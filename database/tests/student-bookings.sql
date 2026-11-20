-- Integration checks for public.submit_booking against the existing MOCK fixtures. Every change is rolled back.
begin;

update auth.users set email_confirmed_at = now(), banned_until = null
where id in (select id from public.profiles where id_number in ('MOCK-STUDENT-001', 'MOCK-ADMIN-001'));

do $$
declare
    student uuid;
    staff uuid;
    stock public.items%rowtype;
    piece public.items%rowtype;
    items jsonb;
    saved jsonb;
    replay jsonb;
    key uuid := gen_random_uuid();
    today date := (now() at time zone 'Asia/Manila')::date;
    requests_before bigint;
    lines_before bigint;
    stock_before bigint;
begin
    select id into strict student from public.profiles where id_number = 'MOCK-STUDENT-001';
    select id into strict staff from public.profiles where id_number = 'MOCK-ADMIN-001';

    select i.* into strict stock from public.items i join public.categories c on c.id = i.category_id
    where i.is_active and c.is_active and i.available >= 100 order by i.code limit 1;

    select i.* into piece from public.items i join public.categories c on c.id = i.category_id
    where i.is_active and c.is_active and i.unit = 'pcs' and i.available >= 100 order by i.code limit 1;

    items := jsonb_build_array(jsonb_build_object('inventoryId', stock.id, 'quantity', 100));

    if has_function_privilege('anon', 'public.submit_booking(uuid,text,text,date,date,jsonb)', 'EXECUTE') then
        raise exception 'Anonymous execution must be revoked';
    end if;

    -- Signed-out callers and staff accounts cannot submit student bookings.
    perform set_config('request.jwt.claim.sub', '', true);

    begin
        perform public.submit_booking(key, 'Chem 16', 'Research', today, today, items);
        raise exception 'Expected signed-out rejection';
    exception when raise_exception then
        if sqlerrm <> 'BOOKING_FORBIDDEN' then raise; end if;
    end;

    perform set_config('request.jwt.claim.sub', staff::text, true);

    begin
        perform public.submit_booking(key, 'Chem 16', 'Research', today, today, items);
        raise exception 'Expected staff rejection';
    exception when raise_exception then
        if sqlerrm <> 'BOOKING_FORBIDDEN' then raise; end if;
    end;

    perform set_config('request.jwt.claim.sub', student::text, true);

    select count(*) into requests_before from public.requests;
    select count(*) into lines_before from public.request_items;
    select available into stock_before from public.items where id = stock.id;

    -- Invalid input is rejected before or during the save, leaving no header or lines behind.
    begin
        perform public.submit_booking(gen_random_uuid(), 'Chem 16', 'Research', today - 1, today, items);
        raise exception 'Expected past-date rejection';
    exception when raise_exception then
        if sqlerrm <> 'BOOKING_DATES_INVALID' then raise; end if;
    end;

    begin
        perform public.submit_booking(gen_random_uuid(), 'Chem 16', 'Research', today + 2, today + 1, items);
        raise exception 'Expected reversed-date rejection';
    exception when raise_exception then
        if sqlerrm <> 'BOOKING_DATES_INVALID' then raise; end if;
    end;

    begin
        perform public.submit_booking(gen_random_uuid(), ' ', 'Research', today, today, items);
        raise exception 'Expected blank subject rejection';
    exception when raise_exception then
        if sqlerrm <> 'BOOKING_DETAILS_INVALID' then raise; end if;
    end;

    begin
        perform public.submit_booking(gen_random_uuid(), 'Chem 16', 'Research', today, today, '[]');
        raise exception 'Expected empty selection rejection';
    exception when raise_exception then
        if sqlerrm <> 'BOOKING_ITEMS_INVALID' then raise; end if;
    end;

    begin
        perform public.submit_booking(gen_random_uuid(), 'Chem 16', 'Research', today, today, items || items);
        raise exception 'Expected duplicate item rejection';
    exception when raise_exception then
        if sqlerrm <> 'BOOKING_ITEMS_INVALID' then raise; end if;
    end;

    begin
        perform public.submit_booking(gen_random_uuid(), 'Chem 16', 'Research', today, today,
            jsonb_build_array(jsonb_build_object('inventoryId', stock.id, 'quantity', 0)));
        raise exception 'Expected zero quantity rejection';
    exception when raise_exception then
        if sqlerrm <> 'BOOKING_ITEMS_INVALID' then raise; end if;
    end;

    if piece.id is not null then
        begin
            perform public.submit_booking(gen_random_uuid(), 'Chem 16', 'Research', today, today,
                jsonb_build_array(jsonb_build_object('inventoryId', piece.id, 'quantity', 150)));
            raise exception 'Expected fractional pcs rejection';
        exception when raise_exception then
            if sqlerrm <> 'BOOKING_ITEMS_INVALID' then raise; end if;
        end;
    end if;

    -- A valid first line followed by an excessive one must not leave a partial request.
    begin
        perform public.submit_booking(gen_random_uuid(), 'Chem 16', 'Research', today, today, jsonb_build_array(
            jsonb_build_object('inventoryId', stock.id, 'quantity', 100),
            jsonb_build_object('inventoryId', 'ffffffff-ffff-4fff-bfff-ffffffffffff', 'quantity', 100)));
        raise exception 'Expected unavailable item rejection';
    exception when raise_exception then
        if sqlerrm <> 'BOOKING_ITEM_UNAVAILABLE' then raise; end if;
    end;

    begin
        perform public.submit_booking(gen_random_uuid(), 'Chem 16', 'Research', today, today,
            jsonb_build_array(jsonb_build_object('inventoryId', stock.id, 'quantity', stock.available + 100)));
        raise exception 'Expected stock rejection';
    exception when raise_exception then
        if sqlerrm <> 'BOOKING_STOCK_EXCEEDED' then raise; end if;
    end;

    if (select count(*) from public.requests) <> requests_before
        or (select count(*) from public.request_items) <> lines_before then
        raise exception 'A rejected submission left a header or lines behind';
    end if;

    -- A nullable profile type must still produce a text snapshot accepted by admin review.
    update public.profiles set requester_type = null where id = student;

    -- A valid submission saves one Pending header owned by the caller, with snapshot lines.
    saved := public.submit_booking(key, ' Chem 16 ', 'Research', today, today + 1, items);

    if saved->>'status' <> 'pending' or saved->>'reference' !~ '^REQ-' or (saved->>'replayed')::boolean then
        raise exception 'Unexpected submission result: %', saved;
    end if;

    if not exists (
        select 1 from public.requests r
        where r.id = (saved->>'id')::uuid and r.requester_id = student and r.status = 'pending'
            and r.subject = 'Chem 16' and r.submission_key = key and r.reviewed_by is null
            and r.requester_snapshot->>'id_number' = 'MOCK-STUDENT-001'
            and r.requester_snapshot->>'requester_type' = 'undergraduate'
    ) then raise exception 'Saved header is wrong'; end if;

    if (select count(*) from public.request_items ri where ri.request_id = (saved->>'id')::uuid
        and ri.item_id = stock.id and ri.unit = stock.unit and ri.qty_requested = 100 and ri.qty_approved = 0) <> 1 then
        raise exception 'Saved lines are wrong';
    end if;

    -- Pending requests do not reserve stock.
    if (select available from public.items where id = stock.id) <> stock_before then
        raise exception 'Submission changed stock';
    end if;

    -- Retrying with the same key returns the same request without a second save.
    replay := public.submit_booking(key, 'Chem 16', 'Research', today, today + 1, items);

    if replay->>'id' <> saved->>'id' or not (replay->>'replayed')::boolean
        or (select count(*) from public.requests) <> requests_before + 1 then
        raise exception 'Retried submission was saved twice';
    end if;

    -- A reused key with different content is a conflict, not a successful save of that content.
    begin
        perform public.submit_booking(key, 'Changed', 'Research', today, today + 1, items);
        raise exception 'Expected changed draft rejection';
    exception when raise_exception then
        if sqlerrm <> 'BOOKING_SUBMISSION_CONFLICT' then raise; end if;
    end;

    -- Invalid JSON shapes and unsafe integers produce predictable validation errors.
    begin
        perform public.submit_booking(gen_random_uuid(), 'Chem 16', 'Research', today, today, '{}');
        raise exception 'Expected malformed items rejection';
    exception when raise_exception then
        if sqlerrm <> 'BOOKING_ITEMS_INVALID' then raise; end if;
    end;

    begin
        perform public.submit_booking(gen_random_uuid(), 'Chem 16', 'Research', today, today,
            jsonb_build_array(jsonb_build_object('inventoryId', stock.id, 'quantity', 9007199254740992)));
        raise exception 'Expected unsafe quantity rejection';
    exception when raise_exception then
        if sqlerrm <> 'BOOKING_ITEMS_INVALID' then raise; end if;
    end;

    -- Inventory retirement rejects new requests, but cannot invalidate an already saved receipt.
    update public.items set is_active = false where id = stock.id;

    begin
        perform public.submit_booking(gen_random_uuid(), 'Chem 16', 'Research', today, today, items);
        raise exception 'Expected inactive item rejection';
    exception when raise_exception then
        if sqlerrm <> 'BOOKING_ITEM_UNAVAILABLE' then raise; end if;
    end;

    replay := public.submit_booking(key, 'Chem 16', 'Research', today, today + 1, items);

    if replay->>'id' <> saved->>'id' then raise exception 'Retirement invalidated a saved receipt'; end if;

    update public.items set is_active = true where id = stock.id;

    -- A reviewed receipt remains a successful replay with its current status.
    perform set_config('request.jwt.claim.sub', staff::text, true);

    perform public.review_booking((saved->>'id')::uuid,
        (select updated_at from public.requests where id = (saved->>'id')::uuid), 'denied', '[]', '', 'Integration check');

    perform set_config('request.jwt.claim.sub', student::text, true);

    replay := public.submit_booking(key, 'Chem 16', 'Research', today, today + 1, items);

    if replay->>'status' <> 'denied' or replay->>'id' <> saved->>'id' then
        raise exception 'Reviewed replay did not return the saved status';
    end if;

    -- Explicit requester categories must be preserved rather than overwritten by the fallback.
    update public.profiles set requester_type = 'graduate' where id = student;

    saved := public.submit_booking(gen_random_uuid(), 'Graduate check', 'Research', today, today, items);

    if not exists (select 1 from public.requests where id = (saved->>'id')::uuid
        and requester_snapshot->>'requester_type' = 'graduate') then
        raise exception 'Explicit requester type was not preserved';
    end if;
end;
$$;

-- Exercise actual authenticated-role grants and RLS, rather than only the function's role checks.
set local role authenticated;

do $$
declare
    item_id uuid;
    saved jsonb;
    today date := (now() at time zone 'Asia/Manila')::date;
begin
    if exists (select 1 from public.requests where requester_id <> auth.uid())
        or exists (select 1 from public.request_items where request_id not in (select id from public.requests)) then
        raise exception 'Student can read another owner request or line';
    end if;

    if has_table_privilege(current_user, 'public.requests', 'INSERT')
        or has_table_privilege(current_user, 'public.request_items', 'INSERT')
        or has_table_privilege(current_user, 'public.items', 'UPDATE') then
        raise exception 'Student direct table writes must stay revoked';
    end if;

    select i.id into strict item_id from public.items i join public.categories c on c.id = i.category_id
    where i.is_active and c.is_active and i.available >= 100 order by i.id limit 1;

    saved := public.submit_booking(gen_random_uuid(), 'Authenticated role check', 'Research', today, today,
        jsonb_build_array(jsonb_build_object('inventoryId', item_id, 'quantity', 100)));

    if not exists (select 1 from public.requests where id = (saved->>'id')::uuid and requester_id = auth.uid()) then
        raise exception 'Authenticated caller cannot retrieve their saved request';
    end if;
end;
$$;

rollback;

select 'Student submission integration checks passed; test data changes rolled back.' as result;
