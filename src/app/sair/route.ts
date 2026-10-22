import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Encerra a sessão de quem foi desativado com o sistema aberto. Precisa ser um
// route handler: Server Components não podem apagar os cookies da sessão.
export async function GET(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url));
}
