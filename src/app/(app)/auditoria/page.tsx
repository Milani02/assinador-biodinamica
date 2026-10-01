import Link from "next/link";
import { Download, ScrollText, SlidersHorizontal } from "lucide-react";
import { db } from "@/lib/db/client";
import { profiles } from "@/lib/db/schema";
import { requireAdminArea } from "@/lib/auth/current-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buscarRegistrosAuditoria } from "./query";

const papelLabel: Record<string, string> = {
  elaborado: "Elaborado",
  verificado: "Verificado",
  aprovado: "Aprovado",
};

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdminArea();
  const sp = await searchParams;

  const filters = {
    codigo: sp.codigo || undefined,
    signatarioId: sp.signatarioId || undefined,
    papel: (sp.papel as "elaborado" | "verificado" | "aprovado" | undefined) || undefined,
    decisao: (sp.decisao as "assinado" | "reprovado" | undefined) || undefined,
    de: sp.de || undefined,
    ate: sp.ate || undefined,
  };

  const [registros, pessoas] = await Promise.all([
    buscarRegistrosAuditoria(filters),
    db.select({ id: profiles.id, nome: profiles.nome }).from(profiles),
  ]);

  const queryString = new URLSearchParams(
    Object.entries(sp).filter(([, v]) => !!v) as [string, string][],
  ).toString();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Auditoria</h1>
        <p className="mt-1 text-muted-foreground">
          Registro de todas as assinaturas eletrônicas — evidência para auditorias internas
          e externas (ex.: VISA/ANVISA).
        </p>
      </div>

      <form
        className="grid gap-4 rounded-xl bg-card p-5 shadow-soft ring-1 ring-foreground/10 sm:grid-cols-6"
        method="get"
      >
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="codigo">Código do documento</Label>
          <Input id="codigo" name="codigo" defaultValue={filters.codigo} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="signatarioId">Signatário</Label>
          <Select
            name="signatarioId"
            defaultValue={filters.signatarioId}
            items={pessoas.map((a) => ({ value: a.id, label: a.nome }))}
          >
            <SelectTrigger id="signatarioId" className="w-full">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              {pessoas.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="papel">Etapa</Label>
          <Select
            name="papel"
            defaultValue={filters.papel}
            items={[
              { value: "elaborado", label: "Elaborado" },
              { value: "verificado", label: "Verificado" },
              { value: "aprovado", label: "Aprovado" },
            ]}
          >
            <SelectTrigger id="papel" className="w-full">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="elaborado">Elaborado</SelectItem>
              <SelectItem value="verificado">Verificado</SelectItem>
              <SelectItem value="aprovado">Aprovado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="decisao">Decisão</Label>
          <Select
            name="decisao"
            defaultValue={filters.decisao}
            items={[
              { value: "assinado", label: "Assinado" },
              { value: "reprovado", label: "Reprovado" },
            ]}
          >
            <SelectTrigger id="decisao" className="w-full">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="assinado">Assinado</SelectItem>
              <SelectItem value="reprovado">Reprovado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="de">De</Label>
          <Input id="de" name="de" type="date" defaultValue={filters.de} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ate">Até</Label>
          <Input id="ate" name="ate" type="date" defaultValue={filters.ate} />
        </div>
        <div className="flex justify-end gap-2 sm:col-span-6">
          <Button
            render={<Link href={`/auditoria/export${queryString ? `?${queryString}` : ""}`} />}
            nativeButton={false}
            variant="outline"
          >
            <Download className="size-4" />
            Exportar CSV
          </Button>
          <Button type="submit">
            <SlidersHorizontal className="size-4" />
            Filtrar
          </Button>
        </div>
      </form>

      <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Código</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Revisão</TableHead>
              <TableHead>Etapa</TableHead>
              <TableHead>Decisão</TableHead>
              <TableHead>Signatário</TableHead>
              <TableHead>Data/hora</TableHead>
              <TableHead>Protocolo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {registros.map((r) => (
              <TableRow key={r.signatureId}>
                <TableCell className="font-mono text-sm">{r.codigo}</TableCell>
                <TableCell className="font-medium">{r.titulo}</TableCell>
                <TableCell className="tabular-nums">{r.revisao}</TableCell>
                <TableCell>{papelLabel[r.papel] ?? r.papel}</TableCell>
                <TableCell>
                  <span
                    className={
                      r.decisao === "assinado"
                        ? "inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
                        : "inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-500/15 dark:text-red-300"
                    }
                  >
                    <span className="size-1.5 rounded-full bg-current opacity-70" />
                    {r.decisao === "assinado" ? "Assinado" : "Reprovado"}
                  </span>
                </TableCell>
                <TableCell>{r.signatarioNome}</TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {new Date(r.assinadoEm).toLocaleString("pt-BR")}
                </TableCell>
                <TableCell>
                  {r.protocoloPath && (
                    <a
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                      href={`/aprovacoes/protocolo/${r.versionId}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ScrollText className="size-3.5" />
                      Ver
                    </a>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {registros.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  Nenhum registro encontrado para os filtros aplicados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
