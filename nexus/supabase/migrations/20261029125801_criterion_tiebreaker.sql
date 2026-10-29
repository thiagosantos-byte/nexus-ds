alter table public.evaluation_criteria
  add column is_tiebreaker boolean not null default false;

create unique index evaluation_criteria_one_tiebreaker_per_institution
  on public.evaluation_criteria(institution_id)
  where is_tiebreaker;

create function private.clear_inactive_tiebreaker()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not new.active then
    new.is_tiebreaker := false;
  end if;
  return new;
end $$;

create trigger clear_inactive_tiebreaker
before update of active on public.evaluation_criteria
for each row execute function private.clear_inactive_tiebreaker();


create function private.workspace_set_tiebreaker(
  p_institution uuid,
  p_criterion uuid
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null or (auth.jwt()->>'is_anonymous') = 'true'
     or not private.has_institution_role(p_institution, array['institution_admin']) then
    raise insufficient_privilege;
  end if;

  perform 1
    from public.evaluation_criteria
   where id = p_criterion
     and institution_id = p_institution
     and active
   for update;
  if not found then
    raise invalid_parameter_value using message = 'Escolha um critério ativo desta instituição';
  end if;

  update public.evaluation_criteria
     set is_tiebreaker = false
   where institution_id = p_institution
     and is_tiebreaker;

  update public.evaluation_criteria
     set is_tiebreaker = true
   where id = p_criterion
     and institution_id = p_institution;

  insert into private.audit_events(actor_id, institution_id, action, resource_id)
  values (actor, p_institution, 'criterion.tiebreaker', p_criterion);

  return jsonb_build_object('ok', true, 'id', p_criterion);
end $$;

create function private.freeze_tiebreaker_snapshot()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'open' and old.status = 'draft' then
    select coalesce(
      jsonb_agg(
        snap.item || jsonb_build_object(
          'is_tiebreaker', coalesce(c.is_tiebreaker, false)
        )
        order by snap.ordinality
      ),
      '[]'::jsonb
    )
    into new.criteria_snapshot
    from jsonb_array_elements(new.criteria_snapshot) with ordinality as snap(item, ordinality)
    left join public.evaluation_criteria c
      on c.id = (snap.item->>'id')::uuid
     and c.institution_id = new.institution_id;
  end if;
  return new;
end $$;

create trigger freeze_tiebreaker_snapshot
before update of status, criteria_snapshot on public.evaluation_events
for each row execute function private.freeze_tiebreaker_snapshot();

create or replace function private.event_results(p_event uuid)
returns jsonb
language sql stable security definer set search_path = '' as $$
  with config as (
    select (
      select item->>'id'
      from jsonb_array_elements(ev.criteria_snapshot) as criteria(item)
      where coalesce((item->>'is_tiebreaker')::boolean, false)
      limit 1
    ) as criterion_id
    from public.evaluation_events ev
    where ev.id = p_event
  ),
  scores as (
    select
      p.id,
      p.name,
      count(e.id)::integer as submitted,
      round(avg(e.average), 4) as score,
      round(avg((e.scores->>config.criterion_id)::numeric), 4) as tiebreaker_score,
      (select count(*) from public.event_evaluators where event_id = p_event)::integer as expected
    from public.event_projects ep
    join public.projects p on p.id = ep.project_id
    cross join config
    left join public.project_evaluations e
      on e.event_id = ep.event_id and e.project_id = ep.project_id
    where ep.event_id = p_event
    group by p.id, p.name, config.criterion_id
  ),
  ranked as (
    select *,
      case when score is not null then
        dense_rank() over (
          order by score desc nulls last, tiebreaker_score desc nulls last
        )
      end as position
    from scores
  )
  select coalesce(
    jsonb_agg(
      to_jsonb(ranked) - 'tiebreaker_score'
      order by score desc nulls last, tiebreaker_score desc nulls last, name
    ),
    '[]'::jsonb
  )
  from ranked;
$$;

create function public.workspace_set_tiebreaker(p_institution uuid, p_criterion uuid)
returns jsonb
language sql security invoker set search_path = '' as $$
  select private.workspace_set_tiebreaker(p_institution, p_criterion);
$$;

revoke all on function private.workspace_set_tiebreaker(uuid, uuid),
  private.freeze_tiebreaker_snapshot(),
  private.clear_inactive_tiebreaker(),
  public.workspace_set_tiebreaker(uuid, uuid)
from public, anon, authenticated;

grant execute on function private.workspace_set_tiebreaker(uuid, uuid), public.workspace_set_tiebreaker(uuid, uuid) to authenticated;
