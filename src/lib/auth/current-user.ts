import { cache } from "react";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/lib/db/client";
import { profiles } from "@/lib/db/schema";
import { createClient } from "@/lib/supabase/server";

// `cache()` deduplica por request: o layout e a página chamam requireUser(), mas
// o getUser() (rede -> Supabase) + a query em `profiles` rodam uma única vez por
// navegação, em vez de 2x. Reduz a latência de toda troca de aba.
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return null;

  const [profile] = await db.select().from(profiles).where(eq(profiles.id, authUser.id)).limit(1);
  if (!profile) return null;

  return {
    ...profile,
    mustChangePassword: Boolean(authUser.user_metadata?.must_change_password),
  };
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/");
  return user;
}

/**
 * Áreas restritas ao admin (todas as abas exceto "Assinar"). Não-admin é
 * mandado para /assinar. Garante o bloqueio no servidor por página, além do
 * cadeado no menu.
 */
export async function requireAdminArea() {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/assinar");
  return user;
}
