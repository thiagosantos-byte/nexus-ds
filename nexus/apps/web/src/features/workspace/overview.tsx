import { useId, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Lightbulb,
  PanelsTopLeft,
  Sparkles,
  Trophy,
  UsersRound,
} from "lucide-react";
import { Link } from "wouter";
import type { WorkspaceData } from "./types";
import { buildInsights, type Insight, type InsightIcon, type InsightTone } from "../assistant/insights";
import "./overview.css";

const toneLabel: Record<InsightTone, string> = {
  positive: "Tudo certo",
  attention: "Atenção",
  critical: "Prioridade",
  neutral: "Informativo",
};

const iconFor: Record<InsightIcon, typeof Sparkles> = {
  clock: Clock3,
  users: UsersRound,
  clipboard: ClipboardCheck,
  trophy: Trophy,
  spark: Sparkles,
};

const stageLabels = ["Descoberta", "Protótipo", "Validação", "Concluído"];

function askNexus(prompt: string) {
  window.dispatchEvent(new CustomEvent("nexus:ask", { detail: { prompt } }));
}

export function WorkspaceOverview({
  data,
  roleLabel,
}: {
  data: WorkspaceData;
  roleLabel: string;
}) {
  const [year, setYear] = useState("");
  const [semester, setSemester] = useState("");
  const titleId = useId();
  const orbitId = useId();

  const availableYears = Array.from(
    new Set([
      ...data.projects.map((project) => project.year),
      ...data.events
        .map((event) => new Date(event.scheduled_at).getFullYear())
        .filter(Number.isFinite),
    ]),
  ).sort((a, b) => b - a);

  const inSelectedPeriod = (date: string) => {
    const value = new Date(date);
    if (!Number.isFinite(value.getTime())) return !year && !semester;
    return (
      (!year || value.getFullYear() === Number(year)) &&
      (!semester || (value.getMonth() < 6 ? 1 : 2) === Number(semester))
    );
  };

  const projects = data.projects.filter(
    (project) =>
      (!year || project.year === Number(year)) &&
      (!semester || project.semester === Number(semester)),
  );
  const activeProjects = projects.filter((project) => !project.archived);
  const events = data.events.filter((event) => inSelectedPeriod(event.scheduled_at));
  const eventIds = new Set(events.map((event) => event.id));
  const itemEvents = data.events.filter((event) => eventIds.has(event.id));
  const evaluations = data.evaluations.filter((evaluation) =>
    eventIds.has(evaluation.event_id),
  );
  const eventProjects = data.eventProjects.filter((item) => eventIds.has(item.event_id));
  const eventEvaluators = data.eventEvaluators.filter((item) =>
    eventIds.has(item.event_id),
  );

  const progressFor = (eventId: string) => {
    const projectIds = new Set(
      eventProjects.filter((item) => item.event_id === eventId).map((item) => item.project_id),
    );
    const evaluatorIds = new Set(
      eventEvaluators.filter((item) => item.event_id === eventId).map((item) => item.user_id),
    );
    const expected = projectIds.size * evaluatorIds.size;
    const submitted = new Set(
      data.evaluations
        .filter(
          (item) =>
            item.event_id === eventId &&
            projectIds.has(item.project_id) &&
            evaluatorIds.has(item.evaluator_id),
        )
        .map((item) => `${item.project_id}:${item.evaluator_id}`),
    ).size;
    return { expected, submitted, pending: Math.max(0, expected - submitted) };
  };

  const expectedEvaluations = itemEvents.reduce(
    (sum, event) => sum + progressFor(event.id).expected,
    0,
  );
  const open = itemEvents.filter((event) => event.status === "open").length;
  const drafts = itemEvents.filter((event) => event.status === "draft").length;
  const closed = itemEvents.filter((event) => event.status === "closed").length;
  const published = data.results.filter(
    (result) => eventIds.has(result.event_id) && result.published,
  ).length;
  const pending = data.memberships.filter((member) => member.status === "pending").length;

  const stageDistribution = stageLabels.map((label, index) => ({
    label,
    value: activeProjects.filter((project) => project.stage === label).length,
    tone: index + 1,
    symbol: ["circle", "square", "triangle", "diamond"][index],
  }));
  const maximumStageCount = Math.max(1, ...stageDistribution.map((stage) => stage.value));

  const evaluatedRatio = expectedEvaluations
    ? Math.min(1, evaluations.length / expectedEvaluations)
    : itemEvents.length
      ? 0
      : 1;
  const publishedRatio = closed ? Math.min(1, published / closed) : itemEvents.length ? 0 : 1;
  const maturityRatio = activeProjects.length
    ? activeProjects.filter((project) => ["Validação", "Concluído"].includes(project.stage)).length /
      activeProjects.length
    : 0;
  const eventRatio = itemEvents.length ? (open + closed) / itemEvents.length : 0;
  const readiness = Math.round(
    (evaluatedRatio * 0.35 + maturityRatio * 0.25 + eventRatio * 0.2 + publishedRatio * 0.2) * 100,
  );

  const orbitNodes = [
    {
      label: "Projetos ativos",
      value: activeProjects.length,
      percent: projects.length ? Math.round((activeProjects.length / projects.length) * 100) : 0,
      color: "var(--chart-1)",
      shape: "circle",
      href: "/app/projects",
    },
    {
      label: "Bancas em curso",
      value: open + drafts,
      percent: itemEvents.length ? Math.round(((open + drafts) / itemEvents.length) * 100) : 0,
      color: "var(--chart-2)",
      shape: "square",
      href: "/app/events",
    },
    {
      label: "Avaliações",
      value: evaluations.length,
      percent: Math.round(evaluatedRatio * 100),
      color: "var(--chart-3)",
      shape: "triangle",
      href: data.capabilities.evaluate ? "/app/evaluations" : "/app/events",
    },
    {
      label: "Resultados",
      value: published,
      percent: Math.round(publishedRatio * 100),
      color: "var(--chart-4)",
      shape: "diamond",
      href: "/app/results",
    },
  ];

  const insights = buildInsights(data).slice(0, 4);
  const upcoming = itemEvents
    .filter((event) => ["open", "draft"].includes(event.status))
    .slice()
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
    .slice(0, 4);
  const recentProjects = activeProjects
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 4);

  const actions = [
    ...(data.capabilities.manageMembers
      ? [
          {
            title: "Revisar solicitações de acesso",
            description: `${pending} ${pending === 1 ? "solicitação aguardando decisão" : "solicitações aguardando decisão"}.`,
            label: "Revisar acessos",
            href: "/app/members",
          },
        ]
      : []),
    ...(data.capabilities.manageEvents
      ? [
          {
            title: "Preparar bancas",
            description: `${drafts} ${drafts === 1 ? "banca em preparação" : "bancas em preparação"}.`,
            label: "Organizar bancas",
            href: "/app/events",
          },
        ]
      : []),
    ...(data.capabilities.evaluate
      ? [
          {
            title: "Minhas avaliações",
            description: "Bancas e projetos atribuídos a você.",
            label: "Ver avaliações",
            href: "/app/evaluations",
          },
        ]
      : []),
    {
      title: "Resultados publicados",
      description: `${published} disponíveis no período selecionado.`,
      label: "Ver resultados",
      href: "/app/results",
    },
  ];

  return (
    <div className="nx-dash">
      <section className="nx-hero" aria-labelledby={titleId}>
        <div className="nx-aurora" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="nx-hero-copy">
          <p className="nx-kicker">
            <Activity size={14} aria-hidden="true" />
            Sala de comando · {data.institution.name}
          </p>
          <h2 id={titleId}>
            O ciclo inteiro
            <br />
            em um só olhar.
          </h2>
          <p className="nx-lead">
            {activeProjects.length} projetos ativos, {open + drafts} bancas em curso e{" "}
            {published} resultados publicados. O Nexus sinaliza o que pede decisão
            antes de virar atraso.
          </p>
          <div className="nx-hero-tags">
            <span className="nx-tag">{roleLabel}</span>
            <span className="nx-tag nx-tag-muted">
              {year ? `Ano ${year}` : "Todos os anos"}
            </span>
            <span className="nx-tag nx-tag-muted">
              {semester ? `${semester}º semestre` : "Ambos os semestres"}
            </span>
          </div>
          <div className="nx-hero-actions">
            <button
              type="button"
              className="nx-ai-cta"
              onClick={() =>
                askNexus("Faça um resumo do meu panorama e diga o que merece atenção agora.")
              }
            >
              <Sparkles size={17} aria-hidden="true" />
              Perguntar à Nexus IA
            </button>
            <Link className="nx-ghost-cta" href="/app/events">
              Abrir bancas <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>

        <div className="nx-hero-side">
          <div className="nx-period" role="group" aria-label="Filtros do painel">
            <label className="nx-period-field">
              <span>Ano</span>
              <select value={year} onChange={(event) => setYear(event.target.value)}>
                <option value="">Todos</option>
                {availableYears.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label className="nx-period-field">
              <span>Semestre</span>
              <select value={semester} onChange={(event) => setSemester(event.target.value)}>
                <option value="">Todos</option>
                <option value="1">1º</option>
                <option value="2">2º</option>
              </select>
            </label>
          </div>

          <div className="nx-orbit" aria-labelledby={`${orbitId}-title`}>
            <p id={`${orbitId}-title`} className="sr-only">
              Órbita do ciclo: prontidão {readiness} por cento, com{" "}
              {orbitNodes.map((node) => `${node.value} ${node.label}`).join(", ")}.
            </p>
            <svg
              viewBox="0 0 240 240"
              className="nx-orbit-svg"
              role="img"
              aria-label={`Prontidão do ciclo: ${readiness} de 100`}
            >
              <defs>
                <radialGradient id={`${orbitId}-core`} cx="50%" cy="45%" r="65%">
                  <stop offset="0%" stopColor="#a4e3d1" stopOpacity="0.55" />
                  <stop offset="100%" stopColor="#a4e3d1" stopOpacity="0" />
                </radialGradient>
              </defs>
              <circle cx="120" cy="120" r="52" fill={`url(#${orbitId}-core)`} />
              {[112, 88, 64].map((radius, index) => (
                <circle
                  key={radius}
                  cx="120"
                  cy="120"
                  r={radius}
                  fill="none"
                  stroke="currentColor"
                  strokeOpacity={0.14 - index * 0.03}
                  strokeDasharray={index === 1 ? "3 6" : undefined}
                />
              ))}
              <circle
                cx="120"
                cy="120"
                r="112"
                fill="none"
                stroke="var(--mint)"
                strokeOpacity="0.28"
                strokeWidth="2"
              />
              {orbitNodes.map((node, index) => {
                const angle = (-90 + index * 90) * (Math.PI / 180);
                const radius = 112 - node.percent * 0.42;
                const x = 120 + Math.cos(angle) * radius;
                const y = 120 + Math.sin(angle) * radius;
                return (
                  <g key={node.label}>
                    <line
                      x1="120"
                      y1="120"
                      x2={x}
                      y2={y}
                      stroke={node.color}
                      strokeOpacity="0.3"
                      strokeWidth="1.5"
                    />
                    {node.shape === "circle" && (
                      <circle cx={x} cy={y} r="10" fill={node.color} />
                    )}
                    {node.shape === "square" && (
                      <rect x={x - 9} y={y - 9} width="18" height="18" rx="3" fill={node.color} />
                    )}
                    {node.shape === "triangle" && (
                      <polygon
                        points={`${x},${y - 11} ${x + 10},${y + 8} ${x - 10},${y + 8}`}
                        fill={node.color}
                      />
                    )}
                    {node.shape === "diamond" && (
                      <polygon
                        points={`${x},${y - 11} ${x + 11},${y} ${x},${y + 11} ${x - 11},${y}`}
                        fill={node.color}
                      />
                    )}
                    <text
                      x={x}
                      y={y + 3.5}
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="800"
                      fill={index === 2 ? "#1c1403" : "#ffffff"}
                    >
                      {node.value}
                    </text>
                  </g>
                );
              })}
              <text
                x="120"
                y="114"
                textAnchor="middle"
                fontSize="27"
                fontWeight="750"
                fill="currentColor"
                className="nx-orbit-score"
              >
                {readiness}
              </text>
              <text
                x="120"
                y="132"
                textAnchor="middle"
                fontSize="8.5"
                letterSpacing="1.3"
                fill="currentColor"
                opacity="0.7"
              >
                PRONTIDÃO
              </text>
            </svg>
            <ul className="nx-orbit-legend">
              {orbitNodes.map((node) => (
                <li key={node.label}>
                  <Link href={node.href}>
                    <span
                      className={`nx-node-shape shape-${node.shape}`}
                      style={{ background: node.color }}
                      aria-hidden="true"
                    />
                    <span className="nx-node-label">{node.label}</span>
                    <strong>{node.value}</strong>
                    <span className="nx-node-percent">{node.percent}%</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="nx-signals" aria-labelledby="nx-signals-title">
        <div className="nx-section-head">
          <div>
            <p className="nx-kicker">
              <Sparkles size={14} aria-hidden="true" />
              Pulso Nexus
            </p>
            <h3 id="nx-signals-title">Sinais que pedem decisão</h3>
          </div>
          <p className="nx-section-note">
            Leitura dos seus dados, sem previsões. Cada sinal leva à ação
            correspondente.
          </p>
        </div>
        <div className="nx-signal-grid">
          {insights.map((insight) => (
            <SignalCard key={insight.id} insight={insight} />
          ))}
        </div>
      </section>

      <section className="nx-cycle" aria-labelledby="nx-cycle-title">
        <div className="nx-section-head">
          <div>
            <p className="nx-kicker">
              <Activity size={14} aria-hidden="true" />
              Linha do ciclo
            </p>
            <h3 id="nx-cycle-title">Da iniciativa ao reconhecimento</h3>
          </div>
          <p className="nx-section-note">
            Contagens do período selecionado. Não representam uma taxa de
            conclusão.
          </p>
        </div>
        <ol className="nx-cycle-track">
          {[
            { label: "Projetos", value: activeProjects.length, detail: `${projects.length - activeProjects.length} arquivados`, tone: 1 },
            { label: "Preparação", value: drafts, detail: "bancas em rascunho", tone: 2 },
            { label: "Bancas abertas", value: open, detail: "recebendo notas", tone: 3 },
            { label: "Avaliações", value: evaluations.length, detail: expectedEvaluations ? `de ${expectedEvaluations} esperadas` : "registros visíveis", tone: 4 },
            { label: "Publicados", value: published, detail: "resultados oficiais", tone: 5 },
          ].map((stage, index) => (
            <li key={stage.label} style={{ ["--tone" as string]: `var(--chart-${stage.tone})` }}>
              <span className="nx-cycle-node" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <span className="nx-cycle-label">{stage.label}</span>
                <strong>{stage.value}</strong>
                <span className="nx-cycle-detail">{stage.detail}</span>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <div className="nx-grid">
        <section className="nx-card nx-distribution" aria-labelledby="nx-dist-title">
          <div className="nx-card-head">
            <div>
              <p className="nx-kicker">Etapas dos projetos</p>
              <h3 id="nx-dist-title">Onde a energia está agora</h3>
            </div>
            <span className="nx-badge">{activeProjects.length} ativos</span>
          </div>
          <ul className="nx-bars">
            {stageDistribution.map((stage) => (
              <li key={stage.label}>
                <span className="nx-bar-label">
                  <i
                    className={`nx-node-shape shape-${stage.symbol}`}
                    style={{ background: `var(--chart-${stage.tone})` }}
                    aria-hidden="true"
                  />
                  {stage.label}
                </span>
                <span
                  className="nx-bar-track"
                  role="img"
                  aria-label={`${stage.label}: ${stage.value} de ${activeProjects.length} projetos ativos`}
                >
                  <span
                    className={`nx-bar-fill pattern-${stage.tone}`}
                    style={{ width: `${(stage.value / maximumStageCount) * 100}%` }}
                  />
                </span>
                <strong>{stage.value}</strong>
              </li>
            ))}
          </ul>
          <p className="nx-card-note">
            {activeProjects.length
              ? `${Math.round((activeProjects.filter((project) => ["Validação", "Concluído"].includes(project.stage)).length / activeProjects.length) * 100)}% dos projetos já estão em validação ou concluídos.`
              : "Nenhum projeto ativo no período selecionado."}
          </p>
          <button
            type="button"
            className="nx-text-action"
            onClick={() => askNexus("Como estão distribuídos os projetos por etapa e o que isso indica?")}
          >
            Pedir leitura à Nexus IA <ArrowUpRight size={15} aria-hidden="true" />
          </button>
        </section>

        <section className="nx-card nx-agenda" aria-labelledby="nx-agenda-title">
          <div className="nx-card-head">
            <div>
              <p className="nx-kicker">Radar de bancas</p>
              <h3 id="nx-agenda-title">Próximos encontros</h3>
            </div>
            <Link className="nx-mini-link" href="/app/events">
              Ver todas
            </Link>
          </div>
          {upcoming.length ? (
            <ul className="nx-agenda-list">
              {upcoming.map((event) => {
                const progress = progressFor(event.id);
                const percent = progress.expected
                  ? Math.round((progress.submitted / progress.expected) * 100)
                  : 0;
                return (
                  <li key={event.id}>
                    <span
                      className={`nx-status-pill ${event.status}`}
                      data-label={event.status === "open" ? "Aberta" : "Preparação"}
                    >
                      <span className="nx-status-shape" aria-hidden="true" />
                      {event.status === "open" ? "Aberta" : "Preparação"}
                    </span>
                    <div>
                      <strong>{event.name}</strong>
                      <span>
                        {new Date(event.scheduled_at).toLocaleString("pt-BR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </span>
                    </div>
                    <span
                      className="nx-mini-progress"
                      role="img"
                      aria-label={`${percent}% das avaliações registradas`}
                    >
                      <i style={{ width: `${percent}%` }} />
                      <em>{percent}%</em>
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="nx-empty">
              Sem bancas abertas ou em preparação no período. As próximas
              aparecerão aqui.
            </p>
          )}
        </section>

        <section className="nx-card nx-actions" aria-labelledby="nx-actions-title">
          <div className="nx-card-head">
            <div>
              <p className="nx-kicker">Próximos passos</p>
              <h3 id="nx-actions-title">O que pede atenção</h3>
            </div>
          </div>
          <ul className="nx-action-list">
            {actions.map((action) => (
              <li key={action.href}>
                <div>
                  <h4>{action.title}</h4>
                  <p>{action.description}</p>
                </div>
                <Link href={action.href} className="nx-mini-link">
                  {action.label}
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="nx-card nx-projects" aria-labelledby="nx-projects-title">
          <div className="nx-card-head">
            <div>
              <p className="nx-kicker">Acompanhamento</p>
              <h3 id="nx-projects-title">Projetos em foco</h3>
            </div>
            <Link className="nx-mini-link" href="/app/projects">
              Ver todos
            </Link>
          </div>
          {recentProjects.length ? (
            <ul className="nx-project-list">
              {recentProjects.map((project) => (
                <li key={project.id}>
                  <span className="nx-project-mark" aria-hidden="true">
                    {project.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <strong>{project.name}</strong>
                    <span>
                      {[project.category, `${project.year}.${project.semester}`]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </div>
                  <span className={`nx-stage-chip stage-${project.stage.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}`}>
                    {project.stage}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="nx-empty">Nenhum projeto no período selecionado.</p>
          )}
        </section>
      </div>

      <footer className="nx-dash-foot">
        <span>
          <CheckCircle2 size={15} aria-hidden="true" />
          Dados visíveis apenas ao seu perfil nesta instituição.
        </span>
        <span>
          <Lightbulb size={15} aria-hidden="true" />
          A Nexus IA explica qualquer número deste painel.
        </span>
      </footer>
    </div>
  );
}

function SignalCard({ insight }: { insight: Insight }) {
  const Icon = iconFor[insight.icon] ?? Sparkles;
  return (
    <article className={`nx-signal tone-${insight.tone}`}>
      <header>
        <span className="nx-signal-icon" aria-hidden="true">
          <Icon size={18} />
        </span>
        <span className="nx-signal-tone">
          {insight.tone === "critical" && <AlertTriangle size={13} aria-hidden="true" />}
          {insight.tone === "positive" && <CheckCircle2 size={13} aria-hidden="true" />}
          {toneLabel[insight.tone]}
        </span>
        {insight.metric && <span className="nx-signal-metric">{insight.metric}</span>}
      </header>
      <h4>{insight.title}</h4>
      <p>{insight.detail}</p>
      <div className="nx-signal-foot">
        {insight.action && (
          <Link href={insight.action.href} className="nx-mini-link">
            {insight.action.label}
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        )}
        <button type="button" className="nx-ask-inline" onClick={() => askNexus(insight.prompt)}>
          <Sparkles size={14} aria-hidden="true" />
          Perguntar
        </button>
      </div>
    </article>
  );
}
