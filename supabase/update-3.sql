-- =====================================================================
-- BizManager ERP (online) - UPDATE 3   (safe to run more than once)
-- Run this ONCE in Supabase > SQL Editor if you already installed an earlier version.
-- It keeps all data and all permissions. New installs do not need it: schema.sql already includes it.
--
-- Adds: Administrator and Manager can change what each role may do (Settings > Role permissions).
-- =====================================================================

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

revoke execute on function public.set_role_perm(text, text, text) from public, anon;
grant execute on function public.set_role_perm(text, text, text) to authenticated;

-- Done. Reload the app.
