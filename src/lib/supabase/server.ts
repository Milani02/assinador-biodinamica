import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              // Cookie de SESSÃO: sem maxAge/expires o navegador apaga ao fechar
              // (login expira ao reabrir o navegador). Em remoções (value vazio),
              // mantém as opções para o logout limpar o cookie corretamente.
              const opts =
                value === "" ? options : { ...options, maxAge: undefined, expires: undefined };
              cookieStore.set(name, value, opts);
            });
          } catch {
            // Chamado a partir de um Server Component (sem permissão de
            // escrever cookie) — sem problema, o middleware renova a sessão.
          }
        },
      },
    },
  );
}
