// Testa se DOCUMENSO_API_URL + DOCUMENSO_API_TOKEN estão corretos.
// Uso: npm run documenso:test
import { testConnection } from "../src/lib/documenso/client";

async function main() {
  console.log("URL:", process.env.DOCUMENSO_API_URL);
  console.log("Testando conexão com a API do Documenso...");

  try {
    const result = await testConnection();
    console.log("✅ Conexão OK. Envelopes existentes:", result.total);
    process.exit(0);
  } catch (err) {
    console.error("❌ Falha na conexão:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
