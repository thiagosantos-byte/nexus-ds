-- Explicit, opt-in test data. Never executed by builds, deploys or migrations.
-- Set catapimba.seed_owner to the existing platform administrator's UUID first.
-- Creates ONLY a separate labeled institution. Re-running preserves existing data.
begin;
select pg_advisory_xact_lock(hashtextextended('catapimba:podium-lab:v1',0));
do $$
declare
 actor uuid := nullif(current_setting('catapimba.seed_owner',true),'')::uuid;
 lab uuid; member_id uuid; project_ids uuid[] := '{}'; criterion_ids uuid[] := '{}'; bank_id uuid;
 project_names text[] := array['[TESTE] Aurora Solar','[TESTE] Rota Acessível','[TESTE] Horta Circular','[TESTE] Água Viva'];
 criteria_names text[] := array['[TESTE] Inovação','[TESTE] Impacto','[TESTE] Viabilidade'];
 matrix jsonb; grades jsonb; expected numeric[]; row_data jsonb; result_data jsonb;
 i integer; bank integer; existing_count integer;
begin
 if actor is null or not exists(select 1 from public.platform_administrators where user_id=actor and revoked_at is null)
   or not exists(select 1 from public.user_profiles where id=actor) then
  raise exception 'Provide an existing, active platform administrator as seed_owner';
 end if;
 select count(*) into existing_count from public.institutions where name='Catapimba — Laboratório de Testes';
 if existing_count>0 then
  if existing_count<>1 or not exists(select 1 from public.institutions i join private.audit_events a on a.institution_id=i.id where i.name='Catapimba — Laboratório de Testes' and a.action='testdata.podium_lab.seed' and a.actor_id=actor) then
   raise exception 'Name already exists without the expected test-data marker; no data changed';
  end if;
  return;
 end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','is_anonymous',false)::text,true);
 select id into lab from public.platform_create_institution('Catapimba — Laboratório de Testes');
 perform public.workspace_command(lab,'member.save',jsonb_build_object('email',(select email from public.user_profiles where id=actor),'status','active','roles',jsonb_build_array('institution_admin','coordinator','evaluator')));
 for i in 1..3 loop
  criterion_ids:=array_append(criterion_ids,(public.workspace_command(lab,'criterion.save',jsonb_build_object('name',criteria_names[i],'weight',case when i=3 then 1 else 2 end,'descriptors',jsonb_build_array('1 — Inicial [TESTE]','2 — Em desenvolvimento [TESTE]','3 — Adequado [TESTE]','4 — Bom [TESTE]','5 — Excelente [TESTE]')))->>'id')::uuid);
 end loop;
 for i in 1..4 loop
  project_ids:=array_append(project_ids,(public.workspace_command(lab,'project.save',jsonb_build_object('name',project_names[i],'summary','DADOS FICTÍCIOS DE TESTE. Projeto criado exclusivamente para validar a cerimônia do pódio. Não representa um projeto acadêmico real.','category','Laboratório de testes','stage','Concluído','year',2026,'semester',2))->>'id')::uuid);
 end loop;
 for bank in 1..2 loop
  bank_id:=(public.workspace_command(lab,'event.save',jsonb_build_object('name',case when bank=1 then '[TESTE] Jornada de Inovação — premiação' else '[TESTE] Vitória compartilhada — empate' end,'scheduled_at',now(),'project_ids',to_jsonb(project_ids),'evaluator_ids',jsonb_build_array(actor)))->>'id')::uuid;
  perform public.workspace_command(lab,'event.status',jsonb_build_object('id',bank_id,'status','open'));
  matrix:=case when bank=1 then '[[5,5,4],[5,4,4],[4,4,4],[3,4,3]]'::jsonb else '[[5,5,4],[5,5,4],[5,4,4],[4,4,4]]'::jsonb end;
  expected:=case when bank=1 then array[4.8,4.4,4.0,3.4]::numeric[] else array[4.8,4.8,4.4,4.0]::numeric[] end;
  for i in 1..4 loop
   grades:=matrix->(i-1);
   perform public.workspace_command(lab,'evaluation.submit',jsonb_build_object('event_id',bank_id,'project_id',project_ids[i],'scores',jsonb_build_object(criterion_ids[1]::text,grades->0,criterion_ids[2]::text,grades->1,criterion_ids[3]::text,grades->2),'notes','[TESTE] Avaliação fictícia autorizada para validar animação, ranking e empates.'));
   if (select average from public.project_evaluations where event_id=bank_id and project_id=project_ids[i] and evaluator_id=actor limit 1) is null then
    raise exception 'Test evaluation missing';
   end if;
  end loop;
  perform public.workspace_command(lab,'event.status',jsonb_build_object('id',bank_id,'status','closed'));
  perform public.workspace_command(lab,'event.publish',jsonb_build_object('id',bank_id,'published',true));
  select value into result_data from jsonb_array_elements(public.workspace_read(lab)->'results') where value->>'event_id'=bank_id::text;
  if result_data is null or not (result_data->>'published')::boolean or result_data->>'status'<>'closed' then raise exception 'Test event not published'; end if;
  for i in 1..4 loop
   select value into row_data from jsonb_array_elements(result_data->'rows') where value->>'id'=project_ids[i]::text;
   if (row_data->>'score')::numeric<>expected[i] or (row_data->>'submitted')::integer<>1 then raise exception 'Unexpected fixture score'; end if;
  end loop;
  if bank=2 and (select count(*) from jsonb_array_elements(result_data->'rows') where value->>'position'='1')<>2 then raise exception 'Tie fixture failed'; end if;
 end loop;
 insert into private.audit_events(actor_id,institution_id,action,resource_id) values(actor,lab,'testdata.podium_lab.seed',lab);
end $$;
commit;
