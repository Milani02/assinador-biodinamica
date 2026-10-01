CREATE TYPE "public"."decisao_assinatura" AS ENUM('assinado', 'reprovado');--> statement-breakpoint
CREATE TYPE "public"."papel_assinatura" AS ENUM('elaborado', 'verificado', 'aprovado');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'aprovador');--> statement-breakpoint
CREATE TYPE "public"."version_status" AS ENUM('aguardando_elaboracao', 'aguardando_verificacao', 'aguardando_aprovacao', 'vigente', 'substituido', 'reprovado');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" text NOT NULL,
	"actor_id" uuid,
	"metadata" jsonb,
	"prev_hash" text NOT NULL,
	"row_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"revisao" text NOT NULL,
	"arquivo_path" text NOT NULL,
	"arquivo_nome_original" text NOT NULL,
	"sha256_hash" text NOT NULL,
	"status" "version_status" DEFAULT 'aguardando_elaboracao' NOT NULL,
	"enviado_por_id" uuid NOT NULL,
	"elaborador_id" uuid NOT NULL,
	"verificador_id" uuid NOT NULL,
	"aprovador_id" uuid NOT NULL,
	"protocolo_path" text,
	"enviado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"codigo" text NOT NULL,
	"titulo" text NOT NULL,
	"categoria" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"email" text NOT NULL,
	"role" "user_role" DEFAULT 'aprovador' NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signatures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_version_id" uuid NOT NULL,
	"papel" "papel_assinatura" NOT NULL,
	"signer_id" uuid NOT NULL,
	"decisao" "decisao_assinatura" NOT NULL,
	"comentario" text,
	"ip" text,
	"assinado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_profiles_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_enviado_por_id_profiles_id_fk" FOREIGN KEY ("enviado_por_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_elaborador_id_profiles_id_fk" FOREIGN KEY ("elaborador_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_verificador_id_profiles_id_fk" FOREIGN KEY ("verificador_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_aprovador_id_profiles_id_fk" FOREIGN KEY ("aprovador_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_document_version_id_document_versions_id_fk" FOREIGN KEY ("document_version_id") REFERENCES "public"."document_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_signer_id_profiles_id_fk" FOREIGN KEY ("signer_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;