// Baixa todos os arquivos dos buckets do Supabase Storage (documentos e
// protocolos) para uma pasta local, mantendo a mesma estrutura de pastas.
// Só lê o Storage — nada é alterado ou apagado no Supabase.
// Uso: npm run backup:storage -- --destino="D:\Backups\assinador\2026-10-16"
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const BUCKETS = ["documentos", "protocolos"];

const destinoArg = process.argv.find((a) => a.startsWith("--destino="));
if (!destinoArg) {
  console.error('Informe a pasta de destino: --destino="D:\\Backups\\assinador\\AAAA-MM-DD"');
  process.exit(1);
}
const destino = destinoArg.slice("--destino=".length);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

// Lista recursivamente; entradas sem id são pastas.
async function listarArquivos(bucket: string, prefixo = ""): Promise<string[]> {
  const arquivos: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(prefixo, { limit: 1000, offset });
    if (error) throw new Error(`Falha ao listar ${bucket}/${prefixo}: ${error.message}`);
    for (const item of data) {
      const caminho = prefixo ? `${prefixo}/${item.name}` : item.name;
      if (item.id) arquivos.push(caminho);
      else arquivos.push(...(await listarArquivos(bucket, caminho)));
    }
    if (data.length < 1000) break;
  }
  return arquivos;
}

async function main() {
  let total = 0;
  for (const bucket of BUCKETS) {
    const arquivos = await listarArquivos(bucket);
    console.log(`\n${bucket}: ${arquivos.length} arquivo(s)`);
    for (const caminho of arquivos) {
      const { data, error } = await supabase.storage.from(bucket).download(caminho);
      if (error) throw new Error(`Falha ao baixar ${bucket}/${caminho}: ${error.message}`);
      const local = join(destino, "storage", bucket, ...caminho.split("/"));
      mkdirSync(dirname(local), { recursive: true });
      writeFileSync(local, Buffer.from(await data.arrayBuffer()));
      console.log(`  ✅ ${caminho}`);
      total++;
    }
  }
  console.log(`\nConcluído: ${total} arquivo(s) salvos em ${join(destino, "storage")}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
