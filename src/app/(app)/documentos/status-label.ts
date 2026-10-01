type Status =
  | "aguardando_elaboracao"
  | "aguardando_verificacao"
  | "aguardando_aprovacao"
  | "vigente"
  | "substituido"
  | "reprovado";

const labels: Record<Status, string> = {
  aguardando_elaboracao: "Aguardando elaboração",
  aguardando_verificacao: "Aguardando verificação",
  aguardando_aprovacao: "Aguardando aprovação",
  vigente: "Vigente",
  substituido: "Substituído",
  reprovado: "Reprovado",
};

export function statusLabel(status: string) {
  return labels[status as Status] ?? status;
}
