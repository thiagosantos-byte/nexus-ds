import type { RankedProject, Result } from "../workspace/types";

export type PhaseKind = "intro" | "reveal" | "suspense" | "winner" | "finale";
export type Phase = {
  kind: PhaseKind;
  rank?: number;
  start: number;
  end: number;
  title: string;
  detail: string;
};
export function awards(result: Result) {
  return [1, 2, 3]
    .map((rank) => ({
      rank,
      projects: result.rows.filter((row) => row.position === rank),
    }))
    .filter((group) => group.projects.length);
}
export function canCelebrate(result: Result): boolean {
  return (
    result.published &&
    result.status === "closed" &&
    result.rows.length > 0 &&
    result.rows.every(
      (row) =>
        Number.isInteger(row.position) &&
        row.position! > 0 &&
        Number.isFinite(row.score) &&
        row.score! >= 1 &&
        row.score! <= 5 &&
        row.expected > 0 &&
        row.submitted === row.expected,
    ) &&
    result.rows.some((row) => row.position === 1)
  );
}
export function timeline(result: Result): Phase[] {
  let cursor = 0;
  const phases: Phase[] = [];
  const add = (
    kind: PhaseKind,
    duration: number,
    title: string,
    detail: string,
    rank?: number,
  ) => {
    phases.push({
      kind,
      rank,
      start: cursor,
      end: cursor + duration,
      title,
      detail,
    });
    cursor += duration;
  };
  add(
    "intro",
    2800,
    "Toda grande ideia merece seu momento.",
    "A premiação vai começar.",
  );
  for (const group of awards(result).slice().reverse()) {
    if (group.rank === 1) {
      add(
        "suspense",
        3400,
        "E o primeiro lugar…",
        "Uma conquista está prestes a ganhar o palco.",
      );
      add(
        "winner",
        4800,
        group.projects.length > 1
          ? "Uma vitória compartilhada!"
          : "O grande destaque desta banca!",
        group.projects.length > 1
          ? "Projetos empatados recebem o mesmo reconhecimento."
          : "Conheça o projeto que conquistou o primeiro lugar.",
        1,
      );
    } else
      add(
        "reveal",
        4200,
        `${group.rank}º lugar`,
        group.projects.length > 1
          ? "Mais de um projeto, a mesma conquista."
          : "Reconhecimento a uma ideia que foi além.",
        group.rank,
      );
  }
  add(
    "finale",
    5200,
    "Ideias que merecem aplausos.",
    "Parabéns a todos os participantes desta jornada!",
  );
  return phases;
}
export function revealedRanks(phases: Phase[], elapsed: number) {
  return phases
    .filter((phase) => phase.rank && elapsed >= phase.start)
    .map((phase) => phase.rank!);
}
export function resultVersion(result: Result) {
  const text = JSON.stringify([
    result.event_id,
    result.status,
    result.published,
    result.rows
      .slice()
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((row) => [
        row.id,
        row.name,
        row.score,
        row.position,
        row.submitted,
        row.expected,
      ]),
  ]);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++)
    hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  return (hash >>> 0).toString(16);
}
export function seenKey(
  userId: string,
  institutionId: string,
  eventId: string,
) {
  return `nexus:podium:v1:${userId}:${institutionId}:${eventId}`;
}
export function scoreText(row: RankedProject) {
  return Number(row.score).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
