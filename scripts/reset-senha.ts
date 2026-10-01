// Redefine a senha de um usuário EXISTENTE (ex.: admin que perdeu a senha).
// A senha antiga não é recuperável (fica com hash no Supabase); isto gera uma
// NOVA senha temporária e marca must_change_password para troca no 1º login.
//
// Uso:
//   npm run reset-senha -- --email="voce@empresa.com"
//
// A senha temporária aparece AQUI no seu terminal. Faça login com ela e o app
// vai te levar para /trocar-senha para definir a definitiva.
import { eq } from "drizzle-orm";
import { db } from "../src/lib/db/client";
import { profiles } from "../src/lib/db/schema";
import { generateTempPassword } from "../src/lib/auth/temp-password";
import { createAdminClient } from "../src/lib/supabase/admin";

function arg(name: string) {
  const prefix = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(prefix));
  return found?.slice(prefix.length);
}

async function main() {
  const email = arg("email")?.toLowerCase();

  if (!email) {
    const admins = await db
      .select({ email: profiles.email, nome: profiles.nome })
      .from(profiles)
      .where(eq(profiles.role, "admin"));
    console.error('Uso: npm run reset-senha -- --email="voce@empresa.com"');
    if (admins.length) {
      console.error("\nAdmins cadastrados:");
      for (const a of admins) console.error(`  - ${a.email} (${a.nome})`);
    }
    process.exit(1);
  }

  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.email, email))
    .limit(1);

  if (!profile) {
    console.error(`Nenhum usuário com e-mail ${email}.`);
    process.exit(1);
  }

  const tempPassword = generateTempPassword();
  const supabaseAdmin = createAdminClient();

  const { error } = await supabaseAdmin.auth.admin.updateUserById(profile.id, {
    password: tempPassword,
    user_metadata: { must_change_password: true },
  });

  if (error) {
    console.error("Falha ao redefinir a senha:", error.message);
    process.exit(1);
  }

  console.log(`Senha redefinida para: ${email} (${profile.role})`);
  console.log(`Senha temporária (troque no primeiro login): ${tempPassword}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
