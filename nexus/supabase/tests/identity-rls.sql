-- Run on the development database as an operator. All fixtures are rolled back.
begin;
insert into auth.users(id,is_anonymous) values
 ('10000000-0000-0000-0000-000000000001',false),
 ('10000000-0000-0000-0000-000000000002',false);
insert into public.institutions(id,name) values
 ('20000000-0000-0000-0000-000000000001','Teste A'),
 ('20000000-0000-0000-0000-000000000002','Teste B');
insert into public.institution_memberships(id,user_id,institution_id,status) values
 ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','active'),
 ('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','active');
insert into public.membership_roles values
 ('30000000-0000-0000-0000-000000000001','student'),
 ('30000000-0000-0000-0000-000000000002','institution_admin');
insert into public.platform_administrators(user_id) values ('10000000-0000-0000-0000-000000000002');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
do $$
begin
  if (select count(*) from public.institutions) <> 1 then raise exception 'institution isolation failed'; end if;
  if exists(select 1 from public.institutions where name='Teste B') then raise exception 'cross institution read'; end if;
  if (select count(*) from public.institution_memberships) <> 1 then raise exception 'membership isolation failed'; end if;
  if (select count(*) from public.membership_roles) <> 1 then raise exception 'role isolation failed'; end if;
  if exists(select 1 from public.platform_administrators) then raise exception 'platform privileges leaked'; end if;
  begin
    update public.institution_memberships set status='active';
    raise exception 'unexpected update permission';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.platform_administrators(user_id) values ('10000000-0000-0000-0000-000000000001');
    raise exception 'unexpected self promotion';
  exception when insufficient_privilege then null; end;
  begin
    select 1 from private.audit_events;
    raise exception 'audit read allowed';
  exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
do $$ begin
  if (select count(*) from public.platform_administrators) <> 1 then raise exception 'own administrator grant missing'; end if;
  if exists(select 1 from public.institutions where name='Teste A') then raise exception 'identity switch leaked rows'; end if;
end $$;

reset role;
update public.institution_memberships set status='suspended' where id='30000000-0000-0000-0000-000000000001';
update public.platform_administrators set revoked_at=now() where user_id='10000000-0000-0000-0000-000000000002';
set local role authenticated;
do $$ begin
  if exists(select 1 from public.platform_administrators) then raise exception 'revocation not effective'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
do $$ begin
  if (select status from public.institution_memberships limit 1) <> 'suspended' then raise exception 'suspension not visible'; end if;
end $$;

set local role anon;
do $$ begin
  begin
    select 1 from public.institution_memberships;
    raise exception 'anonymous read allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'PASS: tenant isolation, own roles, denied writes, denied audit, revocation, suspension and anonymous denial' as result;
