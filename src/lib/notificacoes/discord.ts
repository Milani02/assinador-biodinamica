/**
 * Avisos de assinatura no canal do Discord configurado em DISCORD_WEBHOOK_URL.
 *
 * É só um aviso: sem a variável não faz nada, e qualquer falha (Discord fora,
 * URL inválida, timeout) é registrada no log e engolida — nunca pode impedir o
 * registro de uma assinatura.
 */

const COR = {
  pendente: 0xf5a524,
  concluido: 0x22c55e,
  reprovado: 0xef4444,
} as const;

export interface AvisoAssinatura {
  resultado: "pendente" | "concluido" | "reprovado";
  /** Título do documento como aparece no app. */
  documento: string;
  quem: string;
  /** Etapa de quem assinou (ex.: "Verificação"), quando houver. */
  etapa?: string;
  /** Próximo signatário pendente, quando houver. */
  proximo?: { nome: string; etapa?: string };
  /** Assinaturas feitas / total de assinaturas do fluxo. */
  progresso: { feitas: number; total: number };
  comentario?: string | null;
  /** Quem assinou e quando, na ordem — usado no cartão de concluído. */
  assinaturas?: { nome: string; etapa?: string; em: Date | null }[];
}

export async function avisarAssinatura(aviso: AvisoAssinatura): Promise<void> {
  await enviar({ embeds: [montarEmbed(aviso)] });
}

function montarEmbed(a: AvisoAssinatura) {
  const titulo = {
    pendente: "✍️  Nova assinatura",
    concluido: "🎉  Todas as assinaturas concluídas",
    reprovado: "❌  Documento reprovado",
  }[a.resultado];

  const comEtapa = (nome: string, etapa?: string) =>
    etapa ? `**${md(nome)}**\n${etapa}` : `**${md(nome)}**`;

  const fields: { name: string; value: string; inline?: boolean }[] = [];
  if (a.resultado === "concluido" && a.assinaturas?.length) {
    fields.push({
      name: "Assinaturas",
      value: a.assinaturas
        .map((x) => {
          const partes = [`✅ **${md(x.nome)}**`];
          if (x.etapa) partes.push(x.etapa);
          if (x.em) partes.push(dataHora(x.em));
          return partes.join("  ·  ");
        })
        .join("\n")
        .slice(0, 1024),
    });
  } else {
    fields.push({
      name: a.resultado === "reprovado" ? "Reprovado por" : "Assinado por",
      value: comEtapa(a.quem, a.etapa),
      inline: true,
    });
  }
  if (a.resultado === "pendente" && a.proximo) {
    fields.push({
      name: "⏳ Aguardando",
      value: comEtapa(a.proximo.nome, a.proximo.etapa),
      inline: true,
    });
  }
  if (a.resultado !== "reprovado") {
    fields.push({ name: "Progresso", value: barra(a.progresso), inline: false });
  }
  if (a.resultado === "reprovado" && a.comentario) {
    fields.push({ name: "💬 Comentário", value: `>>> ${md(a.comentario).slice(0, 1000)}` });
  }

  return {
    color: COR[a.resultado],
    author: { name: "Biodinâmica · Assinatura eletrônica" },
    title: titulo,
    description: `### ${md(a.documento).slice(0, 250)}`,
    fields,
    timestamp: new Date().toISOString(),
  };
}

/** "23/10 09:30" no horário de Brasília. */
function dataHora(d: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(d)
    .replace(",", "");
}

/** "🟩🟩⬜  2 de 3 assinaturas" */
function barra({ feitas, total }: { feitas: number; total: number }) {
  const t = Math.max(total, 1);
  const f = Math.min(Math.max(feitas, 0), t);
  return `${"🟩".repeat(f)}${"⬜".repeat(t - f)}  **${f} de ${t}** assinatura${t > 1 ? "s" : ""}`;
}

async function enviar(corpo: object): Promise<void> {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...corpo,
        // Títulos e comentários vêm de usuários: não deixa virar @everyone/@here.
        allowed_mentions: { parse: [] },
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.error(`[discord] webhook respondeu ${res.status}: ${await res.text()}`);
    }
  } catch (err) {
    console.error("[discord] falha ao notificar:", err);
  }
}

/** Escapa a formatação Markdown do Discord em textos vindos de usuários. */
function md(texto: string): string {
  return texto.replace(/([\\*_~`|>#\[\]])/g, "\\$1");
}
