// Carimbo de assinatura com data dinâmica.
//
// Algumas assinaturas fixas (profiles.assinaturaImagem) não são uma rubrica
// manuscrita, e sim um carimbo ("Documento assinado eletronicamente / NOME /
// Cargo / Data: ..."). A imagem guardada no perfil vem SEM a data e com um
// chunk PNG tEXt (chave CARIMBO_KEY) dizendo onde escrevê-la. No momento da
// assinatura, aplicarDataNoCarimbo escreve a data/hora real (fuso de São Paulo).
// Imagens sem esse chunk (rubricas comuns) passam intactas.
import path from "node:path";
import { crc32 } from "node:zlib";
import sharp from "sharp";

export const CARIMBO_KEY = "biodinamica-carimbo";

/** Onde e como escrever a linha da data (pixels da imagem do carimbo). */
export type CarimboLayout = {
  /** Canto superior esquerdo da caixa de texto. */
  x: number;
  y: number;
  /** Tamanho da fonte em px. */
  fontSize: number;
  /** Cor do texto (#rrggbb). */
  color: string;
  /** Texto antes da data, ex.: "Data: ". */
  prefixo: string;
};

const FONT_FILE = path.join(process.cwd(), "public", "fonts", "LiberationSans-Regular.ttf");
const FONT_FAMILY = "Liberation Sans";
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const DATA_URL_PNG = "data:image/png;base64,";

/** "21/10/2026 14:32:10 -0300" no fuso de São Paulo. */
export function formatarDataCarimbo(quando: Date): string {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
      timeZoneName: "longOffset",
    })
      .formatToParts(quando)
      .map((p) => [p.type, p.value]),
  );
  // timeZoneName vem como "GMT-03:00" → "-0300".
  const offset = (partes.timeZoneName ?? "GMT-03:00").replace("GMT", "").replace(":", "") || "+0000";
  return `${partes.day}/${partes.month}/${partes.year} ${partes.hour}:${partes.minute}:${partes.second} ${offset}`;
}

/** Lê os chunks tEXt de um PNG. */
function lerTextosPng(png: Buffer): Map<string, string> {
  const out = new Map<string, string>();
  if (!png.subarray(0, 8).equals(PNG_SIGNATURE)) return out;
  let pos = 8;
  while (pos + 8 <= png.length) {
    const len = png.readUInt32BE(pos);
    const type = png.toString("latin1", pos + 4, pos + 8);
    if (type === "tEXt") {
      const data = png.subarray(pos + 8, pos + 8 + len);
      const sep = data.indexOf(0);
      if (sep > 0) out.set(data.toString("latin1", 0, sep), data.toString("latin1", sep + 1));
    }
    if (type === "IEND") break;
    pos += 12 + len;
  }
  return out;
}

/** Insere um chunk tEXt logo após o IHDR. */
export function gravarTextoPng(png: Buffer, chave: string, valor: string): Buffer {
  const data = Buffer.from(`${chave}\0${valor}`, "latin1");
  const tipoEDados = Buffer.concat([Buffer.from("tEXt", "latin1"), data]);
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  tipoEDados.copy(chunk, 4);
  chunk.writeUInt32BE(crc32(tipoEDados), 8 + data.length);
  const fimIhdr = 8 + 12 + png.readUInt32BE(8);
  return Buffer.concat([png.subarray(0, fimIhdr), chunk, png.subarray(fimIhdr)]);
}

function escaparMarkup(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Renderiza uma linha de texto como PNG transparente. */
export async function renderizarTexto(texto: string, fontSize: number, color: string) {
  return sharp({
    text: {
      text: `<span foreground="${color}">${escaparMarkup(texto)}</span>`,
      font: `${FONT_FAMILY} ${fontSize}px`,
      fontfile: FONT_FILE,
      rgba: true,
    },
  })
    .png()
    .toBuffer();
}

/** Lê o layout do carimbo, se a imagem for um carimbo com data dinâmica. */
export function layoutDoCarimbo(dataUrl: string): CarimboLayout | null {
  if (!dataUrl.startsWith(DATA_URL_PNG)) return null;
  const json = lerTextosPng(Buffer.from(dataUrl.slice(DATA_URL_PNG.length), "base64")).get(
    CARIMBO_KEY,
  );
  if (!json) return null;
  try {
    return JSON.parse(json) as CarimboLayout;
  } catch {
    return null;
  }
}

/**
 * Se `dataUrl` for um carimbo com data dinâmica, devolve uma cópia com a linha
 * "Data: ..." preenchida com `quando`. Caso contrário, devolve `dataUrl` igual.
 */
export async function aplicarDataNoCarimbo(dataUrl: string, quando: Date): Promise<string> {
  const layout = layoutDoCarimbo(dataUrl);
  if (!layout) return dataUrl;

  const base = Buffer.from(dataUrl.slice(DATA_URL_PNG.length), "base64");
  const texto = await renderizarTexto(
    `${layout.prefixo}${formatarDataCarimbo(quando)}`,
    layout.fontSize,
    layout.color,
  );
  const png = await sharp(base)
    .composite([{ input: texto, left: layout.x, top: layout.y }])
    .png()
    .toBuffer();
  return DATA_URL_PNG + png.toString("base64");
}
