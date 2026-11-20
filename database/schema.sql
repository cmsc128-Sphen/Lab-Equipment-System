-- Initial LES foundation. Apply once to a new project after checking its existing schema.
-- Quantities are integer hundredths: 25.50 mL = 2550; 2 pcs = 200.
-- This script creates structure and read policies only. It inserts no application data.
begin;

create schema les_private;

revoke all on schema les_private from public, anon, authenticated;

grant usage on schema les_private to authenticated, service_role;

create table public.profiles (
    id uuid primary key references auth.users(id) on delete restrict,
    id_number text not null unique check (length(trim(id_number)) between 1 and 50),
    first_name text not null check (length(trim(first_name)) between 1 and 100),
    last_name text not null check (length(trim(last_name)) between 1 and 100),
    role text not null default 'student' check (role in ('student', 'lab_aid', 'admin')),
    requester_type text default 'undergraduate'
        check (requester_type in ('undergraduate', 'graduate', 'faculty', 'researcher')),
    is_active boolean not null default true,
    is_on_duty boolean not null default false,
    profile_image jsonb default null check (profile_image is null),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.categories (
    id text primary key check (length(id) <= 100 and id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    name text not null check (length(trim(name)) between 1 and 100),
    type text not null check (type in ('equipment', 'chemical', 'disposable')),
    sort_order integer not null default 0,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (id, type)
);

create table public.items (
    id uuid primary key default gen_random_uuid(),
    code text not null unique check (code ~ '^[A-Z0-9][A-Z0-9-]{0,49}$'),
    name text not null check (length(trim(name)) between 1 and 200),
    name_lower text generated always as (lower(name)) stored,
    specification text not null default '' check (length(specification) <= 1000),
    type text not null check (type in ('equipment', 'chemical', 'disposable')),
    category_id text not null,
    unit text not null check (unit in ('pcs', 'mL', 'L', 'mg', 'g', 'kg')),
    quantity_scale smallint not null default 100 check (quantity_scale = 100),
    return_policy text not null check (return_policy in ('reusable', 'consumable_reconcile', 'no_return')),
    total bigint not null default 0,
    available bigint not null default 0,
    reserved bigint not null default 0,
    checked_out bigint not null default 0,
    unusable bigint not null default 0,
    low_stock_threshold bigint not null default 0 check (low_stock_threshold between 0 and 9007199254740991),
    status text generated always as (
        case
            when available = 0 and reserved + checked_out > 0 then 'in_use'
            when available = 0 then 'out_of_stock'
            when available <= low_stock_threshold then 'low_stock'
            else 'available'
        end
    ) stored,
    location text not null default '' check (length(location) <= 200),
    tags text[] not null default '{}' check (cardinality(tags) <= 20),
    chemical jsonb check (chemical is null or jsonb_typeof(chemical) = 'object'),
    primary_image jsonb default null check (primary_image is null),
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    foreign key (category_id, type) references public.categories(id, type) on delete restrict,
    unique (id, type, unit, return_policy),
    check (type = 'chemical' or (unit = 'pcs' and chemical is null)),
    check (total between 0 and 9007199254740991),
    check (available >= 0 and reserved >= 0 and checked_out >= 0 and unusable >= 0),
    check (total = available + reserved + checked_out + unusable),
    check (unit <> 'pcs' or (
        total % 100 = 0 and available % 100 = 0 and reserved % 100 = 0
        and checked_out % 100 = 0 and unusable % 100 = 0 and low_stock_threshold % 100 = 0
    ))
);

create sequence public.request_number_seq;

create table public.requests (
    id uuid primary key default gen_random_uuid(),
    request_no text not null unique default (
        'REQ-' || to_char(now(), 'YYYY') || '-' || nextval('public.request_number_seq')::text
    ),
    requester_id uuid not null references public.profiles(id) on delete restrict,
    requester_snapshot jsonb not null check (
        jsonb_typeof(requester_snapshot) = 'object'
        and requester_snapshot ?& array['id_number', 'name', 'email', 'requester_type']
    ),
    subject text not null check (length(trim(subject)) between 1 and 200),
    purpose text not null check (length(trim(purpose)) between 1 and 2000),
    borrow_date date not null,
    return_date date not null,
    status text not null default 'pending' check (
        status in ('pending', 'approved', 'ready', 'denied', 'cancelled', 'claimed', 'return_pending', 'closed')
    ),
    staff_notes text not null default '' check (length(staff_notes) <= 2000),
    denial_reason text check (length(trim(denial_reason)) between 1 and 2000),
    email_decision boolean not null default true,
    reviewed_by uuid references public.profiles(id) on delete restrict,
    reviewed_at timestamptz,
    submission_key uuid not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (requester_id, submission_key),
    check (return_date >= borrow_date),
    check (status <> 'denied' or denial_reason is not null),
    check ((reviewed_by is null) = (reviewed_at is null))
);

create table public.request_items (
    id uuid primary key default gen_random_uuid(),
    request_id uuid not null references public.requests(id) on delete restrict,
    item_id uuid not null,
    item_code text not null check (length(item_code) between 1 and 50),
    item_name text not null check (length(trim(item_name)) between 1 and 200),
    item_type text not null check (item_type in ('equipment', 'chemical', 'disposable')),
    unit text not null check (unit in ('pcs', 'mL', 'L', 'mg', 'g', 'kg')),
    quantity_scale smallint not null default 100 check (quantity_scale = 100),
    return_policy text not null check (return_policy in ('reusable', 'consumable_reconcile', 'no_return')),
    qty_requested bigint not null check (qty_requested between 1 and 9007199254740991),
    qty_approved bigint not null default 0 check (qty_approved between 0 and qty_requested),
    aid_remark text check (length(aid_remark) <= 2000),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (request_id, item_id),
    foreign key (item_id, item_type, unit, return_policy)
        references public.items(id, type, unit, return_policy) on delete restrict on update restrict,
    check (unit <> 'pcs' or (qty_requested % 100 = 0 and qty_approved % 100 = 0))
);

create table public.stock_movements (
    id uuid primary key default gen_random_uuid(),
    item_id uuid not null references public.items(id) on delete restrict,
    item_code text not null,
    request_id uuid references public.requests(id) on delete restrict,
    actor_id uuid not null references public.profiles(id) on delete restrict,
    actor_name text not null check (length(trim(actor_name)) between 1 and 201),
    type text not null check (
        type in ('restock', 'adjust', 'reserve', 'release', 'checkout', 'return', 'consume', 'dispose', 'write_off')
    ),
    delta jsonb not null check (jsonb_typeof(delta) = 'object' and delta <> '{}'::jsonb),
    after_stock jsonb not null check (
        jsonb_typeof(after_stock) = 'object'
        and after_stock ?& array['total', 'available', 'reserved', 'checked_out', 'unusable']
    ),
    reason text not null check (length(trim(reason)) between 1 and 2000),
    operation_id uuid not null,
    created_at timestamptz not null default now(),
    unique (actor_id, operation_id, item_id)
);

create index items_category_idx on public.items(category_id, type);
create index items_catalogue_idx on public.items(name_lower, id) where is_active;
create index requests_requester_idx on public.requests(requester_id, created_at desc, id);
create index requests_review_queue_idx on public.requests(status, borrow_date, id);
create index requests_reviewer_idx on public.requests(reviewed_by) where reviewed_by is not null;
create index request_items_item_fk_idx on public.request_items(item_id, item_type, unit, return_policy);
create index stock_movements_item_idx on public.stock_movements(item_id, created_at desc, id);
create index stock_movements_request_idx on public.stock_movements(request_id) where request_id is not null;
-- The ledger's unique constraint already indexes actor_id; request_items' unique constraint indexes request_id.

create function les_private.set_updated_at() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
    new.updated_at := now();

    return new;
end;
$$;

create trigger profiles_updated before update on public.profiles
for each row execute function les_private.set_updated_at();

create trigger categories_updated before update on public.categories
for each row execute function les_private.set_updated_at();

create trigger items_updated before update on public.items
for each row execute function les_private.set_updated_at();

create trigger requests_updated before update on public.requests
for each row execute function les_private.set_updated_at();

create trigger request_items_updated before update on public.request_items
for each row execute function les_private.set_updated_at();

create function les_private.prevent_ledger_changes() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
    raise exception using errcode = '23514', message = 'Stock movements are append-only. Record a correcting movement instead.';
end;
$$;

create trigger stock_movements_append_only before update or delete on public.stock_movements
for each row execute function les_private.prevent_ledger_changes();

-- The private helper only reads the current user's role. Definer rights avoid recursive profile RLS.
-- Role, active status and verification come from stored records, never user-editable JWT metadata.
create function les_private.current_app_role() returns text
language sql stable security definer set search_path = '' as $$
    select p.role
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.id = auth.uid() and p.is_active and u.email_confirmed_at is not null
        and (u.banned_until is null or u.banned_until <= now());
$$;

revoke all on function les_private.set_updated_at(), les_private.prevent_ledger_changes(),
    les_private.current_app_role() from public, anon, authenticated;

grant execute on function les_private.current_app_role() to authenticated;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.items enable row level security;
alter table public.requests enable row level security;
alter table public.request_items enable row level security;
alter table public.stock_movements enable row level security;

revoke all on public.profiles, public.categories, public.items, public.requests,
    public.request_items, public.stock_movements from public, anon, authenticated;

revoke all on sequence public.request_number_seq from public, anon, authenticated;

grant select on public.profiles, public.categories, public.items, public.requests,
    public.request_items, public.stock_movements to authenticated;

-- Trusted server/database administration can provision data. No application write paths are exposed yet.
grant all on public.profiles, public.categories, public.items, public.requests,
    public.request_items to service_role;

revoke all on public.stock_movements from service_role;

grant select, insert on public.stock_movements to service_role;

grant usage, select on sequence public.request_number_seq to service_role;

create policy profiles_read on public.profiles for select to authenticated using (
    (select les_private.current_app_role()) is not null
    and (id = (select auth.uid()) or (select les_private.current_app_role()) = 'admin')
);

create policy categories_read on public.categories for select to authenticated using (
    (select les_private.current_app_role()) is not null
    and (is_active or (select les_private.current_app_role()) in ('lab_aid', 'admin'))
);

create policy items_read on public.items for select to authenticated using (
    (select les_private.current_app_role()) is not null
    and (is_active or (select les_private.current_app_role()) in ('lab_aid', 'admin'))
);

create policy requests_read on public.requests for select to authenticated using (
    (select les_private.current_app_role()) is not null
    and (requester_id = (select auth.uid()) or (select les_private.current_app_role()) in ('lab_aid', 'admin'))
);

create policy request_items_read on public.request_items for select to authenticated using (
    exists (select 1 from public.requests r where r.id = request_id)
);

create policy stock_movements_read on public.stock_movements for select to authenticated using (
    (select les_private.current_app_role()) in ('lab_aid', 'admin')
);

commit;
