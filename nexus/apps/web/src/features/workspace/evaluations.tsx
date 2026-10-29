import { SearchSelect } from "../../components/inputs/search-select";
import { useEffect, useState, type FormEvent } from "react";
import type { Command, WorkspaceData } from "./types";
import { Card, Empty, InputField, SaveButton, score, dateTime } from "./ui";

export function EvaluationsModule({
  data,
  command,
  busy,
  userId,
  initialEventId,
  simplified = false,
}: {
  data: WorkspaceData;
  command: Command;
  busy: boolean;
  userId: string;
  initialEventId?: string;
  simplified?: boolean;
}) {
  const [eventId, setEventId] = useState(initialEventId ?? "");
  const [projectId, setProjectId] = useState("");
  const [scores, setScores] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");
  const [receipt, setReceipt] = useState("");
  useEffect(() => {
    if (initialEventId) {
      setEventId(initialEventId);
      setProjectId("");
      setScores({});
      setNotes("");
      setReceipt("");
    }
  }, [initialEventId]);
  const assigned = data.events.filter(
    (ev) =>
      data.eventEvaluators.some(
        (ee) => ee.event_id === ev.id && ee.user_id === userId,
      ) && ev.status !== "cancelled",
  );
  const event = assigned.find((e) => e.id === eventId);
  const projects = data.projects.filter((p) =>
    data.eventProjects.some(
      (ep) => ep.event_id === eventId && ep.project_id === p.id,
    ),
  );
  function chooseProject(id: string) {
    setProjectId(id);
    setReceipt("");
    const previous = data.evaluations.find(
      (e) =>
        e.event_id === eventId &&
        e.project_id === id &&
        e.evaluator_id === userId,
    );
    setScores(previous?.scores ?? {});
    setNotes(previous?.notes ?? "");
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (
      await command("evaluation.submit", {
        event_id: eventId,
        project_id: projectId,
        scores,
        notes,
      })
    ) {
      setReceipt(
        "Avaliação registrada. Você pode revisá-la enquanto a banca estiver aberta.",
      );
    }
  }
  return (
    <>
      <Card>
        <h2 className="section-title">Minhas avaliações</h2>
        <p>
          Preencha todas as notas da rubrica. O cálculo utiliza os pesos
          definidos na abertura da banca.
        </p>
        {!assigned.length ? (
          <Empty>Nenhuma banca atribuída a você</Empty>
        ) : simplified && !event ? (
          <Empty>Esta banca não está atribuída à sua conta de avaliador ou não está disponível. Confirme se entrou com a conta cadastrada e se a coordenação atribuiu você à banca.</Empty>
        ) : (
          <>
            {!simplified ? (
              <InputField label="Banca para avaliar">
                <SearchSelect
                  label="Banca para avaliar"
                  value={eventId}
                  disabled={busy}
                  onChange={(id) => {
                    setEventId(id);
                    setProjectId("");
                    setScores({});
                    setNotes("");
                    setReceipt("");
                  }}
                  options={assigned.map((event) => ({
                    value: event.id,
                    label: event.name,
                    description:
                      event.status === "open"
                        ? "Aberta para avaliações"
                        : event.status === "draft"
                          ? "Em preparação"
                          : "Encerrada · consulta",
                  }))}
                />
              </InputField>
            ) : (
              <p><strong>Banca:</strong> {event?.name ?? "Validando banca"}</p>
            )}
            {event && (
              <InputField label="Projeto para avaliar">
                <SearchSelect
                  label="Projeto para avaliar"
                  value={projectId}
                  onChange={chooseProject}
                  disabled={busy}
                  options={projects.map((project) => ({
                    value: project.id,
                    label: project.name,
                    description: data.evaluations.some(
                      (e) =>
                        e.event_id === eventId &&
                        e.project_id === project.id &&
                        e.evaluator_id === userId,
                    )
                      ? "Avaliado · revisão disponível enquanto a banca estiver aberta"
                      : "Aguardando sua avaliação",
                  }))}
                />
              </InputField>
            )}
            {event &&
              projectId &&
              (event.status === "open" ? (
                <form className="workspace-form" onSubmit={submit}>
                  <p>{projects.find((p) => p.id === projectId)?.summary}</p>
                  {event.criteria_snapshot.map((c) => (
                    <fieldset key={c.id}>
                      <legend>
                        {c.name} · peso {c.weight}
                      </legend>
                      <InputField label={`Nota para ${c.name}`}>
                        <select
                          required
                          value={scores[c.id] ?? ""}
                          onChange={(e) =>
                            setScores({
                              ...scores,
                              [c.id]: Number(e.target.value),
                            })
                          }
                        >
                          <option value="">Escolha uma nota</option>
                          {c.descriptors.map((d, i) => (
                            <option key={i} value={i + 1}>
                              {i + 1} — {d}
                            </option>
                          ))}
                        </select>
                      </InputField>
                    </fieldset>
                  ))}
                  <InputField label="Observações da avaliação">
                    <textarea
                      maxLength={5000}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </InputField>
                  <SaveButton busy={busy}>Enviar avaliação</SaveButton>
                  {receipt && <p role="status">{receipt}</p>}
                </form>
              ) : (
                <p>A banca precisa estar aberta para receber avaliações.</p>
              ))}
          </>
        )}
      </Card>
      {!simplified && <Card>
        <h2 className="section-title">Comprovantes e histórico</h2>
        {data.evaluations
          .filter((e) => e.evaluator_id === userId)
          .map((e) => (
            <article className="workspace-row" key={e.id}>
              <div>
                <strong>
                  {data.projects.find((p) => p.id === e.project_id)?.name ??
                    "Projeto"}
                </strong>
                <div>
                  {data.events.find((ev) => ev.id === e.event_id)?.name}
                </div>
                <div>
                  Média: {score(e.average)} · {dateTime(e.submitted_at)}
                </div>
                <small>Comprovante: {e.id}</small>
              </div>
            </article>
          ))}
        {!data.evaluations.some((e) => e.evaluator_id === userId) && (
          <Empty>Nenhuma avaliação enviada</Empty>
        )}
      </Card>}
    </>
  );
}
