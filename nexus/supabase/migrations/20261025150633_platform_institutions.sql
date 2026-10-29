-- Global administration is independent of institutional membership.
create policy platform_admin_read_institutions on public.institutions
for select to authenticated using (
  exists(select 1 from public.platform_administrators a
    where a.user_id = (select auth.uid()) and a.revoked_at is null)
);

-- These narrowly scoped operations need privilege to write private audit rows.
-- They verify the caller themselves, fix search_path, and revoke default EXECUTE.
create function public.platform_create_institution(p_name text)
returns setof public.institutions language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); result public.institutions;
begin
  if actor is null or (auth.jwt()->>'is_anonymous') = 'true' then
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

create function public.platform_set_institution_status(p_id uuid, p_status text)
returns setof public.institutions language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); result public.institutions;
begin
  if actor is null or (auth.jwt()->>'is_anonymous') = 'true' then
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

revoke all on function public.platform_create_institution(text) from public, anon, authenticated;
revoke all on function public.platform_set_institution_status(uuid,text) from public, anon, authenticated;
grant execute on function public.platform_create_institution(text) to authenticated;
grant execute on function public.platform_set_institution_status(uuid,text) to authenticated;
-- Still no direct table INSERT/UPDATE grants; clients cannot bypass the audit.
