-- Preserve existing site records; enforce permissions at the database boundary.
create schema if not exists private;
revoke all on schema private from public,anon;
grant usage on schema private to authenticated;
create or replace function private.st_role() returns text language sql stable security definer set search_path='' as $$select role from public.profiles where id=auth.uid() and auth.uid() is not null$$;
revoke all on function private.st_role() from public,anon;
grant execute on function private.st_role() to authenticated;
create or replace function public.my_role() returns text language sql stable security invoker set search_path='' as $$select private.st_role()$$;
create or replace function public.can_see_finance() returns boolean language sql stable security invoker set search_path='' as $$select coalesce(private.st_role() in ('md','qms','accounts','admin'),false)$$;
revoke all on function public.my_role(),public.can_see_finance() from public,anon;
grant execute on function public.my_role(),public.can_see_finance() to authenticated;
-- User-editable auth metadata must never select a privileged role.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.raw_app_meta_data->>'role' in ('md','engineer','sales','qms','accounts','admin') then
 insert into public.profiles(id,username,name,role,avatar) values(new.id,coalesce(new.raw_user_meta_data->>'username',split_part(new.email,'@',1)),coalesce(new.raw_user_meta_data->>'name','Team member'),new.raw_app_meta_data->>'role','TM') on conflict(id) do nothing;
 end if;return new;end$$;
revoke all on function public.handle_new_user() from public,anon,authenticated;
revoke update on public.profiles from authenticated,anon,public;
grant update(name,avatar) on public.profiles to authenticated;
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
-- Replace blanket authentication with membership checks, retaining six defined roles.
do $$declare p record; t text; begin
 for p in select tablename,policyname from pg_policies where schemaname='public' and tablename<>'profiles' loop execute format('drop policy %I on public.%I',p.policyname,p.tablename);end loop;
 for t in select tablename from pg_tables where schemaname='public' and tablename not in ('profiles','ping_test') loop
 execute format('create policy member_read on public.%I for select to authenticated using (private.st_role() is not null)',t);
 execute format('create policy member_insert on public.%I for insert to authenticated with check (private.st_role() is not null)',t);
 execute format('create policy member_update on public.%I for update to authenticated using (private.st_role() is not null) with check (private.st_role() is not null)',t);
 execute format('create policy member_delete on public.%I for delete to authenticated using (private.st_role() in (''md'',''admin''))',t);
 end loop;
end$$;
-- Restrict ledgers and the directory, including direct API requests.
do $$declare t text;p record;begin
 foreach t in array array['subcon_ledger','vendor_ledger','vendors'] loop
 for p in select policyname from pg_policies where schemaname='public' and tablename=t loop execute format('drop policy %I on public.%I',p.policyname,t);end loop;
 if t='vendors' then execute format('create policy authorized_access on public.%I for all to authenticated using(private.st_role() in (''md'',''sales'',''admin'')) with check(private.st_role() in (''md'',''sales'',''admin''))',t);
 else execute format('create policy authorized_access on public.%I for all to authenticated using(public.can_see_finance()) with check(public.can_see_finance())',t);end if;
 end loop;
end$$;
-- Column grants prevent direct REST reads of confidential values. Masked views are the intentional read boundary.
revoke select on public.projects,public.boq_items,public.labour_categories,public.material_orders,public.indent_quotations from public,anon,authenticated;
grant select(id,name,location,client_name,start_date,end_date,status,created_by,created_at) on public.projects to authenticated;
grant select(id,project_id,item,unit,boq_qty,cum_done,is_extra,created_at) on public.boq_items to authenticated;
grant select(id,labour_entry_id,trade,skill,male_count,female_count) on public.labour_categories to authenticated;
grant select(id,project_id,vendor,material,date,po_number,ordered_qty,unit,pay_status,remarks,created_by,created_at) on public.material_orders to authenticated;
grant select(id,indent_id,vendor_name,delivery_time,notes,uploaded_by,created_at) on public.indent_quotations to authenticated;
create or replace view public.projects_view with(security_barrier=true) as select p.id,p.name,p.location,p.client_name,case when public.can_see_finance() then p.value else null end as value,p.start_date,p.end_date,p.status,p.created_by,p.created_at,coalesce(b.total_qty,0) total_boq_qty,coalesce(b.total_done,0) total_done_qty,case when b.total_qty>0 then round(100*b.total_done/b.total_qty,1) else 0 end progress_pct from public.projects p left join(select project_id,sum(boq_qty) total_qty,sum(cum_done) total_done from public.boq_items group by project_id)b on b.project_id=p.id where private.st_role() is not null;
-- Existing views already mask rate/wage values. Add an explicit membership boundary.
create or replace view public.boq_items_view with(security_barrier=true) as select id,project_id,item,unit,boq_qty,cum_done,is_extra,boq_qty-cum_done balance,case when boq_qty>0 then round(100*cum_done/boq_qty,1) else 0 end progress_pct,case when public.can_see_finance() then rate end rate,case when public.can_see_finance() then rate*boq_qty end boq_value,case when public.can_see_finance() then rate*cum_done end done_value from public.boq_items where private.st_role() is not null;
create or replace view public.labour_categories_view with(security_barrier=true) as select id,labour_entry_id,trade,skill,male_count,female_count,case when public.can_see_finance() then wage end wage,case when public.can_see_finance() then (male_count+female_count)*wage end row_cost from public.labour_categories where private.st_role() is not null;
create or replace view public.indent_quotations_view with(security_barrier=true) as select id,indent_id,vendor_name,delivery_time,notes,case when public.can_see_finance() or private.st_role()='sales' then attached_file_url end attached_file_url,attached_file_name,uploaded_by,created_at,case when public.can_see_finance() or private.st_role()='sales' then rate end rate,case when public.can_see_finance() or private.st_role()='sales' then total end total from public.indent_quotations where private.st_role() is not null;
-- Shared mutation guard: authorizes fields, computes derived values, validates quantities.
create or replace function private.guard_site_write() returns trigger language plpgsql security definer set search_path='' as $$declare r text:=private.st_role();f boolean:=r in ('md','qms','accounts','admin');ord public.material_orders;rec numeric;begin
 if r is null then raise exception 'Workspace membership required';end if;
 if tg_table_name='projects' then
  if not f then if tg_op='INSERT' and coalesce(new.value,0)<>0 or tg_op='UPDATE' and new.value is distinct from old.value then raise exception 'Financial permission required';end if;end if;
  if new.end_date<new.start_date then raise exception 'Target date must follow start date';end if;
 elsif tg_table_name='boq_items' then
  if not f then if tg_op='INSERT' and new.rate<>0 or tg_op='UPDATE' and new.rate is distinct from old.rate then raise exception 'Financial permission required';end if;end if;
  if new.boq_qty<0 or new.cum_done<0 or new.cum_done>new.boq_qty or new.rate<0 then raise exception 'BOQ quantities and rate must be nonnegative; done cannot exceed total';end if;
 elsif tg_table_name='labour_categories' then
  if new.male_count<0 or new.female_count<0 or new.wage<0 then raise exception 'Labour counts and wages cannot be negative';end if;
  if not f then if tg_op='INSERT' and new.wage<>0 or tg_op='UPDATE' and new.wage is distinct from old.wage then raise exception 'Financial permission required';end if;end if;
 elsif tg_table_name='material_orders' then
  if new.ordered_qty<=0 or new.rate<0 then raise exception 'Order quantity must be positive and rate nonnegative';end if;
  if not f then if tg_op='INSERT' and new.rate<>0 or tg_op='UPDATE' and new.rate is distinct from old.rate then raise exception 'Financial permission required';end if;end if;
 elsif tg_table_name='material_order_deliveries' then
  select * into ord from public.material_orders where id=new.order_id for update;
  select coalesce(sum(delivered_qty),0) into rec from public.material_order_deliveries where order_id=new.order_id and id<>new.id;
  if new.delivered_qty<=0 or new.delivered_qty+rec>ord.ordered_qty then raise exception 'Delivery exceeds pending quantity or is not positive';end if;
 elsif tg_table_name='dwr_entries' or tg_table_name='dpr_entries' then
  if r not in ('engineer','qms','md','admin') then raise exception 'Only site engineers, quality or management may record work';end if;
  new.carry_forward:=new.work_status='Delayed - Carry Forward' or coalesce(new.carry_forward,false);
  if tg_table_name='dpr_entries' then
   if coalesce(new.qty_done,0)<0 then raise exception 'Progress quantity cannot be negative';end if;
   if new.pct_done<0 or new.pct_done>100 then raise exception 'Percentage must be between 0 and 100';end if;
   if new.boq_item_id is not null and not exists(select 1 from public.boq_items where id=new.boq_item_id and project_id=new.project_id) then raise exception 'BOQ item must belong to selected project';end if;
  end if;
 elsif tg_table_name='indent_quotations' then
  if r not in ('sales','admin') then raise exception 'Only procurement may upload quotations';end if;
  if new.rate<0 or new.total<0 then raise exception 'Quotation amounts cannot be negative';end if;
  if (select status from public.indents where id=new.indent_id) not in ('Pending Quotation','MD Review') then raise exception 'This indent is already decided';end if;
 elsif tg_table_name='indents' then
  if tg_op='INSERT' then if r not in ('engineer','qms','md','admin') or new.status<>'Pending Quotation' then raise exception 'Invalid indent creation';end if;
  elsif new.status is distinct from old.status then
   if new.status in ('Approved','Rejected') and (r not in ('md','admin') or current_setting('sitetrack.deciding',true) is distinct from 'yes') then raise exception 'Management approval required';end if;
   if new.status='MD Review' and r not in ('sales','admin') then raise exception 'Procurement permission required';end if;
   if new.status='MD Review' and (select count(*) from public.indent_quotations where indent_id=new.id)<2 then raise exception 'At least two quotations required';end if;
   if old.status in ('Approved','Rejected') then raise exception 'A decided indent cannot be changed';end if;
  elsif r not in ('md','admin') then raise exception 'Management permission required';end if;
 elsif tg_table_name='indent_items' then
  if new.quantity<=0 then raise exception 'Material quantity must be positive';end if;
  if tg_op='UPDATE' and new.item_status is distinct from old.item_status and (r not in ('md','qms','admin') or (new.item_status in ('Approved','Rejected') and current_setting('sitetrack.deciding',true) is distinct from 'yes')) then raise exception 'Management or quality permission required';end if;
 end if;
 return new;end$$;
revoke all on function private.guard_site_write() from public,anon,authenticated;
do $$declare t text;begin foreach t in array array['projects','boq_items','labour_categories','material_orders','material_order_deliveries','dwr_entries','dpr_entries','indent_quotations','indents','indent_items'] loop execute format('drop trigger if exists guard_site_write on public.%I',t);execute format('create trigger guard_site_write before insert or update on public.%I for each row execute function private.guard_site_write()',t);end loop;end$$;
-- Atomic management decisions: selected quotation + all eligible item statuses change together.
create or replace function public.decide_indent(p_id uuid,p_quote uuid,p_approve boolean) returns void language plpgsql security definer set search_path='' as $$declare ind public.indents;q public.indent_quotations;idx integer;begin
 if auth.uid() is null or private.st_role() not in ('md','admin') then raise exception 'Management approval required';end if;
 select * into ind from public.indents where id=p_id for update;
 if ind.status<>'MD Review' then raise exception 'Indent must be in MD Review';end if;
 perform set_config('sitetrack.deciding','yes',true);
 if p_approve then
  select * into q from public.indent_quotations where id=p_quote and indent_id=p_id;
  if q.id is null then raise exception 'Select a quotation from this indent';end if;
  select n-1 into idx from(select id,row_number()over(order by created_at,id)n from public.indent_quotations where indent_id=p_id)t where id=p_quote;
  update public.indents set status='Approved',approved_idx=idx,po_number='PO-'||upper(substr(replace(p_id::text,'-',''),1,12)),wo_number='WO-'||upper(substr(replace(p_id::text,'-',''),1,12)) where id=p_id;
  update public.indent_items set item_status='Approved' where indent_id=p_id and item_status='Pending';
 else update public.indents set status='Rejected' where id=p_id;update public.indent_items set item_status='Rejected' where indent_id=p_id and item_status='Pending';end if;
end$$;
revoke all on function public.decide_indent(uuid,uuid,boolean) from public,anon;grant execute on function public.decide_indent(uuid,uuid,boolean) to authenticated;
-- Realtime is shared across sessions; add only tables not already published.
do $$declare t text;begin for t in select tablename from pg_tables where schemaname='public' and tablename not in ('ping_test','profiles') loop if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then execute format('alter publication supabase_realtime add table public.%I',t);end if;end loop;end$$;
-- Restrict document access by role; storage bucket limits are enforced independently of the UI.
drop policy if exists "authenticated read quotations" on storage.objects;
drop policy if exists "authenticated upload quotations" on storage.objects;
create policy quote_read on storage.objects for select to authenticated using(bucket_id='quotations' and private.st_role() in ('md','qms','accounts','admin','sales'));
create policy quote_upload on storage.objects for insert to authenticated with check(bucket_id='quotations' and private.st_role() in ('sales','admin'));
update storage.buckets set public=false,file_size_limit=5242880 where id in ('quotations','issue-photos');
update storage.buckets set public=false,file_size_limit=3145728 where id='visiting-cards';
revoke all on public.projects_view,public.boq_items_view,public.labour_categories_view,public.indent_quotations_view,public.material_orders_view from public,anon;
grant select on public.projects_view,public.boq_items_view,public.labour_categories_view,public.indent_quotations_view,public.material_orders_view to authenticated;
notify pgrst,'reload schema';
