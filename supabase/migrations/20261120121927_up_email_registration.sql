-- Apply after database/schema.sql. Existing mock accounts are left unchanged.
-- Public registration creates an active student profile without staff approval.

create function les_private.require_up_email() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
    if tg_op = 'UPDATE' and new.email is not distinct from old.email then
        return new;
    end if;

    if new.email is null or new.email !~* '^[^@[:space:]]+@up[.]edu[.]ph$' then
        raise exception using
            errcode = '23514',
            message = 'Registration requires an @up.edu.ph email address.';
    end if;

    return new;
end;
$$;

-- This also prevents an account from changing to a non-UP email later.
create trigger les_require_up_email
before insert or update of email on auth.users
for each row execute function les_private.require_up_email();

create function les_private.create_student_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
    -- Auth signup has no logged-in auth.uid(). Only this Auth-table trigger may provision profiles.
    if tg_table_schema <> 'auth' or tg_table_name <> 'users' or tg_op <> 'INSERT' then
        raise exception 'Student profiles must be provisioned through Auth registration.';
    end if;

    if jsonb_typeof(new.raw_user_meta_data -> 'id_number') is distinct from 'string'
        or jsonb_typeof(new.raw_user_meta_data -> 'first_name') is distinct from 'string'
        or jsonb_typeof(new.raw_user_meta_data -> 'last_name') is distinct from 'string' then
        raise exception using
            errcode = '23514',
            message = 'Registration requires an ID number, first name and last name.';
    end if;

    -- Ignore supplied role, activation and duty metadata, even in direct Auth API requests.
    insert into public.profiles (
        id, id_number, first_name, last_name, role, requester_type, is_active, is_on_duty
    ) values (
        new.id,
        trim(new.raw_user_meta_data ->> 'id_number'),
        trim(new.raw_user_meta_data ->> 'first_name'),
        trim(new.raw_user_meta_data ->> 'last_name'),
        'student',
        'undergraduate',
        true,
        false
    );

    return new;
end;
$$;

create trigger les_create_student_profile
after insert on auth.users
for each row execute function les_private.create_student_profile();

-- Neither function is a callable client endpoint. Existing profile write restrictions remain in place.
revoke all on function les_private.require_up_email(), les_private.create_student_profile()
from public, anon, authenticated, service_role;
