import type { ReactNode } from "react";
import { EmptyState } from "../../components/app-ui";
export { Card, PageHead, Stat, Status } from "../../components/app-ui";

export function InputField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field workspace-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function SaveButton({
  children = "Salvar",
  busy = false,
}: {
  children?: ReactNode;
  busy?: boolean;
}) {
  return (
    <button type="submit" className="btn btn-primary" disabled={busy}>
      {busy ? "Salvando…" : children}
    </button>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return <EmptyState>{children}</EmptyState>;
}
export function dateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}
export function score(value: number | null) {
  return value === null
    ? "—"
    : Number(value).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
}
export const auditNames: Record<string, string> = {
  "testdata.podium_lab.seed": "Laboratório de teste do pódio criado",
  "institution.create": "Instituição cadastrada",
  "institution.active": "Instituição ativada",
  "institution.suspended": "Instituição suspensa",
  "member.save": "Vínculo atualizado",
  "access.request": "Acesso solicitado",
  "project.save": "Projeto atualizado",
  "project.team": "Equipe atualizada",
  "criterion.save": "Critério atualizado",
  "criterion.tiebreaker": "Critério prioritário de desempate alterado",
  "event.save": "Banca atualizada",
  "event.status": "Situação da banca alterada",
  "event.publish": "Publicação de resultados alterada",
  "evaluation.submit": "Avaliação enviada",
};
