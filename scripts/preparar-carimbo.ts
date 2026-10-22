// Prepara um carimbo de assinatura com data dinâmica a partir de um PNG de
// exemplo (ex.: "E2-<nome>-com-data-EXEMPLO.png"): apaga a linha "Data: ...",
// calibra fonte/posição para a data nova cair no mesmo lugar, grava o layout
// num chunk tEXt (ver src/lib/assinatura/carimbo.ts) e, com --gravar, salva no
// perfil do e-mail informado. Sempre gera prévias ao lado do arquivo de saída.
//
// Uso: npx tsx --env-file=.env.local scripts/preparar-carimbo.ts <png> <email> <saida.png> [--gravar]
import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import {
  CARIMBO_KEY,
  aplicarDataNoCarimbo,
  gravarTextoPng,
  renderizarTexto,
  type CarimboLayout,
} from "../src/lib/assinatura/carimbo";

// Texto de exemplo gravado no E2 — usado só para calibrar o tamanho da fonte.
const TEXTO_EXEMPLO = "Data: 21/10/2026 14:32:10 -0300";
const PREFIXO = "Data: ";
// A linha da data fica na metade direita do carimbo (à esquerda está o logo).
const X_MIN_TEXTO = 340;

type Caixa = { x0: number; y0: number; x1: number; y1: number };

/** Caixa com tinta (pixel escuro e opaco) dentro de uma região. */
async function caixaDeTinta(png: Buffer, regiao?: Caixa): Promise<Caixa | null> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const r = regiao ?? { x0: 0, y0: 0, x1: info.width - 1, y1: info.height - 1 };
  let c: Caixa | null = null;
  for (let y = r.y0; y <= r.y1; y++) {
    for (let x = r.x0; x <= r.x1; x++) {
      const i = (y * info.width + x) * 4;
      const tinta = data[i + 3] > 128 && data[i] + data[i + 1] + data[i + 2] < 450;
      if (!tinta) continue;
      c = c
        ? { x0: Math.min(c.x0, x), y0: Math.min(c.y0, y), x1: Math.max(c.x1, x), y1: Math.max(c.y1, y) }
        : { x0: x, y0: y, x1: x, y1: y };
    }
  }
  return c;
}

/** Faixas horizontais com tinta à direita do logo (uma por linha de texto). */
async function linhasDeTexto(png: Buffer): Promise<Caixa[]> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const linhas: Caixa[] = [];
  let atual: Caixa | null = null;
  for (let y = 0; y < info.height; y++) {
    let tem = false;
    for (let x = X_MIN_TEXTO; x < info.width - 10 && !tem; x++) {
      const i = (y * info.width + x) * 4;
      tem = data[i] + data[i + 1] + data[i + 2] < 450;
    }
    if (tem && !atual) atual = { x0: X_MIN_TEXTO, y0: y, x1: info.width - 10, y1: y };
    else if (tem && atual) atual.y1 = y;
    else if (!tem && atual) {
      linhas.push(atual);
      atual = null;
    }
  }
  if (atual) linhas.push(atual);
  return linhas;
}

async function main() {
  const [entrada, email, saida, flag] = process.argv.slice(2);
  if (!entrada || !email || !saida) {
    console.error("Uso: preparar-carimbo.ts <png> <email> <saida.png> [--gravar]");
    process.exit(1);
  }
  const original = readFileSync(entrada);
  const meta = await sharp(original).metadata();

  // A data é a penúltima linha de texto (a última é "Verifique no certificado...").
  const linhas = await linhasDeTexto(original);
  const linhaData = linhas[linhas.length - 2];
  const alvo = await caixaDeTinta(original, linhaData);
  if (!alvo) throw new Error("Linha da data não encontrada.");
  console.log(`Linha da data no original: x ${alvo.x0}–${alvo.x1}, y ${alvo.y0}–${alvo.y1}`);

  // Cor: o pixel mais escuro da linha original.
  const { data, info } = await sharp(original).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let cor = [255, 255, 255];
  for (let y = alvo.y0; y <= alvo.y1; y++)
    for (let x = alvo.x0; x <= alvo.x1; x++) {
      const i = (y * info.width + x) * 4;
      if (data[i] + data[i + 1] + data[i + 2] < cor[0] + cor[1] + cor[2]) cor = [data[i], data[i + 1], data[i + 2]];
    }
  const color = "#" + cor.map((v) => v.toString(16).padStart(2, "0")).join("");

  // Tamanho da fonte cuja largura de tinta mais se aproxima da original.
  const larguraAlvo = alvo.x1 - alvo.x0;
  let melhor = { fontSize: 0, erro: Infinity, tinta: null as Caixa | null };
  for (let fontSize = 18; fontSize <= 40; fontSize++) {
    const tinta = await caixaDeTinta(await renderizarTexto(TEXTO_EXEMPLO, fontSize, color));
    if (!tinta) continue;
    const erro = Math.abs(tinta.x1 - tinta.x0 - larguraAlvo);
    if (erro < melhor.erro) melhor = { fontSize, erro, tinta };
  }
  if (!melhor.tinta) throw new Error("Falha ao renderizar texto de calibração.");

  // Desloca a caixa do texto para a tinta cair onde estava a original.
  const layout: CarimboLayout = {
    x: alvo.x0 - melhor.tinta.x0,
    y: alvo.y0 - melhor.tinta.y0,
    fontSize: melhor.fontSize,
    color,
    prefixo: PREFIXO,
  };
  console.log("Layout:", layout, `(erro de largura ${melhor.erro}px)`);

  // Apaga a linha da data (com folga) pintando de branco.
  const folga = 6;
  const apagar = {
    left: alvo.x0 - folga,
    top: alvo.y0 - folga,
    width: Math.min(meta.width! - 12, alvo.x1 + 80) - (alvo.x0 - folga),
    height: alvo.y1 - alvo.y0 + 2 * folga,
  };
  const semData = await sharp(original)
    .composite([
      {
        input: { create: { width: apagar.width, height: apagar.height, channels: 4, background: "#ffffff" } },
        left: apagar.left,
        top: apagar.top,
      },
    ])
    .png()
    .toBuffer();

  const base = gravarTextoPng(semData, CARIMBO_KEY, JSON.stringify(layout));
  writeFileSync(saida, base);
  const dataUrl = "data:image/png;base64," + base.toString("base64");

  // Prévias: com a data de exemplo (comparar com o original) e com "agora".
  const exemplo = await aplicarDataNoCarimbo(dataUrl, new Date("2026-10-21T17:32:10Z"));
  writeFileSync(saida.replace(/\.png$/, "-previa-exemplo.png"), Buffer.from(exemplo.split(",")[1], "base64"));
  const agora = await aplicarDataNoCarimbo(dataUrl, new Date());
  writeFileSync(saida.replace(/\.png$/, "-previa-agora.png"), Buffer.from(agora.split(",")[1], "base64"));
  console.log(`Base: ${saida} (${Math.round(dataUrl.length / 1024)}KB em data URL)`);

  if (flag === "--gravar") {
    const { eq } = await import("drizzle-orm");
    const { db } = await import("../src/lib/db/client");
    const { profiles } = await import("../src/lib/db/schema");
    const updated = await db
      .update(profiles)
      .set({ assinaturaImagem: dataUrl })
      .where(eq(profiles.email, email))
      .returning({ id: profiles.id, nome: profiles.nome });
    if (updated.length === 0) throw new Error(`Nenhum perfil com e-mail ${email}.`);
    console.log(`✅ Gravado em ${updated[0].nome} (${email}).`);
  } else {
    console.log("Prévia apenas — rode com --gravar para salvar no perfil.");
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
