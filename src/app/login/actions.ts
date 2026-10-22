"use server";

import { after } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { profiles } from "@/lib/db/schema";
import { createClient } from "@/lib/supabase/server";
import { recordAudit } from "@/lib/audit";
import { origemDaRequisicao } from "@/lib/requisicao";

// entity_id é obrigatório (uuid); tentativas com e-mail não cadastrado usam o nulo.
const USUARIO_DESCONHECIDO = "00000000-0000-0000-0000-000000000000";

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

  const origem = await origemDaRequisicao();
  // Auditoria FORA do caminho crítico: não segura a resposta do login.
  const auditarDepois = (params: Parameters<typeof recordAudit>[0]) =>
    after(async () => {
      try {
        await recordAudit(params);
      } catch {
        // auditoria é best-effort aqui; não deve bloquear/derrubar o login
      }
    });

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    const [conhecido] = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.email, email))
      .limit(1);
    auditarDepois({
      entityType: "login",
      entityId: conhecido?.id ?? USUARIO_DESCONHECIDO,
      action: "login_falhou",
      actorId: conhecido?.id ?? null,
      metadata: { email, motivo: "credenciais inválidas", ...origem },
    });
    return { error: "Credenciais inválidas." };
  }

  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, data.user.id))
    .limit(1);

  if (!profile || !profile.ativo) {
    await supabase.auth.signOut();
    auditarDepois({
      entityType: "login",
      entityId: data.user.id,
      action: "login_falhou",
      actorId: profile ? data.user.id : null,
      metadata: { email, motivo: profile ? "usuário inativo" : "sem cadastro", ...origem },
    });
    // Mesma mensagem da senha errada: não revela que a conta existe.
    return { error: "Credenciais inválidas." };
  }

  const userId = data.user.id;
  const mustChangePassword = Boolean(data.user.user_metadata?.must_change_password);

  auditarDepois({
    entityType: "user",
    entityId: userId,
    action: "login",
    actorId: userId,
    metadata: { ...origem },
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
