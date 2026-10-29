create table public.institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 200),
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now()
);

create table public.institution_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  institution_id uuid not null references public.institutions(id),
  status text not null default 'pending' check (status in ('pending', 'active', 'suspended')),
  created_at timestamptz not null default now(),
  unique (user_id, institution_id)
);
create index institution_memberships_institution_idx on public.institution_memberships(institution_id);

create table public.membership_roles (
  membership_id uuid not null references public.institution_memberships(id) on delete cascade,
  role text not null check (role in ('institution_admin', 'coordinator', 'mentor', 'evaluator', 'student')),
  primary key (membership_id, role)
);

create table public.platform_administrators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz
);

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table private.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  institution_id uuid,
  action text not null,
  resource_id uuid,
  occurred_at timestamptz not null default now()
);
alter table private.audit_events enable row level security;
revoke all on private.audit_events from public, anon, authenticated;

alter table public.institutions enable row level security;
alter table public.institution_memberships enable row level security;
alter table public.membership_roles enable row level security;
alter table public.platform_administrators enable row level security;

revoke all on public.institutions, public.institution_memberships,
  public.membership_roles, public.platform_administrators from public, anon, authenticated;
grant select on public.institutions, public.institution_memberships,
  public.membership_roles, public.platform_administrators to authenticated;

-- Status is visible to the owner even when pending/suspended. This grants no
-- access to institutional content or management operations.
create policy memberships_read_own on public.institution_memberships
  for select to authenticated using (
    user_id = (select auth.uid())
    and (select auth.jwt()->>'is_anonymous') is distinct from 'true'
  );

create policy institutions_read_own_label on public.institutions
  for select to authenticated using (
    exists (select 1 from public.institution_memberships m
      where m.institution_id = institutions.id and m.user_id = (select auth.uid()))
  );

create policy membership_roles_read_own on public.membership_roles
  for select to authenticated using (
    exists (select 1 from public.institution_memberships m
      where m.id = membership_roles.membership_id and m.user_id = (select auth.uid()))
  );

create policy platform_administrators_read_own on public.platform_administrators
  for select to authenticated using (
    user_id = (select auth.uid()) and revoked_at is null
    and (select auth.jwt()->>'is_anonymous') is distinct from 'true'
  );

-- Deliberately no INSERT/UPDATE/DELETE grants or policies for users. Administrative
-- writes will require separately reviewed, audited operations in the next step.
