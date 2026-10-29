-- Keep elevated implementations outside exposed schemas. Public RPC entrypoints
-- run as the caller and delegate only to the guarded, narrow private operations.
alter function public.platform_create_institution(text) set schema private;
alter function public.platform_set_institution_status(uuid,text) set schema private;
grant usage on schema private to authenticated;

create function public.platform_create_institution(p_name text)
returns setof public.institutions language sql security invoker set search_path = '' as $$
  select * from private.platform_create_institution(p_name);
$$;
create function public.platform_set_institution_status(p_id uuid,p_status text)
returns setof public.institutions language sql security invoker set search_path = '' as $$
  select * from private.platform_set_institution_status(p_id,p_status);
$$;
revoke all on function public.platform_create_institution(text) from public, anon, authenticated;
revoke all on function public.platform_set_institution_status(uuid,text) from public, anon, authenticated;
grant execute on function public.platform_create_institution(text) to authenticated;
grant execute on function public.platform_set_institution_status(uuid,text) to authenticated;
-- Schema USAGE does not grant table access. Audit and all other private tables
-- remain inaccessible; implementations still check auth.uid() and admin status.
