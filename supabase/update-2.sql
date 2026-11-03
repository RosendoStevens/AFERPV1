-- =====================================================================
-- PrintPress ERP (online) - UPDATE 2   (safe to run more than once)
-- Run this ONCE in Supabase > SQL Editor if you already installed the first version.
-- It keeps all your data. New installs do not need it: schema.sql already includes it.
--
-- Adds: Attendance & payroll data (staff list, pay rates, attendance, payroll), Suppliers,
--       job-card permissions for Sales and Designer, and storage rules for job reference files.
-- =====================================================================

-- 1. allow the new kinds of data
alter table public.records drop constraint if exists records_store_check;
alter table public.records add constraint records_store_check check (store in
  ('customers','orders','jobs','inventory','movements','invoices','artworks','expenses','settings',
   'suppliers','employees','pay_rates','attendance','payroll'));

-- 2. who may use them
--    Sales and Designer can now work on job cards (design stage / send orders to production):
insert into public.role_perms (role, store, can_read, can_write, can_delete) values
  ('sales','jobs',true,true,false),
  ('designer','jobs',true,true,false)
on conflict (role, store) do update
  set can_read = excluded.can_read, can_write = excluded.can_write, can_delete = excluded.can_delete;
--    The new kinds of data (permissions you already changed are kept):
insert into public.role_perms (role, store, can_read, can_write, can_delete) values
  ('admin','suppliers',true,true,true),
  ('admin','employees',true,true,true),
  ('admin','pay_rates',true,true,true),
  ('admin','attendance',true,true,true),
  ('admin','payroll',true,true,true),
  ('manager','suppliers',true,true,true),
  ('manager','employees',true,true,true),
  ('manager','pay_rates',true,true,true),
  ('manager','attendance',true,true,true),
  ('manager','payroll',true,true,true),
  ('sales','suppliers',true,false,false),
  ('sales','pay_rates',true,true,false),
  ('sales','payroll',true,true,false),
  ('sales','attendance',true,true,false),
  ('designer','employees',true,false,false),
  ('production','suppliers',true,true,false),
  ('production','employees',true,false,false)
on conflict (role, store) do nothing;
--    Sales / Accounts may also edit the staff list (no deleting):
update public.role_perms set can_write = true where role = 'sales' and store = 'employees';

-- 3. file storage: client reference files on job cards
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


-- Done. Reload the app.
