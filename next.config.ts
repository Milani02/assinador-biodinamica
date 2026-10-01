import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
};

export default nextConfig;
