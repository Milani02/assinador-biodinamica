ALTER TYPE "public"."user_role" ADD VALUE 'diretoria';--> statement-breakpoint
CREATE TABLE "avulso_signatarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"avulso_id" uuid NOT NULL,
	"ordem" integer NOT NULL,
	"signer_id" uuid NOT NULL,
	"documenso_token" text,
	"status" "avulso_status" DEFAULT 'pendente' NOT NULL,
	"assinado_em" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "avulso_signatarios" ADD CONSTRAINT "avulso_signatarios_avulso_id_avulsos_id_fk" FOREIGN KEY ("avulso_id") REFERENCES "public"."avulsos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avulso_signatarios" ADD CONSTRAINT "avulso_signatarios_signer_id_profiles_id_fk" FOREIGN KEY ("signer_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;