// Cria o primeiro usuário administrador via Supabase Auth + tabela profiles.
// Rode uma única vez, depois de aplicar as migrações e criar os buckets:
// npm run seed -- --nome="Fulano" --email="fulano@empresa.com"
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
  const nome = arg("nome") ?? "Administrador";
  const email = arg("email");

  if (!email) {
    console.error('Uso: npm run seed -- --nome="Seu Nome" --email="voce@empresa.com"');
    process.exit(1);
  }

  const tempPassword = generateTempPassword();
  const supabaseAdmin = createAdminClient();

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: email.toLowerCase(),
    password: tempPassword,
    email_confirm: true,
    user_metadata: { must_change_password: true },
  });

  if (error || !data.user) {
    console.error("Falha ao criar usuário no Supabase Auth:", error?.message);
    process.exit(1);
  }

  await db.insert(profiles).values({
    id: data.user.id,
    nome,
    email: email.toLowerCase(),
    role: "admin",
    ativo: true,
  });

  console.log(`Administrador criado: ${email}`);
  console.log(`Senha temporária (troque no primeiro login): ${tempPassword}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
