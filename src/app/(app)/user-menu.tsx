"use client";

import Link from "next/link";
import { ChevronDown, KeyRound } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserMenu({
  nome,
  papel,
}: {
  nome: string;
  papel: string;
}) {
  const initial = nome.trim().charAt(0).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg py-1 pr-1.5 pl-1 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50">
        <div className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
          {initial}
        </div>
        <div className="hidden text-sm leading-tight sm:block">
          <p className="font-medium">{nome}</p>
          <p className="text-xs text-muted-foreground">{papel}</p>
        </div>
        <ChevronDown className="hidden size-3.5 text-muted-foreground sm:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <p className="font-medium text-foreground">{nome}</p>
            <p className="font-normal text-muted-foreground">{papel}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem render={<Link href="/trocar-senha" />}>
            <KeyRound className="size-4" />
            Trocar senha
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
