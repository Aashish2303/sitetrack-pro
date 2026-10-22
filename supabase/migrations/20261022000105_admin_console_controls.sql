-- Admin-only controls. Existing users remain active; no existing role is changed.
alter table public.profiles add column if not exists is_active boolean not null default true;
create or replace function private.st_role() returns text language sql stable security definer set search_path='' as $$select role from public.profiles where id=auth.uid() and auth.uid() is not null and is_active$$;
create table if not exists private.admin_events(id bigint generated always as identity primary key,actor_id uuid,action text not null,target_id text,details jsonb not null default '{}'::jsonb,at timestamptz not null default now());
alter table private.admin_events enable row level security;
revoke all on private.admin_events from public,anon,authenticated;
create or replace function private.admin_console(p_action text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;target uuid;entry public.profiles;newrole text;active boolean;nm text;entity text;allowed jsonb:='{"projects":["name","location","client_name","value","start_date","end_date","status"],"boq_items":["project_id","item","unit","boq_qty","cum_done","rate","is_extra"],"dwr_entries":["project_id","date","description","location_block","quantity","category","subcontractor","engineer","site_incharge","work_status","carry_forward","remarks"],"dpr_entries":["project_id","boq_item_id","date","description","location_block","category","qty_done","pct_done","subcontractor","engineer","site_incharge","work_status","carry_forward","reason"],"materials":["name","unit","category","opening_stock"],"material_transactions":["project_id","material_id","date","type","quantity","reference","remarks"],"indents":["project_id","date","urgency","engineer","notes","note_for_approval"],"indent_items":["indent_id","material_name","quantity","unit","size","category"],"indent_quotations":["indent_id","vendor_name","rate","total","delivery_time","notes"],"quotation_lines":["quotation_id","item_id","rate"],"labour_entries":["project_id","date","subcontractor","site_incharge","shift","in_time","out_time","remarks"],"labour_categories":["labour_entry_id","trade","skill","male_count","female_count","wage"],"issues":["project_id","date","title","description","category","priority","assigned_to","status","resolution"],"subcon_ledger":["project_id","subcontractor","date","type","description","wo_po_number","work_order_amount","invoice_amount","amount_paid","remarks"],"vendor_ledger":["project_id","vendor","date","type","description","po_number","po_amount","invoice_amount","amount_paid","remarks"],"material_orders":["project_id","vendor","material","date","po_number","ordered_qty","unit","rate","pay_status","remarks"],"material_order_deliveries":["order_id","date","delivered_qty","dc_number"],"vendors":["vendor_name","company_name","mobile","alt_contact","category","location","material_type","remarks"]}'::jsonb;keys text[];cols text;patch jsonb;oldrow jsonb;newrow jsonb;offset_num int;counts jsonb:='{}'::jsonb;t text;target_count bigint;fk record;has_children boolean;begin
 if auth.uid() is null or private.st_role() is distinct from 'admin' then raise exception 'Administrator access required' using errcode='42501';end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'Invalid request';end if;
 if p_action='overview' then
  for t in select jsonb_object_keys(allowed) loop execute format('select count(*) from public.%I',t)into target_count;counts:=counts||jsonb_build_object(t,target_count);end loop;result:=jsonb_build_object('counts',counts,'users',(select count(*)from public.profiles),'active_users',(select count(*)from public.profiles where is_active),'administrators',(select count(*)from public.profiles where role='admin'and is_active));
 elsif p_action='users' then
  select coalesce(jsonb_agg(to_jsonb(p)order by p.name),'[]'::jsonb) into result from public.profiles p;
 elsif p_action='save_user' then
  perform pg_advisory_xact_lock(813277001);
  target:=(p_payload->>'id')::uuid;
  select * into entry from public.profiles where id=target for update;
  if entry.id is null then raise exception 'User not found';end if;
  newrole:=p_payload->>'role';active:=(p_payload->>'is_active')::boolean;nm:=trim(p_payload->>'name');
  if newrole is null or newrole not in ('md','engineer','sales','qms','accounts','admin') or active is null or nm is null or length(nm)not between 1 and 100 then raise exception 'Enter a name, valid role and account status';end if;
  if target=auth.uid() and (newrole<>'admin' or not active)then raise exception 'You cannot remove your own administrator access';end if;
  if entry.role='admin' and entry.is_active and(newrole<>'admin'or not active)and(select count(*)from public.profiles where role='admin'and is_active)<=1 then raise exception 'At least one active administrator is required';end if;
  update public.profiles set name=nm,role=newrole,is_active=active,avatar=upper(left(nm,2))where id=target returning to_jsonb(profiles.*)into result;
  insert into private.admin_events(actor_id,action,target_id,details)values(auth.uid(),'USER_UPDATED',target::text,jsonb_build_object('old_role',entry.role,'new_role',newrole,'active',active));
 elsif p_action='records' then
  entity:=p_payload->>'entity';if not allowed?entity then raise exception 'Unknown record type';end if;
  offset_num:=greatest(0,least(coalesce((p_payload->>'offset')::int,0),100000));
  if nullif(p_payload->>'id','')is not null then
   execute format('select to_jsonb(t.*)from public.%I t where id=$1',entity)into result using(p_payload->>'id')::uuid;
   if result is null then raise exception 'Record not found';end if;
  else execute format('select jsonb_build_object(''rows'',coalesce((select jsonb_agg(to_jsonb(x))from(select * from public.%I order by id limit 50 offset $1)x),''[]''::jsonb),''total'',(select count(*)from public.%I))',entity,entity)into result using offset_num;end if;
 elsif p_action='save_record' then
  entity:=p_payload->>'entity';if not allowed?entity or entity=any(array['indent_quotations','quotation_lines'])then raise exception 'Use the quotation workflow for these records';end if;
  patch:=p_payload->'data';if patch is null or jsonb_typeof(patch)<>'object'or patch='{}'::jsonb then raise exception 'Enter record details';end if;
  if exists(select 1 from jsonb_object_keys(patch)k where not(allowed->entity)?k)then raise exception 'Unsupported field';end if;
  target:=nullif(p_payload->>'id','')::uuid;
  if target is not null then
   execute format('select to_jsonb(t.*)from public.%I t where id=$1 for update',entity)into oldrow using target;
   if oldrow is null then raise exception 'Record not found';end if;
   if entity='indent_items'and exists(select 1 from public.indents where id=(oldrow->>'indent_id')::uuid and status in('Approved','Rejected'))then raise exception 'Decided indent items are locked; use the indent workflow';end if;
  end if;
  select array_agg(k order by k)into keys from jsonb_object_keys(patch)k;
  cols:=array_to_string(array(select quote_ident(k)from unnest(keys)k),',');
  if target is null then
   execute format('insert into public.%I(%s)select %s from jsonb_populate_record(null::public.%I,$1)r returning to_jsonb(%I.*)',entity,cols,cols,entity,entity)into newrow using patch;
  else
   if entity='dpr_entries'and((patch?'qty_done'and patch->'qty_done'is distinct from oldrow->'qty_done')or(patch?'boq_item_id'and patch->'boq_item_id'is distinct from oldrow->'boq_item_id')or(patch?'project_id'and patch->'project_id'is distinct from oldrow->'project_id'))then raise exception 'Linked progress quantities are locked. Correct quantities through BOQ to preserve reconciliation';end if;
   execute format('update public.%I t set(%s)=(select %s from jsonb_populate_record(null::public.%I,$1)r)where id=$2 returning to_jsonb(t.*)',entity,cols,cols,entity)into newrow using patch,target;
  end if;
  if entity='material_orders'and(newrow->>'ordered_qty')::numeric<(select coalesce(sum(delivered_qty),0)from public.material_order_deliveries where order_id=(newrow->>'id')::uuid)then raise exception 'Ordered quantity cannot be less than received quantity';end if;
  insert into private.admin_events(actor_id,action,target_id,details)values(auth.uid(),case when target is null then 'RECORD_CREATED'else 'RECORD_UPDATED'end,newrow->>'id',jsonb_build_object('entity',entity,'fields',to_jsonb(keys)));
  result:=newrow;
 elsif p_action='delete_record' then
  entity:=p_payload->>'entity';target:=(p_payload->>'id')::uuid;
  if not allowed?entity or entity in('indent_quotations','quotation_lines','dpr_entries')then raise exception 'This record must be managed through its workflow';end if;
  execute format('select to_jsonb(t.*)from public.%I t where id=$1 for update',entity)into oldrow using target;
  if oldrow is null then raise exception 'Record not found';end if;
  if entity='indent_items'and exists(select 1 from public.indents where id=(oldrow->>'indent_id')::uuid and status in('Approved','Rejected'))then raise exception 'Decided indent items cannot be deleted';end if;
  for fk in select c.conrelid,a.attname,array_length(c.conkey,1)width from pg_constraint c join pg_attribute a on a.attrelid=c.conrelid and a.attnum=c.conkey[1] where c.contype='f'and c.confrelid=format('public.%I',entity)::regclass loop
   if fk.width<>1 then raise exception 'Record has linked dependencies';end if;
   execute format('select exists(select 1 from %s where %I=$1)',fk.conrelid::regclass,fk.attname)into has_children using target;
   if has_children then raise exception 'Linked records exist. Remove or reassign them before deleting this record';end if;
  end loop;
  execute format('delete from public.%I where id=$1',entity)using target;
  insert into private.admin_events(actor_id,action,target_id,details)values(auth.uid(),'RECORD_DELETED',target::text,jsonb_build_object('entity',entity));result:='{"ok":true}'::jsonb;
 elsif p_action='account_event' then
  if p_payload->>'event' not in ('ACCOUNT_CREATE_REQUEST','ACCOUNT_CREATED','PASSWORD_RESET_REQUEST','PASSWORD_RESET','ACCOUNT_ACTION_FAILED') then raise exception 'Invalid account event';end if;
  if p_payload->>'event'in('ACCOUNT_CREATE_REQUEST','PASSWORD_RESET_REQUEST')and(select count(*)from private.admin_events where actor_id=auth.uid()and action in('ACCOUNT_CREATE_REQUEST','PASSWORD_RESET_REQUEST')and at>now()-interval '15 minutes')>=20 then raise exception 'Too many account actions. Try again later';end if;
  insert into private.admin_events(actor_id,action,target_id)values(auth.uid(),p_payload->>'event',left(p_payload->>'target',100));result:='{"ok":true}'::jsonb;
 elsif p_action='activity' then
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb)into result from(select e.id,e.actor_id,p.name actor,e.action,e.target_id,e.details,e.at from private.admin_events e left join public.profiles p on p.id=e.actor_id order by e.at desc limit 100)x;
 else raise exception 'Unknown administrator action';end if;
 return result;end$$;
create or replace function public.admin_console(p_action text,p_payload jsonb default '{}'::jsonb)returns jsonb language sql security invoker set search_path=''as $$select private.admin_console(p_action,p_payload)$$;
revoke all on function private.admin_console(text,jsonb),public.admin_console(text,jsonb)from public,anon;
grant execute on function private.admin_console(text,jsonb),public.admin_console(text,jsonb)to authenticated;
notify pgrst,'reload schema';
