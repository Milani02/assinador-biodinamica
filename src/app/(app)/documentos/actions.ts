"use server";

import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { documentVersions, documents } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/current-user";
import { saveUploadedFile } from "@/lib/files";
import { recordAudit } from "@/lib/audit";
import { criarEnvelopeAssinatura, marcarEnvelopeNaVersao } from "@/lib/documenso/integration";

export type DocumentFormState = { error?: string };

function validatePdf(file: File | null): string | null {
  if (!file || file.size === 0) {
    return "Selecione um arquivo PDF.";
  }
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) {
    return "Apenas arquivos PDF são aceitos.";
  }
  if (file.size > 25 * 1024 * 1024) {
    return "O arquivo excede o limite de 25 MB.";
  }
  return null;
}

function parsePos(formData: FormData, key: string, fallbackX: number, fallbackY: number) {
  const x = Number(formData.get(`pos_${key}_x`));
  const y = Number(formData.get(`pos_${key}_y`));
  const page = Number(formData.get(`pos_${key}_page`));
  return {
    x: Number.isFinite(x) && x >= 0 && x <= 100 ? x : fallbackX,
    y: Number.isFinite(y) && y >= 0 && y <= 100 ? y : fallbackY,
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  };
}

function validateRoles(
  elaboradorId: string,
  verificadorId: string,
  aprovadorId: string,
): string | null {
  if (!verificadorId || !aprovadorId) {
    return "Selecione o verificador e o aprovador.";
  }
  if (verificadorId === elaboradorId || aprovadorId === elaboradorId) {
    return "Quem elaborou o documento não pode ser o verificador nem o aprovador.";
  }
  return null;
}

export async function createDocumentAction(
  _prevState: DocumentFormState,
  formData: FormData,
): Promise<DocumentFormState> {
  const user = await requireUser();

  const codigo = String(formData.get("codigo") || "").trim();
  const titulo = String(formData.get("titulo") || "").trim();
  const categoria = String(formData.get("categoria") || "").trim() || null;
  const revisao = String(formData.get("revisao") || "").trim();
  // Quem sobe o documento é automaticamente o elaborador dele — não é mais
  // escolhido no formulário.
  const elaboradorId = user.id;
  const verificadorId = String(formData.get("verificadorId") || "");
  const aprovadorId = String(formData.get("aprovadorId") || "");
  const file = formData.get("arquivo") as File | null;

  if (!codigo || !titulo || !revisao) {
    return { error: "Preencha código, título e revisão." };
  }
  const roleError = validateRoles(elaboradorId, verificadorId, aprovadorId);
  if (roleError) return { error: roleError };
  const fileError = validatePdf(file);
  if (fileError) return { error: fileError };

  let documentId: string;
  try {
    const [doc] = await db
      .insert(documents)
      .values({ codigo, titulo, categoria })
      .returning({ id: documents.id });
    documentId = doc.id;
  } catch {
    return { error: "Já existe um documento com esse código." };
  }

  const saved = await saveUploadedFile(file!);

  const [version] = await db
    .insert(documentVersions)
    .values({
      documentId,
      revisao,
      arquivoPath: saved.relativePath,
      arquivoNomeOriginal: saved.originalName,
      sha256Hash: saved.sha256Hash,
      status: "aguardando_elaboracao",
      enviadoPorId: user.id,
      elaboradorId,
      verificadorId,
      aprovadorId,
    })
    .returning({ id: documentVersions.id });

  await recordAudit({
    entityType: "document",
    entityId: documentId,
    action: "criar_documento",
    actorId: user.id,
    metadata: { codigo, titulo, revisao },
  });
  await recordAudit({
    entityType: "document_version",
    entityId: version.id,
    action: "enviar_revisao",
    actorId: user.id,
    metadata: { revisao, sha256Hash: saved.sha256Hash, elaboradorId, verificadorId, aprovadorId },
  });

  try {
    const pdfBytes = new Uint8Array(await file!.arrayBuffer());
    const envelope = await criarEnvelopeAssinatura({
      codigo,
      titulo,
      revisao,
      pdfBytes,
      fileName: saved.originalName,
      elaboradorId,
      verificadorId,
      aprovadorId,
      posicoes: {
        elaborado: parsePos(formData, "elaborado", 15, 90),
        verificado: parsePos(formData, "verificado", 45, 90),
        aprovado: parsePos(formData, "aprovado", 75, 90),
      },
    });
    await marcarEnvelopeNaVersao(version.id, envelope);
    await recordAudit({
      entityType: "document_version",
      entityId: version.id,
      action: "criar_envelope_documenso",
      actorId: user.id,
      metadata: { envelopeId: envelope.envelopeId },
    });
  } catch (err) {
    // Desfaz o documento criado para permitir nova tentativa com o mesmo código.
    await db.delete(documentVersions).where(eq(documentVersions.id, version.id));
    await db.delete(documents).where(eq(documents.id, documentId));
    console.error("Falha ao criar envelope no Documenso:", err);
    return {
      error:
        "Não foi possível iniciar o fluxo de assinatura eletrônica (Documenso). Tente novamente em instantes.",
    };
  }

  revalidatePath("/documentos");
  redirect(`/documentos/${documentId}`);
}

export async function createRevisionAction(
  documentId: string,
  _prevState: DocumentFormState,
  formData: FormData,
): Promise<DocumentFormState> {
  const user = await requireUser();

  const revisao = String(formData.get("revisao") || "").trim();
  // Quem sobe a revisão é automaticamente o elaborador dela — não é mais
  // escolhido no formulário.
  const elaboradorId = user.id;
  const verificadorId = String(formData.get("verificadorId") || "");
  const aprovadorId = String(formData.get("aprovadorId") || "");
  const file = formData.get("arquivo") as File | null;

  if (!revisao) {
    return { error: "Informe o número da revisão." };
  }
  const roleError = validateRoles(elaboradorId, verificadorId, aprovadorId);
  if (roleError) return { error: roleError };
  const fileError = validatePdf(file);
  if (fileError) return { error: fileError };

  const [existingSameRevisao] = await db
    .select({ id: documentVersions.id })
    .from(documentVersions)
    .where(
      and(eq(documentVersions.documentId, documentId), eq(documentVersions.revisao, revisao)),
    )
    .limit(1);
  if (existingSameRevisao) {
    return { error: "Já existe uma revisão com esse número para este documento." };
  }

  const emAndamento = ["aguardando_elaboracao", "aguardando_verificacao", "aguardando_aprovacao"];
  const versions = await db
    .select({ status: documentVersions.status })
    .from(documentVersions)
    .where(eq(documentVersions.documentId, documentId));
  if (versions.some((v) => emAndamento.includes(v.status))) {
    return { error: "Já existe uma revisão deste documento em andamento no fluxo de assinaturas." };
  }

  const saved = await saveUploadedFile(file!);

  const [version] = await db
    .insert(documentVersions)
    .values({
      documentId,
      revisao,
      arquivoPath: saved.relativePath,
      arquivoNomeOriginal: saved.originalName,
      sha256Hash: saved.sha256Hash,
      status: "aguardando_elaboracao",
      enviadoPorId: user.id,
      elaboradorId,
      verificadorId,
      aprovadorId,
    })
    .returning({ id: documentVersions.id });

  await recordAudit({
    entityType: "document_version",
    entityId: version.id,
    action: "enviar_revisao",
    actorId: user.id,
    metadata: { revisao, sha256Hash: saved.sha256Hash, elaboradorId, verificadorId, aprovadorId },
  });

  const [doc] = await db
    .select({ codigo: documents.codigo, titulo: documents.titulo })
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);

  try {
    const pdfBytes = new Uint8Array(await file!.arrayBuffer());
    const envelope = await criarEnvelopeAssinatura({
      codigo: doc!.codigo,
      titulo: doc!.titulo,
      revisao,
      pdfBytes,
      fileName: saved.originalName,
      elaboradorId,
      verificadorId,
      aprovadorId,
      posicoes: {
        elaborado: parsePos(formData, "elaborado", 15, 90),
        verificado: parsePos(formData, "verificado", 45, 90),
        aprovado: parsePos(formData, "aprovado", 75, 90),
      },
    });
    await marcarEnvelopeNaVersao(version.id, envelope);
    await recordAudit({
      entityType: "document_version",
      entityId: version.id,
      action: "criar_envelope_documenso",
      actorId: user.id,
      metadata: { envelopeId: envelope.envelopeId },
    });
  } catch (err) {
    await db.delete(documentVersions).where(eq(documentVersions.id, version.id));
    console.error("Falha ao criar envelope no Documenso:", err);
    return {
      error:
        "Não foi possível iniciar o fluxo de assinatura eletrônica (Documenso). Tente novamente em instantes.",
    };
  }

  revalidatePath(`/documentos/${documentId}`);
  redirect(`/documentos/${documentId}`);
}

export type VerifyState =
  | { status: "idle" }
  | { status: "error"; error: string }
  | {
      status: "match";
      hash: string;
      revisao: string;
      versionStatus: string;
      arquivoNome: string;
    }
  | { status: "no_match"; hash: string };

export async function verifyIntegrityAction(
  documentId: string,
  _prevState: VerifyState,
  formData: FormData,
): Promise<VerifyState> {
  await requireUser();

  const file = formData.get("arquivo") as File | null;
  const fileError = validatePdf(file);
  if (fileError) return { status: "error", error: fileError };

  const buffer = Buffer.from(await file!.arrayBuffer());
  const hash = createHash("sha256").update(buffer).digest("hex");

  const versions = await db
    .select({
      revisao: documentVersions.revisao,
      status: documentVersions.status,
      sha256Hash: documentVersions.sha256Hash,
      arquivoNomeOriginal: documentVersions.arquivoNomeOriginal,
    })
    .from(documentVersions)
    .where(eq(documentVersions.documentId, documentId));

  const match = versions.find((v) => v.sha256Hash === hash);

  if (!match) {
    return { status: "no_match", hash };
  }

  return {
    status: "match",
    hash,
    revisao: match.revisao,
    versionStatus: match.status,
    arquivoNome: match.arquivoNomeOriginal,
  };
}
