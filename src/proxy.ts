import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const PUBLIC_PATHS = ["/login"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rotas de API (ex.: webhook do Documenso) fazem sua própria autenticação
  // (segredo compartilhado) e nunca devem ser redirecionadas para /login.
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const { response, user } = await updateSession(request);
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!user && !isPublic) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && isPublic) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (user && Boolean(user.user_metadata?.must_change_password) && pathname !== "/trocar-senha") {
    return NextResponse.redirect(new URL("/trocar-senha", request.url));
  }

  return response;
}

export const config = {
  // Não intercepta assets estáticos do /public (imagens, vídeo, fontes etc.):
  // eles são públicos por natureza e o redirect de auth os quebraria
  // (ex.: /falcon.mp4 e /falcon-poster.jpg da tela de login).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|avif|svg|ico|mp4|webm|woff|woff2|ttf|otf|css|js|map|txt|json|xml|webmanifest)).*)",
  ],
};
