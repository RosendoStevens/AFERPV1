-- =====================================================================
-- BizManager ERP (online) - UPDATE 4   (safe to run more than once)
-- Run this ONCE in Supabase > SQL Editor if you already installed an earlier version.
-- It keeps all data. New installs do not need it: schema.sql already includes it.
--
-- Adds: notifications (job assignments, new job cards, client revision requests)
--       and linking staff records to app logins.
-- =====================================================================

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

-- Done. Reload the app.
