import { cn } from "cn";

type Status =
  | "aguardando_elaboracao"
  | "aguardando_verificacao"
  | "aguardando_aprovacao"
  | "vigente"
  | "substituido"
  | "reprovado";

const config: Record<Status, { label: string; className: string }> = {
  aguardando_elaboracao: {
    label: "Aguardando elaboração",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  },
  aguardando_verificacao: {
    label: "Aguardando verificação",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  },
  aguardando_aprovacao: {
    label: "Aguardando aprovação",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  },
  vigente: {
    label: "Vigente",
    className: "bg-primary text-primary-foreground",
  },
  substituido: {
    label: "Substituído",
    className: "bg-muted text-muted-foreground",
  },
  reprovado: {
    label: "Reprovado",
    className: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300",
  },
};

export function StatusBadge({ status }: { status: string }) {
  const c = config[status as Status] ?? {
    label: status,
    className: "bg-muted text-muted-foreground",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        c.className,
      )}
    >
      <span className="size-1.5 shrink-0 rounded-full bg-current opacity-70" />
      {c.label}
    </span>
  );
}
