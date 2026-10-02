"use server";

import { after } from "next/server";
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

  const userId = data.user.id;
  const mustChangePassword = Boolean(data.user.user_metadata?.must_change_password);

  // Auditoria FORA do caminho crítico: não segura a resposta do login.
  after(async () => {
    try {
      await recordAudit({ entityType: "user", entityId: userId, action: "login", actorId: userId });
    } catch {
      // auditoria é best-effort aqui; não deve bloquear/derrubar o login
    }
  });

  // Destino já conforme o papel: evita a cadeia "/" -> "/assinar" (307) para quem
  // não é admin. O cliente faz um reload completo (window.location) neste destino,
  // garantindo requisição nova com a sessão -> renderiza de primeira (sem F5).
  const destino = mustChangePassword
    ? "/trocar-senha"
    : profile.role === "admin"
      ? "/"
      : "/assinar";
  return { redirectTo: destino };
}
