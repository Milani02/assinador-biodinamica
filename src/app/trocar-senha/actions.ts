"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/current-user";
import { recordAudit } from "@/lib/audit";

export type ChangePasswordState = { error?: string };

export async function changePasswordAction(
  _prevState: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const user = await requireUser();
  const atual = String(formData.get("atual") || "");
  const nova = String(formData.get("nova") || "");
  const confirmar = String(formData.get("confirmar") || "");

  if (nova.length < 8) {
    return { error: "A nova senha precisa ter pelo menos 8 caracteres." };
  }
  if (nova !== confirmar) {
    return { error: "A confirmação não confere com a nova senha." };
  }

  const supabase = await createClient();

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: atual,
  });
  if (signInError) {
    return { error: "Senha atual incorreta." };
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: nova,
    data: { must_change_password: false },
  });
  if (updateError) {
    return { error: "Não foi possível trocar a senha. Tente novamente." };
  }

  await recordAudit({
    entityType: "user",
    entityId: user.id,
    action: "trocar_senha",
    actorId: user.id,
  });

  revalidatePath("/", "layout");
  redirect("/");
}
