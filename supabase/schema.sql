-- =====================================================================
-- PrintPress ERP (online version) - database setup for Supabase
--
-- HOW TO USE
--   1. EDIT THE EMAIL ON THE LINE MARKED "<<< EDIT" below (your own email).
--   2. Supabase dashboard > SQL Editor > New query > paste this whole file > Run.
--   3. You can run it again later; it is safe to repeat (it does not delete data).
--
-- WHAT IT CREATES
--   records       one row per customer / order / invoice / etc. (JSON data)
--   profiles      one row per staff login, with a role
--   role_perms    what each role may read / write / delete (editable table)
--   counters      shared numbering (quotation, order, invoice, job, artwork)
--   functions     numbering, stock changes and status updates that must be atomic
--   storage rules for the private "artwork" bucket (proof files)
--   Row Level Security on everything, so the rules are enforced by the database
--   itself and not only by the app.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Owner: the person who signs up with this email becomes Administrator
-- ---------------------------------------------------------------------
create table if not exists public.app_owner (email text primary key);
insert into public.app_owner (email) values ('hi.hellographic@gmail.com')   -- <<< EDIT: your email
  on conflict do nothing;

-- ---------------------------------------------------------------------
-- 1. Staff profiles and roles
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  name       text not null default '',
  role       text not null default 'pending'
             check (role in ('admin', 'manager', 'sales', 'designer', 'production', 'pending')),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- Current user's role (null when not signed in, deactivated or still pending)
create or replace function public.app_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles
  where id = auth.uid() and active and role <> 'pending'
$$;

-- What each role may do, per kind of data. Edit these rows to change permissions.
create table if not exists public.role_perms (
  role       text not null,
  store      text not null,
  can_read   boolean not null default false,
  can_write  boolean not null default false,
  can_delete boolean not null default false,
  primary key (role, store)
);

insert into public.role_perms (role, store, can_read, can_write, can_delete) values
  -- Administrator: everything
  ('admin','customers',true,true,true),   ('admin','orders',true,true,true),
  ('admin','jobs',true,true,true),        ('admin','inventory',true,true,true),
  ('admin','movements',true,true,true),   ('admin','invoices',true,true,true),
  ('admin','artworks',true,true,true),    ('admin','expenses',true,true,true),
  ('admin','settings',true,true,true),    ('admin','suppliers',true,true,true),
  ('admin','employees',true,true,true),   ('admin','pay_rates',true,true,true),
  ('admin','attendance',true,true,true),  ('admin','payroll',true,true,true),
  -- Manager: everything except changing shop settings
  ('manager','customers',true,true,true), ('manager','orders',true,true,true),
  ('manager','jobs',true,true,true),      ('manager','inventory',true,true,true),
  ('manager','movements',true,true,true), ('manager','invoices',true,true,true),
  ('manager','artworks',true,true,true),  ('manager','expenses',true,true,true),
  ('manager','settings',true,false,false),('manager','suppliers',true,true,true),
  ('manager','employees',true,true,true), ('manager','pay_rates',true,true,true),
  ('manager','attendance',true,true,true),('manager','payroll',true,true,true),
  -- Sales / Accounts: customers, quotes, orders, billing, expenses; can send orders to production; records attendance
  ('sales','customers',true,true,false),  ('sales','orders',true,true,false),
  ('sales','invoices',true,true,false),   ('sales','expenses',true,true,false),
  ('sales','jobs',true,true,false),       ('sales','inventory',true,false,false),
  ('sales','movements',true,false,false),('sales','artworks',true,false,false),
  ('sales','settings',true,false,false),  ('sales','suppliers',true,false,false),
  ('sales','employees',true,true,false),  ('sales','attendance',true,true,false),
  ('sales','pay_rates',true,true,false),  ('sales','payroll',true,true,false),
  -- Designer: artwork and approvals; works on job cards (design stage); can view customers and orders
  ('designer','artworks',true,true,false),('designer','customers',true,false,false),
  ('designer','orders',true,false,false), ('designer','jobs',true,true,false),
  ('designer','settings',true,false,false),('designer','employees',true,false,false),
  -- Production / Operator: job board, inventory and suppliers; can view orders, customers, artwork
  ('production','jobs',true,true,false),  ('production','inventory',true,true,false),
  ('production','movements',true,true,false),
  ('production','suppliers',true,true,false),  ('production','employees',true,false,false),
  ('production','customers',true,false,false), ('production','orders',true,false,false),
  ('production','artworks',true,false,false),  ('production','settings',true,false,false)
  on conflict (role, store) do nothing;   -- re-running this file keeps any permissions you changed in the app

alter table public.role_perms enable row level security;
drop policy if exists role_perms_read on public.role_perms;
create policy role_perms_read on public.role_perms for select to authenticated using (true);

-- perm('orders','r'|'w'|'d') -> may the current user read / write / delete that data?
create or replace function public.perm(p_store text, p_action text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select case p_action when 'r' then can_read when 'w' then can_write when 'd' then can_delete else false end
    from public.role_perms
    where role = public.app_role() and store = p_store
  ), false)
$$;

-- ---------------------------------------------------------------------
-- 2. The data: one table, one row per record
-- ---------------------------------------------------------------------
create table if not exists public.records (
  store      text not null check (store in
             ('customers','orders','jobs','inventory','movements','invoices','artworks','expenses','settings',
              'suppliers','employees','pay_rates','attendance','payroll')),
  id         text not null,
  data       jsonb not null,
  rev        integer not null default 1,        -- goes up on every change (edit-conflict detection)
  updated_at timestamptz not null default now(),
  updated_by uuid,
  primary key (store, id)
);
create index if not exists records_updated_idx on public.records (store, updated_at);

create or replace function public.records_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  new.updated_by := auth.uid();
  if tg_op = 'UPDATE' then new.rev := old.rev + 1; end if;
  return new;
end $$;
drop trigger if exists records_touch on public.records;
create trigger records_touch before insert or update on public.records
  for each row execute function public.records_touch();

alter table public.records enable row level security;
drop policy if exists rec_select on public.records;
drop policy if exists rec_insert on public.records;
drop policy if exists rec_update on public.records;
drop policy if exists rec_delete on public.records;
create policy rec_select on public.records for select to authenticated using (public.perm(store, 'r'));
create policy rec_insert on public.records for insert to authenticated with check (public.perm(store, 'w'));
create policy rec_update on public.records for update to authenticated
  using (public.perm(store, 'w')) with check (public.perm(store, 'w'));
create policy rec_delete on public.records for delete to authenticated using (public.perm(store, 'd'));

-- (sync_state is defined further down, together with notifications)

-- ---------------------------------------------------------------------
-- 3. Shared numbering (two people can never get the same number)
-- ---------------------------------------------------------------------
create table if not exists public.counters (kind text primary key, n integer not null default 0);
alter table public.counters enable row level security;     -- no policies: only the functions below touch it

create or replace function public.next_no(p_kind text) returns integer
language plpgsql security definer set search_path = public as $$
declare v integer; ok boolean;
begin
  ok := case p_kind
    when 'quote'   then public.perm('orders', 'w')
    when 'order'   then public.perm('orders', 'w')
    when 'invoice' then public.perm('invoices', 'w')
    when 'job'     then public.perm('jobs', 'w')
    when 'art'     then public.perm('artworks', 'w')
    else false end;
  if not coalesce(ok, false) then raise exception 'Not allowed' using errcode = '42501'; end if;
  insert into public.counters (kind, n) values (p_kind, 1)
    on conflict (kind) do update set n = public.counters.n + 1
    returning n into v;
  return v;
end $$;

create or replace function public.get_counters() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if public.app_role() is distinct from 'admin' then raise exception 'Not allowed' using errcode = '42501'; end if;
  return coalesce((select jsonb_object_agg(kind, n) from public.counters), '{}'::jsonb);
end $$;

create or replace function public.set_counters(p_counters jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare k text; v jsonb;
begin
  if public.app_role() is distinct from 'admin' then raise exception 'Not allowed' using errcode = '42501'; end if;
  for k, v in select * from jsonb_each(coalesce(p_counters, '{}'::jsonb)) loop
    if k in ('quote','order','invoice','job','art') and jsonb_typeof(v) = 'number' then
      insert into public.counters (kind, n) values (k, greatest((v #>> '{}')::integer, 0))
        on conflict (kind) do update set n = excluded.n;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 4. Stock changes and order status changes that must not clash
-- ---------------------------------------------------------------------
-- Adds (positive) or removes (negative) stock and writes the stock history line, in one step.
create or replace function public.adjust_stock(
  p_item text, p_delta numeric, p_type text, p_note text, p_date text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.records; nb numeric; mid text;
begin
  if not public.perm('inventory', 'w') then raise exception 'Not allowed' using errcode = '42501'; end if;
  update public.records
     set data = jsonb_set(data, '{stock}',
           to_jsonb(round(coalesce((data ->> 'stock')::numeric, 0) + p_delta, 3)))
   where store = 'inventory' and id = p_item
   returning * into r;
  if not found then raise exception 'Stock item not found' using errcode = 'P0002'; end if;
  nb := (r.data ->> 'stock')::numeric;
  mid := gen_random_uuid()::text;
  insert into public.records (store, id, data) values ('movements', mid, jsonb_build_object(
    'id', mid, 'itemId', p_item, 'date', p_date, 'type', p_type, 'qty', abs(p_delta),
    'note', coalesce(p_note, ''), 'balance', nb, 'ts', (extract(epoch from clock_timestamp()) * 1000)::bigint));
  return jsonb_build_object('stock', nb, 'rev', r.rev);
end $$;

-- Lets designers and production staff move an order's status (e.g. Design -> Pending)
-- without being allowed to edit the order itself.
create or replace function public.order_set_status(p_id text, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.app_role() is null then raise exception 'Not allowed' using errcode = '42501'; end if;
  if p_status not in ('Pending','Design','In Production','Completed','Delivered','Cancelled') then
    raise exception 'Bad status' using errcode = '22023';
  end if;
  update public.records set data = jsonb_set(data, '{status}', to_jsonb(p_status))
   where store = 'orders' and id = p_id and data ->> 'type' = 'order';
end $$;

-- Administrator / Manager: change what a role may do.  level = none | view | edit | full
--   * nobody can change the Administrator role (it always has full access)
--   * a Manager can change the other roles but not the Manager role itself
create or replace function public.set_role_perm(p_role text, p_store text, p_level text) returns void
language plpgsql security definer set search_path = public as $$
declare me text := public.app_role();
begin
  if me is null or me not in ('admin','manager') then raise exception 'Not allowed' using errcode = '42501'; end if;
  if p_role not in ('manager','sales','designer','production') then raise exception 'That role cannot be changed' using errcode = '42501'; end if;
  if p_role = 'manager' and me <> 'admin' then raise exception 'Only the administrator can change the Manager role' using errcode = '42501'; end if;
  if p_store not in ('customers','orders','jobs','inventory','movements','invoices','artworks','expenses','settings',
                     'suppliers','employees','pay_rates','attendance','payroll') then raise exception 'Unknown data kind' using errcode = '22023'; end if;
  if p_level not in ('none','view','edit','full') then raise exception 'Bad level' using errcode = '22023'; end if;
  insert into public.role_perms (role, store, can_read, can_write, can_delete)
  values (p_role, p_store, p_level <> 'none', p_level in ('edit','full'), p_level = 'full')
  on conflict (role, store) do update
    set can_read = excluded.can_read, can_write = excluded.can_write, can_delete = excluded.can_delete;
end $$;

-- ---------------------------------------------------------------------
-- 5. Profiles: created automatically when someone signs up
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name, role)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'name', ''),
    case when exists (select 1 from public.app_owner o
                      where lower(o.email) = lower(coalesce(new.email, ''))
                        and o.email <> 'CHANGE-ME@example.com')
         then 'admin' else 'pending' end)
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Only an Administrator may change role / active / email; never remove the last Administrator
create or replace function public.profiles_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.app_role() is distinct from 'admin' then
    if new.role <> old.role or new.active <> old.active or new.email <> old.email or new.id <> old.id then
      raise exception 'Only an administrator can change roles' using errcode = '42501';
    end if;
  end if;
  if old.role = 'admin' and old.active and (new.role <> 'admin' or not new.active)
     and not exists (select 1 from public.profiles p
                     where p.role = 'admin' and p.active and p.id <> old.id) then
    raise exception 'There must be at least one active administrator' using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.profiles_guard();

alter table public.profiles enable row level security;
drop policy if exists prof_select_self  on public.profiles;
drop policy if exists prof_select_admin on public.profiles;
drop policy if exists prof_update       on public.profiles;
create policy prof_select_self  on public.profiles for select to authenticated using (id = auth.uid());
create policy prof_select_admin on public.profiles for select to authenticated using (public.app_role() = 'admin');
create policy prof_update       on public.profiles for update to authenticated
  using (id = auth.uid() or public.app_role() = 'admin')
  with check (id = auth.uid() or public.app_role() = 'admin');

alter table public.app_owner enable row level security;      -- no policies: nobody can read it

-- ---------------------------------------------------------------------
-- 6. Who may call what
-- ---------------------------------------------------------------------
-- Supabase gives signed-in users broad table rights by default; take everything away first,
-- then give back only what is needed (Row Level Security then decides row by row).
revoke all on public.records, public.profiles, public.role_perms, public.counters, public.app_owner
  from anon, authenticated;
grant select, insert, update, delete on public.records to authenticated;
grant select on public.role_perms to authenticated;
grant select, update on public.profiles to authenticated;

revoke execute on function
  public.app_role(), public.perm(text, text), public.next_no(text),
  public.get_counters(), public.set_counters(jsonb), public.adjust_stock(text, numeric, text, text, text),
  public.order_set_status(text, text), public.set_role_perm(text, text, text)
  from public, anon;
grant execute on function
  public.app_role(), public.perm(text, text), public.next_no(text),
  public.get_counters(), public.set_counters(jsonb), public.adjust_stock(text, numeric, text, text, text),
  public.order_set_status(text, text), public.set_role_perm(text, text, text)
  to authenticated;

-- ---------------------------------------------------------------------
-- Notifications: each person sees only their own
-- ---------------------------------------------------------------------
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  title      text not null,
  body       text not null default '',
  link       text not null default '',
  by_name    text not null default '',
  created_at timestamptz not null default now(),
  read_at    timestamptz
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
drop policy if exists notif_select on public.notifications;
drop policy if exists notif_update on public.notifications;
drop policy if exists notif_delete on public.notifications;
create policy notif_select on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notif_update on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notif_delete on public.notifications for delete to authenticated using (user_id = auth.uid());

-- Send a notification to specific people (any signed-in, approved staff member may send)
create or replace function public.notify_users(p_users uuid[], p_title text, p_body text, p_link text) returns integer
language plpgsql security definer set search_path = public as $$
declare me text := public.app_role(); who text; n integer;
begin
  if me is null then raise exception 'Not allowed' using errcode = '42501'; end if;
  select coalesce(nullif(name,''), email) into who from public.profiles where id = auth.uid();
  insert into public.notifications (user_id, title, body, link, by_name)
  select p.id, left(coalesce(p_title,''), 200), left(coalesce(p_body,''), 600), left(coalesce(p_link,''), 200), coalesce(who,'')
    from public.profiles p
   where p.id = any (p_users) and p.active and p.role <> 'pending' and p.id <> auth.uid();
  get diagnostics n = row_count;
  return n;
end $$;

-- ...or to everyone who has a role (for example every designer)
create or replace function public.notify_role(p_role text, p_title text, p_body text, p_link text) returns integer
language plpgsql security definer set search_path = public as $$
declare ids uuid[];
begin
  if public.app_role() is null then raise exception 'Not allowed' using errcode = '42501'; end if;
  select coalesce(array_agg(id), '{}') into ids from public.profiles where role = p_role and active;
  return public.notify_users(ids, p_title, p_body, p_link);
end $$;

-- List of app logins (name, email, role) so staff records can be linked to them
create or replace function public.login_users() returns table (id uuid, name text, email text, role text)
language plpgsql stable security definer set search_path = public as $$
begin
  if public.app_role() is null or not (public.perm('employees','w') or public.app_role() in ('admin','manager')) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query select p.id, p.name, p.email, p.role from public.profiles p where p.active and p.role <> 'pending' order by p.name, p.email;
end $$;

-- sync_state also reports the person's own notifications so the bell updates quickly
create or replace function public.sync_state() returns jsonb
language sql stable security invoker set search_path = public as $$
  select coalesce(jsonb_object_agg(store, jsonb_build_object('n', n, 'last', last)), '{}'::jsonb)
  from (select store, count(*) as n, max(updated_at)::text as last from public.records group by store
        union all
        select 'notifications', count(*) filter (where read_at is null), coalesce(max(created_at)::text, '') from public.notifications) s
$$;

revoke execute on function public.sync_state() from public, anon;
grant execute on function public.sync_state() to authenticated;

revoke all on public.notifications from anon, authenticated;
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
revoke execute on function public.notify_users(uuid[], text, text, text), public.notify_role(text, text, text, text), public.login_users() from public, anon;
grant execute on function public.notify_users(uuid[], text, text, text), public.notify_role(text, text, text, text), public.login_users() to authenticated;

-- ---------------------------------------------------------------------
-- 7. Private file storage for artwork proofs
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('artwork', 'artwork', false)
  on conflict (id) do nothing;

drop policy if exists artwork_files_select on storage.objects;
drop policy if exists artwork_files_insert on storage.objects;
drop policy if exists artwork_files_update on storage.objects;
drop policy if exists artwork_files_delete on storage.objects;
create policy artwork_files_select on storage.objects for select to authenticated
  using (bucket_id = 'artwork' and (public.perm('artworks', 'r') or public.perm('jobs', 'r')));
-- proofs (artworks) and client reference files for job cards (names start with ref/)
create policy artwork_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'artwork' and (public.perm('artworks', 'w') or (name like 'ref/%' and public.perm('jobs', 'w'))));
create policy artwork_files_update on storage.objects for update to authenticated
  using (bucket_id = 'artwork' and (public.perm('artworks', 'w') or (name like 'ref/%' and public.perm('jobs', 'w'))))
  with check (bucket_id = 'artwork' and (public.perm('artworks', 'w') or (name like 'ref/%' and public.perm('jobs', 'w'))));
create policy artwork_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'artwork' and (public.perm('artworks', 'd') or (name like 'ref/%' and public.perm('jobs', 'w'))));

-- Done. Next: sign up in the app with the email you put at the top.
