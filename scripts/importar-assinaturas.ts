// Importa as imagens de assinatura fixas (data URL) para os perfis, casando
// por e-mail. As data URLs são geradas por scratchpad/preparar_dataurls.py e
// ficam em assinaturas/recortadas/assinaturas_dataurl.json (fora do git — PII).
// Uso: npm run assinaturas:importar
import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { db } from "../src/lib/db/client";
import { profiles } from "../src/lib/db/schema";

const JSON_PATH = "assinaturas/recortadas/assinaturas_dataurl.json";

async function main() {
  const mapa = JSON.parse(readFileSync(JSON_PATH, "utf8")) as Record<string, string>;
  const emails = Object.keys(mapa);
  console.log(`Importando ${emails.length} assinaturas de ${JSON_PATH}\n`);

  let ok = 0;
  for (const email of emails) {
    const dataUrl = mapa[email];
    const updated = await db
      .update(profiles)
      .set({ assinaturaImagem: dataUrl })
      .where(eq(profiles.email, email))
      .returning({ id: profiles.id, nome: profiles.nome });

    if (updated.length === 0) {
      console.warn(`⚠️  Nenhum perfil com e-mail ${email} — pulado.`);
    } else {
      ok += updated.length;
      console.log(`✅ ${updated[0].nome} (${email}) — ${Math.round(dataUrl.length / 1024)}KB`);
    }
  }

  console.log(`\nConcluído: ${ok}/${emails.length} perfis atualizados.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
