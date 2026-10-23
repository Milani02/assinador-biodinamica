import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import type { NextConfig } from "next";

// Versão exibida no app (rodapé do menu): número do package.json + commit.
// No Coolify o .git não entra no build (.dockerignore), então o commit vem do
// build arg SOURCE_COMMIT; localmente, do próprio git.
const { version } = JSON.parse(readFileSync("./package.json", "utf8")) as { version: string };
function commitAtual(): string {
  if (process.env.SOURCE_COMMIT) return process.env.SOURCE_COMMIT.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "";
  }
}

const nextConfig: NextConfig = {
  // Build enxuto para container (Docker/Coolify): gera .next/standalone com só
  // o necessário para rodar `node server.js`.
  output: "standalone",
  env: {
    APP_VERSION: version,
    APP_COMMIT: commitAtual(),
  },
  // Permite acessar o servidor de desenvolvimento pela rede interna (IP da LAN),
  // não só por localhost. O Next.js bloqueia origens externas em dev por padrão.
  // Cada "*" cobre um octeto do IP; ajuste se a sua sub-rede for diferente.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.16.*.*"],
  // Remove o indicador flutuante do Next.js no canto da tela (só aparece em
  // desenvolvimento). Erros de compilação/execução continuam sendo mostrados.
  devIndicators: false,
  experimental: {
    // Server Actions limitam o corpo da requisição a 1 MB por padrão, o que
    // barrava o upload de PDFs (documentos, revisões, avulsos e verificação de
    // integridade) antes mesmo da action rodar — resultando em erro genérico.
    // 30 MB fica um pouco acima do limite de 25 MB validado no próprio app, para
    // que a mensagem amigável do app rejeite arquivos grandes, não o 413 do Next.
    serverActions: {
      bodySizeLimit: "30mb",
    },
  },
  // Cabeçalhos de segurança (hardening). CSP estrita fica de fora por ora para
  // não quebrar Supabase/Documenso/vídeo; o restante é seguro e sem efeito colateral.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=15552000" },
        ],
      },
    ];
  },
};

export default nextConfig;
