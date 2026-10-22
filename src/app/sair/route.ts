import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Encerra a sessão de quem foi desativado com o sistema aberto. Precisa ser um
// route handler: Server Components não podem apagar os cookies da sessão.
export async function GET() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // Caminho relativo: atrás do proxy, request.url é o endereço interno do
  // contêiner (0.0.0.0:3000) e não pode ir para o navegador.
  redirect("/login");
}
