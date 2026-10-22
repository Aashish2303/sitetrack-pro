-- Item-level quotation pricing and immutable approval attribution.
alter table public.indents add column if not exists approved_by uuid references public.profiles(id);
alter table public.indents add column if not exists approved_at timestamptz;
create table if not exists public.quotation_lines (
 id uuid primary key default gen_random_uuid(), quotation_id uuid not null references public.indent_quotations(id) on delete cascade,
 item_id uuid not null references public.indent_items(id) on delete cascade, rate numeric not null check(rate>=0),
 unique(quotation_id,item_id)
);
alter table public.quotation_lines enable row level security;
revoke all on public.quotation_lines from anon,authenticated;
grant select(id,quotation_id,item_id) on public.quotation_lines to authenticated;
create policy lines_read on public.quotation_lines for select to authenticated using(private.st_role() is not null);
create or replace view public.quotation_lines_view with(security_barrier=true) as select l.id,l.quotation_id,l.item_id,
 case when public.can_see_finance() or private.st_role()='sales' then l.rate end rate,
 case when public.can_see_finance() or private.st_role()='sales' then l.rate*i.quantity end amount
 from public.quotation_lines l join public.indent_items i on i.id=l.item_id where private.st_role() is not null;
revoke all on public.quotation_lines_view from public,anon;grant select on public.quotation_lines_view to authenticated;
-- Master-order view explicitly enforces workspace membership and finance masking.
create or replace view public.material_orders_view with(security_barrier=true) as select o.id,o.project_id,o.vendor,o.material,o.date,o.po_number,o.ordered_qty,o.unit,o.pay_status,o.remarks,o.created_by,o.created_at,
 coalesce(d.received_qty,0) received_qty,o.ordered_qty-coalesce(d.received_qty,0) pending_qty,
 case when coalesce(d.received_qty,0)>=o.ordered_qty then 'Complete' else 'Partial' end billing_status,
 case when public.can_see_finance() then o.rate end rate
 from public.material_orders o left join(select order_id,sum(delivered_qty) received_qty from public.material_order_deliveries group by order_id)d on d.order_id=o.id where private.st_role() is not null;
alter table public.indent_quotations add column if not exists adjustment numeric not null default 0;
-- Hide arbitrary attachment names and financial quotation notes from engineers too.
create or replace view public.indent_quotations_view with(security_barrier=true) as select q.id,q.indent_id,q.vendor_name,q.delivery_time,
 case when public.can_see_finance() or private.st_role()='sales' then q.notes end notes,
 case when public.can_see_finance() or private.st_role()='sales' then q.attached_file_url end attached_file_url,
 case when public.can_see_finance() or private.st_role()='sales' then q.attached_file_name end attached_file_name,q.uploaded_by,q.created_at,
 case when public.can_see_finance() or private.st_role()='sales' then q.rate end rate,
 case when public.can_see_finance() or private.st_role()='sales' then coalesce((select sum(l.rate*i.quantity) from public.quotation_lines l join public.indent_items i on i.id=l.item_id where l.quotation_id=q.id and i.item_status not in ('On Hold','Rejected'))+q.adjustment,q.total) end total
 from public.indent_quotations q where private.st_role() is not null;
revoke select(notes,attached_file_name) on public.indent_quotations from authenticated;
-- Atomic multi-item indent. Invalid children roll back the header too.
create or replace function private.create_indent(p_header jsonb,p_items jsonb) returns uuid language plpgsql security definer set search_path='' as $$declare v_id uuid;r text:=private.st_role();i jsonb;begin
 if auth.uid() is null or r not in ('engineer','qms','md','admin') then raise exception 'Site engineering permission required';end if;
 if jsonb_array_length(p_items)<1 or jsonb_array_length(p_items)>100 then raise exception 'Add 1 to 100 items';end if;
 insert into public.indents(project_id,date,urgency,engineer,notes,note_for_approval,created_by)values((p_header->>'project_id')::uuid,(p_header->>'date')::date,p_header->>'urgency',p_header->>'engineer',p_header->>'notes',p_header->>'note_for_approval',auth.uid())returning id into v_id;
 for i in select value from jsonb_array_elements(p_items)loop
 if nullif(trim(i->>'material_name'),'') is null or nullif(i->>'category','') is null then raise exception 'Each item needs a name and category';end if;
 insert into public.indent_items(indent_id,material_name,quantity,unit,size,category)values(v_id,i->>'material_name',(i->>'quantity')::numeric,i->>'unit',i->>'size',i->>'category');end loop;return v_id;end$$;
create or replace function public.create_indent(p_header jsonb,p_items jsonb) returns uuid language sql security invoker set search_path='' as $$select private.create_indent(p_header,p_items)$$;
-- Quotations are item-priced. Two complete quotations advance the indent atomically.
create or replace function private.submit_quotation(p_indent uuid,p_header jsonb,p_lines jsonb)returns uuid language plpgsql security definer set search_path='' as $$declare qid uuid;v_line jsonb;v_total numeric;ind public.indents;begin
 if auth.uid() is null or private.st_role() not in ('sales','admin')then raise exception 'Procurement permission required';end if;
 select * into ind from public.indents where id=p_indent for update;
 if ind.id is null or ind.status not in ('Pending Quotation','MD Review')then raise exception 'Indent is not accepting quotations';end if;
 if nullif(trim(p_header->>'vendor_name'),'') is null then raise exception 'Vendor required';end if;
 if exists(select 1 from public.indent_items i where indent_id=p_indent and item_status='Pending' and not exists(select 1 from jsonb_array_elements(p_lines)x where (x->>'item_id')::uuid=i.id)) then raise exception 'Price every pending item';end if;
 insert into public.indent_quotations(indent_id,vendor_name,rate,total,delivery_time,notes,attached_file_url,attached_file_name,uploaded_by)values(p_indent,p_header->>'vendor_name',0,0,p_header->>'delivery_time',p_header->>'notes',p_header->>'attached_file_url',p_header->>'attached_file_name',auth.uid())returning id into qid;
 for v_line in select value from jsonb_array_elements(p_lines)loop
 if not exists(select 1 from public.indent_items where id=(v_line->>'item_id')::uuid and indent_id=p_indent)then raise exception 'Quotation item does not belong to indent';end if;
 insert into public.quotation_lines(quotation_id,item_id,rate)values(qid,(v_line->>'item_id')::uuid,(v_line->>'rate')::numeric);end loop;
 select sum(l.rate*i.quantity)into v_total from public.quotation_lines l join public.indent_items i on i.id=l.item_id where l.quotation_id=qid and i.item_status='Pending';
 update public.indent_quotations set total=coalesce((p_header->>'total')::numeric,v_total,0),adjustment=coalesce((p_header->>'total')::numeric,v_total,0)-coalesce(v_total,0) where id=qid;
 if (select count(*)from public.indent_quotations where indent_id=p_indent)>=2 then update public.indents set status='MD Review' where id=p_indent;end if;return qid;end$$;
create or replace function public.submit_quotation(p_indent uuid,p_header jsonb,p_lines jsonb)returns uuid language sql security invoker set search_path='' as $$select private.submit_quotation(p_indent,p_header,p_lines)$$;
-- Atomic decision changes eligible items only; held/rejected items never enter PO.
create or replace function private.decide_indent(p_id uuid,p_quote uuid,p_approve boolean)returns void language plpgsql security definer set search_path='' as $$declare ind public.indents;idx integer;begin
 if auth.uid() is null or private.st_role() not in ('md','admin')then raise exception 'Management approval required';end if;
 select * into ind from public.indents where id=p_id for update;
 if ind.id is null or ind.status<>'MD Review'then raise exception 'Indent must be in MD Review';end if;
 perform set_config('sitetrack.deciding','yes',true);
 if p_approve then
 if not exists(select 1 from public.indent_quotations where id=p_quote and indent_id=p_id)then raise exception 'Select a valid quotation';end if;
 if not exists(select 1 from public.indent_items where indent_id=p_id and item_status='Pending')then raise exception 'No pending items to approve';end if;
 if exists(select 1 from public.quotation_lines where quotation_id=p_quote)and exists(select 1 from public.indent_items i where indent_id=p_id and item_status='Pending' and not exists(select 1 from public.quotation_lines l where quotation_id=p_quote and item_id=i.id))then raise exception 'Quotation needs prices for released items';end if;
 select n-1 into idx from(select id,row_number()over(order by created_at,id)n from public.indent_quotations where indent_id=p_id)x where id=p_quote;
 update public.indents set status='Approved',approved_idx=idx,approved_by=auth.uid(),approved_at=now(),po_number='PO-'||upper(substr(replace(p_id::text,'-',''),1,12)),wo_number='WO-'||upper(substr(replace(p_id::text,'-',''),1,12))where id=p_id;
 update public.indent_items set item_status='Approved'where indent_id=p_id and item_status='Pending';
 else update public.indents set status='Rejected',approved_by=auth.uid(),approved_at=now()where id=p_id;update public.indent_items set item_status='Rejected'where indent_id=p_id and item_status='Pending';end if;end$$;
create or replace function public.decide_indent(p_id uuid,p_quote uuid,p_approve boolean)returns void language sql security invoker set search_path='' as $$select private.decide_indent(p_id,p_quote,p_approve)$$;
-- All privileged implementation functions live in a non-exposed schema.
revoke all on function private.create_indent(jsonb,jsonb),private.submit_quotation(uuid,jsonb,jsonb),private.decide_indent(uuid,uuid,boolean) from public,anon;
grant execute on function private.create_indent(jsonb,jsonb),private.submit_quotation(uuid,jsonb,jsonb),private.decide_indent(uuid,uuid,boolean) to authenticated;
revoke all on function public.create_indent(jsonb,jsonb),public.submit_quotation(uuid,jsonb,jsonb),public.decide_indent(uuid,uuid,boolean) from public,anon;
grant execute on function public.create_indent(jsonb,jsonb),public.submit_quotation(uuid,jsonb,jsonb),public.decide_indent(uuid,uuid,boolean) to authenticated;
-- Atomic labour editing preserves wages hidden from non-finance staff.
create or replace function private.save_labour(p_id uuid,p_headev_row jsonb,p_rows jsonb)returns uuid language plpgsql security definer set search_path='' as $$declare eid uuid:=p_id;v_row jsonb;rid uuid;w numeric;old_entry public.labour_entries;old_ids uuid[];begin
 if auth.uid()is null or private.st_role()is null then raise exception 'Membership required';end if;
 if jsonb_array_length(p_rows)<1 then raise exception 'Add at least one labour category';end if;
 if p_id is null then
 insert into public.labour_entries(project_id,date,subcontractor,site_incharge,shift,in_time,out_time,remarks,created_by)values((p_headev_row->>'project_id')::uuid,(p_headev_row->>'date')::date,p_headev_row->>'subcontractor',p_headev_row->>'site_incharge',p_headev_row->>'shift',nullif(p_headev_row->>'in_time',''),nullif(p_headev_row->>'out_time',''),p_headev_row->>'remarks',auth.uid())returning id into eid;
 else select * into old_entry from public.labour_entries where id=eid for update;
 if old_entry.id is null or(old_entry.date<>(now()at time zone'Asia/Kolkata')::date and private.st_role()not in('md','admin'))then raise exception 'Only same-day entries may be edited';end if;
 update public.labour_entries set project_id=(p_headev_row->>'project_id')::uuid,date=(p_headev_row->>'date')::date,subcontractor=p_headev_row->>'subcontractor',site_incharge=p_headev_row->>'site_incharge',shift=p_headev_row->>'shift',in_time=nullif(p_headev_row->>'in_time',''),out_time=nullif(p_headev_row->>'out_time',''),remarks=p_headev_row->>'remarks'where id=eid;end if;
 select array_agg(id) into old_ids from public.labour_categories where labour_entry_id=eid;
 for v_row in select value from jsonb_array_elements(p_rows)loop
 rid:=nullif(v_row->>'id','')::uuid;w:=0;
 if rid is not null then select wage into w from public.labour_categories where id=rid and labour_entry_id=eid;if not found then raise exception 'Invalid labour category';end if;end if;
 if public.can_see_finance()then w:=coalesce((v_row->>'wage')::numeric,0);end if;
 if rid is null then insert into public.labour_categories(labour_entry_id,trade,skill,male_count,female_count,wage)values(eid,v_row->>'trade',v_row->>'skill',(v_row->>'male_count')::int,(v_row->>'female_count')::int,w);
 else update public.labour_categories set trade=v_row->>'trade',skill=v_row->>'skill',male_count=(v_row->>'male_count')::int,female_count=(v_row->>'female_count')::int,wage=w where id=rid;end if;end loop;
 delete from public.labour_categories c where c.id=any(old_ids) and not exists(select 1 from jsonb_array_elements(p_rows)x where nullif(x->>'id','')::uuid=c.id);
 return eid;end$$;
create or replace function public.save_labour(p_id uuid,p_header jsonb,p_rows jsonb)returns uuid language sql security invoker set search_path=''as $$select private.save_labour(p_id,p_header,p_rows)$$;
revoke all on function private.save_labour(uuid,jsonb,jsonb),public.save_labour(uuid,jsonb,jsonb) from public,anon;grant execute on function private.save_labour(uuid,jsonb,jsonb),public.save_labour(uuid,jsonb,jsonb)to authenticated;
-- Calculate hours in DB, validating HH:MM and treating equal times as zero hours.
create or replace function private.labour_hours()returns trigger language plpgsql set search_path=''as $$begin
 if new.in_time is not null and new.out_time is not null then new.hours:=round((mod((extract(epoch from new.out_time::time)-extract(epoch from new.in_time::time))::numeric+86400,86400))/3600,2);else new.hours:=null;end if;return new;end$$;
create trigger labour_hours before insert or update on public.labour_entries for each row execute function private.labour_hours();
-- Private storage policies require approved workspace membership.
drop policy if exists "authenticated upload visiting cards"on storage.objects;drop policy if exists "authenticated read visiting cards"on storage.objects;
create policy directory_upload on storage.objects for insert to authenticated with check(bucket_id='visiting-cards'and private.st_role()in('md','sales','admin'));
create policy directory_read on storage.objects for select to authenticated using(bucket_id='visiting-cards'and private.st_role()in('md','sales','admin'));
drop policy if exists "authenticated upload issue photos"on storage.objects;drop policy if exists "authenticated read issue photos"on storage.objects;
create policy issues_upload on storage.objects for insert to authenticated with check(bucket_id='issue-photos'and private.st_role()is not null);
create policy issues_read on storage.objects for select to authenticated using(bucket_id='issue-photos'and private.st_role()is not null);
-- Auditable changes, including who changed status and which records were affected.
create table public.activity_log(id bigint generated always as identity primary key,table_name text not null,record_id text,action text not null,user_id uuid,at timestamptz not null default now());
alter table public.activity_log enable row level security;revoke all on public.activity_log from public,authenticated;grant select on public.activity_log to authenticated;revoke all on public.activity_log from anon;
create policy activity_read on public.activity_log for select to authenticated using(private.st_role()is not null and(table_name not in('subcon_ledger','vendor_ledger')or public.can_see_finance()));
create function private.audit_change()returns trigger language plpgsql security definer set search_path=''as $$begin insert into public.activity_log(table_name,record_id,action,user_id)values(tg_table_name,case when tg_op='DELETE'then old.id::text else new.id::text end,tg_op,auth.uid());return null;end$$;
revoke all on function private.audit_change()from public,anon,authenticated;
do $$declare t text;begin foreach t in array array['projects','boq_items','indents','indent_items','indent_quotations','labour_entries','labour_categories','dwr_entries','dpr_entries','material_transactions','issues','subcon_ledger','vendor_ledger','material_orders','material_order_deliveries','vendors']loop execute format('create trigger audit_change after insert or update or delete on public.%I for each row execute function private.audit_change()',t);end loop;end$$;
-- Require valid positive stock movements and nonnegative master balances.
alter table public.materials add constraint opening_nonnegative check(opening_stock>=0);
alter table public.material_transactions add constraint movement_positive check(quantity>0);
-- Restrict profile reads to members and remove default anon table privileges.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using(private.st_role()is not null);
revoke all on all tables in schema public from anon;
revoke all on function public.handle_new_user(),public.apply_dpr_to_boq()from public,anon,authenticated;
notify pgrst,'reload schema';

revoke all on function private.labour_hours() from public,anon,authenticated;
