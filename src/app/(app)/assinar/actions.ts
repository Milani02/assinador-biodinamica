"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { avulsos, avulsoSignatarios, profiles } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/current-user";
import { saveAvulsoFile } from "@/lib/files";
import { recordAudit } from "@/lib/audit";
import {
  criarEnvelopeAvulso,
  registrarAssinaturaAvulsaPorSigner,
  type SignatarioAvulso,
} from "@/lib/documenso/avulso-flow";
import {
  moverCampoAssinatura,
  getEnvelope,
  assinarCampoComImagem,
  completarAssinaturaDocumento,
  documentIdFromSecondary,
} from "@/lib/documenso/client";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

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

/** Lê o tamanho escolhido da assinatura (largura/altura em % da página). */
function parseSize(formData: FormData): { width: number; height: number } | undefined {
  const w = Number(formData.get("pos_assinatura_w"));
  const h = Number(formData.get("pos_assinatura_h"));
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return undefined;
  return { width: clamp(w, 4, 60), height: clamp(h, 1, 50) };
}

// IDs dos signatários encaminhados, na ordem (campo oculto com IDs separados por vírgula).
function parseForwardedIds(formData: FormData): string[] {
  const raw = String(formData.get("signatariosIds") || "").trim();
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

export type AvulsoFormState = { error?: string };

export async function criarAvulsoAction(
  _prevState: AvulsoFormState,
  formData: FormData,
): Promise<AvulsoFormState> {
  const user = await requireUser();

  const titulo = String(formData.get("titulo") || "").trim();
  const file = formData.get("arquivo") as File | null;
  const uploaderPos = parsePos(formData, 70, 88);
  const uploaderSize = parseSize(formData);
  const forwardedIds = parseForwardedIds(formData);

  if (!titulo) return { error: "Dê um título para identificar o documento." };
  if (!file || file.size === 0) return { error: "Selecione um arquivo PDF." };
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) return { error: "Apenas arquivos PDF são aceitos." };
  if (file.size > 25 * 1024 * 1024) return { error: "O arquivo excede o limite de 25 MB." };

  // Resolve os encaminhados: preserva a ordem, remove duplicados e o próprio
  // uploader (que já é o primeiro signatário).
  const forwarded: { id: string; nome: string; email: string }[] = [];
  if (forwardedIds.length) {
    const rows = await db
      .select({ id: profiles.id, nome: profiles.nome, email: profiles.email, ativo: profiles.ativo })
      .from(profiles)
      .where(inArray(profiles.id, forwardedIds));
    const byId = new Map(rows.map((p) => [p.id, p]));
    const seen = new Set<string>([user.id]);
    for (const id of forwardedIds) {
      if (seen.has(id)) continue;
      const p = byId.get(id);
      if (!p || !p.ativo) continue;
      seen.add(id);
      forwarded.push({ id: p.id, nome: p.nome, email: p.email });
    }
  }

  // Cadeia de assinatura: ordem 0 = uploader; 1..N = encaminhados.
  const chain = [
    {
      ordem: 0,
      signerId: user.id,
      nome: user.nome,
      email: user.email,
      pos: { x: uploaderPos.x, y: uploaderPos.y, page: uploaderPos.page },
    },
    ...forwarded.map((p, i) => ({
      ordem: i + 1,
      signerId: p.id,
      nome: p.nome,
      email: p.email,
      // Posição padrão escalonada (cada um reposiciona a sua ao assinar).
      pos: { x: clamp(15 + (i + 1) * 18, 15, 82), y: 88, page: 1 },
    })),
  ];

  const saved = await saveAvulsoFile(file);

  const [avulso] = await db
    .insert(avulsos)
    .values({
      uploaderId: user.id,
      titulo,
      arquivoPath: saved.relativePath,
      arquivoNomeOriginal: saved.originalName,
      sha256Hash: saved.sha256Hash,
      status: "pendente",
    })
    .returning({ id: avulsos.id });

  try {
    const pdfBytes = new Uint8Array(await file.arrayBuffer());
    const signatarios: SignatarioAvulso[] = chain.map((c) => ({
      ordem: c.ordem,
      nome: c.nome,
      email: c.email,
      positionX: c.pos.x,
      positionY: c.pos.y,
      page: c.pos.page,
      // Só o uploader (ordem 0) escolhe o tamanho no envio; os demais definem
      // o seu ao assinar. Os encaminhados ficam com o padrão até lá.
      ...(c.ordem === 0 && uploaderSize
        ? { width: uploaderSize.width, height: uploaderSize.height }
        : {}),
    }));
    const { envelopeId, tokensPorOrdem } = await criarEnvelopeAvulso({
      titulo,
      pdfBytes,
      fileName: saved.originalName,
      signatarios,
    });

    await db
      .update(avulsos)
      .set({ documensoEnvelopeId: envelopeId, documensoToken: tokensPorOrdem[0] ?? null })
      .where(eq(avulsos.id, avulso.id));

    await db.insert(avulsoSignatarios).values(
      chain.map((c) => ({
        avulsoId: avulso.id,
        ordem: c.ordem,
        signerId: c.signerId,
        documensoToken: tokensPorOrdem[c.ordem] ?? null,
        status: "pendente" as const,
      })),
    );

    await recordAudit({
      entityType: "avulso",
      entityId: avulso.id,
      action: "criar_avulso",
      actorId: user.id,
      metadata: {
        titulo,
        sha256Hash: saved.sha256Hash,
        envelopeId,
        signatarios: chain.map((c) => ({ ordem: c.ordem, signerId: c.signerId })),
      },
    });

    // Assina o uploader (ordem 0) já na tela de envio, se ele tem assinatura
    // fixa. Falha aqui não desfaz o envio — ele ainda pode assinar depois.
    if (user.assinaturaImagem) {
      try {
        const token0 = tokensPorOrdem[0];
        const envelope = await getEnvelope(envelopeId);
        const rec = envelope.recipients.find((r) => r.signingOrder === 0);
        const campos = rec
          ? envelope.fields.filter((f) => f.recipientId === rec.id && f.type === "SIGNATURE")
          : [];
        if (token0 && rec && campos.length) {
          for (const campo of campos) {
            await assinarCampoComImagem(token0, campo.id, user.assinaturaImagem);
          }
          await completarAssinaturaDocumento(
            token0,
            documentIdFromSecondary(envelope.secondaryId),
          );
          await registrarAssinaturaAvulsaPorSigner(avulso.id, user.id, "usuario");
        }
      } catch (signErr) {
        console.error("Falha ao assinar o uploader no envio (segue sem assinar):", signErr);
      }
    }
  } catch (err) {
    // Apaga o avulso (cascade remove os signatários) para permitir nova tentativa.
    await db.delete(avulsos).where(eq(avulsos.id, avulso.id));
    console.error("Falha ao criar envelope avulso no Documenso:", err);
    return {
      error: "Não foi possível iniciar a assinatura (Documenso). Tente novamente em instantes.",
    };
  }

  revalidatePath("/assinar");
  redirect(`/assinar/${avulso.id}`);
}

export type ReposicionarState = { error?: string; ok?: boolean };

/**
 * Move o campo de assinatura DO PRÓPRIO usuário no envelope, antes dele assinar.
 * Cada signatário mexe só na sua assinatura e só enquanto não assinou.
 */
export async function reposicionarAvulsoAction(
  id: string,
  _prevState: ReposicionarState,
  formData: FormData,
): Promise<ReposicionarState> {
  const user = await requireUser();

  const [avulso] = await db.select().from(avulsos).where(eq(avulsos.id, id)).limit(1);
  if (!avulso || !avulso.documensoEnvelopeId) {
    return { error: "Documento não encontrado." };
  }
  if (avulso.status === "assinado") {
    return { error: "Este documento já foi assinado." };
  }

  const [sig] = await db
    .select()
    .from(avulsoSignatarios)
    .where(and(eq(avulsoSignatarios.avulsoId, id), eq(avulsoSignatarios.signerId, user.id)))
    .orderBy(asc(avulsoSignatarios.ordem))
    .limit(1);
  if (!sig) return { error: "Você não é signatário deste documento." };
  if (sig.status === "assinado") {
    return { error: "Você já assinou — não é possível mais mover a assinatura." };
  }

  const pos = parsePos(formData, 70, 88);

  try {
    await moverCampoAssinatura(avulso.documensoEnvelopeId, sig.ordem, pos);
  } catch (err) {
    console.error("Falha ao reposicionar assinatura avulsa:", err);
    return { error: "Não foi possível ajustar a posição. Tente novamente." };
  }

  await recordAudit({
    entityType: "avulso_signatario",
    entityId: sig.id,
    action: "reposicionar_assinatura",
    actorId: user.id,
    metadata: { avulsoId: id, ordem: sig.ordem, ...pos },
  });

  revalidatePath(`/assinar/${id}`);
  return { ok: true };
}

export type AssinarState = { error?: string; ok?: boolean };

/**
 * Assina automaticamente a etapa do usuário: injeta a imagem de assinatura
 * fixa dele no campo do Documenso (via tRPC) e conclui a etapa — sem o widget
 * de desenho. Só funciona quando é a vez do usuário e ele tem assinatura
 * cadastrada. Idempotência final fica a cargo de registrarAssinaturaAvulsaPorSigner.
 */
export async function assinarAutomaticoAction(
  id: string,
  pos?: { x: number; y: number; page: number },
  size?: { width: number; height: number },
): Promise<AssinarState> {
  const user = await requireUser();

  if (!user.assinaturaImagem) {
    return { error: "Você ainda não tem uma assinatura cadastrada. Fale com o administrador." };
  }

  const [avulso] = await db.select().from(avulsos).where(eq(avulsos.id, id)).limit(1);
  if (!avulso || !avulso.documensoEnvelopeId) {
    return { error: "Documento não encontrado." };
  }
  if (avulso.status === "assinado") {
    return { error: "Este documento já foi assinado." };
  }

  // Confirma que é a vez do usuário: o primeiro signatário pendente na ordem
  // (Documenso é sequencial) precisa ser ele.
  const fila = await db
    .select()
    .from(avulsoSignatarios)
    .where(eq(avulsoSignatarios.avulsoId, id))
    .orderBy(asc(avulsoSignatarios.ordem));

  const atual = fila.find((s) => s.status === "pendente");
  if (!atual || atual.signerId !== user.id) {
    return { error: "Ainda não é a sua vez de assinar." };
  }
  if (!atual.documensoToken) {
    return { error: "Token de assinatura ausente. Tente novamente em instantes." };
  }

  try {
    // Se o usuário escolheu a posição/tamanho na hora, move o campo antes de assinar.
    if (pos) {
      await moverCampoAssinatura(avulso.documensoEnvelopeId, atual.ordem, pos, size);
    }
    // Descobre o(s) campo(s) SIGNATURE do destinatário desta ordem.
    const envelope = await getEnvelope(avulso.documensoEnvelopeId);
    const rec = envelope.recipients.find((r) => r.signingOrder === atual.ordem);
    if (!rec) {
      return { error: "Destinatário não encontrado no envelope." };
    }
    const campos = envelope.fields.filter(
      (f) => f.recipientId === rec.id && f.type === "SIGNATURE",
    );
    if (campos.length === 0) {
      return { error: "Nenhum campo de assinatura encontrado para você." };
    }

    for (const campo of campos) {
      await assinarCampoComImagem(atual.documensoToken, campo.id, user.assinaturaImagem);
    }
    await completarAssinaturaDocumento(
      atual.documensoToken,
      documentIdFromSecondary(envelope.secondaryId),
    );
  } catch (err) {
    console.error("Falha ao assinar automaticamente (avulso):", err);
    return { error: "Não foi possível assinar agora. Tente novamente em instantes." };
  }

  // Atualiza status local + auditoria + conclui o avulso se todos assinaram.
  await registrarAssinaturaAvulsaPorSigner(id, user.id, "usuario");

  revalidatePath("/assinar");
  revalidatePath(`/assinar/${id}`);
  return { ok: true };
}

/**
 * Versão para <form>: lê a posição escolhida (arrastada sobre o PDF) e assina
 * naquele ponto, num passo só. Usada na tela unificada de assinatura.
 */
export async function assinarComPosicaoAction(
  id: string,
  _prevState: AssinarState,
  formData: FormData,
): Promise<AssinarState> {
  const pos = parsePos(formData, 70, 88);
  const size = parseSize(formData);
  return assinarAutomaticoAction(id, pos, size);
}

export async function marcarAvulsoAssinadoAction(id: string) {
  const user = await requireUser();

  const [avulso] = await db.select().from(avulsos).where(eq(avulsos.id, id)).limit(1);
  if (!avulso) return;

  await registrarAssinaturaAvulsaPorSigner(id, user.id, "usuario");
  revalidatePath("/assinar");
  revalidatePath(`/assinar/${id}`);
}
