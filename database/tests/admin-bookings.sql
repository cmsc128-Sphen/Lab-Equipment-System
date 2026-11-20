-- Integration checks against the existing MOCK fixtures. Every change is rolled back.
begin;

update auth.users set email_confirmed_at = now(), banned_until = null
where id in (select id from public.profiles where id_number = 'MOCK-ADMIN-001');

do $$
declare
    booking public.requests%rowtype;
    second_booking public.requests%rowtype;
    allocations jsonb;
    invalid_allocations jsonb;
    stock_before jsonb;
    ledger_before bigint;
    actor uuid;
begin
    select id into strict actor from public.profiles where id_number = 'MOCK-ADMIN-001';

    select * into strict booking from public.requests
    where purpose like '[MOCK]%' and status = 'pending' order by request_no limit 1;

    select * into strict second_booking from public.requests
    where purpose like '[MOCK]%' and status = 'pending' and id <> booking.id order by request_no limit 1;

    select jsonb_agg(jsonb_build_object('id', ri.id, 'quantity', ri.qty_requested)) into allocations
    from public.request_items ri where ri.request_id = booking.id;

    -- Students cannot invoke the privileged review operation, even via a direct RPC.
    perform set_config('request.jwt.claim.sub', (select id::text from public.profiles where id_number = 'MOCK-STUDENT-001'), true);

    begin
        perform public.review_booking(booking.id, booking.updated_at, 'approved', allocations, '', '');
        raise exception 'Expected student rejection';
    exception when raise_exception then
        if sqlerrm <> 'BOOKING_FORBIDDEN' then raise; end if;
    end;

    perform set_config('request.jwt.claim.sub', actor::text, true);

    if has_function_privilege('anon', 'public.review_booking(uuid,timestamptz,text,jsonb,text,text)', 'EXECUTE') then
        raise exception 'Anonymous execution must be revoked';
    end if;

    -- Reject stale review forms before any stock changes.
    begin
        perform public.review_booking(booking.id, booking.updated_at - interval '1 second', 'approved', allocations, '', '');
        raise exception 'Expected stale review rejection';
    exception when raise_exception then
        if sqlerrm <> 'BOOKING_CONFLICT' then raise; end if;
    end;

    -- Reject allocations beyond either stock or the student's requested amount.
    invalid_allocations := jsonb_set(allocations, '{0,quantity}', '9007199254740991'::jsonb);

    begin
        perform public.review_booking(booking.id, booking.updated_at, 'approved', invalid_allocations, '', '');
        raise exception 'Expected stock rejection';
    exception when raise_exception then
        if sqlerrm <> 'BOOKING_STOCK_CHANGED' then raise; end if;
    end;

    -- Duplicate lines cannot stand in for a complete allocation list.
    invalid_allocations := jsonb_set(allocations, '{1}', allocations->0);

    begin
        perform public.review_booking(booking.id, booking.updated_at, 'approved', invalid_allocations, '', '');
        raise exception 'Expected duplicate rejection';
    exception when raise_exception then
        if sqlerrm <> 'BOOKING_INVALID' then raise; end if;
    end;

    select jsonb_object_agg(i.id, jsonb_build_object('available', i.available, 'reserved', i.reserved)) into stock_before
    from public.items i join public.request_items ri on ri.item_id = i.id where ri.request_id = booking.id;

    select count(*) into ledger_before from public.stock_movements where request_id = booking.id;

    perform public.review_booking(booking.id, booking.updated_at, 'approved', allocations, 'Database integration check', '');

    if exists (
        select 1 from public.request_items ri join public.items i on i.id = ri.item_id
        where ri.request_id = booking.id and (
            ri.qty_approved <> ri.qty_requested
            or i.available <> (stock_before->i.id::text->>'available')::bigint - ri.qty_requested
            or i.reserved <> (stock_before->i.id::text->>'reserved')::bigint + ri.qty_requested
        )
    ) then raise exception 'Allocation or stock accounting mismatch'; end if;

    if (select count(*) from public.stock_movements where request_id = booking.id) <>
        ledger_before + jsonb_array_length(allocations) then
        raise exception 'Reservation ledger entries missing';
    end if;

    if not exists (select 1 from public.requests where id = booking.id and status = 'approved'
        and reviewed_by = actor and reviewed_at is not null and not email_decision) then
        raise exception 'Decision audit fields missing';
    end if;

    -- Repeated approval cannot reserve stock a second time.
    begin
        perform public.review_booking(booking.id, booking.updated_at, 'approved', allocations, '', '');
        raise exception 'Expected duplicate approval rejection';
    exception when raise_exception then
        if sqlerrm <> 'BOOKING_CONFLICT' then raise; end if;
    end;

    select * into booking from public.requests where id = booking.id;

    perform public.review_booking(booking.id, booking.updated_at, 'ready', '[]', '', '');

    if not exists (select 1 from public.requests where id = booking.id and status = 'ready') then
        raise exception 'Ready transition missing';
    end if;

    if (select count(*) from public.stock_movements where request_id = booking.id) <>
        ledger_before + jsonb_array_length(allocations) then
        raise exception 'Ready transition incorrectly changed stock';
    end if;

    -- Disapproval requires a reason and never reserves stock.
    begin
        perform public.review_booking(second_booking.id, second_booking.updated_at, 'denied', '[]', '', '');
        raise exception 'Expected denial reason rejection';
    exception when raise_exception then
        if sqlerrm <> 'BOOKING_REASON_REQUIRED' then raise; end if;
    end;

    perform public.review_booking(second_booking.id, second_booking.updated_at, 'denied', '[]', '', 'Integration check');

    if not exists (select 1 from public.requests where id = second_booking.id and status = 'denied' and denial_reason = 'Integration check') then
        raise exception 'Disapproval was not saved';
    end if;
end;
$$;

rollback;

select 'Booking integration checks passed; all changes rolled back.' as result;
