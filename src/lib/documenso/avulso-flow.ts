import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { avulsos, avulsoSignatarios } from "@/lib/db/schema";
import { recordAudit } from "@/lib/audit";
import { createEnvelope, distributeEnvelope } from "./client";

export interface SignatarioAvulso {
  /** 0 = quem fez o upload (assina primeiro); 1..N = encaminhados, na ordem. */
  ordem: number;
  nome: string;
  email: string;
  positionX: number;
  positionY: number;
  page: number;
  /** Tamanho do campo (% da página). Padrão 25×6 se omitido. */
  width?: number;
  height?: number;
}

/**
 * Cria (e distribui) o envelope de uma assinatura avulsa com um ou mais
 * signatários em ordem sequencial. O idioma é pt-BR, então o certificado e a
 * trilha de auditoria anexados nas últimas páginas saem em português.
 * Retorna o token de assinatura embutida de cada signatário, por ordem.
 */
export async function criarEnvelopeAvulso(params: {
  titulo: string;
  pdfBytes: Uint8Array;
  fileName: string;
  signatarios: SignatarioAvulso[];
}): Promise<{ envelopeId: string; tokensPorOrdem: Record<number, string> }> {
  const signatariosEnvelope = params.signatarios.map((s) => ({
    papel: `s${s.ordem}`,
    nome: s.nome,
    email: s.email,
    ordem: s.ordem,
    positionX: s.positionX,
    positionY: s.positionY,
    page: s.page,
    width: s.width,
    height: s.height,
  }));

  const { envelopeId } = await createEnvelope({
    title: params.titulo,
    pdfBytes: params.pdfBytes,
    fileName: params.fileName,
    signatarios: signatariosEnvelope,
    language: "pt-BR",
  });

  const distribuidos = await distributeEnvelope(envelopeId, signatariosEnvelope);
  const tokensPorOrdem: Record<number, string> = {};
  for (const d of distribuidos) {
    if (d.ordem != null) tokensPorOrdem[d.ordem] = d.signingToken;
  }
  return { envelopeId, tokensPorOrdem };
}

/**
 * Marca o avulso como concluído (assinado) somente quando TODOS os signatários
 * já assinaram. Idempotente.
 */
async function finalizarSeCompleto(avulsoId: string): Promise<boolean> {
  const pendentes = await db
    .select({ id: avulsoSignatarios.id })
    .from(avulsoSignatarios)
    .where(
      and(eq(avulsoSignatarios.avulsoId, avulsoId), eq(avulsoSignatarios.status, "pendente")),
    )
    .limit(1);
  if (pendentes.length > 0) return false;

  const [av] = await db.select().from(avulsos).where(eq(avulsos.id, avulsoId)).limit(1);
  if (!av || av.status === "assinado") return true;

  await db
    .update(avulsos)
    .set({ status: "assinado", assinadoEm: new Date() })
    .where(eq(avulsos.id, avulsoId));

  await recordAudit({
    entityType: "avulso",
    entityId: avulsoId,
    action: "concluir_avulso",
    actorId: av.uploaderId,
    metadata: { titulo: av.titulo, sha256Hash: av.sha256Hash },
  });
  return true;
}

/**
 * Registra a assinatura de um signatário avulso identificado pelo token do
 * Documenso (usado pelo webhook). Depois tenta concluir o avulso. Idempotente.
 */
export async function registrarAssinaturaAvulsaPorToken(
  token: string,
  origem: "usuario" | "webhook_documenso",
): Promise<{ jaRegistrado: boolean }> {
  const [sig] = await db
    .select()
    .from(avulsoSignatarios)
    .where(eq(avulsoSignatarios.documensoToken, token))
    .limit(1);
  if (!sig) return { jaRegistrado: false };
  if (sig.status === "assinado") return { jaRegistrado: true };

  await db
    .update(avulsoSignatarios)
    .set({ status: "assinado", assinadoEm: new Date() })
    .where(eq(avulsoSignatarios.id, sig.id));

  await recordAudit({
    entityType: "avulso_signatario",
    entityId: sig.id,
    action: "assinar_avulso",
    actorId: sig.signerId,
    metadata: { avulsoId: sig.avulsoId, ordem: sig.ordem, origem },
  });

  await finalizarSeCompleto(sig.avulsoId);
  return { jaRegistrado: false };
}

/**
 * Registra a assinatura da etapa atual de um usuário num avulso (usado pelo
 * callback do navegador). Marca a menor ordem pendente daquele signatário.
 * Idempotente.
 */
export async function registrarAssinaturaAvulsaPorSigner(
  avulsoId: string,
  signerId: string,
  origem: "usuario" | "webhook_documenso",
): Promise<{ jaRegistrado: boolean }> {
  const [sig] = await db
    .select()
    .from(avulsoSignatarios)
    .where(
      and(
        eq(avulsoSignatarios.avulsoId, avulsoId),
        eq(avulsoSignatarios.signerId, signerId),
        eq(avulsoSignatarios.status, "pendente"),
      ),
    )
    .orderBy(asc(avulsoSignatarios.ordem))
    .limit(1);
  if (!sig) return { jaRegistrado: true };

  await db
    .update(avulsoSignatarios)
    .set({ status: "assinado", assinadoEm: new Date() })
    .where(eq(avulsoSignatarios.id, sig.id));

  await recordAudit({
    entityType: "avulso_signatario",
    entityId: sig.id,
    action: "assinar_avulso",
    actorId: signerId,
    metadata: { avulsoId, ordem: sig.ordem, origem },
  });

  await finalizarSeCompleto(avulsoId);
  return { jaRegistrado: false };
}
