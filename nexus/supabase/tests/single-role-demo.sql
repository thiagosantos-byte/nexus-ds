begin;
insert into auth.users(id,email,is_anonymous) values
 ('93000000-0000-0000-0000-000000000001','demo-role@example.test',false),
 ('93000000-0000-0000-0000-000000000002','not-allowlisted@example.test',false);
insert into public.institutions(id,name,status) values
 ('94000000-0000-0000-0000-000000000001','Demo role test','active');
insert into public.institution_memberships(id,institution_id,user_id,status) values
 ('93000000-0000-0000-0000-000000000101','94000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000001','active'),
 ('93000000-0000-0000-0000-000000000102','94000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000002','active');
insert into public.membership_roles(membership_id,role) values
 ('93000000-0000-0000-0000-000000000101','institution_admin'),
 ('93000000-0000-0000-0000-000000000102','student');
insert into private.demo_role_allowlist(user_id,institution_id,allowed_roles) values
 ('93000000-0000-0000-0000-000000000001','94000000-0000-0000-0000-000000000001',
  array['institution_admin','coordinator','mentor','evaluator','student']::text[]);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"93000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"93000000-0000-0000-0000-000000000201"}',true);
select public.demo_role_switch('94000000-0000-0000-0000-000000000001','student');
do $$ begin
 if not private.has_institution_role('94000000-0000-0000-0000-000000000001',array['student']) then raise exception 'Demo role was not applied'; end if;
 if private.has_institution_role('94000000-0000-0000-0000-000000000001',array['institution_admin']) then raise exception 'Demo role retained real admin access'; end if;
 if private.is_platform_admin() then raise exception 'Platform admin access remained active in demo mode'; end if;
 if public.workspace_read('94000000-0000-0000-0000-000000000001')->>'demoRole' <> 'student' then raise exception 'Selected demo role not returned'; end if;
end $$;
do $$ begin
 begin
  perform public.demo_role_switch('94000000-0000-0000-0000-000000000001','not-a-role');
  raise exception 'Unexpected role accepted';
 exception when invalid_parameter_value then null;
 end;
end $$;
select public.demo_role_switch('94000000-0000-0000-0000-000000000001',null);
do $$ begin
 if private.demo_mode_active() then raise exception 'Demo mode did not clear'; end if;
 if not private.has_institution_role('94000000-0000-0000-0000-000000000001',array['institution_admin']) then raise exception 'Real role not restored'; end if;
end $$;
reset role;
do $$ begin
 begin
  insert into public.membership_roles(membership_id,role)
  values('93000000-0000-0000-0000-000000000101','student');
  raise exception 'Multiple roles were accepted for one membership';
 exception when unique_violation then null;
 end;
end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"93000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"93000000-0000-0000-0000-000000000202"}',true);
do $$ begin
 begin
  perform public.demo_role_switch('94000000-0000-0000-0000-000000000001','coordinator');
  raise exception 'Non-allowlisted account switched roles';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;
rollback;
select 'PASS: one role per membership, allowlisted session-bound demo role, role override and reset, platform privileges suppressed' as result;
