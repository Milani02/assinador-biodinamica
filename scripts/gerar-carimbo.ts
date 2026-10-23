// Gera o carimbo compacto de assinatura de um usuário a partir do perfil:
//
//   NOME COMPLETO
//   Assinado eletronicamente em <data/hora da assinatura>
//
// A imagem tem a proporção da caixa de assinatura do certificado do Documenso
// (100pt de largura, 40pt de altura mínima), com o texto centralizado e fundo
// transparente — no campo do documento ela é encaixada mantendo a proporção.
// A data fica em branco na imagem; o layout vai num chunk tEXt e a
// data é escrita na hora de assinar (ver src/lib/assinatura/carimbo.ts).
// Sempre gera a base e uma prévia em assinaturas/carimbos/; com --gravar,
// salva no perfil.
//
// Uso: npx tsx --env-file=.env.local scripts/gerar-carimbo.ts <email> [--nome="Nome Completo"] [--gravar]
// --nome troca só o nome do carimbo (o nome do perfil no app não muda).
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { db } from "../src/lib/db/client";
import { profiles } from "../src/lib/db/schema";
import {
  CARIMBO_KEY,
  aplicarDataNoCarimbo,
  formatarDataCarimbo,
  gravarTextoPng,
  renderizarTexto,
  type CarimboLayout,
} from "../src/lib/assinatura/carimbo";

const ESCURO = "#283139";
const CINZA = "#5f6b76";
const FONTE_NEGRITO = path.join(
  process.cwd(),
  "node_modules/pdfjs-dist/standard_fonts/LiberationSans-Bold.ttf",
);
const PASTA = "assinaturas/carimbos";
const PREFIXO = "Assinado eletronicamente em ";

// Caixa do certificado (Documenso v2.18 render-certificate.ts): a imagem entra
// em x=4,y=4 com 100pt de largura; a borda vai de 2 a 102 (x) e de 2 a 42 (y).
const PROPORCAO = 100 / 40;
// Centro da borda em coordenadas da imagem (fração da largura/altura).
const CENTRO_X = (52 - 4) / 100;
const CENTRO_Y = (22 - 4) / 40;
// Fração da largura ocupada pelo texto (o resto é respiro dentro da caixa).
const OCUPACAO = 0.86;

async function negrito(texto: string, fontSize: number, color: string) {
  const esc = texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return sharp({
    text: {
      text: `<span foreground="${color}">${esc}</span>`,
      font: `Liberation Sans Bold ${fontSize}px`,
      fontfile: FONTE_NEGRITO,
      rgba: true,
    },
  })
    .png()
    .toBuffer();
}

async function tamanho(png: Buffer) {
  const m = await sharp(png).metadata();
  return { w: m.width!, h: m.height! };
}

async function main() {
  const args = process.argv.slice(2);
  const email = args.find((a) => !a.startsWith("--"));
  const gravar = args.includes("--gravar");
  const nomeArg = args.find((a) => a.startsWith("--nome="))?.slice("--nome=".length).trim();
  if (!email) {
    console.error('Uso: gerar-carimbo.ts <email> [--nome="Nome Completo"] [--gravar]');
    process.exit(1);
  }
  const [perfil] = await db
    .select({ id: profiles.id, nome: profiles.nome })
    .from(profiles)
    .where(eq(profiles.email, email));
  if (!perfil) throw new Error(`Nenhum perfil com e-mail ${email}.`);

  // A 2ª linha é medida já com uma data de exemplo para reservar o espaço.
  const nome = (nomeArg || perfil.nome).toUpperCase();
  const l1 = await negrito(nome, 40, ESCURO);
  const l2 = await renderizarTexto(PREFIXO + formatarDataCarimbo(new Date()), 27, CINZA);
  const [t1, t2] = await Promise.all([tamanho(l1), tamanho(l2)]);
  const gap = 18;

  const textoW = Math.max(t1.w, t2.w);
  const textoH = t1.h + gap + t2.h;
  const W = Math.max(Math.ceil(textoW / OCUPACAO), Math.ceil((textoH / 0.7) * PROPORCAO));
  const H = Math.round(W / PROPORCAO);
  // Cada linha centralizada na horizontal; o bloco centralizado na vertical.
  const x1 = Math.round(W * CENTRO_X - t1.w / 2);
  const x2 = Math.round(W * CENTRO_X - t2.w / 2);
  const y1 = Math.round(H * CENTRO_Y - textoH / 2);
  const y2 = y1 + t1.h + gap;

  const layout: CarimboLayout = { x: x2, y: y2, fontSize: 27, color: CINZA, prefixo: PREFIXO };

  const fundo = sharp({ create: { width: W, height: H, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0 } } });
  const semData = await fundo
    .composite([
      { input: l1, left: x1, top: y1 },
    ])
    .png()
    .toBuffer();

  const base = gravarTextoPng(semData, CARIMBO_KEY, JSON.stringify(layout));
  const dataUrl = "data:image/png;base64," + base.toString("base64");

  mkdirSync(PASTA, { recursive: true });
  const nomeArquivo = email.replace(/[^a-z0-9.+-]/gi, "_");
  writeFileSync(path.join(PASTA, `${nomeArquivo}.png`), base);
  const previa = await aplicarDataNoCarimbo(dataUrl, new Date());
  writeFileSync(
    path.join(PASTA, `${nomeArquivo}-previa.png`),
    Buffer.from(previa.slice(previa.indexOf(",") + 1), "base64"),
  );
  console.log(`${nome}: ${W}x${H}, ${Math.round(dataUrl.length / 1024)}KB — ${PASTA}/${nomeArquivo}-previa.png`);

  if (gravar) {
    await db.update(profiles).set({ assinaturaImagem: dataUrl }).where(eq(profiles.id, perfil.id));
    console.log("✅ Gravado no perfil.");
  } else {
    console.log("Prévia apenas — rode com --gravar para salvar no perfil.");
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
