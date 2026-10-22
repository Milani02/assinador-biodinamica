import { createHash } from "node:crypto";
import { asc, desc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { auditLog } from "@/lib/db/schema";

const GENESIS_HASH = "0".repeat(64);

// JSON com as chaves em ordem alfabética (em todos os níveis). A coluna
// `metadata` é jsonb, e o Postgres reordena as chaves ao gravar; sem uma forma
// canônica, o hash não poderia ser recalculado a partir do que está no banco.
function jsonCanonico(valor: unknown): string {
  return JSON.stringify(valor, (_chave, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v,
  );
}

interface CamposHash {
  entityType: string;
  entityId: string;
  action: string;
  actorId: string | null;
  metadata: unknown;
  createdAt: Date;
  prevHash: string;
}

export function calcularHash(c: CamposHash): string {
  const payload = jsonCanonico({
    entityType: c.entityType,
    entityId: c.entityId,
    action: c.action,
    actorId: c.actorId,
    metadata: c.metadata ?? null,
    createdAt: c.createdAt.toISOString(),
    prevHash: c.prevHash,
  });
  return createHash("sha256").update(payload).digest("hex");
}

// Formato usado até out/2026: campos na ordem de declaração e metadata na
// ordem original. Só confere quando o jsonb não reordenou o metadata.
export function calcularHashLegado(c: CamposHash): string {
  const payload = JSON.stringify({
    entityType: c.entityType,
    entityId: c.entityId,
    action: c.action,
    actorId: c.actorId,
    metadata: c.metadata ?? null,
    createdAt: c.createdAt.toISOString(),
    prevHash: c.prevHash,
  });
  return createHash("sha256").update(payload).digest("hex");
}

// Cadeia de hash: cada registro inclui o hash do anterior, então qualquer
// alteração retroativa no histórico quebra a cadeia — é o que torna a
// trilha de auditoria defensável (item central para a NC 06).
export async function recordAudit(params: {
  entityType: string;
  entityId: string;
  action: string;
  actorId: string | null;
  metadata?: Record<string, unknown>;
}) {
  const [last] = await db
    .select({ rowHash: auditLog.rowHash })
    .from(auditLog)
    .orderBy(desc(auditLog.createdAt))
    .limit(1);

  const prevHash = last?.rowHash ?? GENESIS_HASH;
  const createdAt = new Date();
  const metadata = params.metadata ?? null;
  const rowHash = calcularHash({ ...params, metadata, createdAt, prevHash });

  await db.insert(auditLog).values({
    entityType: params.entityType,
    entityId: params.entityId,
    action: params.action,
    actorId: params.actorId,
    metadata,
    prevHash,
    rowHash,
    createdAt,
  });
}

/**
 * Situação de cada registro na verificação da cadeia:
 * - "integro": aponta para o registro anterior e o hash recalculado confere;
 * - "encadeado": aponta para o anterior, mas o hash não pôde ser recalculado
 *   (registro gravado antes do JSON canônico — a ordem original das chaves se
 *   perdeu no jsonb);
 * - "quebrado": não aponta para o hash do registro anterior.
 */
export type SituacaoRegistro = "integro" | "encadeado" | "quebrado";

export interface ResultadoCadeia {
  total: number;
  integros: number;
  encadeados: number;
  quebrados: number;
  situacao: Map<string, SituacaoRegistro>;
}

/** Percorre toda a trilha em ordem cronológica e confere a cadeia de hash. */
export async function verificarCadeiaAuditoria(): Promise<ResultadoCadeia> {
  const linhas = await db.select().from(auditLog).orderBy(asc(auditLog.createdAt));
  const situacao = new Map<string, SituacaoRegistro>();
  let anterior = GENESIS_HASH;
  let integros = 0;
  let encadeados = 0;
  let quebrados = 0;

  for (const l of linhas) {
    let s: SituacaoRegistro;
    if (l.prevHash !== anterior) {
      s = "quebrado";
      quebrados++;
    } else if (calcularHash(l) === l.rowHash || calcularHashLegado(l) === l.rowHash) {
      s = "integro";
      integros++;
    } else {
      s = "encadeado";
      encadeados++;
    }
    situacao.set(l.id, s);
    anterior = l.rowHash;
  }

  return { total: linhas.length, integros, encadeados, quebrados, situacao };
}
