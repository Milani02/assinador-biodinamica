import { desc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { profiles } from "@/lib/db/schema";
import { requireAdminArea } from "@/lib/auth/current-user";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NewUserDialog } from "./new-user-dialog";
import { UserRowActions } from "./user-row-actions";

export default async function UsuariosPage() {
  await requireAdminArea();

  const list = await db.select().from(profiles).orderBy(desc(profiles.createdAt));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Usuários</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Cada aprovador precisa de uma conta individual — é isso que garante a
            identificação inequívoca exigida na IT 4.01-01.
          </p>
        </div>
        <NewUserDialog />
      </div>

      <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Perfil</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                      {u.nome.trim().charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium">{u.nome}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{u.email}</TableCell>
                <TableCell>
                  <span
                    className={
                      u.role === "admin"
                        ? "inline-flex items-center rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground"
                        : "inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground"
                    }
                  >
                    {u.role === "admin"
                      ? "Administrador"
                      : u.role === "diretoria"
                        ? "Diretoria"
                        : "Aprovador"}
                  </span>
                </TableCell>
                <TableCell>
                  <span
                    className={
                      u.ativo
                        ? "inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
                        : "inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-500/15 dark:text-red-300"
                    }
                  >
                    <span className="size-1.5 rounded-full bg-current opacity-70" />
                    {u.ativo ? "Ativo" : "Inativo"}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <UserRowActions userId={u.id} ativo={u.ativo} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
