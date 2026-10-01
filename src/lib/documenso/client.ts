// Cliente da API do Documenso (self-hosted em https://digital.biodinamica.com.br).
// Referência: /api/v2, header `Authorization: <token>` (sem prefixo "Bearer").
// Endpoints confirmados no código-fonte oficial (packages/trpc/server/envelope-router).

const BASE_URL = process.env.DOCUMENSO_API_URL; // ex: https://digital.biodinamica.com.br/api/v2
const API_TOKEN = process.env.DOCUMENSO_API_TOKEN;

function assertConfigured() {
  if (!BASE_URL || !API_TOKEN) {
    throw new Error(
      "DOCUMENSO_API_URL e DOCUMENSO_API_TOKEN precisam estar definidos no ambiente.",
    );
  }
}

async function documensoFetch(path: string, init: RequestInit) {
  assertConfigured();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: API_TOKEN!,
      ...init.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Documenso ${init.method ?? "GET"} ${path} falhou (${res.status}): ${body}`);
  }

  return res.json();
}

/**
 * Todos os avisos de e-mail do Documenso desligados. As pessoas assinam logadas
 * no sistema e acompanham tudo na aba Assinar — não usamos e-mail.
 */
export const EMAIL_SETTINGS_OFF = {
  recipientSigningRequest: false,
  recipientRemoved: false,
  recipientSigned: false,
  documentPending: false,
  documentCompleted: false,
  documentDeleted: false,
  ownerDocumentCompleted: false,
  ownerRecipientExpired: false,
  ownerDocumentCreated: false,
} as const;

export type PapelAssinatura = "elaborado" | "verificado" | "aprovado";

export interface SignatarioEnvelope<Papel extends string = PapelAssinatura> {
  papel: Papel;
  nome: string;
  email: string;
  /** Ordem de assinatura: 0 = primeiro a assinar. */
  ordem: number;
  /** Posição do campo de assinatura, em % (0-100) a partir do canto superior esquerdo. */
  positionX: number;
  positionY: number;
  /** Página do PDF (1 = primeira) onde o campo de assinatura entra. */
  page: number;
  /** Largura/altura do campo (% da página). Padrão 25×6 se omitido. */
  width?: number;
  height?: number;
}

export interface CreateEnvelopeResult {
  envelopeId: string;
}

/**
 * Cria um envelope (documento) no Documenso com um PDF e os signatários em
 * ordem sequencial (ex.: elaborado -> verificado -> aprovado, ou uma única
 * pessoa no caso de uma assinatura avulsa). Não envia ainda para assinatura
 * — isso é feito em `distributeEnvelope`.
 */
export async function createEnvelope<Papel extends string = PapelAssinatura>(params: {
  title: string;
  pdfBytes: Uint8Array;
  fileName: string;
  signatarios: SignatarioEnvelope<Papel>[];
  /** Idioma do envelope (ex.: "pt-BR") — traduz e-mails e o certificado/auditoria. */
  language?: string;
  /**
   * Sobrescreve os toggles de e-mail do Documenso. Por padrão TODOS ficam
   * desligados (ver `EMAIL_SETTINGS_OFF`) — nenhum e-mail é enviado.
   */
  emailSettings?: Record<string, boolean>;
}): Promise<CreateEnvelopeResult> {
  const emailSettings = { ...EMAIL_SETTINGS_OFF, ...params.emailSettings };
  const payload = {
    title: params.title,
    type: "DOCUMENT",
    recipients: params.signatarios.map((s) => ({
      email: s.email,
      name: s.nome,
      role: "SIGNER",
      signingOrder: s.ordem,
      fields: [
        {
          type: "SIGNATURE",
          identifier: params.fileName,
          page: s.page,
          positionX: s.positionX,
          positionY: s.positionY,
          width: s.width ?? 25,
          height: s.height ?? 6,
        },
      ],
    })),
    meta: {
      signingOrder: "SEQUENTIAL",
      ...(params.language ? { language: params.language } : {}),
      emailSettings,
    },
  };

  const form = new FormData();
  form.append("payload", JSON.stringify(payload));
  form.append("files", new Blob([new Uint8Array(params.pdfBytes)], { type: "application/pdf" }), params.fileName);

  const data = await documensoFetch("/envelope/create", {
    method: "POST",
    body: form,
  });

  return { envelopeId: data.id };
}

export interface DistributedRecipient<Papel extends string = PapelAssinatura> {
  papel: Papel;
  email: string;
  /** Ordem de assinatura (signingOrder) deste destinatário no envelope. */
  ordem: number | null;
  /** Token usado no componente de assinatura embutida (@documenso/embed-react). */
  signingToken: string;
  signingUrl: string;
}

/**
 * Envia o envelope para o fluxo de assinatura. Retorna, para cada
 * destinatário, o token de assinatura embutida.
 */
export async function distributeEnvelope<Papel extends string = PapelAssinatura>(
  envelopeId: string,
  signatarios: SignatarioEnvelope<Papel>[],
): Promise<DistributedRecipient<Papel>[]> {
  const data = await documensoFetch("/envelope/distribute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ envelopeId }),
  });

  // Correlaciona pelo `ordem`/`signingOrder`, não pelo e-mail: verificador e
  // aprovador podem ser a mesma pessoa (mesmo e-mail em dois destinatários),
  // então usar e-mail como chave perderia um dos dois tokens.
  const porOrdem = new Map(signatarios.map((s) => [s.ordem, s.papel]));

  return (
    data.recipients as Array<{
      email: string;
      token: string;
      signingUrl: string;
      signingOrder: number | null;
    }>
  ).map((r) => ({
    papel: porOrdem.get(r.signingOrder ?? -1)!,
    email: r.email,
    ordem: r.signingOrder,
    signingToken: r.token,
    signingUrl: r.signingUrl,
  }));
}

/** Lista envelopes — usado só para testar se o token de API está válido. */
export async function testConnection(): Promise<{ ok: true; total: number }> {
  const data = await documensoFetch("/envelope?perPage=1", { method: "GET" });
  return { ok: true, total: data.count ?? 0 };
}

export interface EnvelopeRecipient {
  id: number;
  email: string;
  signingOrder: number | null;
  signingStatus?: string;
}

export interface EnvelopeField {
  id: number;
  recipientId: number;
  type: string;
  page: number;
  positionX: string;
  positionY: string;
  width: string;
  height: string;
}

export interface EnvelopeDetails {
  id: string;
  /** ID legível "document_<n>" — o <n> é o documentId numérico usado no tRPC. */
  secondaryId: string;
  status: string;
  envelopeItems: { id: string; title: string }[];
  recipients: EnvelopeRecipient[];
  fields: EnvelopeField[];
}

/** Extrai o documentId numérico do `secondaryId` ("document_26" -> 26). */
export function documentIdFromSecondary(secondaryId: string): number {
  const n = Number(String(secondaryId).replace(/^document_/, ""));
  if (!Number.isInteger(n)) {
    throw new Error(`secondaryId inesperado do Documenso: ${secondaryId}`);
  }
  return n;
}

export async function getEnvelope(envelopeId: string): Promise<EnvelopeDetails> {
  return documensoFetch(`/envelope/${envelopeId}`, { method: "GET" });
}

/**
 * Move o campo de assinatura de um signatário (identificado pela ordem de
 * assinatura) para uma nova posição/página no envelope, SEM recriar o envelope
 * — preservando as assinaturas já coletadas das etapas anteriores.
 *
 * Implementado como apagar + recriar o campo, porque o endpoint de atualização
 * (`/envelope/field/update-many`) desta versão do Documenso descarta as
 * coordenadas (só persiste o fieldMeta). Só funciona enquanto o signatário
 * daquele campo ainda não interagiu com o documento (ou seja, antes de assinar).
 */
export async function moverCampoAssinatura(
  envelopeId: string,
  ordem: number,
  pos: { x: number; y: number; page: number },
  size?: { width: number; height: number },
): Promise<void> {
  const envelope = await getEnvelope(envelopeId);
  const recipient = envelope.recipients.find((r) => r.signingOrder === ordem);
  if (!recipient) {
    throw new Error(`Signatário com ordem ${ordem} não encontrado no envelope.`);
  }
  const campo = envelope.fields.find((f) => f.recipientId === recipient.id);
  if (!campo) {
    throw new Error(`Campo de assinatura do signatário ordem ${ordem} não encontrado.`);
  }

  await documensoFetch("/envelope/field/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fieldId: campo.id }),
  });

  await documensoFetch("/envelope/field/create-many", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      envelopeId,
      data: [
        {
          recipientId: recipient.id,
          type: "SIGNATURE",
          fieldMeta: { type: "signature" },
          page: pos.page,
          positionX: pos.x,
          positionY: pos.y,
          // Usa o tamanho escolhido, ou preserva as dimensões do campo original.
          width: size?.width ?? Number(campo.width) ?? 25,
          height: size?.height ?? Number(campo.height) ?? 6,
        },
      ],
    }),
  });
}

/**
 * Baixa o PDF final de um envelope já concluído — com o selo criptográfico
 * (PAdES) do certificado da empresa aplicado pelo Documenso, não o arquivo
 * original enviado antes da assinatura.
 */
export async function downloadSignedPdf(
  envelopeId: string,
): Promise<{ bytes: Uint8Array; fileName: string }> {
  assertConfigured();
  const envelope = await getEnvelope(envelopeId);
  const [item] = envelope.envelopeItems;
  if (!item) {
    throw new Error(`Envelope ${envelopeId} não tem nenhum arquivo.`);
  }

  const res = await fetch(`${BASE_URL}/envelope/item/${item.id}/download?version=signed`, {
    headers: { Authorization: API_TOKEN! },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Documenso GET download falhou (${res.status}): ${body}`);
  }

  return { bytes: new Uint8Array(await res.arrayBuffer()), fileName: item.title };
}

// --- Assinatura programática (fluxo interno tRPC, o mesmo da página /sign) ---
//
// A API REST v2 NÃO tem endpoint para inserir o valor de um campo (assinar).
// Isso é feito pelas mutations tRPC autenticadas pelo TOKEN do destinatário
// (não pela API key). Contrato confirmado empiricamente contra a instância.

/** Host base do Documenso (sem o sufixo /api/v2), para montar a URL do tRPC. */
function documensoHost(): string {
  assertConfigured();
  return BASE_URL!.replace(/\/api\/v2\/?$/, "");
}

async function trpcMutation(path: string, input: unknown): Promise<unknown> {
  const res = await fetch(`${documensoHost()}/api/trpc/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // Transporte tRPC + superjson: corpo { "json": <input> }.
    body: JSON.stringify({ json: input }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || (data && data.error)) {
    const msg = data?.error?.json?.message ?? (await res.text().catch(() => "")) ?? "";
    throw new Error(`Documenso tRPC ${path} falhou (${res.status}): ${msg}`);
  }
  return data?.result?.data?.json;
}

/**
 * Insere a assinatura (imagem, como data URL) num campo SIGNATURE, usando o
 * token de assinatura do destinatário. Se `value` não for um data URL, o
 * Documenso grava como assinatura digitada (texto).
 */
export async function assinarCampoComImagem(
  token: string,
  fieldId: number,
  value: string,
): Promise<void> {
  await trpcMutation("envelope.field.sign", {
    token,
    fieldId,
    fieldValue: { type: "SIGNATURE", value },
  });
}

/**
 * Conclui a etapa do destinatário (marca como assinado e avança a ordem
 * sequencial). `documentId` é o número extraído do `secondaryId` do envelope.
 */
export async function completarAssinaturaDocumento(
  token: string,
  documentId: number,
): Promise<{ status: string }> {
  const out = (await trpcMutation("recipient.completeDocumentWithToken", {
    token,
    documentId,
  })) as { status: string };
  return out;
}

/**
 * Desliga todos os e-mails de um envelope já existente (documentos em
 * andamento criados antes de o padrão virar "sem e-mail").
 */
export async function silenciarEmailsEnvelope(envelopeId: string): Promise<void> {
  await documensoFetch("/envelope/update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ envelopeId, meta: { emailSettings: EMAIL_SETTINGS_OFF } }),
  });
}
