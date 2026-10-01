import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { profiles } from "@/lib/db/schema";
import { requireAdminArea } from "@/lib/auth/current-user";
import { NewDocumentForm } from "./new-document-form";

export default async function NovoDocumentoPage() {
  const user = await requireAdminArea();

  const todasPessoas = await db
    .select({ id: profiles.id, nome: profiles.nome })
    .from(profiles)
    .where(eq(profiles.ativo, true));
  // Quem sobe o documento é o elaborador automaticamente, então não pode
  // aparecer como opção de verificador/aprovador.
  const pessoas = todasPessoas.filter((p) => p.id !== user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Novo documento</h1>
        <p className="mt-1 text-muted-foreground">
          O documento passa pelo fluxo de assinaturas Elaborado → Verificado → Aprovado
          antes de se tornar vigente.
        </p>
      </div>
      <NewDocumentForm pessoas={pessoas} />
    </div>
  );
}
