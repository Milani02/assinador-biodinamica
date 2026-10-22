import Link from "next/link";
import { cn } from "cn";

const ABAS = [
  { href: "/auditoria", label: "Assinaturas do SGQ" },
  { href: "/auditoria/eventos", label: "Trilha de eventos" },
];

export function AuditoriaAbas({ ativa }: { ativa: string }) {
  return (
    <nav className="inline-flex rounded-lg bg-muted p-1 text-sm">
      {ABAS.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          className={cn(
            "rounded-md px-3 py-1.5 font-medium transition-colors",
            a.href === ativa
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {a.label}
        </Link>
      ))}
    </nav>
  );
}
