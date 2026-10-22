import { and, desc, eq, gte, ilike, lte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { documentVersions, documents, profiles, signatures } from "@/lib/db/schema";
import { fimDoDia, inicioDoDia } from "@/lib/datas";

export interface AuditoriaFilters {
  codigo?: string;
  signatarioId?: string;
  papel?: "elaborado" | "verificado" | "aprovado";
  decisao?: "assinado" | "reprovado";
  de?: string;
  ate?: string;
}

export function buscarRegistrosAuditoria(filters: AuditoriaFilters) {
  const conditions = [];
  if (filters.codigo) conditions.push(ilike(documents.codigo, `%${filters.codigo}%`));
  if (filters.signatarioId) conditions.push(eq(signatures.signerId, filters.signatarioId));
  if (filters.papel) conditions.push(eq(signatures.papel, filters.papel));
  if (filters.decisao) conditions.push(eq(signatures.decisao, filters.decisao));
  if (filters.de) conditions.push(gte(signatures.assinadoEm, inicioDoDia(filters.de)));
  if (filters.ate) conditions.push(lte(signatures.assinadoEm, fimDoDia(filters.ate)));

  return db
    .select({
      signatureId: signatures.id,
      versionId: documentVersions.id,
      codigo: documents.codigo,
      titulo: documents.titulo,
      revisao: documentVersions.revisao,
      papel: signatures.papel,
      decisao: signatures.decisao,
      comentario: signatures.comentario,
      assinadoEm: signatures.assinadoEm,
      signatarioNome: profiles.nome,
      sha256Hash: documentVersions.sha256Hash,
      protocoloPath: documentVersions.protocoloPath,
    })
    .from(signatures)
    .innerJoin(documentVersions, eq(documentVersions.id, signatures.documentVersionId))
    .innerJoin(documents, eq(documents.id, documentVersions.documentId))
    .innerJoin(profiles, eq(profiles.id, signatures.signerId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(signatures.assinadoEm));
}
