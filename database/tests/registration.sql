-- Run after the registration migration. All temporary identities are rolled back; no emails are sent.
begin;

do $$
declare
    test_user_id uuid := gen_random_uuid();

    failed_user_id uuid;

    invalid_email text;

    metadata jsonb := '{"id_number":"TEST-REGISTRATION-ROLLBACK","first_name":" Sample ","last_name":" Student ","role":"admin","is_active":false,"is_on_duty":true}';
begin
    -- The Auth-table trigger rejects other domains, including suffix tricks and subdomains.
    foreach invalid_email in array array[
        'registration-test@gmail.com',
        'registration-test@upv.edu.ph',
        'registration-test@students.up.edu.ph',
        'registration-test@up.edu.ph.evil.test',
        'registration test@up.edu.ph',
        'registration@test@up.edu.ph',
        null
    ] loop
        begin
            insert into auth.users (id, email, raw_user_meta_data)
            values (gen_random_uuid(), invalid_email, metadata);

            raise exception 'An invalid email was accepted: %', invalid_email;
        exception when check_violation then
            if sqlerrm <> 'Registration requires an @up.edu.ph email address.' then
                raise;
            end if;
        end;
    end loop;

    -- Simulate an Auth insertion without sending an email or creating a permanent account.
    insert into auth.users (id, email, raw_user_meta_data)
    values (test_user_id, 'registration-test@UP.EDU.PH', metadata);

    perform set_config('les.test_user_id', test_user_id::text, true);

    -- Duplicate identity numbers must roll back the Auth user too.
    failed_user_id := gen_random_uuid();

    begin
        insert into auth.users (id, email, raw_user_meta_data)
        values (failed_user_id, 'registration-duplicate@up.edu.ph', metadata);

        raise exception 'A duplicate ID number was accepted.';
    exception when unique_violation then
        if exists (select 1 from auth.users where id = failed_user_id) then
            raise exception 'Failed signup left an orphaned Auth user.';
        end if;
    end;

    -- Missing identity data cannot create an incomplete account.
    begin
        insert into auth.users (id, email, raw_user_meta_data)
        values (gen_random_uuid(), 'registration-missing@up.edu.ph', '{}');

        raise exception 'Missing signup identity was accepted.';
    exception when check_violation then
        if sqlerrm <> 'Registration requires an ID number, first name and last name.' then
            raise;
        end if;
    end;

    -- An existing user cannot switch to an email outside the allowed domain.
    begin
        update auth.users set email = 'registration-test@gmail.com' where id = test_user_id;

        raise exception 'A non-UP email change was accepted.';
    exception when check_violation then
        null;
    end;
end;
$$;

reset role;

do $$
declare
    profile_record record;
begin
    select * into strict profile_record from public.profiles
    where id = current_setting('les.test_user_id')::uuid;

    if profile_record.role <> 'student' or not profile_record.is_active or profile_record.is_on_duty
        or profile_record.first_name <> 'Sample' or profile_record.last_name <> 'Student' then
        raise exception 'Registration did not create the expected student profile.';
    end if;
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('les.test_user_id'), true);

set local role authenticated;

do $$
begin
    -- Creating an account is automatic, but app access still requires email ownership verification.
    if les_private.current_app_role() is not null then
        raise exception 'An unverified signup gained app access.';
    end if;
end;
$$;

reset role;

update auth.users set email_confirmed_at = now()
where id = current_setting('les.test_user_id')::uuid;

set local role authenticated;

do $$
begin
    if les_private.current_app_role() is distinct from 'student' then
        raise exception 'A verified student could not access the app.';
    end if;

    if (select count(*) from public.profiles) <> 1 then
        raise exception 'Student profile ownership policy failed.';
    end if;

    -- Client writes cannot promote an account to staff or admin.
    begin
        update public.profiles set role = 'admin' where id = auth.uid();

        raise exception 'A student could change their own role.';
    exception when insufficient_privilege then
        null;
    end;
end;
$$;

rollback;

select 'Registration checks passed; all temporary Auth users and profiles rolled back.' as result;
