"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { recordAudit } from "@/lib/audit";
import { origemDaRequisicao } from "@/lib/requisicao";

export async function logoutAction() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await recordAudit({
      entityType: "user",
      entityId: user.id,
      action: "logout",
      actorId: user.id,
      metadata: { ...(await origemDaRequisicao()) },
    });
  }

  await supabase.auth.signOut();
  redirect("/login");
}
