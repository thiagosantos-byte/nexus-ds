export type Role =
  "institution_admin" | "coordinator" | "mentor" | "evaluator" | "student";
export const roleNames: Record<Role, string> = {
  institution_admin: "Administrador institucional",
  coordinator: "Coordenador",
  mentor: "Orientador",
  evaluator: "Avaliador",
  student: "Aluno",
};
export const memberStatuses: Record<string, string> = {
  active: "Ativo",
  pending: "Pendente",
  suspended: "Suspenso",
};
export const eventStatuses: Record<string, string> = {
  draft: "Em preparação",
  open: "Aberta",
  closed: "Encerrada",
  cancelled: "Cancelada",
};
export type Identity = {
  user: { id: string; email?: string };
  isPlatformAdministrator: boolean;
  memberships: Array<{
    id: string;
    institution_id: string;
    status: string;
    requested_role?: Role;
    institutions: { id: string; name: string; status: string } | null;
    membership_roles: Array<{ role: Role }>;
  }>;
};
export type Institution = { id: string; name: string; status: string };
export type Project = {
  id: string;
  institution_id: string;
  name: string;
  summary: string;
  category: string;
  stage: string;
  year: number;
  semester: number;
  archived: boolean;
  created_at: string;
};
export type Person = { id: string; name: string; email: string | null };
export type Membership = {
  id: string;
  user_id: string;
  status: string;
  requested_role: Role | null;
  roles: Role[];
};
export type Participant = {
  project_id: string;
  user_id: string;
  kind: "mentor" | "student";
};
export type Criterion = {
  id: string;
  name: string;
  weight: number;
  descriptors: string[];
  active: boolean;
  is_tiebreaker: boolean;
};
export type Event = {
  id: string;
  name: string;
  scheduled_at: string;
  status: string;
  results_published: boolean;
  criteria_snapshot: Criterion[];
};
export type Evaluation = {
  id: string;
  event_id: string;
  project_id: string;
  evaluator_id: string;
  scores: Record<string, number>;
  notes: string;
  average: number;
  submitted_at: string;
};
export type RankedProject = {
  id: string;
  name: string;
  score: number | null;
  position: number | null;
  submitted: number;
  expected: number;
};
export type Result = {
  event_id: string;
  name: string;
  status: string;
  published: boolean;
  rows: RankedProject[];
};
export type WorkspaceData = {
  institution: Institution;
  demoRole?: Role | null;
  demoRoles?: Role[];
  capabilities: {
    manageMembers: boolean;
    manageProjects: boolean;
    manageEvents: boolean;
    manageCriteria: boolean;
    evaluate: boolean;
    readAudit: boolean;
  };
  projects: Project[];
  participants: Participant[];
  criteria: Criterion[];
  events: Event[];
  eventProjects: Array<{ event_id: string; project_id: string }>;
  eventEvaluators: Array<{ event_id: string; user_id: string }>;
  evaluations: Evaluation[];
  memberships: Membership[];
  people: Person[];
  results: Result[];
  audit: Array<{
    id: string;
    actor_id: string;
    action: string;
    resource_id: string;
    occurred_at: string;
  }>;
};
export type Command = (
  action: string,
  data: Record<string, unknown>,
) => Promise<boolean>;
