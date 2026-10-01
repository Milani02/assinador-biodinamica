import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { requireUser } from "@/lib/auth/current-user";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppNav } from "./nav";
import { SidebarNav } from "./sidebar-nav";
import { UserMenu } from "./user-menu";
import { logoutAction } from "./actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const isAdmin = user.role === "admin";
  const papel =
    user.role === "admin"
      ? "Administrador"
      : user.role === "diretoria"
        ? "Diretoria"
        : "Aprovador";

  // Bloqueio de abas: quem não é admin só acessa "Assinar". Qualquer outra rota
  // do app é redirecionada para lá (defesa no servidor, além do cadeado no menu).
  const pathname = (await headers()).get("x-pathname") ?? "";
  const emAssinar = pathname === "/assinar" || pathname.startsWith("/assinar/");
  // `pathname &&` evita loop de redirect caso o header não esteja presente.
  if (!isAdmin && pathname && !emAssinar) {
    redirect("/assinar");
  }
  const homeHref = isAdmin ? "/" : "/assinar";

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-4 py-6 md:flex">
        <Link href={homeHref} className="flex items-center px-2 text-sidebar-foreground">
          <BrandLogo className="h-6" />
        </Link>

        <div className="mt-8 flex-1">
          <p className="px-3 text-xs font-medium tracking-wider text-sidebar-foreground/50 uppercase">
            Menu
          </p>
          <div className="mt-2">
            <SidebarNav isAdmin={isAdmin} />
          </div>
        </div>

        <div className="rounded-xl bg-sidebar-accent/40 p-3.5 text-xs leading-relaxed text-sidebar-foreground/70 ring-1 ring-sidebar-border">
          Assinatura eletrônica via Documenso — sem imagem de assinatura colada no
          documento.
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-4 px-4 py-3 md:justify-end md:px-8">
            <div className="flex items-center gap-6 md:hidden">
              <Link href={homeHref} className="flex items-center text-foreground">
                <BrandLogo className="h-5" />
              </Link>
              <AppNav isAdmin={isAdmin} />
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <UserMenu nome={user.nome} papel={papel} />
              <form action={logoutAction}>
                <Button type="submit" variant="ghost" size="icon" aria-label="Sair">
                  <LogOut className="size-4" />
                </Button>
              </form>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-8">{children}</main>
      </div>
    </div>
  );
}
