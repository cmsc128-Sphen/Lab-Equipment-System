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
    ) then raise exception 'Saved header is wrong'; end if;

    if (select count(*) from public.request_items ri where ri.request_id = (saved->>'id')::uuid
        and ri.item_id = stock.id and ri.unit = stock.unit and ri.qty_requested = 100 and ri.qty_approved = 0) <> 1 then
        raise exception 'Saved lines are wrong';
    end if;

    -- Pending requests do not reserve stock.
    if (select available from public.items where id = stock.id) <> stock_before then
        raise exception 'Submission changed stock';
    end if;

    -- Retrying the same details with the same key returns the same request without a second save.
    replay := public.submit_booking(key, 'Chem 16', 'Research', today, today + 1, items);

    if replay->>'id' <> saved->>'id' or not (replay->>'replayed')::boolean
        or (select count(*) from public.requests) <> requests_before + 1 then
        raise exception 'Retried submission was saved twice';
    end if;

    -- Changed details or lines under a saved key are rejected with its reference, never silently dropped.
    begin
        perform public.submit_booking(key, 'Chem 16', 'Changed purpose', today, today + 1, items);
        raise exception 'Expected changed-details rejection';
    exception when raise_exception then
        if sqlerrm <> 'BOOKING_KEY_REUSED' then raise; end if;
    end;

    begin
        perform public.submit_booking(key, 'Chem 16', 'Research', today, today + 1,
            jsonb_build_array(jsonb_build_object('inventoryId', stock.id, 'quantity', 200)));
        raise exception 'Expected changed-quantity rejection';
    exception when raise_exception then
        if sqlerrm <> 'BOOKING_KEY_REUSED' then raise; end if;
    end;

    begin
        perform public.submit_booking(key, 'Chem 16', 'Research', today, today + 1, '"not an array"'::jsonb);
        raise exception 'Expected malformed retry rejection';
    exception when raise_exception then
        if sqlerrm <> 'BOOKING_KEY_REUSED' then raise; end if;
    end;

    if (select count(*) from public.requests) <> requests_before + 1
        or (select count(*) from public.request_items) <> lines_before + 1 then
        raise exception 'A rejected retry changed saved data';
    end if;
end;
$$;

rollback;
