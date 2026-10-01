"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Inbox, LayoutDashboard, Lock, PenLine, ScrollText, Users } from "lucide-react";
import { cn } from "cn";

const baseLinks = [
  { href: "/", label: "Painel", icon: LayoutDashboard, exact: true },
  { href: "/assinar", label: "Assinar", icon: PenLine },
  { href: "/aprovacoes", label: "Minhas aprovações", icon: Inbox },
  { href: "/documentos", label: "Documentos", icon: FileText },
  { href: "/auditoria", label: "Auditoria", icon: ScrollText },
];

export function SidebarNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const items = [...baseLinks, { href: "/usuarios", label: "Usuários", icon: Users }];

  return (
    <nav className="space-y-1">
      {items.map((item) => {
        const Icon = item.icon;
        // Sem admin: só "Assinar" fica liberado; o resto aparece com cadeado.
        const locked = !isAdmin && item.href !== "/assinar";
        if (locked) {
          return (
            <div
              key={item.href}
              title="Disponível apenas para administradores"
              className="flex cursor-not-allowed items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/35 select-none"
            >
              <Icon className="size-4.5 shrink-0" />
              <span className="flex-1">{item.label}</span>
              <Lock className="size-3.5 shrink-0" />
            </div>
          );
        }
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
            )}
          >
            <Icon className="size-4.5 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
