"use server";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { profiles } from "@/lib/db/schema";
import { createClient } from "@/lib/supabase/server";
import { recordAudit } from "@/lib/audit";

export type LoginState = { error?: string; redirectTo?: string };

export async function loginAction(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    return { error: "Informe e-mail e senha." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return { error: "Credenciais inválidas." };
  }

  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, data.user.id))
    .limit(1);

  if (!profile || !profile.ativo) {
    await supabase.auth.signOut();
    return { error: "Usuário inativo ou não cadastrado." };
  }

  await recordAudit({
    entityType: "user",
    entityId: data.user.id,
    action: "login",
    actorId: data.user.id,
  });

  const mustChangePassword = Boolean(data.user.user_metadata?.must_change_password);
  // Em vez de redirect() no servidor (navegacao "soft" que renderiza o destino
  // com o cookie antigo -> painel vazio, so o F5 resolve), devolvemos o destino
  // e o cliente faz um reload completo, ja com a sessao gravada.
  return { redirectTo: mustChangePassword ? "/trocar-senha" : "/" };
}
