import { createHash } from "node:crypto";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { auditLog } from "@/lib/db/schema";

const GENESIS_HASH = "0".repeat(64);

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

  const payload = JSON.stringify({
    entityType: params.entityType,
    entityId: params.entityId,
    action: params.action,
    actorId: params.actorId,
    metadata,
    createdAt: createdAt.toISOString(),
    prevHash,
  });
  const rowHash = createHash("sha256").update(payload).digest("hex");

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
