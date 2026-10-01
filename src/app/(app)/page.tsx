import Link from "next/link";
import { and, count, eq, or } from "drizzle-orm";
import { Inbox, FileText, BadgeCheck, ArrowRight } from "lucide-react";
import { db } from "@/lib/db/client";
import { documentVersions, documents } from "@/lib/db/schema";
import { requireAdminArea } from "@/lib/auth/current-user";
import { Card } from "@/components/ui/card";

export default async function DashboardPage() {
  const user = await requireAdminArea();

  // Assinaturas pendentes onde é a vez do usuário (papel = status atual).
  const [pendentesRow] = await db
    .select({ total: count() })
    .from(documentVersions)
    .where(
      or(
        and(
          eq(documentVersions.status, "aguardando_elaboracao"),
          eq(documentVersions.elaboradorId, user.id),
        ),
        and(
          eq(documentVersions.status, "aguardando_verificacao"),
          eq(documentVersions.verificadorId, user.id),
        ),
        and(
          eq(documentVersions.status, "aguardando_aprovacao"),
          eq(documentVersions.aprovadorId, user.id),
        ),
      ),
    );

  const [documentosRow] = await db.select({ total: count() }).from(documents);

  const [vigentesRow] = await db
    .select({ total: count() })
    .from(documentVersions)
    .where(eq(documentVersions.status, "vigente"));

  const stats = [
    {
      href: "/aprovacoes",
      label: "Assinaturas pendentes com você",
      value: pendentesRow?.total ?? 0,
      icon: Inbox,
      cta: "Ver fila",
    },
    {
      href: "/documentos",
      label: "Documentos cadastrados",
      value: documentosRow?.total ?? 0,
      icon: FileText,
      cta: "Ver documentos",
    },
    {
      href: "/auditoria",
      label: "Revisões vigentes",
      value: vigentesRow?.total ?? 0,
      icon: BadgeCheck,
      cta: "Ver auditoria",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Olá, {user.nome.split(" ")[0]}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Painel de aprovação eletrônica de documentos do SGQ.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link key={stat.href} href={stat.href} className="group">
              <Card className="h-full gap-4 p-5 shadow-soft ring-0 transition-transform duration-200 ease-out-strong group-hover:-translate-y-0.5 group-active:translate-y-0 group-active:scale-[0.99]">
                <div className="flex items-center justify-between">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                    <Icon className="size-4.5" />
                  </div>
                  <ArrowRight className="size-4 -translate-x-0.5 text-muted-foreground opacity-0 transition-[transform,opacity] duration-200 ease-out-strong group-hover:translate-x-0 group-hover:opacity-100" />
                </div>
                <div>
                  <p className="text-3xl font-semibold tabular-nums tracking-tight">
                    {stat.value}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
