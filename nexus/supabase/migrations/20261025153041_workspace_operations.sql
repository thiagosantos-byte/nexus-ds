create function private.workspace_catalog() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or (auth.jwt()->>'is_anonymous')='true' then raise insufficient_privilege; end if;
 return jsonb_build_object('institutions',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'status',status) order by name)
 from public.institutions where status='active' or private.is_platform_admin()),'[]'::jsonb));
end $$;

create function private.event_results(p_event uuid) returns jsonb language sql stable security definer set search_path='' as $$
 with scores as (
 select p.id,p.name,count(e.id)::integer as submitted,round(avg(e.average),4) as score,
 (select count(*) from public.event_evaluators where event_id=p_event)::integer as expected
 from public.event_projects ep join public.projects p on p.id=ep.project_id
 left join public.project_evaluations e on e.event_id=ep.event_id and e.project_id=ep.project_id
 where ep.event_id=p_event group by p.id,p.name
 ), ranked as (select *,case when score is not null then dense_rank() over(order by score desc nulls last) end as position from scores)
 select coalesce(jsonb_agg(to_jsonb(ranked) order by score desc nulls last,name),'[]'::jsonb) from ranked;
$$;

create function private.workspace_read(p_institution uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare manager boolean; member_manager boolean; actor uuid:=auth.uid(); output jsonb;
begin
 if not private.has_institution_role(p_institution,array['institution_admin','coordinator','mentor','evaluator','student']) then raise insufficient_privilege; end if;
 manager:=private.has_institution_role(p_institution,array['institution_admin','coordinator']);
 member_manager:=private.has_institution_role(p_institution,array['institution_admin']);
 select jsonb_build_object(
 'institution',(select to_jsonb(i) from public.institutions i where id=p_institution),
 'capabilities',jsonb_build_object('manageMembers',member_manager,'manageProjects',member_manager,'manageEvents',manager,'manageCriteria',member_manager,'evaluate',private.has_institution_role(p_institution,array['evaluator']),'readAudit',member_manager),
 'projects',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc) from public.projects p where p.institution_id=p_institution and private.can_read_project(p.id)),'[]'::jsonb),
 'participants',coalesce((select jsonb_agg(to_jsonb(pp)) from public.project_participants pp where pp.institution_id=p_institution and private.can_read_project(pp.project_id)),'[]'::jsonb),
 'criteria',coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at,c.id) from public.evaluation_criteria c where c.institution_id=p_institution),'[]'::jsonb),
 'events',coalesce((select jsonb_agg(to_jsonb(ev) order by ev.scheduled_at desc) from public.evaluation_events ev where ev.institution_id=p_institution and private.can_read_event(ev.id)),'[]'::jsonb),
 'eventProjects',coalesce((select jsonb_agg(to_jsonb(ep)) from public.event_projects ep where ep.institution_id=p_institution and private.can_read_event(ep.event_id) and private.can_read_project(ep.project_id)),'[]'::jsonb),
 'eventEvaluators',coalesce((select jsonb_agg(to_jsonb(ee)) from public.event_evaluators ee where ee.institution_id=p_institution and private.can_read_event(ee.event_id)),'[]'::jsonb),
 'evaluations',coalesce((select jsonb_agg(to_jsonb(e)) from public.project_evaluations e where e.institution_id=p_institution and (manager or (e.evaluator_id=actor and private.can_read_event(e.event_id)))),'[]'::jsonb),
 'memberships',coalesce((select jsonb_agg(to_jsonb(m)||jsonb_build_object('roles',coalesce((select jsonb_agg(r.role order by r.role) from public.membership_roles r where r.membership_id=m.id),'[]'::jsonb))) from public.institution_memberships m where m.institution_id=p_institution and (member_manager or m.user_id=actor)),'[]'::jsonb),
 'people',coalesce((select jsonb_agg(jsonb_build_object('id',u.id,'name',u.name,'email',case when member_manager or u.id=actor then u.email end)) from public.user_profiles u where
 u.id=actor or (member_manager and exists(select 1 from public.institution_memberships m where m.institution_id=p_institution and m.user_id=u.id)) or
 exists(select 1 from public.project_participants pp where pp.institution_id=p_institution and pp.user_id=u.id and private.can_read_project(pp.project_id)) or
 exists(select 1 from public.event_evaluators ee where ee.institution_id=p_institution and ee.user_id=u.id and private.can_read_event(ee.event_id))),'[]'::jsonb),
 'results',coalesce((select jsonb_agg(jsonb_build_object('event_id',ev.id,'name',ev.name,'status',ev.status,'published',ev.results_published,'rows',private.event_results(ev.id)) order by ev.scheduled_at desc)
 from public.evaluation_events ev where ev.institution_id=p_institution and ev.status<>'cancelled' and (manager or ev.results_published)),'[]'::jsonb),
 'audit',case when member_manager then coalesce((select jsonb_agg(to_jsonb(a) order by a.occurred_at desc) from (select id,actor_id,action,resource_id,occurred_at from private.audit_events where institution_id=p_institution order by occurred_at desc limit 200) a),'[]'::jsonb) else '[]'::jsonb end
 ) into output;
 return output;
end $$;

create function private.workspace_command(p_institution uuid,p_action text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); rid uuid; target uuid; allowed text[]; wanted_roles text[]; r text;
 mem public.institution_memberships; proj public.projects; ev public.evaluation_events; scores jsonb; snap jsonb;
 total numeric:=0; weights numeric:=0; grade numeric; target_status text; affected integer;
begin
 if actor is null or (auth.jwt()->>'is_anonymous')='true' then raise insufficient_privilege; end if;
 if jsonb_typeof(p_data) is distinct from 'object' then raise invalid_parameter_value using message='Dados inválidos'; end if;
 allowed:=case p_action
 when 'access.request' then array['role'] when 'member.save' then array['id','email','status','roles']
 when 'project.save' then array['id','name','summary','category','stage','year','semester','archived']
 when 'project.team' then array['id','user_id','kind','remove']
 when 'criterion.save' then array['id','name','weight','descriptors','active']
 when 'event.save' then array['id','name','scheduled_at','project_ids','evaluator_ids']
 when 'event.status' then array['id','status'] when 'event.publish' then array['id','published']
 when 'evaluation.submit' then array['event_id','project_id','scores','notes'] else null end;
 if allowed is null or exists(select 1 from jsonb_object_keys(p_data) k where not(k=any(allowed))) then raise invalid_parameter_value using message='Operação ou campos inválidos'; end if;

 if p_action='access.request' then
   if not exists(select 1 from public.institutions where id=p_institution and status='active') then raise insufficient_privilege; end if;
   r:=p_data->>'role';
   if r is null or r not in ('coordinator','mentor','evaluator','student') then raise invalid_parameter_value; end if;
   if exists(select 1 from public.institution_memberships where institution_id=p_institution and user_id=actor and status<>'pending') then
    raise invalid_parameter_value using message='Já existe um vínculo ativo ou suspenso; procure o administrador'; end if;
   insert into public.institution_memberships(user_id,institution_id,status,requested_role) values(actor,p_institution,'pending',r)
   on conflict(user_id,institution_id) do update set requested_role=excluded.requested_role returning id into rid;
 else
   if not private.has_institution_role(p_institution,array['institution_admin','coordinator','mentor','evaluator','student']) then raise insufficient_privilege; end if;
   rid:=nullif(p_data->>'id','')::uuid;

   if p_action='member.save' then
    if not private.has_institution_role(p_institution,array['institution_admin']) then raise insufficient_privilege; end if;
    target_status:=p_data->>'status';
    if target_status is null or target_status not in ('active','pending','suspended') or jsonb_typeof(p_data->'roles') is distinct from 'array' then raise invalid_parameter_value; end if;
    select array_agg(distinct x) into wanted_roles from jsonb_array_elements_text(p_data->'roles') x;
    if coalesce(cardinality(wanted_roles),0)=0 or exists(select 1 from unnest(wanted_roles) x where x not in ('institution_admin','coordinator','mentor','evaluator','student')) then raise invalid_parameter_value; end if;
    if rid is not null then
     select * into mem from public.institution_memberships where id=rid and institution_id=p_institution for update;
     if not found then raise no_data_found; end if; target:=mem.user_id;
    else
     select id into target from public.user_profiles where lower(email)=lower(trim(p_data->>'email'));
     if target is null then raise invalid_parameter_value using message='A pessoa deve entrar com Google antes de receber o vínculo'; end if;
     select * into mem from public.institution_memberships where institution_id=p_institution and user_id=target for update;
     rid:=mem.id;
    end if;
    if not private.is_platform_admin() and (target=actor or 'institution_admin'=any(wanted_roles) or exists(select 1 from public.membership_roles where membership_id=rid and role='institution_admin')) then raise insufficient_privilege; end if;
    if rid is null then
     insert into public.institution_memberships(institution_id,user_id,status) values(p_institution,target,target_status) returning id into rid;
    else update public.institution_memberships set status=target_status where id=rid; end if;
    delete from public.membership_roles where membership_id=rid;
    insert into public.membership_roles(membership_id,role) select rid,x from unnest(wanted_roles) x;

   elsif p_action='project.save' then
    if rid is not null then
     select * into proj from public.projects where id=rid and institution_id=p_institution for update;
     if not found then raise no_data_found; end if;
    end if;
    if not private.has_institution_role(p_institution,array['institution_admin']) then
     if rid is null or not private.has_institution_role(p_institution,array['student']) or not exists(select 1 from public.project_participants where project_id=rid and user_id=actor and kind='student')
       or exists(select 1 from jsonb_object_keys(p_data) k where k not in ('id','summary')) then raise insufficient_privilege; end if;
     if jsonb_typeof(p_data->'summary') is distinct from 'string' then raise invalid_parameter_value; end if;
     update public.projects set summary=p_data->>'summary' where id=rid;
    else
     if jsonb_typeof(p_data->'name') is distinct from 'string' or jsonb_typeof(p_data->'summary') is distinct from 'string' then raise invalid_parameter_value; end if;
     if rid is null then
      insert into public.projects(institution_id,name,summary,category,stage,year,semester)
      values(p_institution,trim(p_data->>'name'),p_data->>'summary',coalesce(p_data->>'category',''),coalesce(p_data->>'stage','Descoberta'),(p_data->>'year')::integer,(p_data->>'semester')::integer) returning id into rid;
     else
      update public.projects set name=trim(p_data->>'name'),summary=p_data->>'summary',category=coalesce(p_data->>'category',''),
       stage=coalesce(p_data->>'stage',stage),year=coalesce((p_data->>'year')::integer,year),semester=coalesce((p_data->>'semester')::integer,semester),archived=coalesce((p_data->>'archived')::boolean,archived) where id=rid;
     end if;
    end if;

   elsif p_action='project.team' then
    if not private.has_institution_role(p_institution,array['institution_admin']) then raise insufficient_privilege; end if;
    perform 1 from public.projects where id=rid and institution_id=p_institution for update;
    if not found then raise no_data_found; end if;
    target:=(p_data->>'user_id')::uuid;r:=p_data->>'kind';
    if r is null or r not in ('mentor','student') then raise invalid_parameter_value; end if;
    if coalesce((p_data->>'remove')::boolean,false) then delete from public.project_participants where project_id=rid and user_id=target and kind=r;
    else
     if not exists(select 1 from public.institution_memberships m join public.membership_roles mr on mr.membership_id=m.id
       where m.institution_id=p_institution and m.user_id=target and m.status='active' and mr.role=r) then raise invalid_parameter_value using message='Vínculo ativo e papel compatível são obrigatórios'; end if;
     insert into public.project_participants values(p_institution,rid,target,r) on conflict do nothing;
    end if;

   elsif p_action='criterion.save' then
    if not private.has_institution_role(p_institution,array['institution_admin']) then raise insufficient_privilege; end if;
    if jsonb_typeof(p_data->'descriptors') is distinct from 'array' or jsonb_array_length(p_data->'descriptors')<>5
      or exists(select 1 from jsonb_array_elements(p_data->'descriptors') x where jsonb_typeof(x)<>'string' or char_length(x#>>'{}')>1000) then raise invalid_parameter_value; end if;
    if rid is null then
     insert into public.evaluation_criteria(institution_id,name,weight,descriptors) values(p_institution,trim(p_data->>'name'),(p_data->>'weight')::numeric,p_data->'descriptors') returning id into rid;
    else
     update public.evaluation_criteria set name=trim(p_data->>'name'),weight=(p_data->>'weight')::numeric,descriptors=p_data->'descriptors',active=coalesce((p_data->>'active')::boolean,active) where id=rid and institution_id=p_institution;
     if not found then raise no_data_found; end if;
    end if;

   elsif p_action='event.save' then
    if not private.has_institution_role(p_institution,array['institution_admin','coordinator']) then raise insufficient_privilege; end if;
    if jsonb_typeof(p_data->'project_ids') is distinct from 'array' or jsonb_typeof(p_data->'evaluator_ids') is distinct from 'array' then raise invalid_parameter_value; end if;
    if exists(select 1 from jsonb_array_elements_text(p_data->'project_ids') x where not exists(select 1 from public.projects where id=x::uuid and institution_id=p_institution and not archived))
     or exists(select 1 from jsonb_array_elements_text(p_data->'evaluator_ids') x where not exists(select 1 from public.institution_memberships m join public.membership_roles mr on mr.membership_id=m.id where m.institution_id=p_institution and m.user_id=x::uuid and m.status='active' and mr.role='evaluator')) then raise invalid_parameter_value using message='Projetos e avaliadores devem pertencer à instituição e estar ativos'; end if;
    if rid is null then
     insert into public.evaluation_events(institution_id,name,scheduled_at) values(p_institution,trim(p_data->>'name'),(p_data->>'scheduled_at')::timestamptz) returning id into rid;
    else
     perform 1 from public.evaluation_events where id=rid and institution_id=p_institution and status='draft' for update;
     if not found then raise invalid_parameter_value using message='Somente bancas em preparação podem ser editadas'; end if;
     update public.evaluation_events set name=trim(p_data->>'name'),scheduled_at=(p_data->>'scheduled_at')::timestamptz where id=rid;
     delete from public.event_projects where event_id=rid; delete from public.event_evaluators where event_id=rid;
    end if;
    insert into public.event_projects select distinct p_institution,rid,x::uuid from jsonb_array_elements_text(p_data->'project_ids') x;
    insert into public.event_evaluators select distinct p_institution,rid,x::uuid from jsonb_array_elements_text(p_data->'evaluator_ids') x;

   elsif p_action in ('event.status','event.publish') then
    if not private.has_institution_role(p_institution,array['institution_admin','coordinator']) then raise insufficient_privilege; end if;
    select * into ev from public.evaluation_events where id=rid and institution_id=p_institution for update;
    if not found then raise no_data_found; end if;
    if p_action='event.publish' then
     if ev.status<>'closed' then raise invalid_parameter_value using message='Encerre a banca antes de publicar'; end if;
     if jsonb_typeof(p_data->'published') is distinct from 'boolean' then raise invalid_parameter_value; end if;
     update public.evaluation_events set results_published=(p_data->>'published')::boolean where id=rid;
    else
     target_status:=p_data->>'status';
     if target_status='open' and ev.status='draft' then
      select jsonb_agg(jsonb_build_object('id',id,'name',name,'weight',weight,'descriptors',descriptors) order by created_at,id) into snap from public.evaluation_criteria where institution_id=p_institution and active;
      if snap is null or not exists(select 1 from public.event_projects where event_id=rid) or not exists(select 1 from public.event_evaluators where event_id=rid) then raise invalid_parameter_value using message='Defina critérios, projetos e avaliadores antes de abrir a banca'; end if;
      if exists(select 1 from public.event_evaluators ee where ee.event_id=rid and not exists(select 1 from public.institution_memberships m join public.membership_roles mr on mr.membership_id=m.id where m.institution_id=p_institution and m.user_id=ee.user_id and m.status='active' and mr.role='evaluator')) then raise invalid_parameter_value using message='Há avaliador sem vínculo ativo'; end if;
      update public.evaluation_events set status='open',criteria_snapshot=snap where id=rid;
     elsif target_status='closed' and ev.status='open' then
      if exists(select 1 from public.event_projects ep cross join public.event_evaluators ee where ep.event_id=rid and ee.event_id=rid and not exists(select 1 from public.project_evaluations e where e.event_id=rid and e.project_id=ep.project_id and e.evaluator_id=ee.user_id)) then raise invalid_parameter_value using message='Existem avaliações pendentes'; end if;
      update public.evaluation_events set status='closed' where id=rid;
     elsif target_status='cancelled' and ev.status in ('draft','open') then update public.evaluation_events set status='cancelled' where id=rid;
     else raise invalid_parameter_value using message='Transição de status inválida'; end if;
    end if;

   elsif p_action='evaluation.submit' then
    if not private.has_institution_role(p_institution,array['evaluator']) then raise insufficient_privilege; end if;
    rid:=(p_data->>'event_id')::uuid; target:=(p_data->>'project_id')::uuid;
    select * into ev from public.evaluation_events where id=rid and institution_id=p_institution for share;
    if not found or ev.status<>'open' then raise invalid_parameter_value using message='A banca não está aberta'; end if;
    if not exists(select 1 from public.event_evaluators where event_id=rid and user_id=actor) or not exists(select 1 from public.event_projects where event_id=rid and project_id=target) then raise insufficient_privilege; end if;
    scores:=p_data->'scores';
    if jsonb_typeof(scores) is distinct from 'object' or (select count(*) from jsonb_object_keys(scores))<>jsonb_array_length(ev.criteria_snapshot) then raise invalid_parameter_value using message='Informe uma nota para cada critério'; end if;
    for snap in select * from jsonb_array_elements(ev.criteria_snapshot) loop
     if jsonb_typeof(scores->(snap->>'id')) is distinct from 'number' then raise invalid_parameter_value; end if;
     grade:=(scores->>(snap->>'id'))::numeric;
     if grade<1 or grade>5 or grade<>trunc(grade) then raise invalid_parameter_value using message='As notas devem ser inteiras entre 1 e 5'; end if;
     total:=total+grade*(snap->>'weight')::numeric;weights:=weights+(snap->>'weight')::numeric;
    end loop;
    insert into public.project_evaluations(institution_id,event_id,project_id,evaluator_id,scores,average,notes)
    values(p_institution,rid,target,actor,scores,total/weights,coalesce(p_data->>'notes',''))
    on conflict(event_id,project_id,evaluator_id) do update set scores=excluded.scores,average=excluded.average,notes=excluded.notes,submitted_at=now()
    returning id into rid;
   end if;
 end if;
 insert into private.audit_events(actor_id,institution_id,action,resource_id) values(actor,p_institution,p_action,rid);
 return jsonb_build_object('ok',true,'id',rid);
end $$;

create function public.workspace_catalog() returns jsonb language sql security invoker set search_path='' as $$select private.workspace_catalog();$$;
create function public.workspace_read(p_institution uuid) returns jsonb language sql security invoker set search_path='' as $$select private.workspace_read(p_institution);$$;
create function public.workspace_command(p_institution uuid,p_action text,p_data jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.workspace_command(p_institution,p_action,p_data);$$;
revoke all on function private.workspace_catalog(),private.event_results(uuid),private.workspace_read(uuid),private.workspace_command(uuid,text,jsonb),public.workspace_catalog(),public.workspace_read(uuid),public.workspace_command(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function private.workspace_catalog(),private.workspace_read(uuid),private.workspace_command(uuid,text,jsonb),public.workspace_catalog(),public.workspace_read(uuid),public.workspace_command(uuid,text,jsonb) to authenticated;
