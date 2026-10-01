import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { documentVersions } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/current-user";
import { getDocumentoSignedUrl } from "@/lib/files";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ versionId: string }> },
) {
  const user = await requireUser();
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
  }
  const { versionId } = await params;

  const [version] = await db
    .select()
    .from(documentVersions)
    .where(eq(documentVersions.id, versionId))
    .limit(1);

  if (!version) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }

  const signedUrl = await getDocumentoSignedUrl(version.arquivoPath);
  return NextResponse.redirect(signedUrl);
}
