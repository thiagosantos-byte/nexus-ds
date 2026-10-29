-- Enforce one real role per institutional membership and provide a tightly scoped,
-- session-bound demonstration role switch for explicitly allowlisted accounts.
create table private.role_normalization_log (
  id bigint generated always as identity primary key,
  membership_id uuid not null,
  user_id uuid not null,
  institution_id uuid not null,
  previous_roles text[] not null,
  retained_role text not null,
  normalized_at timestamptz not null default now()
);
alter table private.role_normalization_log enable row level security;
revoke all on private.role_normalization_log from public, anon, authenticated;

insert into private.role_normalization_log(membership_id,user_id,institution_id,previous_roles,retained_role)
select m.id,m.user_id,m.institution_id,
       array_agg(r.role order by case r.role
         when 'institution_admin' then 1 when 'coordinator' then 2
         when 'evaluator' then 3 when 'mentor' then 4 when 'student' then 5 else 99 end),
       (array_agg(r.role order by case r.role
         when 'institution_admin' then 1 when 'coordinator' then 2
         when 'evaluator' then 3 when 'mentor' then 4 when 'student' then 5 else 99 end))[1]
from public.institution_memberships m
join public.membership_roles r on r.membership_id=m.id
group by m.id,m.user_id,m.institution_id
having count(*) > 1;

with ranked as (
  select membership_id,role,row_number() over (
    partition by membership_id order by case role
      when 'institution_admin' then 1 when 'coordinator' then 2
      when 'evaluator' then 3 when 'mentor' then 4 when 'student' then 5 else 99 end
  ) as position
  from public.membership_roles
)
delete from public.membership_roles r using ranked x
where r.membership_id=x.membership_id and r.role=x.role and x.position>1;

create unique index membership_roles_one_role_per_membership
  on public.membership_roles(membership_id);

create table private.demo_role_allowlist (
  user_id uuid not null references auth.users(id) on delete cascade,
  institution_id uuid not null references public.institutions(id) on delete cascade,
  allowed_roles text[] not null check (
    cardinality(allowed_roles) > 0 and
    allowed_roles <@ array['institution_admin','coordinator','mentor','evaluator','student']::text[]
  ),
  granted_at timestamptz not null default now(),
  primary key(user_id,institution_id)
);
alter table private.demo_role_allowlist enable row level security;
revoke all on private.demo_role_allowlist from public, anon, authenticated;

create table private.demo_role_context (
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text not null,
  institution_id uuid not null references public.institutions(id) on delete cascade,
  role text not null check (role in ('institution_admin','coordinator','mentor','evaluator','student')),
  updated_at timestamptz not null default now(),
  primary key(user_id,session_id,institution_id)
);
alter table private.demo_role_context enable row level security;
revoke all on private.demo_role_context from public, anon, authenticated;

-- Only the named account is allowlisted, and only for its own active institutional
-- memberships. The allowlist is private and cannot be edited by application users.
insert into private.demo_role_allowlist(user_id,institution_id,allowed_roles)
select u.id,m.institution_id,
       array['institution_admin','coordinator','mentor','evaluator','student']::text[]
from auth.users u
join public.institution_memberships m on m.user_id=u.id and m.status='active'
join public.institutions i on i.id=m.institution_id and i.status='active'
where lower(u.email)=lower('gustavo.r.silva8@ba.estudante.senai.br')
on conflict(user_id,institution_id) do update
set allowed_roles=excluded.allowed_roles;

create function private.demo_mode_active() returns boolean
language sql stable security definer set search_path='' as $$
  select auth.uid() is not null
    and nullif(auth.jwt()->>'session_id','') is not null
    and exists (
      select 1 from private.demo_role_context c
      where c.user_id=auth.uid() and c.session_id=auth.jwt()->>'session_id'
    );
$$;

create or replace function private.is_platform_admin() returns boolean
language sql stable security definer set search_path='' as $$
  select auth.uid() is not null
    and (auth.jwt()->>'is_anonymous') is distinct from 'true'
    and not private.demo_mode_active()
    and exists (
      select 1 from public.platform_administrators
      where user_id=auth.uid() and revoked_at is null
    );
$$;

create or replace function private.has_institution_role(p_institution uuid,p_roles text[]) returns boolean
language sql stable security definer set search_path='' as $$
  select auth.uid() is not null
    and (auth.jwt()->>'is_anonymous') is distinct from 'true'
    and exists(select 1 from public.institutions where id=p_institution and status='active')
    and case
      when private.demo_mode_active() then exists (
        select 1
        from private.demo_role_context c
        join private.demo_role_allowlist a
          on a.user_id=c.user_id and a.institution_id=c.institution_id
        join public.institution_memberships m
          on m.user_id=c.user_id and m.institution_id=c.institution_id and m.status='active'
        where c.user_id=auth.uid()
          and c.session_id=auth.jwt()->>'session_id'
          and c.institution_id=p_institution
          and c.role=any(p_roles)
          and c.role=any(a.allowed_roles)
      )
      else (
        (private.is_platform_admin() and p_roles && array['institution_admin','coordinator','mentor','student']::text[])
        or exists (
          select 1 from public.institution_memberships m
          join public.membership_roles r on r.membership_id=m.id
          where m.user_id=auth.uid() and m.institution_id=p_institution
            and m.status='active' and r.role=any(p_roles)
        )
      )
    end;
$$;

create function private.demo_role_switch(p_institution uuid,p_role text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); session_key text:=auth.jwt()->>'session_id'; allowed text[];
begin
  if actor is null or (auth.jwt()->>'is_anonymous')='true' or session_key is null then
    raise insufficient_privilege;
  end if;

  if p_role is null then
    with removed as (
      delete from private.demo_role_context
      where user_id=actor and session_id=session_key
      returning institution_id
    )
    insert into private.audit_events(actor_id,institution_id,action,resource_id)
    select actor,removed.institution_id,'demo.role.clear',removed.institution_id from removed;
    return jsonb_build_object('ok',true,'active',false);
  end if;

  select a.allowed_roles into allowed
  from private.demo_role_allowlist a
  where a.user_id=actor and a.institution_id=p_institution;
  if not found then raise insufficient_privilege; end if;
  if not p_role=any(allowed) then
    raise invalid_parameter_value using message='Perfil de demonstração não autorizado';
  end if;
  if not exists (
    select 1 from public.institution_memberships m
    join public.institutions i on i.id=m.institution_id
    where m.user_id=actor and m.institution_id=p_institution
      and m.status='active' and i.status='active'
  ) then raise insufficient_privilege; end if;

  with removed as (
    delete from private.demo_role_context
    where user_id=actor and session_id=session_key
    returning institution_id
  )
  insert into private.audit_events(actor_id,institution_id,action,resource_id)
  select actor,removed.institution_id,'demo.role.clear',removed.institution_id from removed;

  insert into private.demo_role_context(user_id,session_id,institution_id,role)
  values(actor,session_key,p_institution,p_role)
  on conflict(user_id,session_id,institution_id)
  do update set role=excluded.role,updated_at=now();

  insert into private.audit_events(actor_id,institution_id,action,resource_id)
  values(actor,p_institution,'demo.role.switch',p_institution);
  return jsonb_build_object('ok',true,'active',true,'role',p_role,'institution_id',p_institution);
end;
$$;

create function public.demo_role_switch(p_institution uuid,p_role text) returns jsonb
language sql security invoker set search_path='' as $$
  select private.demo_role_switch(p_institution,p_role);
$$;

create function public.demo_role_status() returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'active',private.demo_mode_active(),
    'role',(select c.role from private.demo_role_context c
      where c.user_id=auth.uid() and c.session_id=auth.jwt()->>'session_id' limit 1),
    'institution_id',(select c.institution_id from private.demo_role_context c
      where c.user_id=auth.uid() and c.session_id=auth.jwt()->>'session_id' limit 1)
  );
$$;

create or replace function private.workspace_read(p_institution uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare manager boolean; member_manager boolean; actor uuid:=auth.uid(); output jsonb;
begin
 if not private.has_institution_role(p_institution,array['institution_admin','coordinator','mentor','evaluator','student']) then raise insufficient_privilege; end if;
 manager:=private.has_institution_role(p_institution,array['institution_admin','coordinator']);
 member_manager:=private.has_institution_role(p_institution,array['institution_admin']);
 select jsonb_build_object(
 'institution',(select to_jsonb(i) from public.institutions i where id=p_institution),
 'capabilities',jsonb_build_object('manageMembers',member_manager,'manageProjects',member_manager,'manageEvents',manager,'manageCriteria',member_manager,'evaluate',private.has_institution_role(p_institution,array['evaluator']),'readAudit',member_manager),
 'demoRole',(select c.role from private.demo_role_context c where c.user_id=actor and c.session_id=auth.jwt()->>'session_id' and c.institution_id=p_institution),
 'demoRoles',coalesce((select to_jsonb(a.allowed_roles) from private.demo_role_allowlist a where a.user_id=actor and a.institution_id=p_institution),'[]'::jsonb),
 'projects',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc) from public.projects p where p.institution_id=p_institution and private.can_read_project(p.id)),'[]'::jsonb),
 'participants',coalesce((select jsonb_agg(to_jsonb(pp)) from public.project_participants pp where pp.institution_id=p_institution and private.can_read_project(pp.project_id)),'[]'::jsonb),
 'criteria',coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at,c.id) from public.evaluation_criteria c where c.institution_id=p_institution),'[]'::jsonb),
 'events',coalesce((select jsonb_agg(to_jsonb(ev) order by ev.scheduled_at desc) from public.evaluation_events ev where ev.institution_id=p_institution and private.can_read_event(ev.id)),'[]'::jsonb),
 'eventProjects',coalesce((select jsonb_agg(to_jsonb(ep)) from public.event_projects ep where ep.institution_id=p_institution and private.can_read_event(ep.event_id) and private.can_read_project(ep.project_id)),'[]'::jsonb),
 'eventEvaluators',coalesce((select jsonb_agg(to_jsonb(ee)) from public.event_evaluators ee where ee.institution_id=p_institution and private.can_read_event(ee.event_id)),'[]'::jsonb),
 'evaluations',coalesce((select jsonb_agg(to_jsonb(e)) from public.project_evaluations e where e.institution_id=p_institution and (manager or (e.evaluator_id=actor and private.can_read_event(e.event_id)))),'[]'::jsonb),
 'memberships',coalesce((select jsonb_agg(to_jsonb(m)||jsonb_build_object('roles',coalesce((select jsonb_agg(r.role order by r.role) from public.membership_roles r where r.membership_id=m.id),'[]'::jsonb))) from public.institution_memberships m where m.institution_id=p_institution and (member_manager or m.user_id=actor or (manager and m.status='active' and exists(select 1 from public.membership_roles mr where mr.membership_id=m.id and mr.role='evaluator')))),'[]'::jsonb),
 'people',coalesce((select jsonb_agg(jsonb_build_object('id',u.id,'name',u.name,'email',case when member_manager or u.id=actor then u.email end)) from public.user_profiles u where
 u.id=actor or (manager and exists(select 1 from public.institution_memberships m join public.membership_roles mr on mr.membership_id=m.id where m.institution_id=p_institution and m.user_id=u.id and m.status='active' and mr.role='evaluator')) or (member_manager and exists(select 1 from public.institution_memberships m where m.institution_id=p_institution and m.user_id=u.id)) or
 exists(select 1 from public.project_participants pp where pp.institution_id=p_institution and pp.user_id=u.id and private.can_read_project(pp.project_id)) or
 exists(select 1 from public.event_evaluators ee where ee.institution_id=p_institution and ee.user_id=u.id and private.can_read_event(ee.event_id))),'[]'::jsonb),
 'results',coalesce((select jsonb_agg(jsonb_build_object('event_id',ev.id,'name',ev.name,'status',ev.status,'published',ev.results_published,'rows',private.event_results(ev.id)) order by ev.scheduled_at desc)
 from public.evaluation_events ev where ev.institution_id=p_institution and ev.status<>'cancelled' and (manager or ev.results_published)),'[]'::jsonb),
 'audit',case when member_manager then coalesce((select jsonb_agg(to_jsonb(a) order by a.occurred_at desc) from (select id,actor_id,action,resource_id,occurred_at from private.audit_events where institution_id=p_institution order by occurred_at desc limit 200) a),'[]'::jsonb) else '[]'::jsonb end
 ) into output;
 return output;
end $$;

create or replace function private.platform_create_institution(p_name text)
returns setof public.institutions language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); result public.institutions;
begin
  if actor is null or (auth.jwt()->>'is_anonymous') = 'true' or private.demo_mode_active() then
    raise insufficient_privilege using message = 'Platform administrator required';
  end if;
  perform 1 from public.platform_administrators where user_id=actor and revoked_at is null for share;
  if not found then raise insufficient_privilege using message = 'Platform administrator required'; end if;
  if p_name is null or char_length(trim(p_name)) not between 1 and 200 then
    raise invalid_parameter_value using message = 'Invalid institution name';
  end if;
  insert into public.institutions(name) values(trim(p_name)) returning * into result;
  insert into private.audit_events(actor_id,institution_id,action,resource_id)
    values(actor,result.id,'institution.create',result.id);
  return next result;
end $$;

create or replace function private.platform_set_institution_status(p_id uuid,p_status text)
returns setof public.institutions language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); result public.institutions;
begin
  if actor is null or (auth.jwt()->>'is_anonymous') = 'true' or private.demo_mode_active() then
    raise insufficient_privilege using message = 'Platform administrator required';
  end if;
  perform 1 from public.platform_administrators where user_id=actor and revoked_at is null for share;
  if not found then raise insufficient_privilege using message = 'Platform administrator required'; end if;
  if p_status is null or p_status not in ('active','suspended') then
    raise invalid_parameter_value using message = 'Invalid institution status';
  end if;
  select * into result from public.institutions where id=p_id for update;
  if not found then raise no_data_found using message = 'Institution not found'; end if;
  if result.status <> p_status then
    update public.institutions set status=p_status where id=p_id returning * into result;
    insert into private.audit_events(actor_id,institution_id,action,resource_id)
      values(actor,result.id,'institution.' || p_status,result.id);
  end if;
  return next result;
end $$;

revoke all on function private.demo_mode_active(),private.demo_role_switch(uuid,text) from public,anon,authenticated;
grant execute on function private.demo_mode_active(),private.demo_role_switch(uuid,text) to authenticated;
revoke all on function public.demo_role_switch(uuid,text),public.demo_role_status() from public,anon,authenticated;
grant execute on function public.demo_role_switch(uuid,text),public.demo_role_status() to authenticated;
