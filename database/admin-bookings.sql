-- Additive booking review API. No table-wide write grants and no seed data.
begin;

create or replace function les_private.review_booking(
    p_request_id uuid, p_expected_updated_at timestamptz, p_action text,
    p_allocations jsonb, p_staff_notes text, p_denial_reason text
) returns void
language plpgsql security definer set search_path = '' as $$
declare
    actor public.profiles%rowtype;
    booking public.requests%rowtype;
    line record;
    stock public.items%rowtype;
    approved_quantity bigint;
    operation uuid := gen_random_uuid();
begin
    -- This private definer is needed to write the request, stock, and ledger atomically.
    -- Every entry checks the authenticated actor against verified database records.
    if auth.uid() is null or coalesce(les_private.current_app_role(), '') not in ('admin', 'lab_aid') then
        raise exception 'BOOKING_FORBIDDEN';
    end if;

    select * into actor from public.profiles where id = auth.uid() and is_active for share;

    if not found or actor.role not in ('admin', 'lab_aid') then
        raise exception 'BOOKING_FORBIDDEN';
    end if;

    if p_action is null or p_action not in ('approved', 'denied', 'ready')
        or p_expected_updated_at is null or p_staff_notes is null or length(p_staff_notes) > 2000
        or length(coalesce(p_denial_reason, '')) > 2000 then
        raise exception 'BOOKING_INVALID';
    end if;

    select * into booking from public.requests where id = p_request_id for update;

    if not found then
        raise exception 'BOOKING_NOT_FOUND';
    end if;

    if booking.updated_at <> p_expected_updated_at
        or (p_action in ('approved', 'denied') and booking.status <> 'pending')
        or (p_action = 'ready' and booking.status <> 'approved') then
        raise exception 'BOOKING_CONFLICT';
    end if;

    if p_action = 'denied' and length(trim(coalesce(p_denial_reason, ''))) = 0 then
        raise exception 'BOOKING_REASON_REQUIRED';
    end if;

    if p_action = 'approved' then
        if jsonb_typeof(p_allocations) is distinct from 'array' then
            raise exception 'BOOKING_INVALID';
        end if;

        if jsonb_array_length(p_allocations) <> (select count(*) from public.request_items where request_id = booking.id)
            or jsonb_array_length(p_allocations) = 0 then
            raise exception 'BOOKING_INVALID';
        end if;

        if exists (
            select 1 from jsonb_array_elements(p_allocations) a
            where jsonb_typeof(a) is distinct from 'object'
                or jsonb_typeof(a->'quantity') is distinct from 'number'
                or coalesce(a->>'quantity', '') !~ '^[0-9]{1,16}$'
                or not exists (select 1 from public.request_items ri where ri.request_id = booking.id and ri.id::text = a->>'id')
        ) or (select count(distinct a->>'id') from jsonb_array_elements(p_allocations) a) <> jsonb_array_length(p_allocations) then
            raise exception 'BOOKING_INVALID';
        end if;

        if not exists (select 1 from jsonb_array_elements(p_allocations) a where (a->>'quantity')::bigint > 0) then
            raise exception 'BOOKING_ALLOCATION_REQUIRED';
        end if;

        -- All reviewers lock shared stock in the same order before testing availability.
        perform i.id from public.items i
        join public.request_items ri on ri.item_id = i.id
        where ri.request_id = booking.id order by i.id for update of i;

        for line in select ri.*, (a->>'quantity')::bigint as allocation
            from public.request_items ri
            join jsonb_array_elements(p_allocations) a on a->>'id' = ri.id::text
            where ri.request_id = booking.id order by ri.item_id
        loop
            approved_quantity := line.allocation;

            select * into stock from public.items where id = line.item_id;

            if approved_quantity > line.qty_requested or approved_quantity > stock.available
                or (line.unit = 'pcs' and approved_quantity % 100 <> 0)
                or (approved_quantity > 0 and (not stock.is_active or not exists (
                    select 1 from public.categories c where c.id = stock.category_id and c.is_active
                ))) then
                raise exception 'BOOKING_STOCK_CHANGED';
            end if;

            update public.request_items set qty_approved = approved_quantity where id = line.id;

            if approved_quantity > 0 then
                update public.items set available = available - approved_quantity,
                    reserved = reserved + approved_quantity where id = stock.id returning * into stock;

                insert into public.stock_movements (
                    item_id, item_code, request_id, actor_id, actor_name, type,
                    delta, after_stock, reason, operation_id
                ) values (
                    stock.id, stock.code, booking.id, actor.id, actor.first_name || ' ' || actor.last_name, 'reserve',
                    jsonb_build_object('available', -approved_quantity, 'reserved', approved_quantity),
                    jsonb_build_object('total', stock.total, 'available', stock.available, 'reserved', stock.reserved,
                        'checked_out', stock.checked_out, 'unusable', stock.unusable),
                    'Booking approval ' || booking.request_no, operation
                );
            end if;
        end loop;
    end if;

    update public.requests set status = p_action,
        staff_notes = case when p_action = 'ready' then staff_notes else p_staff_notes end,
        denial_reason = case when p_action = 'denied' then trim(p_denial_reason) else null end,
        email_decision = false,
        reviewed_by = case when p_action = 'ready' then reviewed_by else actor.id end,
        reviewed_at = case when p_action = 'ready' then reviewed_at else now() end
    where id = booking.id;
end;
$$;

revoke all on function les_private.review_booking(uuid, timestamptz, text, jsonb, text, text) from public, anon, authenticated;
grant execute on function les_private.review_booking(uuid, timestamptz, text, jsonb, text, text) to authenticated;

create or replace function public.review_booking(
    p_request_id uuid, p_expected_updated_at timestamptz, p_action text,
    p_allocations jsonb, p_staff_notes text, p_denial_reason text
) returns void
language sql security invoker set search_path = '' as $$
    select les_private.review_booking(p_request_id, p_expected_updated_at, p_action,
        p_allocations, p_staff_notes, p_denial_reason);
$$;

revoke all on function public.review_booking(uuid, timestamptz, text, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.review_booking(uuid, timestamptz, text, jsonb, text, text) to authenticated;

commit;
