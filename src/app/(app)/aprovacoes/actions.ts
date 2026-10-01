"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { documentVersions, signatures } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/current-user";
import { recordAudit } from "@/lib/audit";
import { registrarAssinatura } from "@/lib/documenso/signing-flow";
import { moverCampoAssinatura, type PapelAssinatura } from "@/lib/documenso/client";

export type DecisionState = { error?: string };

// Mapeia o status atual da revisão para o papel que deve assinar agora,
// garantindo a ordem sequencial elaborado -> verificado -> aprovado.
const statusToPapel: Record<string, PapelAssinatura | null> = {
  aguardando_elaboracao: "elaborado",
  aguardando_verificacao: "verificado",
  aguardando_aprovacao: "aprovado",
};

const papelLabel: Record<PapelAssinatura, string> = {
  elaborado: "Elaboração",
  verificado: "Verificação",
  aprovado: "Aprovação",
};

// Ordem de assinatura de cada papel no envelope do Documenso.
const ordemPapel: Record<PapelAssinatura, number> = {
  elaborado: 0,
  verificado: 1,
  aprovado: 2,
};

export async function signAction(
  versionId: string,
  decisao: "assinado" | "reprovado",
  _prevState: DecisionState,
  formData: FormData,
): Promise<DecisionState> {
  const user = await requireUser();
  const comentario = String(formData.get("comentario") || "").trim() || null;

  if (decisao === "reprovado" && !comentario) {
    return { error: "Informe o motivo da reprovação." };
  }

  const [version] = await db
    .select()
    .from(documentVersions)
    .where(eq(documentVersions.id, versionId))
    .limit(1);

  if (!version) return { error: "Revisão não encontrada." };

  const papelAtual = statusToPapel[version.status];
  if (!papelAtual) {
    return { error: "Esta revisão não está em etapa de assinatura." };
  }

  // Quem é o responsável designado para o papel atual?
  const responsavelId =
    papelAtual === "elaborado"
      ? version.elaboradorId
      : papelAtual === "verificado"
        ? version.verificadorId
        : version.aprovadorId;

  if (responsavelId !== user.id) {
    return {
      error: `A etapa atual (${papelLabel[papelAtual]}) é de responsabilidade de outra pessoa.`,
    };
  }

  if (decisao === "assinado") {
    // O webhook do Documenso pode ter registrado esta etapa antes deste
    // callback do navegador chegar — se já existe, segue em frente
    // (idempotente), sem mostrar erro. Checa pelo papel da etapa ATUAL, não
    // por "qual papel esta pessoa ocupa": verificador e aprovador podem ser
    // a mesma pessoa, e um lookup por pessoa acharia a assinatura antiga
    // dela numa etapa anterior e abortaria sem nunca registrar a atual.
    const [assinaturaAtual] = await db
      .select({ id: signatures.id })
      .from(signatures)
      .where(and(eq(signatures.documentVersionId, versionId), eq(signatures.papel, papelAtual)))
      .limit(1);
    if (assinaturaAtual) {
      revalidatePath("/aprovacoes");
      revalidatePath(`/documentos/${version.documentId}`);
      redirect("/aprovacoes");
    }
  }

  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for") ?? hdrs.get("x-real-ip") ?? null;

  await registrarAssinatura({
    version,
    papel: papelAtual,
    signerId: user.id,
    decisao,
    comentario,
    ip,
    origem: "usuario",
  });

  revalidatePath("/aprovacoes");
  revalidatePath(`/documentos/${version.documentId}`);
  redirect("/aprovacoes");
}

export type ReposicionarState = { error?: string; ok?: boolean };

function parsePos(formData: FormData, fallbackX: number, fallbackY: number) {
  const x = Number(formData.get("pos_assinatura_x"));
  const y = Number(formData.get("pos_assinatura_y"));
  const page = Number(formData.get("pos_assinatura_page"));
  return {
    x: Number.isFinite(x) && x >= 0 && x <= 100 ? x : fallbackX,
    y: Number.isFinite(y) && y >= 0 && y <= 100 ? y : fallbackY,
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  };
}

/**
 * Reposiciona o campo de assinatura DA ETAPA ATUAL (a do próprio usuário) no
 * envelope do Documenso, antes dele assinar. Cada responsável só mexe no seu
 * próprio campo, e só enquanto ainda não assinou.
 */
export async function reposicionarAssinaturaAction(
  versionId: string,
  _prevState: ReposicionarState,
  formData: FormData,
): Promise<ReposicionarState> {
  const user = await requireUser();

  const [version] = await db
    .select()
    .from(documentVersions)
    .where(eq(documentVersions.id, versionId))
    .limit(1);
  if (!version) return { error: "Revisão não encontrada." };
  if (!version.documensoEnvelopeId) {
    return { error: "Este documento ainda não tem um envelope de assinatura." };
  }

  const papelAtual = statusToPapel[version.status];
  if (!papelAtual) {
    return { error: "Esta revisão não está em etapa de assinatura." };
  }

  const responsavelId =
    papelAtual === "elaborado"
      ? version.elaboradorId
      : papelAtual === "verificado"
        ? version.verificadorId
        : version.aprovadorId;
  if (responsavelId !== user.id) {
    return { error: "Você não é o responsável pela etapa atual." };
  }

  // Se já assinou esta etapa, o campo está travado no Documenso.
  const [jaAssinou] = await db
    .select({ id: signatures.id })
    .from(signatures)
    .where(and(eq(signatures.documentVersionId, versionId), eq(signatures.papel, papelAtual)))
    .limit(1);
  if (jaAssinou) {
    return { error: "Você já assinou esta etapa — não é possível mais mover a assinatura." };
  }

  const pos = parsePos(formData, 15, 90);

  try {
    await moverCampoAssinatura(version.documensoEnvelopeId, ordemPapel[papelAtual], pos);
  } catch (err) {
    console.error("Falha ao reposicionar assinatura do documento:", err);
    return { error: "Não foi possível ajustar a posição agora. Tente novamente." };
  }

  await recordAudit({
    entityType: "document_version",
    entityId: versionId,
    action: "reposicionar_assinatura",
    actorId: user.id,
    metadata: { papel: papelAtual, ...pos },
  });

  revalidatePath(`/aprovacoes/${versionId}`);
  return { ok: true };
}
