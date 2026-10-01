import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/current-user";
import { recordAudit } from "@/lib/audit";
import { buscarRegistrosAuditoria } from "../query";

const papelLabel: Record<string, string> = {
  elaborado: "Elaborado",
  verificado: "Verificado",
  aprovado: "Aprovado",
};

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET(request: Request) {
  const user = await requireUser();
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
  }
  const url = new URL(request.url);
  const sp = Object.fromEntries(url.searchParams.entries());

  const registros = await buscarRegistrosAuditoria({
    codigo: sp.codigo || undefined,
    signatarioId: sp.signatarioId || undefined,
    papel: (sp.papel as "elaborado" | "verificado" | "aprovado" | undefined) || undefined,
    decisao: (sp.decisao as "assinado" | "reprovado" | undefined) || undefined,
    de: sp.de || undefined,
    ate: sp.ate || undefined,
  });

  const header = [
    "Código",
    "Título",
    "Revisão",
    "Etapa",
    "Decisão",
    "Signatário",
    "Data/Hora",
    "Comentário",
    "Hash SHA-256",
  ];
  const lines = [header.join(",")];
  for (const r of registros) {
    lines.push(
      [
        r.codigo,
        r.titulo,
        r.revisao,
        papelLabel[r.papel] ?? r.papel,
        r.decisao,
        r.signatarioNome,
        new Date(r.assinadoEm).toLocaleString("pt-BR"),
        r.comentario ?? "",
        r.sha256Hash,
      ]
        .map((v) => csvEscape(String(v)))
        .join(","),
    );
  }

  await recordAudit({
    entityType: "auditoria",
    entityId: user.id,
    action: "exportar_csv",
    actorId: user.id,
    metadata: { filtros: sp, totalRegistros: registros.length },
  });

  return new NextResponse("﻿" + lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="auditoria-assinaturas.csv"`,
    },
  });
}
