import { useState, type FormEvent } from "react";
import type {
  Command,
  Institution,
  WorkspaceData,
  Identity,
  Role,
} from "./types";
import { roleNames, memberStatuses } from "./types";
import { Card, InputField, SaveButton, Empty } from "./ui";

export function AccessRequest({
  institutions,
  identity,
  request,
  busy,
  refresh,
}: {
  institutions: Institution[];
  identity: Identity;
  request: (institution: string, role: Role) => Promise<boolean>;
  busy: boolean;
  refresh: () => void;
}) {
  const [institution, setInstitution] = useState("");
  const [role, setRole] = useState<Role>("student");
  const available = institutions.filter(
    (i) =>
      i.status === "active" &&
      !identity.memberships.some(
        (m) => m.institution_id === i.id && m.status !== "pending",
      ),
  );
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (institution && (await request(institution, role))) refresh();
  }
  return (
    <Card>
      <h2 className="section-title">Meus vínculos e solicitações</h2>
      <p>
        Escolha a instituição e solicite seu acesso. O papel será concedido
        somente após aprovação.
      </p>
      {identity.memberships.map((m) => (
        <div className="workspace-row" key={m.id}>
          <strong>{m.institutions?.name ?? "Instituição indisponível"}</strong>
          <span>
            {memberStatuses[m.status]}
            {m.institutions?.status === "suspended"
              ? " · Instituição suspensa"
              : ""}
          </span>
        </div>
      ))}
      {!identity.memberships.length && (
        <p>Você ainda não possui vínculo com uma instituição.</p>
      )}
      {!available.length ? (
        <p className="notice warn">
          Não há instituições disponíveis para uma nova solicitação. Consulte
          seus vínculos acima ou procure a gestão da instituição.
        </p>
      ) : (
        <form onSubmit={submit} className="workspace-form">
          <InputField label="Instituição">
            <select
              required
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
            >
              <option value="">Selecione</option>
              {available.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </InputField>
          <InputField label="Perfil solicitado">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
            >
              {Object.entries(roleNames)
                .filter(([r]) => r !== "institution_admin")
                .map(([r, label]) => (
                  <option key={r} value={r}>
                    {label}
                  </option>
                ))}
            </select>
          </InputField>
          <SaveButton busy={busy}>Solicitar acesso</SaveButton>
        </form>
      )}
    </Card>
  );
}

export function MembersModule({
  data,
  command,
  busy,
  isPlatform,
  userId,
}: {
  data: WorkspaceData;
  command: Command;
  busy: boolean;
  isPlatform: boolean;
  userId: string;
}) {
  const [editing, setEditing] = useState("");
  const [email, setEmail] = useState("");
  const [roles, setRoles] = useState<Role[]>(["student"]);
  const [status, setStatus] = useState("active");
  const [search, setSearch] = useState("");
  const filtered = data.memberships.filter((m) =>
    `${data.people.find((p) => p.id === m.user_id)?.name ?? ""} ${data.people.find((p) => p.id === m.user_id)?.email ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  function reset() {
    setEditing("");
    setEmail("");
    setRoles(["student"]);
    setStatus("active");
  }
  const person = (id: string) => data.people.find((p) => p.id === id);
  function edit(id: string) {
    const m = data.memberships.find((m) => m.id === id);
    if (!m) return;
    setEditing(id);
    setEmail(person(m.user_id)?.email ?? "");
    setRoles(m.roles.length ? m.roles : [m.requested_role ?? "student"]);
    setStatus(m.status === "pending" ? "active" : m.status);
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (
      await command("member.save", {
        ...(editing ? { id: editing } : { email }),
        roles,
        status,
      })
    ) {
      setEditing("");
      setEmail("");
      setRoles(["student"]);
      setStatus("active");
    }
  }
  return (
    <>
      <Card>
        <div className="section-head">
          <h2 className="section-title">Usuários e vínculos</h2>
          <InputField label="Pesquisar pessoa">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nome ou e-mail"
            />
          </InputField>
        </div>
        <div
          className="table-wrap"
          tabIndex={0}
          role="region"
          aria-label="Usuários e vínculos"
        >
          <table>
            <thead>
              <tr>
                <th>Pessoa</th>
                <th>Situação</th>
                <th>Papéis</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id}>
                  <td>
                    <strong>{person(m.user_id)?.name ?? "Usuário"}</strong>
                    <div>{person(m.user_id)?.email}</div>
                  </td>
                  <td>{memberStatuses[m.status]}</td>
                  <td>
                    {m.roles.map((r) => roleNames[r]).join(", ") ||
                      `Solicitado: ${roleNames[m.requested_role ?? "student"]}`}
                  </td>
                  <td>
                    <button
                      className="btn btn-ghost"
                      disabled={
                        busy ||
                        (!isPlatform &&
                          (m.user_id === userId ||
                            m.roles.includes("institution_admin")))
                      }
                      title={
                        !isPlatform &&
                        (m.user_id === userId ||
                          m.roles.includes("institution_admin"))
                          ? "Este vínculo deve ser gerenciado por um superadministrador"
                          : undefined
                      }
                      onClick={() => edit(m.id)}
                    >
                      {m.status === "pending" ? "Revisar acesso" : "Gerenciar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length && (
          <Empty>
            {data.memberships.length
              ? "Nenhuma pessoa corresponde à pesquisa"
              : "Nenhum vínculo nesta instituição"}
          </Empty>
        )}
        {!isPlatform && (
          <p className="section-sub">
            Seu próprio vínculo e os administradores institucionais são
            gerenciados pela administração da plataforma.
          </p>
        )}
      </Card>
      <Card>
        <h2 className="section-title">
          {editing ? "Revisar vínculo" : "Vincular pessoa"}
        </h2>
        <p>
          A pessoa deve entrar com Google ao menos uma vez antes de receber um
          vínculo por e-mail. A solicitação de acesso também pode ser feita na
          própria conta.
        </p>
        <form onSubmit={submit} className="workspace-form">
          <InputField label="E-mail da conta">
            <input
              type="email"
              required
              value={email}
              readOnly={!!editing}
              onChange={(e) => setEmail(e.target.value)}
            />
          </InputField>
          <InputField label="Papel neste vínculo (apenas um)">
            <select
              required
              value={roles[0] ?? "student"}
              onChange={(e) => setRoles([e.target.value as Role])}
            >
              {Object.entries(roleNames)
                .filter(([r]) => isPlatform || r !== "institution_admin")
                .map(([r, label]) => (
                  <option key={r} value={r}>{label}</option>
                ))}
            </select>
          </InputField>
          <InputField label="Situação">
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="active">Ativo / aprovar</option>
              <option value="pending">Pendente</option>
              <option value="suspended">Suspenso / recusar</option>
            </select>
          </InputField>
          <SaveButton busy={busy || !roles.length}>
            {editing ? "Salvar vínculo" : "Vincular pessoa"}
          </SaveButton>
          {editing && (
            <button type="button" className="btn btn-ghost" onClick={reset}>
              Cancelar edição
            </button>
          )}
        </form>
      </Card>
    </>
  );
}
