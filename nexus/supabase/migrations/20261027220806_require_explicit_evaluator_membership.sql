-- Platform administration is not an implicit evaluator membership.
-- Management access and all existing function grants remain unchanged.
create or replace function private.has_institution_role(p_institution uuid,p_roles text[]) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (auth.jwt()->>'is_anonymous') is distinct from 'true'
 and exists(select 1 from public.institutions where id=p_institution and status='active')
 and ((private.is_platform_admin() and p_roles && array['institution_admin','coordinator','mentor','student']::text[]) or exists(
  select 1 from public.institution_memberships m join public.membership_roles r on r.membership_id=m.id
  where m.user_id=auth.uid() and m.institution_id=p_institution and m.status='active' and r.role=any(p_roles)));
$$;
