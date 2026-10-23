/**
 * Posta uma mensagem no canal do Discord configurado em DISCORD_WEBHOOK_URL.
 *
 * É só um aviso: sem a variável não faz nada, e qualquer falha (Discord fora,
 * URL inválida, timeout) é registrada no log e engolida — nunca pode impedir o
 * registro de uma assinatura.
 */
export async function notificarDiscord(conteudo: string): Promise<void> {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: conteudo.slice(0, 2000),
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
export function md(texto: string): string {
  return texto.replace(/([\\*_~`|>#\[\]()])/g, "\\$1");
}
