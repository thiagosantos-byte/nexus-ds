import { apiFetch } from "../../lib/api";
import { useEffect, useState } from "react";
import { useSearch } from "wouter";
import { PodiumExperience } from "../podium/PodiumExperience";
import { resultVersion } from "../podium/model";
import { SearchSelect } from "../../components/inputs/search-select";
import type { WorkspaceData } from "./types";
import { Card, Empty, InputField, score } from "./ui";

export function ResultsModule({
  data,
  token,
  userId,
  institutionId,
  mode,
}: {
  data: WorkspaceData;
  token: string;
  userId: string;
  institutionId: string;
  mode: "results" | "reports" | "podium";
}) {
  const search = useSearch();
  const requested = new URLSearchParams(search).get("banca") ?? "";
  const [eventId, setEventId] = useState(requested);
  useEffect(() => {
    if (
      requested &&
      data.results.some((result) => result.event_id === requested)
    )
      setEventId(requested);
  }, [requested]);
  const [query, setQuery] = useState("");
  const [exportYear, setExportYear] = useState("");
  const [exportSemester, setExportSemester] = useState("");
  const [exportStudent, setExportStudent] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const result =
    data.results.find((result) => result.event_id === eventId) ??
    data.results.find(
      (result) => result.published && result.status === "closed",
    ) ??
    data.results[0];
  async function download(type: "projects" | "results") {
    if (downloading) return;
    setDownloading(true);
    setError("");
    try {
      const params = new URLSearchParams({ type, format: "xlsx" });
      if (type === "results" && result) params.set("event", result.event_id);
      if (exportYear) params.set("year", exportYear);
      if (exportSemester) params.set("semester", exportSemester);
      if (exportStudent) params.set("student", exportStudent);
      const response = await apiFetch(
        `/api/workspace/${institutionId}/export?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
      );
      if (!response.ok)
        throw new Error("Exportação não disponível para este contexto.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `nexus-${type}.xlsx`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao exportar.");
    } finally {
      setDownloading(false);
    }
  }
  const filteredProjects = data.projects.filter((project) =>
    (!exportYear || project.year === Number(exportYear)) &&
    (!exportSemester || project.semester === Number(exportSemester)) &&
    (!exportStudent || data.participants.some((participant) =>
      participant.project_id === project.id &&
      participant.user_id === exportStudent &&
      participant.kind === "student"))
  );
  const filteredProjectIds = new Set(filteredProjects.map((project) => project.id));
  const hasPortfolioFilters = Boolean(exportYear || exportSemester || exportStudent);
  const rows = result?.rows.filter((r) =>
    (!hasPortfolioFilters || filteredProjectIds.has(r.id)) &&
    r.name.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR"))
  ) ?? [];
  return (
    <>
      <Card>
        <h2 className="section-title">
          {mode === "podium" ? "Pódio de premiação" : "Resultados e relatórios"}
        </h2>
        <p>
          Média ponderada pelos critérios de cada avaliação e média entre
          avaliadores. Empates na média final de quatro casas decimais são
          resolvidos pela maior média no critério prioritário da banca, quando
          definido. Se persistir o empate, os projetos compartilham a posição;
          a exibição usa duas casas. Resultados parciais ficam restritos à gestão.
        </p>
        {error && (
          <p role="alert" className="notice error">
            {error}
          </p>
        )}
        {downloading && <p role="status">Preparando arquivo…</p>}
        {mode !== "podium" && data.capabilities.manageEvents && (
          <>
            <h3>Projetos e relatórios</h3>
            <p>Os filtros abaixo atualizam a lista de projetos, a classificação exibida e o arquivo Excel.</p>
            <div className="workspace-filters">
              <InputField label="Ano">
                <select value={exportYear} onChange={(event) => setExportYear(event.target.value)}>
                  <option value="">Todos os anos</option>
                  {Array.from(new Set(data.projects.map((project) => project.year))).sort((a, b) => b - a).map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </InputField>
              <InputField label="Semestre">
                <select value={exportSemester} onChange={(event) => setExportSemester(event.target.value)}>
                  <option value="">Todos</option>
                  <option value="1">1º semestre</option>
                  <option value="2">2º semestre</option>
                </select>
              </InputField>
              <InputField label="Aluno">
                <SearchSelect
                  label="Filtrar por aluno"
                  value={exportStudent}
                  onChange={setExportStudent}
                  options={[
                    { value: "", label: "Todos os alunos" },
                    ...Array.from(new Set(data.participants.filter((participant) => participant.kind === "student").map((participant) => participant.user_id)))
                      .map((id) => ({ value: id, label: data.people.find((person) => person.id === id)?.name ?? "Aluno" }))
                      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR")),
                  ]}
                />
              </InputField>
            </div>
            <div className="workspace-actions">
              {data.capabilities.manageEvents && (
                <>
                  <button className="btn btn-primary" disabled={downloading} onClick={() => download("projects")}>
                    Exportar portfólio filtrado (.xlsx)
                  </button>
                  {result && (
                    <button className="btn btn-ghost" disabled={downloading} onClick={() => download("results")}>
                      Exportar resultado desta banca (.xlsx)
                    </button>
                  )}
                </>
              )}
            </div>
            <div className="table-wrap" tabIndex={0} role="region" aria-label="Projetos filtrados">
              <table>
                <thead><tr><th>Projeto</th><th>Etapa</th><th>Ciclo</th><th>Equipe</th></tr></thead>
                <tbody>
                  {filteredProjects.map((project) => (
                    <tr key={project.id}>
                      <td>{project.name}</td>
                      <td>{project.stage}</td>
                      <td>{project.year}.{project.semester}</td>
                      <td>{data.participants.filter((participant) => participant.project_id === project.id).map((participant) => data.people.find((person) => person.id === participant.user_id)?.name ?? "Pessoa vinculada").join(", ") || "Sem integrantes"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!filteredProjects.length && <Empty>Nenhum projeto corresponde aos filtros selecionados.</Empty>}
          </>
        )}
        {!data.results.length ? (
          <Empty>Ainda não há resultados disponíveis para seu perfil</Empty>
        ) : (
          <>
            <InputField label="Banca dos resultados">
              <SearchSelect
                label="Banca dos resultados"
                value={result?.event_id ?? ""}
                onChange={setEventId}
                options={data.results.map((result) => ({
                  value: result.event_id,
                  label: result.name,
                  description: result.published
                    ? "Publicado para a instituição"
                    : "Restrito à gestão",
                }))}
              />
            </InputField>
            <p className="notice">
              {result?.status === "closed"
                ? "Banca encerrada"
                : "Resultado parcial — avaliações em andamento"}{" "}
              ·{" "}
              {result?.published
                ? "Publicado para a instituição"
                : "Ainda não publicado"}
            </p>
            {mode === "podium" && result && (
              <PodiumExperience
                key={`${result.event_id}:${resultVersion(result)}`}
                result={result}
                userId={userId}
                institutionId={institutionId}
              />
            )}
            {mode !== "podium" && (
              <>
                <InputField label="Pesquisar no resultado">
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Nome do projeto"
                  />
                </InputField>
                <div
                  className="table-wrap"
                  tabIndex={0}
                  role="region"
                  aria-label="Classificação dos projetos"
                >
                  <table>
                    <thead>
                      <tr>
                        <th>Posição</th>
                        <th>Projeto</th>
                        <th>Média</th>
                        <th>Avaliações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.id}>
                          <td>{r.position ? `${r.position}º` : "—"}</td>
                          <td>{r.name}</td>
                          <td>{score(r.score)}</td>
                          <td>
                            {r.submitted}/{r.expected}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!rows.length && (
                  <Empty>
                    {result?.rows.length
                      ? "Nenhum projeto corresponde à pesquisa"
                      : "Nenhuma avaliação registrada nesta banca"}
                  </Empty>
                )}
              </>
            )}
          </>
        )}
      </Card>
    </>
  );
}
