-- Keep the demo-status endpoint as a caller-context wrapper and index its private
-- institution references. The implementation reads only the caller's own context.
create or replace function private.demo_role_status() returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'active',private.demo_mode_active(),
    'role',(select c.role from private.demo_role_context c
      where c.user_id=auth.uid() and c.session_id=auth.jwt()->>'session_id' limit 1),
    'institution_id',(select c.institution_id from private.demo_role_context c
      where c.user_id=auth.uid() and c.session_id=auth.jwt()->>'session_id' limit 1)
  );
$$;
revoke all on function private.demo_role_status() from public,anon,authenticated;
grant execute on function private.demo_role_status() to authenticated;

create or replace function public.demo_role_status() returns jsonb
language sql stable security invoker set search_path='' as $$
  select private.demo_role_status();
$$;
revoke all on function public.demo_role_status() from public,anon,authenticated;
grant execute on function public.demo_role_status() to authenticated;

create index if not exists demo_role_allowlist_institution_idx
  on private.demo_role_allowlist(institution_id);
create index if not exists demo_role_context_institution_idx
  on private.demo_role_context(institution_id);
