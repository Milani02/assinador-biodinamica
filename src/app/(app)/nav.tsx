"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Inbox, Lock, PenLine, ScrollText, Users } from "lucide-react";
import { cn } from "cn";

const baseLinks = [
  { href: "/assinar", label: "Assinar", icon: PenLine },
  { href: "/aprovacoes", label: "Minhas aprovações", icon: Inbox },
  { href: "/documentos", label: "Documentos", icon: FileText },
  { href: "/auditoria", label: "Auditoria", icon: ScrollText },
];

export function AppNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const items = [...baseLinks, { href: "/usuarios", label: "Usuários", icon: Users }];

  return (
    <nav className="flex items-center gap-1 text-sm font-medium">
      {items.map((item) => {
        const Icon = item.icon;
        const locked = !isAdmin && item.href !== "/assinar";
        if (locked) {
          return (
            <div
              key={item.href}
              title="Disponível apenas para administradores"
              className="flex cursor-not-allowed items-center gap-1.5 rounded-lg px-3 py-1.5 text-muted-foreground/40 select-none"
            >
              <Icon className="size-4" />
              <span className="hidden sm:inline">{item.label}</span>
              <Lock className="size-3" />
            </div>
          );
        }
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors",
              active
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            <span className="hidden sm:inline">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
