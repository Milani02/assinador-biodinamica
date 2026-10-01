import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { LOGO_BIODINAMICA_BRANCO_PNG_BASE64 } from "./logo-biodinamica";

export interface ProtocoloAssinatura {
  papel: string;
  nome: string;
  email: string;
  assinadoEm: Date;
}

// Paleta verde (identidade Biodinâmica), sóbria e legível na impressão.
const NAVY = rgb(0.051, 0.302, 0.169); // faixa do cabeçalho (verde escuro)
const ACCENT = rgb(0.102, 0.478, 0.29); // detalhes / cabeçalho da tabela (verde)
const INK = rgb(0.13, 0.15, 0.15); // texto principal
const MUTED = rgb(0.44, 0.5, 0.46); // rótulos / texto secundário
const HAIRLINE = rgb(0.83, 0.88, 0.85); // linhas finas / bordas
const SOFT_BG = rgb(0.949, 0.973, 0.957); // fundo de cards / linhas alternadas (verde bem claro)
const WHITE = rgb(1, 1, 1);
const LIGHT = rgb(0.749, 0.878, 0.804); // subtítulo sobre a faixa escura

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 50;
const CONTENT_W = PAGE_W - MARGIN * 2;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

// Formata a data no padrão brasileiro sem depender de ICU/locale do servidor.
function fmtData(d: Date) {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} às ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Quebra o texto em linhas que cabem em maxWidth (com quebra dura para
// "palavras" longas, ex.: um hash sem espaços).
function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";

  const pushHardBreak = (word: string) => {
    let chunk = "";
    for (const ch of word) {
      if (font.widthOfTextAtSize(chunk + ch, size) <= maxWidth) {
        chunk += ch;
      } else {
        if (chunk) lines.push(chunk);
        chunk = ch;
      }
    }
    return chunk;
  };

  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) <= maxWidth) {
      cur = test;
    } else {
      if (cur) lines.push(cur);
      cur = font.widthOfTextAtSize(w, size) > maxWidth ? pushHardBreak(w) : w;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

export async function gerarProtocoloPdf(params: {
  codigo: string;
  titulo: string;
  revisao: string;
  sha256Hash: string;
  protocoloId: string;
  assinaturas: ProtocoloAssinatura[];
}) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([PAGE_W, PAGE_H]);
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const mono = await pdf.embedFont(StandardFonts.Courier);
  const logo = await pdf.embedPng(
    Buffer.from(LOGO_BIODINAMICA_BRANCO_PNG_BASE64, "base64"),
  );

  // Cabeçalho de seção: título em negrito + traço de destaque. Retorna o y
  // onde o conteúdo da seção deve começar.
  function sectionHeading(label: string, y: number) {
    page.drawText(label, { x: MARGIN, y, size: 11.5, font: bold, color: INK });
    page.drawRectangle({ x: MARGIN, y: y - 7, width: 30, height: 2.5, color: ACCENT });
    return y - 24;
  }

  // ---------------------------------------------------------------- Cabeçalho
  const BAND_H = 120;
  page.drawRectangle({ x: 0, y: PAGE_H - BAND_H, width: PAGE_W, height: BAND_H, color: NAVY });
  page.drawRectangle({ x: 0, y: PAGE_H - BAND_H, width: PAGE_W, height: 4, color: ACCENT });

  // Logo institucional (versão branca) no topo do cabeçalho.
  const logoH = 22;
  const logoW = (logo.width / logo.height) * logoH;
  page.drawImage(logo, { x: MARGIN, y: PAGE_H - 24 - logoH, width: logoW, height: logoH });

  page.drawText("Protocolo de Aprovação Eletrônica", {
    x: MARGIN,
    y: PAGE_H - 78,
    size: 17,
    font: bold,
    color: WHITE,
  });
  page.drawText("Sistema de Gestão da Qualidade · Assinatura eletrônica", {
    x: MARGIN,
    y: PAGE_H - 98,
    size: 9.5,
    font: reg,
    color: LIGHT,
  });

  let y = PAGE_H - BAND_H - 34;

  // ------------------------------------------------------- Dados do documento
  y = sectionHeading("Dados do documento", y);

  const labelW = 132;
  const valX = MARGIN + 16 + labelW;
  const valMaxW = CONTENT_W - 32 - labelW;
  const metaRows: { label: string; value: string; mono?: boolean; strong?: boolean }[] = [
    { label: "Código do documento", value: params.codigo, strong: true },
    { label: "Título", value: params.titulo, strong: true },
    { label: "Revisão", value: params.revisao },
    { label: "Protocolo nº", value: params.protocoloId, mono: true },
  ];

  const valSize = 10.5;
  const lineH = 14;
  const rowGap = 9;
  const metaLines = metaRows.map((r) =>
    wrapText(r.value, r.mono ? mono : r.strong ? bold : reg, r.mono ? 9.5 : valSize, valMaxW),
  );
  let metaH = 14;
  for (const lines of metaLines) metaH += lines.length * lineH + rowGap;
  metaH += 2;

  page.drawRectangle({
    x: MARGIN,
    y: y - metaH,
    width: CONTENT_W,
    height: metaH,
    color: SOFT_BG,
    borderColor: HAIRLINE,
    borderWidth: 1,
  });

  let ry = y - 20;
  metaRows.forEach((r, i) => {
    const lines = metaLines[i];
    page.drawText(r.label.toUpperCase(), {
      x: MARGIN + 16,
      y: ry + 0.5,
      size: 7.5,
      font: bold,
      color: MUTED,
    });
    const vfont = r.mono ? mono : r.strong ? bold : reg;
    const vsize = r.mono ? 9.5 : valSize;
    let vy = ry;
    for (const ln of lines) {
      page.drawText(ln, { x: valX, y: vy, size: vsize, font: vfont, color: INK });
      vy -= lineH;
    }
    ry -= lines.length * lineH + rowGap;
  });

  y = y - metaH - 30;

  // ---------------------------------------------------- Assinaturas (tabela)
  y = sectionHeading("Assinaturas eletrônicas", y);

  const col1 = MARGIN + 14; // Etapa
  const col2 = MARGIN + 132; // Responsável
  const col3 = MARGIN + 360; // Data e hora
  const headerH = 24;
  const rowH = 34;

  // Cabeçalho da tabela
  page.drawRectangle({ x: MARGIN, y: y - headerH, width: CONTENT_W, height: headerH, color: ACCENT });
  const hy = y - headerH + 8.5;
  page.drawText("ETAPA", { x: col1, y: hy, size: 8.5, font: bold, color: WHITE });
  page.drawText("RESPONSÁVEL", { x: col2, y: hy, size: 8.5, font: bold, color: WHITE });
  page.drawText("DATA E HORA", { x: col3, y: hy, size: 8.5, font: bold, color: WHITE });

  let ty = y - headerH;
  params.assinaturas.forEach((a, i) => {
    if (i % 2 === 1) {
      page.drawRectangle({ x: MARGIN, y: ty - rowH, width: CONTENT_W, height: rowH, color: SOFT_BG });
    }
    const cy = ty - 14;
    page.drawText(a.papel, { x: col1, y: cy, size: 10, font: bold, color: INK });
    page.drawText(a.nome, { x: col2, y: cy, size: 10, font: bold, color: INK });
    page.drawText(a.email, { x: col2, y: cy - 12, size: 8, font: reg, color: MUTED });
    page.drawText(fmtData(a.assinadoEm), { x: col3, y: cy, size: 9.5, font: reg, color: INK });
    page.drawLine({
      start: { x: MARGIN, y: ty - rowH },
      end: { x: MARGIN + CONTENT_W, y: ty - rowH },
      thickness: 0.75,
      color: HAIRLINE,
    });
    ty -= rowH;
  });

  // Borda externa da tabela
  page.drawRectangle({
    x: MARGIN,
    y: ty,
    width: CONTENT_W,
    height: y - ty,
    borderColor: HAIRLINE,
    borderWidth: 1,
  });

  y = ty - 30;

  // ------------------------------------------------------------ Integridade
  y = sectionHeading("Integridade do documento", y);
  page.drawText(
    "Impressão digital SHA-256 do arquivo aprovado. Qualquer alteração no arquivo muda este código.",
    { x: MARGIN, y, size: 8.5, font: reg, color: MUTED, maxWidth: CONTENT_W },
  );
  y -= 16;
  const boxH = 26;
  page.drawRectangle({
    x: MARGIN,
    y: y - boxH,
    width: CONTENT_W,
    height: boxH,
    color: SOFT_BG,
    borderColor: HAIRLINE,
    borderWidth: 1,
  });
  page.drawText(params.sha256Hash, {
    x: MARGIN + 12,
    y: y - boxH + 9,
    size: 9,
    font: mono,
    color: INK,
  });

  // ----------------------------------------------------------------- Rodapé
  const footRuleY = 104;
  page.drawLine({
    start: { x: MARGIN, y: footRuleY },
    end: { x: PAGE_W - MARGIN, y: footRuleY },
    thickness: 0.75,
    color: HAIRLINE,
  });
  page.drawText(
    "Este protocolo é gerado automaticamente pelo sistema de aprovação eletrônica interna e constitui " +
      "evidência das assinaturas eletrônicas vinculadas à versão do documento identificada acima, conforme " +
      "a autenticação individual de cada responsável no sistema.",
    { x: MARGIN, y: footRuleY - 14, size: 7.5, font: reg, color: MUTED, maxWidth: CONTENT_W, lineHeight: 11 },
  );
  const emitido = `Documento gerado em ${fmtData(new Date())}`;
  page.drawText(emitido, { x: MARGIN, y: 42, size: 7.5, font: bold, color: MUTED });
  const pageLabel = "Página 1 de 1";
  page.drawText(pageLabel, {
    x: PAGE_W - MARGIN - reg.widthOfTextAtSize(pageLabel, 7.5),
    y: 42,
    size: 7.5,
    font: reg,
    color: MUTED,
  });

  return pdf.save();
}
