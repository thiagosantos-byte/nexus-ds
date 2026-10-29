import { useState, type FormEvent } from "react";
import type { Command, Criterion, WorkspaceData } from "./types";
import { Card, InputField, SaveButton, Empty } from "./ui";
const descriptors = [
  "Evidências insuficientes",
  "Evidências iniciais",
  "Atende ao esperado",
  "Bem fundamentado",
  "Destaque no critério",
];
export function CriteriaModule({
  data,
  command,
  busy,
}: {
  data: WorkspaceData;
  command: Command;
  busy: boolean;
}) {
  const [editing, setEditing] = useState("");
  const [name, setName] = useState("");
  const [weight, setWeight] = useState(1);
  const [rubric, setRubric] = useState(descriptors);
  const [active, setActive] = useState(true);
  function edit(c: Criterion) {
    setEditing(c.id);
    setName(c.name);
    setWeight(c.weight);
    setRubric(c.descriptors);
    setActive(c.active);
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (
      await command("criterion.save", {
        ...(editing ? { id: editing } : {}),
        name,
        weight,
        descriptors: rubric,
        ...(editing ? { active } : {}),
      })
    ) {
      setEditing("");
      setName("");
      setWeight(1);
      setRubric(descriptors);
      setActive(true);
    }
  }
  return (
    <>
      <Card>
        <h2 className="section-title">Critérios e rubricas</h2>
        <p>
          Notas de 1 a 5. Os critérios, pesos e descritores são congelados
          quando uma banca é aberta; mudanças posteriores valem para novas
          bancas. Um critério ativo pode ser definido como prioridade de
          desempate; essa escolha vale para bancas abertas depois da alteração.
        </p>
        {data.criteria.map((c) => (
          <article key={c.id} className="workspace-criterion">
            <div className="section-head">
              <h3>
                {c.name} · peso {c.weight}
                {!c.active ? " · Inativo" : ""}
                {c.is_tiebreaker ? " · Desempate prioritário" : ""}
              </h3>
              {data.capabilities.manageCriteria && (
                <div className="workspace-actions">
                  {c.active && (
                    <button
                      className="btn btn-ghost"
                      disabled={busy || c.is_tiebreaker}
                      onClick={() => void command("criterion.tiebreaker", { id: c.id })}
                    >
                      {c.is_tiebreaker ? "Critério de desempate atual" : "Definir como desempate"}
                    </button>
                  )}
                  <button className="btn btn-ghost" onClick={() => edit(c)}>
                    Editar critério
                  </button>
                </div>
              )}
            </div>
            <ol>
              {c.descriptors.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ol>
          </article>
        ))}
        {!data.criteria.length && <Empty>Nenhum critério cadastrado</Empty>}
      </Card>
      {data.capabilities.manageCriteria && (
        <Card>
          <h2 className="section-title">
            {editing ? "Editar critério" : "Novo critério"}
          </h2>
          <form className="workspace-form" onSubmit={submit}>
            <InputField label="Nome do critério">
              <input
                required
                maxLength={200}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </InputField>
            <InputField label="Peso">
              <input
                required
                type="number"
                min={0.01}
                max={100}
                step={0.01}
                value={weight}
                onChange={(e) => setWeight(Number(e.target.value))}
              />
            </InputField>
            {rubric.map((d, i) => (
              <InputField key={i} label={`Descritor da nota ${i + 1}`}>
                <input
                  required
                  maxLength={1000}
                  value={d}
                  onChange={(e) =>
                    setRubric(
                      rubric.map((v, j) => (i === j ? e.target.value : v)),
                    )
                  }
                />
              </InputField>
            ))}
            {editing && (
              <label className="workspace-check">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                />
                Critério ativo para novas bancas
              </label>
            )}
            <SaveButton busy={busy}>Salvar critério</SaveButton>
            {editing && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setEditing("");
                  setName("");
                  setWeight(1);
                  setRubric(descriptors);
                  setActive(true);
                }}
              >
                Cancelar edição
              </button>
            )}
          </form>
        </Card>
      )}
    </>
  );
}
