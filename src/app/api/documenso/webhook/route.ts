import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { avulsos, documentVersions } from "@/lib/db/schema";
import { registrarAssinatura } from "@/lib/documenso/signing-flow";
import { registrarAssinaturaAvulsaPorToken } from "@/lib/documenso/avulso-flow";
import type { PapelAssinatura } from "@/lib/documenso/client";

// Mapeia o status atual da revisão para o papel que deve assinar agora,
// garantindo a ordem sequencial elaborado -> verificado -> aprovado
// mesmo que o payload do webhook traga vários destinatários já assinados.
const statusToPapel: Record<string, PapelAssinatura | null> = {
  aguardando_elaboracao: "elaborado",
  aguardando_verificacao: "verificado",
  aguardando_aprovacao: "aprovado",
};

function segredoValido(recebido: string | null): boolean {
  const esperado = process.env.DOCUMENSO_WEBHOOK_SECRET;
  if (!esperado || !recebido) return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

interface DocumensoRecipient {
  token: string;
  signingStatus: "NOT_SIGNED" | "SIGNED" | "REJECTED";
  rejectionReason?: string | null;
}

interface DocumensoWebhookBody {
  event: string;
  payload?: {
    envelopeId?: string;
    recipients?: DocumensoRecipient[];
  };
}

export async function POST(req: NextRequest) {
  const secretHeader = req.headers.get("x-documenso-secret");
  if (!segredoValido(secretHeader)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: DocumensoWebhookBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const { event, payload } = body ?? {};
  if (!event || !payload?.envelopeId) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  if (event !== "DOCUMENT_SIGNED" && event !== "DOCUMENT_COMPLETED" && event !== "DOCUMENT_REJECTED") {
    return NextResponse.json({ received: true });
  }

  const [version] = await db
    .select()
    .from(documentVersions)
    .where(eq(documentVersions.documensoEnvelopeId, payload.envelopeId))
    .limit(1);

  if (!version) {
    // Pode ser um envelope de assinatura avulsa (fora do fluxo SGQ).
    const [avulso] = await db
      .select()
      .from(avulsos)
      .where(eq(avulsos.documensoEnvelopeId, payload.envelopeId))
      .limit(1);

    if (avulso) {
      // Marca cada signatário que assinou (por token). Ao concluir o último,
      // o próprio registrar finaliza o avulso.
      for (const r of payload.recipients ?? []) {
        if (r.signingStatus === "SIGNED") {
          await registrarAssinaturaAvulsaPorToken(r.token, "webhook_documenso");
        }
      }
      revalidatePath("/assinar");
      revalidatePath(`/assinar/${avulso.id}`);
    }

    return NextResponse.json({ received: true });
  }

  const recipients = payload.recipients ?? [];
  const ordem: PapelAssinatura[] = ["elaborado", "verificado", "aprovado"];
  let atual = version;

  for (const papel of ordem) {
    const papelEsperado = statusToPapel[atual.status];
    if (papelEsperado !== papel) continue;

    const token =
      papel === "elaborado"
        ? atual.documensoTokenElaborador
        : papel === "verificado"
          ? atual.documensoTokenVerificador
          : atual.documensoTokenAprovador;
    if (!token) continue;

    const recipiente = recipients.find((r) => r.token === token);
    if (!recipiente) continue;

    const signerId =
      papel === "elaborado"
        ? atual.elaboradorId
        : papel === "verificado"
          ? atual.verificadorId
          : atual.aprovadorId;

    if (recipiente.signingStatus === "SIGNED") {
      await registrarAssinatura({
        version: atual,
        papel,
        signerId,
        decisao: "assinado",
        comentario: null,
        ip: null,
        origem: "webhook_documenso",
      });
    } else if (recipiente.signingStatus === "REJECTED") {
      await registrarAssinatura({
        version: atual,
        papel,
        signerId,
        decisao: "reprovado",
        comentario: recipiente.rejectionReason?.trim() || "Reprovado no Documenso.",
        ip: null,
        origem: "webhook_documenso",
      });
    } else {
      continue;
    }

    const [refreshed] = await db
      .select()
      .from(documentVersions)
      .where(eq(documentVersions.id, atual.id))
      .limit(1);
    if (!refreshed) break;
    atual = refreshed;
  }

  revalidatePath("/aprovacoes");
  revalidatePath(`/documentos/${version.documentId}`);

  return NextResponse.json({ received: true });
}
