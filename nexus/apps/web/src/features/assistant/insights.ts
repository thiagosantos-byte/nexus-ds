import type { Event, Result, WorkspaceData } from "../workspace/types";

export type InsightTone = "positive" | "attention" | "critical" | "neutral";
export type InsightIcon = "clock" | "users" | "clipboard" | "trophy" | "spark";

export type Insight = {
  id: string;
  tone: InsightTone;
  icon: InsightIcon;
  title: string;
  detail: string;
  metric?: string;
  action?: { label: string; href: string };
  prompt: string;
};

const DAY = 86_400_000;

function submittedFor(data: WorkspaceData, event: Event) {
  const projectIds = new Set(
    data.eventProjects
      .filter((item) => item.event_id === event.id)
      .map((item) => item.project_id),
  );
  const evaluatorIds = new Set(
    data.eventEvaluators
      .filter((item) => item.event_id === event.id)
      .map((item) => item.user_id),
  );
  const submitted = new Set(
    data.evaluations
      .filter(
        (item) =>
          item.event_id === event.id &&
          projectIds.has(item.project_id) &&
          evaluatorIds.has(item.evaluator_id),
      )
      .map((item) => `${item.project_id}:${item.evaluator_id}`),
  );
  const expected = projectIds.size * evaluatorIds.size;
  return { expected, submitted: submitted.size, pending: Math.max(0, expected - submitted.size) };
}

export function latestResult(data: WorkspaceData) {
  return data.results
    .filter((result) => result.published)
    .slice()
    .sort((a, b) => b.name.localeCompare(a.name))[0];
}

export function buildInsights(data: WorkspaceData, now = new Date()): Insight[] {
  const insights: Insight[] = [];
  const activeProjects = data.projects.filter((project) => !project.archived);
  const pendingMembers = data.memberships.filter((member) => member.status === "pending");
  const openEvents = data.events.filter((event) => event.status === "open");
  const closedWithoutResults = data.events.filter(
    (event) => event.status === "closed" && !event.results_published,
  );

  if (pendingMembers.length) {
    insights.push({
      id: "pending-access",
      tone: "attention",
      icon: "users",
      title: `${pendingMembers.length} ${pendingMembers.length === 1 ? "pessoa aguarda" : "pessoas aguardam"} aprovação`,
      detail:
        "Vínculos pendentes não veem projetos nem bancas. Revisar libera o trabalho da equipe.",
      metric: `${pendingMembers.length}`,
      action: { label: "Revisar acessos", href: "/app/members" },
      prompt: "Quais acessos estão pendentes e o que devo fazer?",
    });
  }

  const next = data.events
    .filter((event) => ["open", "draft"].includes(event.status))
    .map((event) => ({ event, when: new Date(event.scheduled_at).getTime() }))
    .filter((item) => Number.isFinite(item.when) && item.when >= now.getTime() - DAY)
    .sort((a, b) => a.when - b.when)[0];

  if (next) {
    const days = Math.ceil((next.when - now.getTime()) / DAY);
    insights.push({
      id: "next-event",
      tone: days <= 3 ? "critical" : "neutral",
      icon: "clock",
      title:
        days <= 0
          ? `${next.event.name} é hoje`
          : `${next.event.name} em ${days} ${days === 1 ? "dia" : "dias"}`,
      detail:
        next.event.status === "draft"
          ? "A banca ainda está em preparação. Defina critérios e avaliadores antes da abertura."
          : "Confira se todos os avaliadores designados já enviaram as notas.",
      metric: days <= 0 ? "hoje" : `${days}d`,
      action: { label: "Abrir bancas", href: "/app/events" },
      prompt: `Como está a preparação da banca ${next.event.name}?`,
    });
  }

  for (const event of openEvents.slice(0, 2)) {
    const progress = submittedFor(data, event);
    if (progress.expected && progress.pending > 0) {
      const percent = Math.round((progress.submitted / progress.expected) * 100);
      insights.push({
        id: `evals-${event.id}`,
        tone: percent < 50 ? "critical" : "attention",
        icon: "clipboard",
        title: `${progress.pending} ${progress.pending === 1 ? "avaliação falta" : "avaliações faltam"} em ${event.name}`,
        detail: `${progress.submitted} de ${progress.expected} combinações projeto × avaliador foram registradas.`,
        metric: `${percent}%`,
        action: { label: "Ver avaliações", href: "/app/evaluations" },
        prompt: `Quantas avaliações faltam na banca ${event.name}?`,
      });
    }
  }

  if (closedWithoutResults.length) {
    insights.push({
      id: "publish-results",
      tone: "attention",
      icon: "trophy",
      title: `${closedWithoutResults.length} ${closedWithoutResults.length === 1 ? "banca encerrada sem publicação" : "bancas encerradas sem publicação"}`,
      detail:
        "As notas estão registradas, mas a comunidade ainda não vê os resultados. Publicar fecha o ciclo.",
      metric: `${closedWithoutResults.length}`,
      action: { label: "Publicar resultados", href: "/app/results" },
      prompt: "Quais resultados posso publicar agora?",
    });
  }

  const newest = data.events
    .filter((event) => event.status === "open")
    .map((event) => ({ event, progress: submittedFor(data, event) }))
    .sort((a, b) => b.progress.submitted - a.progress.submitted)[0];
  if (newest && newest.progress.submitted > 0) {
    const scores = data.evaluations
      .filter((item) => item.event_id === newest.event.id)
      .map((item) => item.average)
      .filter((value) => Number.isFinite(value));
    if (scores.length) {
      const average = scores.reduce((sum, value) => sum + value, 0) / scores.length;
      insights.push({
        id: "live-average",
        tone: "positive",
        icon: "spark",
        title: `Média parcial ${average.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        detail: `Calculada sobre ${scores.length} ${scores.length === 1 ? "avaliação" : "avaliações"} da banca ${newest.event.name}.`,
        metric: average.toFixed(1),
        action: { label: "Acompanhar", href: "/app/results" },
        prompt: `Como estão as notas parciais da banca ${newest.event.name}?`,
      });
    }
  }

  if (activeProjects.length) {
    const stages = ["Descoberta", "Protótipo", "Validação", "Concluído"];
    const counts = stages.map(
      (stage) => activeProjects.filter((project) => project.stage === stage).length,
    );
    const leader = stages[counts.indexOf(Math.max(...counts))];
    insights.push({
      id: "stage-focus",
      tone: "neutral",
      icon: "spark",
      title: `${Math.max(...counts)} ${Math.max(...counts) === 1 ? "projeto está" : "projetos estão"} em ${leader}`,
      detail: `São ${activeProjects.length} projetos ativos. Considere orientação extra para quem está em ${leader}.`,
      metric: `${activeProjects.length}`,
      action: { label: "Ver projetos", href: "/app/projects" },
      prompt: `Como estão distribuídos os projetos por etapa?`,
    });
  }

  if (!insights.length) {
    insights.push({
      id: "all-clear",
      tone: "positive",
      icon: "spark",
      title: "Nenhum sinal crítico agora",
      detail:
        "Não há acessos pendentes, avaliações atrasadas ou resultados represados neste período.",
      action: { label: "Ver projetos", href: "/app/projects" },
      prompt: "Faça um resumo do meu panorama atual.",
    });
  }

  return insights;
}

export function workspaceSnapshot(data: WorkspaceData) {
  const activeProjects = data.projects.filter((project) => !project.archived);
  return {
    institution: data.institution.name,
    period: `${new Date().getFullYear()}`,
    counts: {
      projects: activeProjects.length,
      archived: data.projects.length - activeProjects.length,
      eventsOpen: data.events.filter((event) => event.status === "open").length,
      eventsDraft: data.events.filter((event) => event.status === "draft").length,
      eventsClosed: data.events.filter((event) => event.status === "closed").length,
      evaluations: data.evaluations.length,
      pendingMembers: data.memberships.filter((member) => member.status === "pending").length,
      publishedResults: data.results.filter((result) => result.published).length,
    },
    events: data.events.slice(0, 12).map((event) => {
      const progress = submittedFor(data, event);
      return {
        name: event.name,
        status: event.status,
        date: event.scheduled_at,
        evaluationsExpected: progress.expected,
        evaluationsSubmitted: progress.submitted,
        resultsPublished: event.results_published,
      };
    }),
    projects: activeProjects.slice(0, 20).map((project) => ({
      name: project.name,
      stage: project.stage,
      category: project.category,
      year: project.year,
      semester: project.semester,
    })),
    results: data.results
      .filter((result) => result.published)
      .slice(0, 4)
      .map((result: Result) => ({
        event: result.name,
        top: result.rows
          .slice()
          .sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
          .slice(0, 3)
          .map((row) => ({ project: row.name, score: row.score })),
      })),
  };
}

type Answer = { answer: string; suggestions: string[] };

const number = (value: number) => value.toLocaleString("pt-BR");

export function localAnswer(question: string, data: WorkspaceData): Answer {
  const q = question
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const activeProjects = data.projects.filter((project) => !project.archived);
  const pending = data.memberships.filter((member) => member.status === "pending").length;
  const openEvents = data.events.filter((event) => event.status === "open");
  const published = data.results.filter((result) => result.published);
  const suggestions = [
    "Como está o ciclo avaliativo?",
    "Quais avaliações estão pendentes?",
    "Quais resultados posso publicar?",
    "Como usar os recursos de acessibilidade?",
  ];

  const has = (...words: string[]) => words.some((word) => q.includes(word));

  if (has("acessibilidade", "dalton", "cego", "surdo", "mudo", "libras", "leitor de tela", "legenda")) {
    return {
      answer:
        "O Nexus foi desenhado para funcionar com diferentes formas de perceber e se comunicar:\n\n" +
        "• Daltonismo: ajustes para protanopia, deuteranopia, tritanopia e acromatopsia, além de paleta segura e padrões nos gráficos. A cor nunca é a única informação.\n" +
        "• Pessoas cegas ou com baixa visão: leitores de tela, marcos de página, atalhos, régua de leitura, contraste reforçado e o botão “Ouvir”, que lê a tela em voz alta.\n" +
        "• Pessoas surdas: legendas ao vivo (inclusive na premiação) e tradução em LIBRAS pelo VLibras oficial.\n" +
        "• Pessoas mudas ou sem fala: a Nexus IA entende perguntas por texto, responde por escrito e pode falar a resposta em voz alta.\n\n" +
        "Abra o botão flutuante “Acessibilidade” ou use Alt + Shift + A.",
      suggestions: ["Ativar LIBRAS", "Aumentar o contraste", "Ouvir esta resposta"],
    };
  }

  if (has("pendente", "avaliac", "nota", "faltam")) {
    const lines = openEvents.map((event) => {
      const progress = submittedFor(data, event);
      return `• ${event.name}: ${number(progress.submitted)} de ${number(progress.expected)} avaliações registradas (${number(progress.pending)} pendentes).`;
    });
    return {
      answer: lines.length
        ? `Situação das avaliações nas bancas abertas:\n\n${lines.join("\n")}\n\nQuem pode avaliar encontra o formulário em “Avaliações”.`
        : "Não há bancas abertas neste contexto. Se você esperava uma banca aberta, confirme o período e a instituição selecionada.",
      suggestions: ["Quais bancas estão abertas?", "Ver meus acessos", "Como está o ciclo?"],
    };
  }

  if (has("resultado", "publica", "ranking", "podio", "lider", "primeiro")) {
    if (!published.length) {
      const closed = data.events.filter((event) => event.status === "closed").length;
      return {
        answer: `Ainda não há resultados publicados neste contexto. Existem ${number(closed)} ${closed === 1 ? "banca encerrada" : "bancas encerradas"} — a publicação é uma decisão da gestão e só aparece depois de autorizada.`,
        suggestions: ["Quais bancas estão encerradas?", "Como publicar resultados?"],
      };
    }
    const lines = published.slice(0, 3).map((result) => {
      const top = result.rows.filter((row) => row.position === 1);
      return `• ${result.name}: ${top.length ? top.map((row) => `${row.name} (${row.score?.toFixed(2) ?? "—"})`).join(", ") : "sem primeiro lugar definido"}.`;
    });
    return {
      answer: `Resultados publicados:\n\n${lines.join("\n")}\n\nAbra “Resultados” para ver a classificação completa ou iniciar a premiação.`,
      suggestions: ["Ver pódio", "Quais são as notas por critério?", "Como está o ciclo?"],
    };
  }

  if (has("projeto", "etapa", "equipe", "orienta")) {
    const stages = ["Descoberta", "Protótipo", "Validação", "Concluído"];
    const counts = stages.map(
      (stage) => activeProjects.filter((project) => project.stage === stage).length,
    );
    const named = activeProjects.find((project) =>
      q.includes(project.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")),
    );
    if (named) {
      return {
        answer: `${named.name}\n\n• Etapa: ${named.stage}\n• Categoria: ${named.category || "não informada"}\n• Período: ${named.year}.${named.semester}\n• Situação: ${named.archived ? "arquivado" : "ativo"}\n\nResumo: ${named.summary || "sem resumo cadastrado"}`,
        suggestions: ["Ver projetos", "Como está o ciclo?", "Quais avaliações estão pendentes?"],
      };
    }
    return {
      answer: `Há ${number(activeProjects.length)} projetos ativos nesta instituição:\n\n${stages
        .map((stage, index) => `• ${stage}: ${number(counts[index])}`)
        .join("\n")}\n\nA etapa com mais projetos é ${stages[counts.indexOf(Math.max(...counts))]}.`,
      suggestions: ["Ver projetos", "Quem são os orientadores?", "Como está o ciclo?"],
    };
  }

  if (has("banca", "calendario", "prazo", "proxima", "quando")) {
    const events = data.events
      .filter((event) => ["open", "draft"].includes(event.status))
      .slice()
      .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
    return {
      answer: events.length
        ? `Bancas em andamento ou preparação:\n\n${events
            .slice(0, 5)
            .map(
              (event) =>
                `• ${event.name} — ${new Date(event.scheduled_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })} — ${event.status === "open" ? "aberta" : "em preparação"}`,
            )
            .join("\n")}`
        : "Não há bancas em andamento ou em preparação neste contexto.",
      suggestions: ["Abrir bancas", "Quais avaliações estão pendentes?", "Como está o ciclo?"],
    };
  }

  if (has("acesso", "usuario", "membro", "vinculo", "permissao")) {
    return {
      answer: `Existem ${number(pending)} ${pending === 1 ? "solicitação de acesso pendente" : "solicitações de acesso pendentes"}. Você também pode revisar seus próprios vínculos em “Meus acessos”.`,
      suggestions: ["Revisar acessos", "Quais são meus papéis?", "Como está o ciclo?"],
    };
  }

  // Panorama padrão
  const total = data.evaluations.length;
  const closed = data.events.filter((event) => event.status === "closed").length;
  return {
    answer:
      `Panorama de ${data.institution.name}:\n\n` +
      `• ${number(activeProjects.length)} projetos ativos\n` +
      `• ${number(openEvents.length)} bancas abertas e ${number(data.events.filter((event) => event.status === "draft").length)} em preparação\n` +
      `• ${number(total)} avaliações registradas\n` +
      `• ${number(published.length)} resultados publicados de ${number(closed)} bancas encerradas\n` +
      `• ${number(pending)} acessos aguardando decisão\n\n` +
      "Posso detalhar qualquer um desses pontos. Pergunte, por exemplo, sobre prazos, notas pendentes ou resultados.",
    suggestions,
  };
}
