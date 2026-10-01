import Link from "next/link";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { cn } from "cn";
import { ChevronRight, FileDown, PenLine } from "lucide-react";
import { db } from "@/lib/db/client";
import { avulsos, avulsoSignatarios, profiles } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/current-user";
import { NovoAvulsoForm } from "./novo-avulso-form";

function AvulsoStatusBadge({ status }: { status: string }) {
  const assinado = status === "assinado";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        assinado
          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
          : "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
      )}
    >
      <span className="size-1.5 shrink-0 rounded-full bg-current opacity-70" />
      {assinado ? "Assinado" : "Pendente"}
    </span>
  );
}

export default async function AssinarPage() {
  const user = await requireUser();

  const [meusAvulsos, todasPessoas, minhasPendentes] = await Promise.all([
    db.select().from(avulsos).where(eq(avulsos.uploaderId, user.id)).orderBy(desc(avulsos.criadoEm)),
    db
      .select({ id: profiles.id, nome: profiles.nome, role: profiles.role })
      .from(profiles)
      .where(eq(profiles.ativo, true)),
    db
      .select({ avulsoId: avulsoSignatarios.avulsoId, ordem: avulsoSignatarios.ordem })
      .from(avulsoSignatarios)
      .where(and(eq(avulsoSignatarios.signerId, user.id), eq(avulsoSignatarios.status, "pendente"))),
  ]);

  const pessoas = todasPessoas.filter((p) => p.id !== user.id);

  // Diretoria/admin podem baixar documentos assinados que OUTROS enviaram.
  // Sem esta seção, não haveria como chegar neles (não aparecem em "enviados"
  // nem em "aguardando"). Exclui os próprios uploads (já listados abaixo).
  const podeBaixar = user.role === "diretoria" || user.role === "admin";
  const assinadosParaBaixar = podeBaixar
    ? await db
        .select({
          id: avulsos.id,
          titulo: avulsos.titulo,
          assinadoEm: avulsos.assinadoEm,
          uploaderNome: profiles.nome,
        })
        .from(avulsos)
        .innerJoin(profiles, eq(profiles.id, avulsos.uploaderId))
        .where(and(eq(avulsos.status, "assinado"), ne(avulsos.uploaderId, user.id)))
        .orderBy(desc(avulsos.assinadoEm))
    : [];

  // "Aguardando minha assinatura": avulsos em que é a MINHA vez (menor ordem pendente).
  let paraAssinar: (typeof avulsos.$inferSelect)[] = [];
  if (minhasPendentes.length) {
    const avulsoIds = [...new Set(minhasPendentes.map((m) => m.avulsoId))];
    const pend = await db
      .select({ avulsoId: avulsoSignatarios.avulsoId, ordem: avulsoSignatarios.ordem })
      .from(avulsoSignatarios)
      .where(and(inArray(avulsoSignatarios.avulsoId, avulsoIds), eq(avulsoSignatarios.status, "pendente")));
    const minPorAvulso = new Map<string, number>();
    for (const p of pend) {
      const cur = minPorAvulso.get(p.avulsoId);
      if (cur == null || p.ordem < cur) minPorAvulso.set(p.avulsoId, p.ordem);
    }
    const minhaVezIds = minhasPendentes
      .filter((m) => minPorAvulso.get(m.avulsoId) === m.ordem)
      .map((m) => m.avulsoId);
    if (minhaVezIds.length) {
      paraAssinar = await db.select().from(avulsos).where(inArray(avulsos.id, minhaVezIds));
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Assinar</h1>
        <p className="mt-1 text-muted-foreground">
          Assine documentos e encaminhe para outras pessoas assinarem em sequência.
        </p>
      </div>

      {paraAssinar.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-amber-700 dark:text-amber-400">
            Aguardando a sua assinatura
          </h2>
          <div className="overflow-hidden rounded-xl bg-card shadow-soft ring-1 ring-amber-500/30">
            {paraAssinar.map((a) => (
              <Link
                key={a.id}
                href={`/assinar/${a.id}`}
                className="flex items-center justify-between gap-3 border-b px-5 py-3 text-sm transition-colors last:border-b-0 hover:bg-muted/50"
              >
                <div className="flex items-center gap-2">
                  <PenLine className="size-4 text-amber-600 dark:text-amber-400" />
                  <span className="font-medium">{a.titulo}</span>
                </div>
                <ChevronRight className="size-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </div>
      )}

      <NovoAvulsoForm pessoas={pessoas} minhaAssinatura={user.assinaturaImagem} />

      {meusAvulsos.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">Documentos que você enviou</h2>
          <div className="overflow-hidden rounded-xl bg-card shadow-soft ring-1 ring-foreground/10">
            {meusAvulsos.map((a) => (
              <Link
                key={a.id}
                href={`/assinar/${a.id}`}
                className="flex items-center justify-between gap-3 border-b px-5 py-3 text-sm transition-colors last:border-b-0 hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{a.titulo}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(a.criadoEm).toLocaleString("pt-BR")}
                  </p>
                </div>
                <AvulsoStatusBadge status={a.status} />
              </Link>
            ))}
          </div>
        </div>
      )}

      {podeBaixar && assinadosParaBaixar.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Documentos assinados (para baixar)
          </h2>
          <div className="overflow-hidden rounded-xl bg-card shadow-soft ring-1 ring-foreground/10">
            {assinadosParaBaixar.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-3 border-b px-5 py-3 text-sm last:border-b-0"
              >
                <Link href={`/assinar/${a.id}`} className="min-w-0 hover:underline">
                  <p className="truncate font-medium">{a.titulo}</p>
                  <p className="text-xs text-muted-foreground">
                    Enviado por {a.uploaderNome}
                    {a.assinadoEm
                      ? ` · assinado em ${new Date(a.assinadoEm).toLocaleString("pt-BR")}`
                      : ""}
                  </p>
                </Link>
                <a
                  href={`/assinar/${a.id}/pdf-assinado`}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-primary hover:bg-primary/10"
                >
                  <FileDown className="size-3.5" />
                  Baixar
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
