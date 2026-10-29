import { SearchSelect } from "../../components/inputs/search-select";
import { useEffect, useState, type FormEvent } from "react";
import type { Command, Project, WorkspaceData } from "./types";
import { Card, Empty, InputField, SaveButton } from "./ui";

const blank = () => ({
  name: "",
  summary: "",
  category: "",
  stage: "Descoberta",
  year: new Date().getFullYear(),
  semester: 1,
  archived: false,
});
export function ProjectsModule({
  data,
  command,
  busy,
  userId,
}: {
  data: WorkspaceData;
  command: Command;
  busy: boolean;
  userId: string;
}) {
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("");
  const [year, setYear] = useState("");
  const [semester, setSemester] = useState("");
  const [studentId, setStudentId] = useState("");
  const [mentorId, setMentorId] = useState("");
  const [sortBy, setSortBy] = useState("created");
  const [page, setPage] = useState(1);
  const [showArchived, setShowArchived] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(blank);
  const [personId, setPersonId] = useState("");
  const [kind, setKind] = useState<"student" | "mentor">("student");
  const selected = data.projects.find((p) => p.id === selectedId);
  const manager = data.capabilities.manageProjects;
  const projectLocked = Boolean(selected && data.eventProjects.some((item) =>
    item.project_id === selected.id && data.events.some((event) =>
      event.id === item.event_id && event.status === "closed"
    )
  ));
  const canEdit =
    !projectLocked && (manager ||
    Boolean(
      selected &&
      data.participants.some(
        (p) =>
          p.project_id === selected.id &&
          p.user_id === userId &&
          p.kind === "student",
      ) &&
      data.memberships.some(
        (m) => m.user_id === userId && m.roles.includes("student"),
      ),
    ));
  function edit(project?: Project) {
    setEditing(project?.id ?? "new");
    setPersonId("");
    setForm(
      project
        ? {
            name: project.name,
            summary: project.summary,
            category: project.category,
            stage: project.stage,
            year: project.year,
            semester: project.semester,
            archived: project.archived,
          }
        : blank(),
    );
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    const id = editing === "new" ? {} : { id: editing };
    if (
      await command(
        "project.save",
        manager ? { ...form, ...id } : { id: editing, summary: form.summary },
      )
    ) {
      setEditing(null);
    }
  }
  const eligible = data.memberships.filter(
    (m) => m.status === "active" && m.roles.includes(kind),
  );
  const name = (id: string) =>
    data.people.find((p) => p.id === id)?.name ?? "Pessoa vinculada";
  const filtered = data.projects
    .filter((p) => {
      const projectPeople = data.participants
        .filter((participant) => participant.project_id === p.id)
        .map((participant) => name(participant.user_id))
        .join(" ");
      return (showArchived || !p.archived) &&
        (!stage || p.stage === stage) &&
        (!year || p.year === Number(year)) &&
        (!semester || p.semester === Number(semester)) &&
        (!studentId || data.participants.some((participant) => participant.project_id === p.id && participant.user_id === studentId && participant.kind === "student")) &&
        (!mentorId || data.participants.some((participant) => participant.project_id === p.id && participant.user_id === mentorId && participant.kind === "mentor")) &&
        `${p.name} ${p.summary} ${p.category} ${projectPeople}`
          .toLocaleLowerCase("pt-BR")
          .includes(search.toLocaleLowerCase("pt-BR"));
    })
    .sort((a, b) => sortBy === "name"
      ? a.name.localeCompare(b.name, "pt-BR")
      : sortBy === "year"
        ? b.year - a.year || b.semester - a.semester || a.name.localeCompare(b.name, "pt-BR")
        : sortBy === "semester"
          ? b.year - a.year || b.semester - a.semester
          : b.created_at.localeCompare(a.created_at));
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visibleProjects = filtered.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => {
    setPage(1);
  }, [search, stage, year, semester, studentId, mentorId, sortBy, showArchived]);
  return (
    <>
      <Card>
        <div className="section-head">
          <h2 className="section-title">Projetos e equipes</h2>
          {manager && (
            <button className="btn btn-primary" onClick={() => edit()}>
              Novo projeto
            </button>
          )}
        </div>
        <div className="workspace-filters">
          <InputField label="Pesquisar projetos">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nome, descrição ou categoria"
            />
          </InputField>
          <InputField label="Etapa">
            <select value={stage} onChange={(e) => setStage(e.target.value)}>
              <option value="">Todas</option>
              {["Descoberta", "Protótipo", "Validação", "Concluído"].map(
                (v) => (
                  <option key={v}>{v}</option>
                ),
              )}
            </select>
          </InputField>
          <InputField label="Ano">
            <select value={year} onChange={(e) => setYear(e.target.value)}>
              <option value="">Todos</option>
              {Array.from(new Set(data.projects.map((p) => p.year)))
                .sort()
                .reverse()
                .map((v) => (
                  <option key={v}>{v}</option>
                ))}
            </select>
          </InputField>
          <InputField label="Semestre">
            <select value={semester} onChange={(e) => setSemester(e.target.value)}>
              <option value="">Todos</option>
              <option value="1">1º semestre</option>
              <option value="2">2º semestre</option>
            </select>
          </InputField>
          <InputField label="Aluno">
            <select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              <option value="">Todos os alunos</option>
              {Array.from(new Set(data.participants.filter((participant) => participant.kind === "student").map((participant) => participant.user_id)))
                .map((id) => ({ id, name: name(id) }))
                .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
                .map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
            </select>
          </InputField>
          <label className="workspace-check">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Incluir arquivados
          </label>
        </div>
        <div
          className="table-wrap"
          tabIndex={0}
          role="region"
          aria-label="Lista de projetos"
        >
          <table className="project-table">
            <thead>
              <tr>
                <th>Projeto</th>
                <th>Etapa</th>
                <th>Ciclo</th>
                <th>Equipe</th>
              </tr>
            </thead>
            <tbody>
              {visibleProjects.map((p) => (
                <tr
                  key={p.id}
                  className={selectedId === p.id ? "selected" : ""}
                  onClick={(event) => {
                    if (
                      (event.target as HTMLElement).closest("button, a, input")
                    )
                      return;
                    setSelectedId(p.id);
                    setEditing(null);
                    requestAnimationFrame(() =>
                      document
                        .getElementById("project-detail")
                        ?.scrollIntoView({
                          block: "start",
                          behavior: "instant",
                        }),
                    );
                  }}
                >
                  <td>
                    <button
                      className="row-link"
                      onClick={() => {
                        setSelectedId(p.id);
                        setEditing(null);
                        requestAnimationFrame(() =>
                          document
                            .getElementById("project-detail")
                            ?.scrollIntoView({
                              block: "start",
                              behavior: "instant",
                            }),
                        );
                      }}
                    >
                      {p.name}
                    </button>
                    {p.archived && <span> · Arquivado</span>}
                    <div className="section-sub">{p.category}</div>
                  </td>
                  <td>{p.stage}</td>
                  <td>
                    {p.year}.{p.semester}
                  </td>
                  <td>
                    {data.participants
                      .filter((x) => x.project_id === p.id)
                      .map((x) => name(x.user_id))
                      .join(", ") || "Sem integrantes"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > pageSize && (
          <nav className="workspace-actions" aria-label="Paginação dos projetos">
            <button className="btn btn-ghost" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
              Página anterior
            </button>
            <span aria-live="polite">Página {page} de {pageCount} · {filtered.length} projetos</span>
            <button className="btn btn-ghost" disabled={page >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>
              Próxima página
            </button>
          </nav>
        )}
        {!filtered.length && (
          <Empty>
            {data.projects.length
              ? "Nenhum projeto corresponde aos filtros"
              : "Nenhum projeto disponível no seu contexto"}
          </Empty>
        )}
      </Card>
      {editing !== null && (
        <Card>
          <h2 className="section-title">
            {editing === "new" ? "Novo projeto" : "Editar projeto"}
          </h2>
          <form className="workspace-form" onSubmit={submit}>
            {manager && (
              <InputField label="Nome do projeto">
                <input
                  required
                  maxLength={200}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </InputField>
            )}
            <InputField label="Descrição do projeto">
              <textarea
                required
                maxLength={10000}
                value={form.summary}
                onChange={(e) => setForm({ ...form, summary: e.target.value })}
              />
            </InputField>
            {manager && (
              <>
                <InputField label="Categoria">
                  <input
                    maxLength={100}
                    value={form.category}
                    onChange={(e) =>
                      setForm({ ...form, category: e.target.value })
                    }
                  />
                </InputField>
                <InputField label="Etapa do projeto">
                  <select
                    value={form.stage}
                    onChange={(e) =>
                      setForm({ ...form, stage: e.target.value })
                    }
                  >
                    {["Descoberta", "Protótipo", "Validação", "Concluído"].map(
                      (v) => (
                        <option key={v}>{v}</option>
                      ),
                    )}
                  </select>
                </InputField>
                <InputField label="Ano do ciclo">
                  <input
                    type="number"
                    required
                    min={2000}
                    max={2100}
                    value={form.year}
                    onChange={(e) =>
                      setForm({ ...form, year: Number(e.target.value) })
                    }
                  />
                </InputField>
                <InputField label="Semestre">
                  <select
                    value={form.semester}
                    onChange={(e) =>
                      setForm({ ...form, semester: Number(e.target.value) })
                    }
                  >
                    <option value={1}>1º</option>
                    <option value={2}>2º</option>
                  </select>
                </InputField>
                {editing !== "new" && (
                  <label className="workspace-check">
                    <input
                      type="checkbox"
                      checked={form.archived}
                      onChange={(e) =>
                        setForm({ ...form, archived: e.target.checked })
                      }
                    />
                    Arquivar projeto
                  </label>
                )}
              </>
            )}
            <SaveButton busy={busy}>Salvar projeto</SaveButton>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setEditing(null)}
            >
              Cancelar
            </button>
          </form>
        </Card>
      )}
      {selected && editing === null && (
        <section
          id="project-detail"
          className="project-detail"
          aria-label="Detalhes do projeto"
        >
          <Card>
            <div className="section-head">
              <h2 className="section-title">{selected.name}</h2>
              {canEdit && (
                <button
                  className="btn btn-primary"
                  onClick={() => edit(selected)}
                >
                  {manager ? "Editar projeto" : "Editar descrição"}
                </button>
              )}
            </div>
            {projectLocked && <p className="notice" role="status">Este projeto está bloqueado para edição porque já pertence a uma banca encerrada. Os dados e integrantes foram congelados para preservar o resultado.</p>}
            <p style={{ whiteSpace: "pre-wrap" }}>{selected.summary}</p>
            <p>
              {selected.category} · {selected.stage} · {selected.year}.
              {selected.semester}
            </p>
            <h3 className="section-title">Integrantes e orientadores</h3>
            {data.participants
              .filter((p) => p.project_id === selected.id)
              .map((p) => (
                <div className="workspace-row" key={`${p.user_id}:${p.kind}`}>
                  <span>
                    {name(p.user_id)} ·{" "}
                    {p.kind === "mentor" ? "Orientador" : "Aluno"}
                  </span>
                  {manager && (
                    <button
                      className="btn btn-ghost"
                      disabled={busy || projectLocked}
                      onClick={() =>
                        command("project.team", {
                          id: selected.id,
                          user_id: p.user_id,
                          kind: p.kind,
                          remove: true,
                        })
                      }
                    >
                      Remover
                    </button>
                  )}
                </div>
              ))}
            {manager && !projectLocked && (
              <form
                className="workspace-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (personId)
                    void command("project.team", {
                      id: selected.id,
                      user_id: personId,
                      kind,
                    });
                }}
              >
                <InputField label="Tipo de participante">
                  <select
                    value={kind}
                    onChange={(e) => {
                      setKind(e.target.value as "student" | "mentor");
                      setPersonId("");
                    }}
                  >
                    <option value="student">Aluno</option>
                    <option value="mentor">Orientador</option>
                  </select>
                </InputField>
                <InputField label="Pessoa para vincular">
                  <SearchSelect
                    label="Pessoa para vincular"
                    required
                    value={personId}
                    onChange={setPersonId}
                    disabled={busy}
                    options={eligible.map((member) => ({
                      value: member.user_id,
                      label: name(member.user_id),
                      description:
                        kind === "mentor"
                          ? "Orientador · vínculo ativo"
                          : "Aluno · vínculo ativo",
                    }))}
                  />
                </InputField>
                <SaveButton busy={busy}>Adicionar à equipe</SaveButton>
              </form>
            )}
          </Card>
        </section>
      )}
    </>
  );
}
