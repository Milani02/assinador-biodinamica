CREATE TYPE "public"."avulso_status" AS ENUM('pendente', 'assinado');--> statement-breakpoint
CREATE TABLE "avulsos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"uploader_id" uuid NOT NULL,
	"titulo" text NOT NULL,
	"arquivo_path" text NOT NULL,
	"arquivo_nome_original" text NOT NULL,
	"sha256_hash" text NOT NULL,
	"status" "avulso_status" DEFAULT 'pendente' NOT NULL,
	"documenso_envelope_id" text,
	"documenso_token" text,
	"assinado_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "avulsos" ADD CONSTRAINT "avulsos_uploader_id_profiles_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;