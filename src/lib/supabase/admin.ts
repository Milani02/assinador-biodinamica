import { createClient } from "@supabase/supabase-js";

// Usa a service_role key — ignora RLS. Só pode ser importado em código que
// roda no servidor (Server Actions, Route Handlers), nunca em componente cliente.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
