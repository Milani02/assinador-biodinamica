import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { documentVersions, documents, profiles, signatures } from "@/lib/db/schema";
import { recordAudit } from "@/lib/audit";
import { gerarProtocoloPdf } from "@/lib/pdf/protocolo";
import { saveProtocolFile } from "@/lib/files";
import type { PapelAssinatura } from "./client";

const papelLabel: Record<PapelAssinatura, string> = {
  elaborado: "Elaboração",
  verificado: "Verificação",
  aprovado: "Aprovação",
};

type DocumentVersionRow = typeof documentVersions.$inferSelect;

/**
 * Registra a decisão (assinado/reprovado) de uma etapa e, se for assinatura,
 * avança o fluxo sequencial (ou torna a revisão vigente e gera o protocolo).
 *
 * Idempotente por (documentVersionId, papel): se a etapa já tiver uma
 * assinatura registrada — por exemplo, o webhook do Documenso e o callback
 * do navegador chegando quase juntos — a segunda chamada é um no-op seguro.
 */
export async function registrarAssinatura(params: {
  version: DocumentVersionRow;
  papel: PapelAssinatura;
  signerId: string;
  decisao: "assinado" | "reprovado";
  comentario: string | null;
  ip: string | null;
  origem: "usuario" | "webhook_documenso";
}): Promise<{ jaRegistrado: boolean }> {
  const { version, papel, signerId, decisao, comentario, ip, origem } = params;

  const [existente] = await db
    .select({ id: signatures.id })
    .from(signatures)
    .where(
      and(eq(signatures.documentVersionId, version.id), eq(signatures.papel, papel)),
    )
    .limit(1);
  if (existente) {
    return { jaRegistrado: true };
  }

  await db.insert(signatures).values({
    documentVersionId: version.id,
    papel,
    signerId,
    decisao,
    comentario,
    ip,
  });

  if (decisao === "reprovado") {
    await db
      .update(documentVersions)
      .set({ status: "reprovado" })
      .where(eq(documentVersions.id, version.id));

    await recordAudit({
      entityType: "document_version",
      entityId: version.id,
      action: "reprovar",
      actorId: signerId,
      metadata: { papel, comentario, sha256Hash: version.sha256Hash, origem },
    });

    return { jaRegistrado: false };
  }

  let novoStatus: DocumentVersionRow["status"];
  if (papel === "elaborado") novoStatus = "aguardando_verificacao";
  else if (papel === "verificado") novoStatus = "aguardando_aprovacao";
  else novoStatus = "vigente";

  await recordAudit({
    entityType: "document_version",
    entityId: version.id,
    action: `assinar_${papel}`,
    actorId: signerId,
    metadata: { papel, comentario, sha256Hash: version.sha256Hash, origem },
  });

  if (novoStatus === "vigente") {
    const [doc] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, version.documentId))
      .limit(1);

    const assinaturas = await db
      .select({
        papel: signatures.papel,
        decisao: signatures.decisao,
        comentario: signatures.comentario,
        assinadoEm: signatures.assinadoEm,
        nome: profiles.nome,
        email: profiles.email,
      })
      .from(signatures)
      .innerJoin(profiles, eq(profiles.id, signatures.signerId))
      .where(eq(signatures.documentVersionId, version.id));

    const ordem: PapelAssinatura[] = ["elaborado", "verificado", "aprovado"];
    const linhas = ordem
      .map((p) => assinaturas.find((a) => a.papel === p))
      .filter((a): a is NonNullable<typeof a> => Boolean(a))
      .map((a) => ({
        papel: papelLabel[a.papel as PapelAssinatura],
        nome: a.nome,
        email: a.email,
        assinadoEm: a.assinadoEm,
      }));

    const pdfBytes = await gerarProtocoloPdf({
      codigo: doc!.codigo,
      titulo: doc!.titulo,
      revisao: version.revisao,
      sha256Hash: version.sha256Hash,
      protocoloId: version.id,
      assinaturas: linhas,
    });
    const protocoloPath = await saveProtocolFile(`${version.id}.pdf`, pdfBytes);

    await db
      .update(documentVersions)
      .set({ status: "substituido" })
      .where(
        and(
          eq(documentVersions.documentId, version.documentId),
          eq(documentVersions.status, "vigente"),
        ),
      );

    await db
      .update(documentVersions)
      .set({ status: "vigente", protocoloPath })
      .where(eq(documentVersions.id, version.id));

    await recordAudit({
      entityType: "document_version",
      entityId: version.id,
      action: "tornar_vigente",
      actorId: signerId,
      metadata: { protocoloId: version.id, sha256Hash: version.sha256Hash, origem },
    });
  } else {
    await db
      .update(documentVersions)
      .set({ status: novoStatus })
      .where(eq(documentVersions.id, version.id));
  }

  return { jaRegistrado: false };
}
