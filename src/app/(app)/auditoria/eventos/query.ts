import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { auditLog, avulsos, documentVersions, documents, profiles } from "@/lib/db/schema";
import { fimDoDia, inicioDoDia } from "@/lib/datas";

export const acaoLabel: Record<string, string> = {
  login: "Login",
  login_falhou: "Login recusado",
  logout: "Logout",
  trocar_senha: "Troca de senha",
  resetar_senha: "Senha resetada pelo admin",
  criar_usuario: "Usuário criado",
  alterar_perfil: "Perfil alterado",
  desativar_usuario: "Usuário desativado",
  reativar_usuario: "Usuário reativado",
  criar_avulso: "Documento enviado para assinatura",
  assinar_avulso: "Documento assinado",
  concluir_avulso: "Assinatura concluída (todos)",
  reposicionar_assinatura: "Posição da assinatura ajustada",
  criar_documento: "Documento SGQ criado",
  enviar_revisao: "Revisão enviada",
  criar_envelope_documenso: "Envelope criado no Documenso",
  assinar_elaborado: "Assinado (elaborado)",
  assinar_verificado: "Assinado (verificado)",
  assinar_aprovado: "Assinado (aprovado)",
  reprovar: "Reprovado",
  tornar_vigente: "Revisão vigente",
  exportar_csv: "Exportação CSV",
};

const perfilLabel: Record<string, string> = {
  admin: "Administrador",
  aprovador: "Aprovador",
  diretoria: "Diretoria",
};

export interface EventosFilters {
  acao?: string;
  usuarioId?: string;
  de?: string;
  ate?: string;
}

export interface EventoAuditoria {
  id: string;
  createdAt: Date;
  acao: string;
  acaoLabel: string;
  usuario: string;
  registro: string;
  ip: string | null;
  rowHash: string;
}

const LIMITE = 1000;

export async function buscarEventosAuditoria(filters: EventosFilters): Promise<EventoAuditoria[]> {
  const conditions = [];
  if (filters.acao) conditions.push(eq(auditLog.action, filters.acao));
  if (filters.usuarioId) conditions.push(eq(auditLog.actorId, filters.usuarioId));
  if (filters.de) conditions.push(gte(auditLog.createdAt, inicioDoDia(filters.de)));
  if (filters.ate) conditions.push(lte(auditLog.createdAt, fimDoDia(filters.ate)));

  const [linhas, pessoas, docsAvulsos, versoes] = await Promise.all([
    db
      .select()
      .from(auditLog)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(auditLog.createdAt))
      .limit(LIMITE),
    db.select({ id: profiles.id, nome: profiles.nome, email: profiles.email }).from(profiles),
    db.select({ id: avulsos.id, titulo: avulsos.titulo }).from(avulsos),
    db
      .select({ id: documentVersions.id, revisao: documentVersions.revisao, codigo: documents.codigo })
      .from(documentVersions)
      .innerJoin(documents, eq(documents.id, documentVersions.documentId)),
  ]);

  const pessoa = new Map(pessoas.map((p) => [p.id, p]));
  const tituloAvulso = new Map(docsAvulsos.map((a) => [a.id, a.titulo]));
  const versao = new Map(versoes.map((v) => [v.id, `${v.codigo} rev. ${v.revisao}`]));

  return linhas.map((l) => {
    const m = (l.metadata ?? {}) as Record<string, unknown>;
    const texto = (k: string) => (typeof m[k] === "string" ? (m[k] as string) : undefined);

    let registro: string;
    switch (l.entityType) {
      case "user": {
        const p = pessoa.get(l.entityId);
        registro = p ? `${p.nome} (${p.email})` : texto("email") ?? "Usuário";
        if (l.action === "alterar_perfil") {
          registro += ` · ${perfilLabel[texto("de") ?? ""] ?? texto("de")} → ${perfilLabel[texto("para") ?? ""] ?? texto("para")}`;
        }
        if (l.action === "criar_usuario" && texto("role")) {
          registro += ` · perfil ${perfilLabel[texto("role")!] ?? texto("role")}`;
        }
        break;
      }
      case "login":
        registro = `Tentativa com ${texto("email") ?? "e-mail não informado"} · ${texto("motivo") ?? ""}`;
        break;
      case "avulso":
        registro = texto("titulo") ?? tituloAvulso.get(l.entityId) ?? "Documento";
        break;
      case "avulso_signatario": {
        const avulsoId = texto("avulsoId");
        const titulo = (avulsoId && tituloAvulso.get(avulsoId)) ?? "Documento";
        registro = `${titulo} · ordem ${Number(m.ordem ?? 0) + 1}`;
        break;
      }
      case "document_version":
        registro = versao.get(l.entityId) ?? "Revisão de documento";
        break;
      default:
        registro = texto("titulo") ?? texto("codigo") ?? l.entityType;
    }

    return {
      id: l.id,
      createdAt: l.createdAt,
      acao: l.action,
      acaoLabel: acaoLabel[l.action] ?? l.action,
      usuario: l.actorId ? pessoa.get(l.actorId)?.nome ?? "Usuário removido" : "Sistema",
      registro,
      ip: texto("ip") ?? null,
      rowHash: l.rowHash,
    };
  });
}
