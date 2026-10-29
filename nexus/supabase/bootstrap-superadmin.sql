-- Restricted operator procedure, not a public endpoint. Run only after the real
-- user has signed in. Requires psql with a privileged connection (never a VITE_ variable).
-- psql "$DATABASE_URL" -v user_id='UUID_FROM_AUTH_USERS' -f supabase/bootstrap-superadmin.sql
\set ON_ERROR_STOP on
begin;
with inserted as (
  insert into public.platform_administrators(user_id)
  select id from auth.users where id = :'user_id'::uuid and not is_anonymous
  on conflict (user_id) do nothing
  returning user_id
), logged as (
  insert into private.audit_events(actor_id,action,resource_id)
  select null, 'platform_administrator.bootstrap', user_id from inserted
  returning resource_id
)
select resource_id as granted_user_id from logged;
commit;
-- Exactly one returned UUID means a new grant. Zero rows means no change:
-- account missing, anonymous, or already recorded (including revoked grants).
