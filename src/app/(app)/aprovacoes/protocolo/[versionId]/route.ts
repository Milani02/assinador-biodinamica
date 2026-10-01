import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { documentVersions } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/current-user";
import { getProtocoloSignedUrl } from "@/lib/files";

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
    .select({ protocoloPath: documentVersions.protocoloPath })
    .from(documentVersions)
    .where(eq(documentVersions.id, versionId))
    .limit(1);

  if (!version || !version.protocoloPath) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }

  const signedUrl = await getProtocoloSignedUrl(version.protocoloPath);
  return NextResponse.redirect(signedUrl);
}
