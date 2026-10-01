import {
  pgTable,
  pgSchema,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  pgEnum,
  jsonb,
} from "drizzle-orm/pg-core";

// Stub da tabela auth.users, gerenciada pelo Supabase Auth (não por essa
// migração) — só para permitir a FK de profiles.id -> auth.users.id.
const authSchema = pgSchema("auth");
export const authUsers = authSchema.table("users", {
  id: uuid("id").primaryKey(),
});

export const userRole = pgEnum("user_role", ["admin", "aprovador", "diretoria"]);

// Fluxo sequencial: elaborado -> verificado -> aprovado -> vigente.
export const versionStatus = pgEnum("version_status", [
  "aguardando_elaboracao",
  "aguardando_verificacao",
  "aguardando_aprovacao",
  "vigente",
  "substituido",
  "reprovado",
]);

// Papel de cada assinatura no documento.
export const papelAssinatura = pgEnum("papel_assinatura", [
  "elaborado",
  "verificado",
  "aprovado",
]);

export const decisaoAssinatura = pgEnum("decisao_assinatura", [
  "assinado",
  "reprovado",
]);

export const avulsoStatus = pgEnum("avulso_status", ["pendente", "assinado"]);

export const profiles = pgTable("profiles", {
  id: uuid("id")
    .primaryKey()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  nome: text("nome").notNull(),
  email: text("email").notNull(),
  role: userRole("role").notNull().default("aprovador"),
  ativo: boolean("ativo").notNull().default(true),
  // Assinatura fixa da pessoa (data URL PNG com fundo transparente). Quando
  // presente, o clique em "Assinar" injeta esta imagem no campo do Documenso
  // automaticamente, sem o widget de desenho. É PII — nunca expor a outros
  // usuários; a action carrega server-side só para o próprio dono ao assinar.
  assinaturaImagem: text("assinatura_imagem"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  codigo: text("codigo").notNull(),
  titulo: text("titulo").notNull(),
  categoria: text("categoria"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const documentVersions = pgTable("document_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "restrict" }),
  revisao: text("revisao").notNull(),
  arquivoPath: text("arquivo_path").notNull(),
  arquivoNomeOriginal: text("arquivo_nome_original").notNull(),
  sha256Hash: text("sha256_hash").notNull(),
  status: versionStatus("status").notNull().default("aguardando_elaboracao"),
  enviadoPorId: uuid("enviado_por_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "restrict" }),
  // Os três responsáveis designados (fluxo sequencial obrigatório).
  elaboradorId: uuid("elaborador_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "restrict" }),
  verificadorId: uuid("verificador_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "restrict" }),
  aprovadorId: uuid("aprovador_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "restrict" }),
  protocoloPath: text("protocolo_path"),
  // Integração com o Documenso: ID do envelope e o token de assinatura
  // embutida de cada papel (preenchidos após criar/distribuir o envelope).
  documensoEnvelopeId: text("documenso_envelope_id"),
  documensoTokenElaborador: text("documenso_token_elaborador"),
  documensoTokenVerificador: text("documenso_token_verificador"),
  documensoTokenAprovador: text("documenso_token_aprovador"),
  enviadoEm: timestamp("enviado_em", { withTimezone: true }).notNull().defaultNow(),
});

export const signatures = pgTable("signatures", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentVersionId: uuid("document_version_id")
    .notNull()
    .references(() => documentVersions.id, { onDelete: "restrict" }),
  papel: papelAssinatura("papel").notNull(),
  signerId: uuid("signer_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "restrict" }),
  decisao: decisaoAssinatura("decisao").notNull(),
  comentario: text("comentario"),
  ip: text("ip"),
  assinadoEm: timestamp("assinado_em", { withTimezone: true }).notNull().defaultNow(),
});

// Assinatura pessoal avulsa: a própria pessoa sobe um PDF e assina como
// única signatária, fora do fluxo elaborado -> verificado -> aprovado.
// Substitui o uso do gov.br para assinar um documento próprio.
export const avulsos = pgTable("avulsos", {
  id: uuid("id").primaryKey().defaultRandom(),
  uploaderId: uuid("uploader_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "restrict" }),
  titulo: text("titulo").notNull(),
  arquivoPath: text("arquivo_path").notNull(),
  arquivoNomeOriginal: text("arquivo_nome_original").notNull(),
  sha256Hash: text("sha256_hash").notNull(),
  status: avulsoStatus("status").notNull().default("pendente"),
  documensoEnvelopeId: text("documenso_envelope_id"),
  documensoToken: text("documenso_token"),
  assinadoEm: timestamp("assinado_em", { withTimezone: true }),
  criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
});

// Signatários de uma assinatura avulsa, em ordem sequencial. O uploader é
// sempre a ordem 0 (assina primeiro); os encaminhados vêm em seguida (1..N).
// Cada linha guarda o token de assinatura embutida daquele signatário no
// Documenso e o status individual.
export const avulsoSignatarios = pgTable("avulso_signatarios", {
  id: uuid("id").primaryKey().defaultRandom(),
  avulsoId: uuid("avulso_id")
    .notNull()
    .references(() => avulsos.id, { onDelete: "cascade" }),
  ordem: integer("ordem").notNull(),
  signerId: uuid("signer_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "restrict" }),
  documensoToken: text("documenso_token"),
  status: avulsoStatus("status").notNull().default("pendente"),
  assinadoEm: timestamp("assinado_em", { withTimezone: true }),
});

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  action: text("action").notNull(),
  actorId: uuid("actor_id").references(() => profiles.id, { onDelete: "set null" }),
  metadata: jsonb("metadata"),
  prevHash: text("prev_hash").notNull(),
  rowHash: text("row_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
