-- Freeze project data and team membership once an assigned evaluation event is closed.
-- The database is the enforcement boundary; hiding UI controls alone is insufficient.
create or replace function private.prevent_project_change_after_closed_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.event_projects ep
    join public.evaluation_events ev on ev.id = ep.event_id
    where ep.project_id = old.id
      and ev.status = 'closed'
  ) then
    raise exception using
      errcode = '55000',
      message = 'Projeto bloqueado: já pertence a uma banca encerrada.';
  end if;
  return new;
end;
$$;

drop trigger if exists projects_freeze_after_closed_event on public.projects;
create trigger projects_freeze_after_closed_event
before update on public.projects
for each row execute function private.prevent_project_change_after_closed_event();

create or replace function private.prevent_project_team_change_after_closed_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_project uuid;
begin
  if tg_op = 'DELETE' then
    target_project := old.project_id;
  else
    target_project := new.project_id;
  end if;

  if exists (
    select 1
    from public.event_projects ep
    join public.evaluation_events ev on ev.id = ep.event_id
    where ep.project_id = target_project
      and ev.status = 'closed'
  ) then
    raise exception using
      errcode = '55000',
      message = 'Equipe bloqueada: o projeto já pertence a uma banca encerrada.';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists project_participants_freeze_after_closed_event on public.project_participants;
create trigger project_participants_freeze_after_closed_event
before insert or update or delete on public.project_participants
for each row execute function private.prevent_project_team_change_after_closed_event();
