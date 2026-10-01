import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { documentVersions, profiles } from "@/lib/db/schema";
import {
  createEnvelope,
  distributeEnvelope,
  type PapelAssinatura,
  type SignatarioEnvelope,
} from "./client";

const ordemPapel: Record<PapelAssinatura, number> = {
  elaborado: 0,
  verificado: 1,
  aprovado: 2,
};

export interface EnvelopeCriado {
  envelopeId: string;
  tokens: Record<PapelAssinatura, string>;
}

/**
 * Cria o envelope no Documenso para uma revisão de documento e já envia
 * para o fluxo de assinatura sequencial (elaborado -> verificado -> aprovado).
 * Lança erro se a criação falhar — quem chama decide como reverter.
 */
export async function criarEnvelopeAssinatura(params: {
  codigo: string;
  titulo: string;
  revisao: string;
  pdfBytes: Uint8Array;
  fileName: string;
  elaboradorId: string;
  verificadorId: string;
  aprovadorId: string;
  /** Posição (%) e página de cada campo de assinatura, escolhidas pelo usuário. */
  posicoes: Record<PapelAssinatura, { x: number; y: number; page: number }>;
}): Promise<EnvelopeCriado> {
  const ids = [params.elaboradorId, params.verificadorId, params.aprovadorId];
  const pessoas = await db
    .select({ id: profiles.id, nome: profiles.nome, email: profiles.email })
    .from(profiles)
    .where(inArray(profiles.id, ids));

  const porId = new Map(pessoas.map((p) => [p.id, p]));
  const papeis: { papel: PapelAssinatura; id: string }[] = [
    { papel: "elaborado", id: params.elaboradorId },
    { papel: "verificado", id: params.verificadorId },
    { papel: "aprovado", id: params.aprovadorId },
  ];

  const signatarios: SignatarioEnvelope[] = papeis.map(({ papel, id }) => {
    const pessoa = porId.get(id);
    if (!pessoa) throw new Error(`Usuário ${id} não encontrado para o papel ${papel}.`);
    const pos = params.posicoes[papel];
    return {
      papel,
      nome: pessoa.nome,
      email: pessoa.email,
      ordem: ordemPapel[papel],
      positionX: pos.x,
      positionY: pos.y,
      page: pos.page,
    };
  });

  const { envelopeId } = await createEnvelope({
    title: `${params.codigo} — ${params.titulo} (rev. ${params.revisao})`,
    pdfBytes: params.pdfBytes,
    fileName: params.fileName,
    signatarios,
  });

  const distribuidos = await distributeEnvelope(envelopeId, signatarios);

  const tokens = Object.fromEntries(
    distribuidos.map((d) => [d.papel, d.signingToken]),
  ) as Record<PapelAssinatura, string>;

  return { envelopeId, tokens };
}

export async function marcarEnvelopeNaVersao(
  versionId: string,
  envelope: EnvelopeCriado,
) {
  await db
    .update(documentVersions)
    .set({
      documensoEnvelopeId: envelope.envelopeId,
      documensoTokenElaborador: envelope.tokens.elaborado,
      documensoTokenVerificador: envelope.tokens.verificado,
      documensoTokenAprovador: envelope.tokens.aprovado,
    })
    .where(eq(documentVersions.id, versionId));
}
