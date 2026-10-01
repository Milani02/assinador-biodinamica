"use server";

import { revalidatePath } from "next/cache";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { documentVersions, profiles } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth/current-user";
import { generateTempPassword } from "@/lib/auth/temp-password";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordAudit } from "@/lib/audit";

export type CreateUserState = { error?: string; tempPassword?: string; email?: string };

export async function createUserAction(
  _prevState: CreateUserState,
  formData: FormData,
): Promise<CreateUserState> {
  const admin = await requireAdmin();
  const nome = String(formData.get("nome") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const role = String(formData.get("role") || "aprovador") as "admin" | "aprovador";

  if (!nome || !email) {
    return { error: "Preencha nome e e-mail." };
  }

  const tempPassword = generateTempPassword();
  const supabaseAdmin = createAdminClient();

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { must_change_password: true },
  });

  if (error || !data.user) {
    return { error: "Não foi possível criar o usuário (e-mail já existe?)." };
  }

  await db.insert(profiles).values({
    id: data.user.id,
    nome,
    email,
    role,
    ativo: true,
  });

  await recordAudit({
    entityType: "user",
    entityId: data.user.id,
    action: "criar_usuario",
    actorId: admin.id,
    metadata: { nome, email, role },
  });

  revalidatePath("/usuarios");
  return { tempPassword, email };
}

export type ToggleUserState = { error?: string };

export async function toggleUserActiveAction(
  userId: string,
  ativo: boolean,
): Promise<ToggleUserState> {
  const admin = await requireAdmin();

  if (!ativo) {
    // Bloqueia desativar quem tem uma etapa de assinatura pendente designada a ele.
    const emAndamento = await db
      .select({
        status: documentVersions.status,
        elaboradorId: documentVersions.elaboradorId,
        verificadorId: documentVersions.verificadorId,
        aprovadorId: documentVersions.aprovadorId,
      })
      .from(documentVersions)
      .where(
        inArray(documentVersions.status, [
          "aguardando_elaboracao",
          "aguardando_verificacao",
          "aguardando_aprovacao",
        ]),
      );

    const responsavelPendente = emAndamento.some((v) => {
      if (v.status === "aguardando_elaboracao") return v.elaboradorId === userId;
      if (v.status === "aguardando_verificacao") return v.verificadorId === userId;
      if (v.status === "aguardando_aprovacao") return v.aprovadorId === userId;
      return false;
    });

    if (responsavelPendente) {
      return {
        error:
          "Este usuário tem uma etapa de assinatura pendente designada a ele. Conclua ou reatribua o documento antes de desativar.",
      };
    }
  }

  await db.update(profiles).set({ ativo }).where(eq(profiles.id, userId));
  await recordAudit({
    entityType: "user",
    entityId: userId,
    action: ativo ? "reativar_usuario" : "desativar_usuario",
    actorId: admin.id,
  });
  revalidatePath("/usuarios");
  return {};
}

export type ResetPasswordState = { error?: string; tempPassword?: string; email?: string };

export async function resetPasswordAction(
  userId: string,
  _prevState: ResetPasswordState,
  _formData: FormData,
): Promise<ResetPasswordState> {
  const admin = await requireAdmin();

  const [profile] = await db.select().from(profiles).where(eq(profiles.id, userId)).limit(1);
  if (!profile) return { error: "Usuário não encontrado." };

  const tempPassword = generateTempPassword();
  const supabaseAdmin = createAdminClient();

  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password: tempPassword,
    user_metadata: { must_change_password: true },
  });
  if (error) {
    return { error: "Não foi possível redefinir a senha." };
  }

  await recordAudit({
    entityType: "user",
    entityId: userId,
    action: "resetar_senha",
    actorId: admin.id,
  });

  revalidatePath("/usuarios");
  return { tempPassword, email: profile.email };
}
