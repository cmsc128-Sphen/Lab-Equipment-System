-- Additive student booking submission. Apply after schema.sql and admin-bookings.sql.
-- Saves one Pending request and its lines in a single transaction. Stock is not reserved here.
begin;

-- True when a retry carries the same details and lines as the request already saved under its key.
-- Quantities are compared as JSON, so a malformed retry is simply "different" instead of a cast error.
create or replace function les_private.booking_matches(
    p_request_id uuid, p_subject text, p_purpose text,
    p_borrow_date date, p_return_date date, p_items jsonb
) returns boolean
language sql stable security invoker set search_path = '' as $$
    select r.subject = trim(p_subject) and r.purpose = trim(p_purpose)
        and r.borrow_date = p_borrow_date and r.return_date = p_return_date
        and jsonb_typeof(p_items) = 'array'
        and (select coalesce(jsonb_agg(jsonb_build_array(ri.item_id::text, ri.qty_requested) order by ri.item_id::text), '[]'::jsonb)
             from public.request_items ri where ri.request_id = r.id)
          = (select coalesce(jsonb_agg(jsonb_build_array(lower(a->>'inventoryId'), a->'quantity') order by lower(a->>'inventoryId')), '[]'::jsonb)
             from jsonb_array_elements(p_items) a)
    from public.requests r where r.id = p_request_id;
$$;

revoke all on function les_private.booking_matches(uuid, text, text, date, date, jsonb) from public, anon, authenticated;

create or replace function les_private.submit_booking(
    p_submission_key uuid, p_subject text, p_purpose text,
    p_borrow_date date, p_return_date date, p_items jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
    actor public.profiles%rowtype;
    actor_email text;
    booking public.requests%rowtype;
    today date := (now() at time zone 'Asia/Manila')::date;
    line jsonb;
    stock public.items%rowtype;
    quantity bigint;
begin
    -- Definer rights are needed because students have no table write grants.
    -- Owner, status and snapshots come from verified records, never from the caller.
    if auth.uid() is null or les_private.current_app_role() is distinct from 'student' then
        raise exception 'BOOKING_FORBIDDEN';
    end if;

    select * into actor from public.profiles where id = auth.uid() and is_active;

    select email into actor_email from auth.users where id = auth.uid();

    if not found or actor.id is null then
        raise exception 'BOOKING_FORBIDDEN';
    end if;

    if p_submission_key is null then
        raise exception 'BOOKING_INVALID';
    end if;

    -- A retried submission returns the request already saved under this key.
    -- Different details under a saved key are rejected, so later edits are never silently dropped.
    select * into booking from public.requests
    where requester_id = actor.id and submission_key = p_submission_key;

    if found then
        if not coalesce(les_private.booking_matches(booking.id, p_subject, p_purpose, p_borrow_date, p_return_date, p_items), false) then
            raise exception using message = 'BOOKING_KEY_REUSED', detail = booking.request_no;
        end if;

        return jsonb_build_object('id', booking.id, 'reference', booking.request_no,
            'status', booking.status, 'createdAt', booking.created_at, 'replayed', true);
    end if;

    if length(trim(coalesce(p_subject, ''))) not between 1 and 200
        or length(trim(coalesce(p_purpose, ''))) not between 1 and 2000 then
        raise exception 'BOOKING_DETAILS_INVALID';
    end if;

    if p_borrow_date is null or p_return_date is null
        or p_borrow_date < today or p_return_date < p_borrow_date then
        raise exception 'BOOKING_DATES_INVALID';
    end if;

    if jsonb_typeof(p_items) is distinct from 'array'
        or jsonb_array_length(p_items) not between 1 and 100
        or exists (
            select 1 from jsonb_array_elements(p_items) a
            where jsonb_typeof(a) is distinct from 'object'
                or coalesce(a->>'inventoryId', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                or jsonb_typeof(a->'quantity') is distinct from 'number'
                or coalesce(a->>'quantity', '') !~ '^[1-9][0-9]{0,15}$'
        )
        or (select count(distinct lower(a->>'inventoryId')) from jsonb_array_elements(p_items) a) <> jsonb_array_length(p_items) then
        raise exception 'BOOKING_ITEMS_INVALID';
    end if;

    insert into public.requests (
        requester_id, requester_snapshot, subject, purpose, borrow_date, return_date, status, submission_key
    ) values (
        actor.id,
        jsonb_build_object('id_number', actor.id_number, 'name', actor.first_name || ' ' || actor.last_name,
            'email', actor_email, 'requester_type', actor.requester_type),
        trim(p_subject), trim(p_purpose), p_borrow_date, p_return_date, 'pending', p_submission_key
    )
    on conflict (requester_id, submission_key) do nothing
    returning * into booking;

    -- A concurrent retry with the same key committed first.
    if booking.id is null then
        select * into booking from public.requests
        where requester_id = actor.id and submission_key = p_submission_key;

        if not coalesce(les_private.booking_matches(booking.id, p_subject, p_purpose, p_borrow_date, p_return_date, p_items), false) then
            raise exception using message = 'BOOKING_KEY_REUSED', detail = booking.request_no;
        end if;

        return jsonb_build_object('id', booking.id, 'reference', booking.request_no,
            'status', booking.status, 'createdAt', booking.created_at, 'replayed', true);
    end if;

    -- Pending requests do not reserve stock; this check is advisory and staff approval rechecks it.
    for line in select a from jsonb_array_elements(p_items) a order by a->>'inventoryId'
    loop
        quantity := (line->>'quantity')::bigint;

        select * into stock from public.items where id = (line->>'inventoryId')::uuid;

        if not found or not stock.is_active or not exists (
            select 1 from public.categories c where c.id = stock.category_id and c.is_active
        ) then
            raise exception 'BOOKING_ITEM_UNAVAILABLE';
        end if;

        if stock.unit = 'pcs' and quantity % 100 <> 0 then
            raise exception 'BOOKING_ITEMS_INVALID';
        end if;

        if quantity > stock.available then
            raise exception 'BOOKING_STOCK_EXCEEDED';
        end if;

        insert into public.request_items (
            request_id, item_id, item_code, item_name, item_type, unit, return_policy, qty_requested
        ) values (
            booking.id, stock.id, stock.code, stock.name, stock.type, stock.unit, stock.return_policy, quantity
        );
    end loop;

    return jsonb_build_object('id', booking.id, 'reference', booking.request_no,
        'status', booking.status, 'createdAt', booking.created_at, 'replayed', false);
end;
$$;

revoke all on function les_private.submit_booking(uuid, text, text, date, date, jsonb) from public, anon, authenticated;
grant execute on function les_private.submit_booking(uuid, text, text, date, date, jsonb) to authenticated;

create or replace function public.submit_booking(
    p_submission_key uuid, p_subject text, p_purpose text,
    p_borrow_date date, p_return_date date, p_items jsonb
) returns jsonb
language sql security invoker set search_path = '' as $$
    select les_private.submit_booking(p_submission_key, p_subject, p_purpose,
        p_borrow_date, p_return_date, p_items);
$$;

revoke all on function public.submit_booking(uuid, text, text, date, date, jsonb) from public, anon, authenticated;
grant execute on function public.submit_booking(uuid, text, text, date, date, jsonb) to authenticated;

commit;
