import { MultiChoice } from "../../components/inputs/search-select";
import { useState, type FormEvent } from "react";
import type { Command, Event, WorkspaceData } from "./types";
import { ConfirmDialog } from "../../components/app-ui";
import { eventStatuses } from "./types";
import { Card, Empty, InputField, SaveButton, dateTime } from "./ui";

export function EventsModule({
  data,
  command,
  busy,
}: {
  data: WorkspaceData;
  command: Command;
  busy: boolean;
}) {
  const [cancelTarget, setCancelTarget] = useState<Event | null>(null);
  const [dateError, setDateError] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [evaluators, setEvaluators] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [linkNotice, setLinkNotice] = useState("");
  const selected = data.events.find((e) => e.id === selectedId);
  function edit(ev?: Event) {
    setEditing(ev?.id ?? "new");
    setDateError("");
    setName(ev?.name ?? "");
    setDate(
      ev
        ? new Date(
            new Date(ev.scheduled_at).getTime() -
              new Date(ev.scheduled_at).getTimezoneOffset() * 60000,
          )
            .toISOString()
            .slice(0, 16)
        : "",
    );
    setProjectIds(
      ev
        ? data.eventProjects
            .filter((p) => p.event_id === ev.id)
            .map((p) => p.project_id)
        : [],
    );
    setEvaluators(
      ev
        ? data.eventEvaluators
            .filter((p) => p.event_id === ev.id)
            .map((p) => p.user_id)
        : [],
    );
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    const scheduled = new Date(date);
    if (!Number.isFinite(scheduled.getTime())) {
      setDateError("Informe uma data e um horário válidos.");
      return;
    }
    setDateError("");
    if (
      await command("event.save", {
        ...(editing !== "new" ? { id: editing } : {}),
        name,
        scheduled_at: scheduled.toISOString(),
        project_ids: projectIds,
        evaluator_ids: evaluators,
      })
    ) {
      setEditing(null);
    }
  }
  const filtered = data.events.filter((e) => !filter || e.status === filter);
  const who = (id: string) =>
    data.people.find((p) => p.id === id)?.name ?? "Avaliador";
  return (
    <>
      <Card>
        <div className="section-head">
          <h2 className="section-title">Bancas</h2>
          {data.capabilities.manageEvents && (
            <button className="btn btn-primary" onClick={() => edit()}>
              Nova banca
            </button>
          )}
        </div>
        <InputField label="Filtrar situação">
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">Todas</option>
            {Object.entries(eventStatuses).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </InputField>
        {filtered.map((ev) => (
          <div className="workspace-row" key={ev.id}>
            <div>
              <button
                className="row-link"
                onClick={() => {
                  setSelectedId(ev.id);
                  setEditing(null);
                }}
              >
                {ev.name}
              </button>
              <div>
                {dateTime(ev.scheduled_at)} · {eventStatuses[ev.status]}
                {ev.results_published ? " · Resultados publicados" : ""}
              </div>
            </div>
          </div>
        ))}
        {!filtered.length && (
          <Empty>
            {data.events.length
              ? "Nenhuma banca corresponde ao filtro"
              : "Nenhuma banca disponível no seu contexto"}
          </Empty>
        )}
      </Card>
      {editing !== null && (
        <Card>
          <h2 className="section-title">
            {editing === "new" ? "Nova banca" : "Editar banca"}
          </h2>
          <form className="workspace-form" onSubmit={submit}>
            <InputField label="Nome da banca">
              <input
                required
                maxLength={200}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </InputField>
            <InputField label="Data e horário">
              <input
                required
                type="datetime-local"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </InputField>
            {dateError && (
              <p role="alert" className="notice error">
                {dateError}
              </p>
            )}
            <MultiChoice
              label="Projetos da banca"
              value={projectIds}
              onChange={setProjectIds}
              disabled={busy}
              options={data.projects
                .filter((p) => !p.archived)
                .map((p) => ({
                  value: p.id,
                  label: p.name,
                  description: `${p.category || "Sem categoria"} · ${p.stage} · ${p.year}.${p.semester}`,
                }))}
              empty="Cadastre projetos ativos antes de abrir a banca."
            />
            <MultiChoice
              label="Avaliadores com vínculo ativo"
              value={evaluators}
              onChange={setEvaluators}
              disabled={busy}
              options={data.memberships
                .filter(
                  (m) => m.status === "active" && m.roles.includes("evaluator"),
                )
                .map((m) => ({
                  value: m.user_id,
                  label: who(m.user_id),
                  description: "Avaliador · vínculo ativo nesta instituição",
                }))}
              empty="Peça à gestão para vincular avaliadores à instituição."
            />
            <p>
              Projetos e avaliadores podem ser alterados enquanto a banca
              estiver em preparação. Após abrir, a composição e a rubrica ficam
              congeladas.
            </p>
            <SaveButton busy={busy}>Salvar banca</SaveButton>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setEditing(null)}
            >
              Cancelar edição
            </button>
          </form>
        </Card>
      )}
      {selected && editing === null && (
        <Card>
          <div className="section-head">
            <h2 className="section-title">{selected.name}</h2>
            <span
              className={`status ${selected.status === "cancelled" ? "paused" : selected.status === "draft" ? "pending" : selected.status === "closed" ? "neutral" : ""}`}
            >
              {eventStatuses[selected.status]}
            </span>
          </div>
          <p>{dateTime(selected.scheduled_at)}</p>
          <h3>Projetos</h3>
          <ul>
            {data.eventProjects
              .filter((x) => x.event_id === selected.id)
              .map((x) => (
                <li key={x.project_id}>
                  {data.projects.find((p) => p.id === x.project_id)?.name ??
                    "Projeto"}
                </li>
              ))}
          </ul>
          <h3>Avaliadores</h3>
          <ul>
            {data.eventEvaluators
              .filter((x) => x.event_id === selected.id)
              .map((x) => (
                <li key={x.user_id}>{who(x.user_id)}</li>
              ))}
          </ul>
          <p>
            {data.evaluations.filter((e) => e.event_id === selected.id).length}{" "}
            avaliações visíveis para seu perfil. Cada avaliador designado avalia
            todos os projetos da banca.
          </p>
          {data.capabilities.manageEvents && selected.status === "open" && (
            <div className="workspace-actions">
              <button
                className="btn btn-ghost"
                onClick={async () => {
                  const url = `${window.location.origin}/avaliar/${data.institution.id}/${selected.id}`;
                  try {
                    await navigator.clipboard.writeText(url);
                    setLinkNotice("Link da sala de avaliação copiado. Envie-o aos avaliadores atribuídos a esta banca.");
                  } catch {
                    setLinkNotice(url);
                  }
                }}
              >
                Copiar link da sala de avaliação
              </button>
              {linkNotice && <p role="status">{linkNotice}</p>}
            </div>
          )}
          {data.capabilities.manageEvents && (
            <div className="workspace-actions">
              {selected.status === "draft" && (
                <>
                  <button
                    className="btn btn-ghost"
                    onClick={() => edit(selected)}
                  >
                    Editar composição
                  </button>
                  <button
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() =>
                      command("event.status", {
                        id: selected.id,
                        status: "open",
                      })
                    }
                  >
                    Abrir avaliações
                  </button>
                </>
              )}
              {selected.status === "open" && (
                <button
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() =>
                    command("event.status", {
                      id: selected.id,
                      status: "closed",
                    })
                  }
                >
                  Encerrar banca
                </button>
              )}
              {selected.status === "closed" && (
                <button
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() =>
                    command("event.publish", {
                      id: selected.id,
                      published: !selected.results_published,
                    })
                  }
                >
                  {selected.results_published
                    ? "Ocultar resultados"
                    : "Publicar resultados"}
                </button>
              )}
              {["draft", "open"].includes(selected.status) && (
                <button
                  className="btn btn-danger"
                  disabled={busy}
                  onClick={() => setCancelTarget(selected)}
                >
                  Cancelar banca
                </button>
              )}
            </div>
          )}
        </Card>
      )}
      <ConfirmDialog
        open={cancelTarget !== null}
        title="Cancelar banca?"
        confirmLabel="Cancelar banca"
        onClose={() => setCancelTarget(null)}
        onConfirm={() => {
          if (cancelTarget) {
            void command("event.status", {
              id: cancelTarget.id,
              status: "cancelled",
            });
            setCancelTarget(null);
          }
        }}
      >
        <p>
          As avaliações de {cancelTarget?.name} serão preservadas. A banca não
          poderá ser reaberta nem gerar premiação.
        </p>
      </ConfirmDialog>
    </>
  );
}
