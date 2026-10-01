import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { avulsos } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/current-user";
import { downloadSignedPdf } from "@/lib/documenso/client";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  const { id } = await params;

  // Somente Diretoria (e Admin) podem baixar documentos na aba Assinar.
  if (user.role !== "diretoria" && user.role !== "admin") {
    return NextResponse.json(
      { error: "Apenas a diretoria pode baixar este documento." },
      { status: 403 },
    );
  }

  const [avulso] = await db.select().from(avulsos).where(eq(avulsos.id, id)).limit(1);
  if (!avulso) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }
  if (avulso.status !== "assinado" || !avulso.documensoEnvelopeId) {
    return NextResponse.json({ error: "Este documento ainda não foi assinado." }, { status: 400 });
  }

  try {
    const { bytes, fileName } = await downloadSignedPdf(avulso.documensoEnvelopeId);
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName || avulso.arquivoNomeOriginal}"`,
      },
    });
  } catch (err) {
    console.error("Falha ao baixar PDF assinado do Documenso:", err);
    return NextResponse.json(
      { error: "Não foi possível baixar o PDF assinado agora. Tente novamente." },
      { status: 502 },
    );
  }
}
