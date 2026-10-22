import { headers } from "next/headers";

export interface OrigemRequisicao {
  ip: string | null;
  userAgent: string | null;
}

/**
 * IP e navegador de quem fez a requisição atual (o proxy do Coolify preenche
 * x-forwarded-for). Fora de uma requisição — scripts, jobs — devolve nulos.
 */
export async function origemDaRequisicao(): Promise<OrigemRequisicao> {
  try {
    const h = await headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
    return { ip, userAgent: h.get("user-agent") };
  } catch {
    return { ip: null, userAgent: null };
  }
}
