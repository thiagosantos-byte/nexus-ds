alter table public.institution_memberships add column requested_role text
  check(requested_role in ('coordinator','mentor','evaluator','student'));
alter table public.institution_memberships add constraint membership_institution_user_unique unique(institution_id,user_id);

create table public.user_profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 name text not null,
 email text not null
);
create function private.sync_auth_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.user_profiles(id,name,email)
 values(new.id,coalesce(nullif(new.raw_user_meta_data->>'full_name',''),split_part(coalesce(new.email,''),'@',1)),coalesce(new.email,''))
 on conflict(id) do update set name=excluded.name,email=excluded.email;
 return new;
end $$;
revoke all on function private.sync_auth_profile() from public,anon,authenticated;
create trigger sync_user_profile after insert or update of email,raw_user_meta_data on auth.users
 for each row execute function private.sync_auth_profile();
insert into public.user_profiles(id,name,email)
select id,coalesce(nullif(raw_user_meta_data->>'full_name',''),split_part(coalesce(email,''),'@',1)),coalesce(email,'') from auth.users;

create table public.projects (
 id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.institutions(id),
 name text not null check(char_length(trim(name)) between 1 and 200),
 summary text not null default '' check(char_length(summary)<=10000),
 category text not null default '' check(char_length(category)<=100),
 stage text not null default 'Descoberta' check(stage in ('Descoberta','Protótipo','Validação','Concluído')),
 year integer not null check(year between 2000 and 2100), semester integer not null check(semester in (1,2)),
 archived boolean not null default false, created_at timestamptz not null default now(), unique(institution_id,id)
);
create index projects_institution_idx on public.projects(institution_id);
create table public.project_participants (
 institution_id uuid not null,project_id uuid not null,user_id uuid not null,
 kind text not null check(kind in ('mentor','student')), primary key(project_id,user_id,kind),
 foreign key(institution_id,project_id) references public.projects(institution_id,id),
 foreign key(institution_id,user_id) references public.institution_memberships(institution_id,user_id)
);
create index participants_user_idx on public.project_participants(user_id,institution_id);
create table public.evaluation_criteria (
 id uuid primary key default gen_random_uuid(),institution_id uuid not null references public.institutions(id),
 name text not null check(char_length(trim(name)) between 1 and 200),
 weight numeric not null check(weight>0 and weight<=100),
 descriptors jsonb not null check(jsonb_typeof(descriptors)='array' and jsonb_array_length(descriptors)=5),
 active boolean not null default true,created_at timestamptz not null default now()
);
create index criteria_institution_idx on public.evaluation_criteria(institution_id);
create table public.evaluation_events (
 id uuid primary key default gen_random_uuid(),institution_id uuid not null references public.institutions(id),
 name text not null check(char_length(trim(name)) between 1 and 200),
 scheduled_at timestamptz not null,
 status text not null default 'draft' check(status in ('draft','open','closed','cancelled')),
 results_published boolean not null default false,
 criteria_snapshot jsonb not null default '[]'::jsonb,
 created_at timestamptz not null default now(),unique(institution_id,id)
);
create index events_institution_idx on public.evaluation_events(institution_id);
create table public.event_projects (
 institution_id uuid not null,event_id uuid not null,project_id uuid not null,primary key(event_id,project_id),
 foreign key(institution_id,event_id) references public.evaluation_events(institution_id,id),
 foreign key(institution_id,project_id) references public.projects(institution_id,id)
);
create index event_projects_project_idx on public.event_projects(project_id);
create table public.event_evaluators (
 institution_id uuid not null,event_id uuid not null,user_id uuid not null,primary key(event_id,user_id),
 foreign key(institution_id,event_id) references public.evaluation_events(institution_id,id),
 foreign key(institution_id,user_id) references public.institution_memberships(institution_id,user_id)
);
create index event_evaluators_user_idx on public.event_evaluators(user_id);
create table public.project_evaluations (
 id uuid primary key default gen_random_uuid(),institution_id uuid not null,event_id uuid not null,project_id uuid not null,
 evaluator_id uuid not null,scores jsonb not null,average numeric not null check(average between 1 and 5),
 notes text not null default '' check(char_length(notes)<=5000),submitted_at timestamptz not null default now(),
 unique(event_id,project_id,evaluator_id),
 foreign key(institution_id,event_id) references public.evaluation_events(institution_id,id),
 foreign key(institution_id,project_id) references public.projects(institution_id,id),
 foreign key(institution_id,evaluator_id) references public.institution_memberships(institution_id,user_id)
);
create index evaluations_institution_idx on public.project_evaluations(institution_id);

create function private.is_platform_admin() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (auth.jwt()->>'is_anonymous') is distinct from 'true'
 and exists(select 1 from public.platform_administrators where user_id=auth.uid() and revoked_at is null);
$$;
create function private.has_institution_role(p_institution uuid,p_roles text[]) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (auth.jwt()->>'is_anonymous') is distinct from 'true'
 and exists(select 1 from public.institutions where id=p_institution and status='active')
 and (private.is_platform_admin() or exists(
  select 1 from public.institution_memberships m join public.membership_roles r on r.membership_id=m.id
  where m.user_id=auth.uid() and m.institution_id=p_institution and m.status='active' and r.role=any(p_roles)));
$$;
create function private.can_read_project(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.projects p where p.id=p_id and (
 private.has_institution_role(p.institution_id,array['institution_admin','coordinator'])
 or (private.has_institution_role(p.institution_id,array['mentor','student']) and exists(
  select 1 from public.project_participants x where x.project_id=p.id and x.user_id=auth.uid()))
 or (private.has_institution_role(p.institution_id,array['evaluator']) and exists(
  select 1 from public.event_projects ep join public.event_evaluators ee on ee.event_id=ep.event_id
  join public.evaluation_events ev on ev.id=ep.event_id
  where ep.project_id=p.id and ee.user_id=auth.uid() and ev.status<>'cancelled'))));
$$;
create function private.can_read_event(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.evaluation_events ev where ev.id=p_id and (
 private.has_institution_role(ev.institution_id,array['institution_admin','coordinator'])
 or (private.has_institution_role(ev.institution_id,array['evaluator']) and exists(
 select 1 from public.event_evaluators ee where ee.event_id=ev.id and ee.user_id=auth.uid()))
 or (private.has_institution_role(ev.institution_id,array['mentor','student']) and exists(
 select 1 from public.event_projects ep join public.project_participants pp on pp.project_id=ep.project_id
 where ep.event_id=ev.id and pp.user_id=auth.uid()))));
$$;
revoke all on function private.is_platform_admin(),private.has_institution_role(uuid,text[]),private.can_read_project(uuid),private.can_read_event(uuid) from public,anon,authenticated;
grant execute on function private.is_platform_admin(),private.has_institution_role(uuid,text[]),private.can_read_project(uuid),private.can_read_event(uuid) to authenticated;

alter table public.user_profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_participants enable row level security;
alter table public.evaluation_criteria enable row level security;
alter table public.evaluation_events enable row level security;
alter table public.event_projects enable row level security;
alter table public.event_evaluators enable row level security;
alter table public.project_evaluations enable row level security;
revoke all on public.user_profiles,public.projects,public.project_participants,public.evaluation_criteria,
 public.evaluation_events,public.event_projects,public.event_evaluators,public.project_evaluations from public,anon,authenticated;
grant select on public.user_profiles,public.projects,public.project_participants,public.evaluation_criteria,
 public.evaluation_events,public.event_projects,public.event_evaluators,public.project_evaluations to authenticated;
create policy profiles_read_self on public.user_profiles for select to authenticated using(id=(select auth.uid()));
create policy projects_read on public.projects for select to authenticated using(private.can_read_project(id));
create policy participants_read on public.project_participants for select to authenticated using(private.can_read_project(project_id));
create policy criteria_read on public.evaluation_criteria for select to authenticated using(private.has_institution_role(institution_id,array['institution_admin','coordinator','mentor','evaluator','student']));
create policy events_read on public.evaluation_events for select to authenticated using(private.can_read_event(id));
create policy event_projects_read on public.event_projects for select to authenticated using(private.can_read_event(event_id) and private.can_read_project(project_id));
create policy event_evaluators_read on public.event_evaluators for select to authenticated using(private.can_read_event(event_id));
create policy evaluations_read on public.project_evaluations for select to authenticated using(
 private.has_institution_role(institution_id,array['institution_admin','coordinator']) or
 (evaluator_id=(select auth.uid()) and private.has_institution_role(institution_id,array['evaluator']) and private.can_read_event(event_id)));
