begin;
insert into auth.users(id,is_anonymous) values
 ('10000000-0000-0000-0000-000000000011',false),
 ('10000000-0000-0000-0000-000000000012',false);
insert into public.platform_administrators(user_id) values ('10000000-0000-0000-0000-000000000011');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000011","role":"authenticated"}',true);
select set_config('test.institution_id',id::text,true) from public.platform_create_institution('Teste de administração');
do $$ begin
 if not exists(select 1 from public.institutions where id=current_setting('test.institution_id')::uuid)
 then raise exception 'admin without membership cannot read institution'; end if;
 begin perform public.platform_create_institution(' '); raise exception 'empty name accepted';
 exception when invalid_parameter_value then null; end;
 begin update public.institutions set name='Bypass'; raise exception 'direct write bypasses audit';
 exception when insufficient_privilege then null; end;
end $$;
select * from public.platform_set_institution_status(current_setting('test.institution_id')::uuid,'suspended');
select * from public.platform_set_institution_status(current_setting('test.institution_id')::uuid,'active');
select * from public.platform_set_institution_status(current_setting('test.institution_id')::uuid,'active');
do $$ begin
 begin perform public.platform_set_institution_status(current_setting('test.institution_id')::uuid,'invalid');
 raise exception 'invalid status accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.platform_set_institution_status('00000000-0000-0000-0000-000000000000','active');
 raise exception 'missing institution accepted'; exception when no_data_found then null; end;
end $$;

-- A forged metadata claim is never a platform grant.
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000012","role":"authenticated","user_metadata":{"isPlatformAdministrator":true}}',true);
do $$ begin
 if exists(select 1 from public.institutions where id=current_setting('test.institution_id')::uuid)
 then raise exception 'nonadmin read leaked'; end if;
 begin perform public.platform_create_institution('Forbidden'); raise exception 'nonadmin create allowed';
 exception when insufficient_privilege then null; end;
 begin perform public.platform_set_institution_status(current_setting('test.institution_id')::uuid,'suspended');
 raise exception 'nonadmin status allowed'; exception when insufficient_privilege then null; end;
end $$;
set local role anon;
do $$ begin
 begin perform public.platform_create_institution('Anonymous'); raise exception 'anon create allowed';
 exception when insufficient_privilege then null; end;
end $$;

reset role;
do $$ begin
 if (select count(*) from private.audit_events where resource_id=current_setting('test.institution_id')::uuid) <> 3
 then raise exception 'expected exactly create, suspend and activate audit events'; end if;
 if exists(select 1 from private.audit_events where resource_id=current_setting('test.institution_id')::uuid
 and actor_id <> '10000000-0000-0000-0000-000000000011'::uuid)
 then raise exception 'incorrect audit actor'; end if;
end $$;
update public.platform_administrators set revoked_at=now() where user_id='10000000-0000-0000-0000-000000000011';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000011","role":"authenticated"}',true);
do $$ begin
 begin perform public.platform_create_institution('Revoked'); raise exception 'revoked admin allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'PASS: global administration without membership, audited writes, invalid inputs, nonadmin/anon denial, forged metadata and revocation' as result;
