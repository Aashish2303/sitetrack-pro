create role anon;create role authenticated;create schema auth;create schema storage;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function auth.role() returns text language sql stable as $$select current_user::text$$;
create table storage.buckets(id text primary key,public boolean,file_size_limit bigint);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;
create table public.ping_test("id" integer not null,"note" text,primary key(id));alter table public.ping_test enable row level security;
create table public.profiles("id" uuid not null,"username" text not null,"name" text not null,"role" text not null check(role = ANY (ARRAY['md'::text, 'engineer'::text, 'sales'::text, 'qms'::text, 'accounts'::text, 'admin'::text])),"avatar" text,"created_at" timestamp with time zone default now() not null,primary key(id));alter table public.profiles enable row level security;
create table public.projects("id" uuid default gen_random_uuid() not null,"name" text not null,"location" text,"client_name" text,"value" numeric default 0,"start_date" date,"end_date" date,"status" text default 'Active'::text not null check(status = ANY (ARRAY['Active'::text, 'On Hold'::text, 'Completed'::text])),"created_by" uuid,"created_at" timestamp with time zone default now() not null,primary key(id));alter table public.projects enable row level security;
create table public.boq_items("id" uuid default gen_random_uuid() not null,"project_id" uuid not null,"item" text not null,"unit" text not null,"boq_qty" numeric default 0 not null,"cum_done" numeric default 0 not null,"rate" numeric default 0 not null,"is_extra" boolean default false not null,"created_at" timestamp with time zone default now() not null,primary key(id));alter table public.boq_items enable row level security;
create table public.indents("id" uuid default gen_random_uuid() not null,"project_id" uuid not null,"date" date default CURRENT_DATE not null,"urgency" text default 'Normal'::text,"engineer" text,"notes" text,"note_for_approval" text,"status" text default 'Pending Quotation'::text not null check(status = ANY (ARRAY['Pending Quotation'::text, 'MD Review'::text, 'Approved'::text, 'Rejected'::text])),"po_number" text,"wo_number" text,"approved_idx" integer,"created_by" uuid,"created_at" timestamp with time zone default now() not null,primary key(id));alter table public.indents enable row level security;
create table public.indent_items("id" uuid default gen_random_uuid() not null,"indent_id" uuid not null,"material_name" text not null,"quantity" numeric not null,"unit" text not null,"size" text,"category" text,"item_status" text default 'Pending'::text not null check(item_status = ANY (ARRAY['Pending'::text, 'Approved'::text, 'Rejected'::text, 'On Hold'::text])),"created_at" timestamp with time zone default now() not null,primary key(id));alter table public.indent_items enable row level security;
create table public.indent_quotations("id" uuid default gen_random_uuid() not null,"indent_id" uuid not null,"vendor_name" text not null,"rate" numeric default 0 not null,"total" numeric default 0 not null,"delivery_time" text,"notes" text,"attached_file_url" text,"attached_file_name" text,"uploaded_by" uuid,"created_at" timestamp with time zone default now() not null,primary key(id));alter table public.indent_quotations enable row level security;
create table public.labour_entries("id" uuid default gen_random_uuid() not null,"project_id" uuid not null,"date" date default CURRENT_DATE not null,"subcontractor" text,"site_incharge" text,"shift" text default 'Day'::text check(shift = ANY (ARRAY['Day'::text, 'Night'::text])),"in_time" text,"out_time" text,"hours" numeric,"remarks" text,"created_by" uuid,"created_at" timestamp with time zone default now() not null,primary key(id));alter table public.labour_entries enable row level security;
create table public.labour_categories("id" uuid default gen_random_uuid() not null,"labour_entry_id" uuid not null,"trade" text not null,"skill" text default 'Unskilled'::text check(skill = ANY (ARRAY['Skilled'::text, 'Unskilled'::text, 'Semi-Skilled'::text])),"male_count" integer default 0 not null,"female_count" integer default 0 not null,"wage" numeric default 0 not null,primary key(id));alter table public.labour_categories enable row level security;
create table public.dwr_entries("id" uuid default gen_random_uuid() not null,"project_id" uuid not null,"date" date default CURRENT_DATE not null,"description" text,"location_block" text,"quantity" numeric,"category" text,"subcontractor" text,"engineer" text,"site_incharge" text,"work_status" text default 'Completed'::text check(work_status = ANY (ARRAY['Completed'::text, 'Partial'::text, 'Delayed - Carry Forward'::text, 'Cancelled'::text, 'Not Started'::text])),"carry_forward" boolean default false,"remarks" text,"created_by" uuid,"created_at" timestamp with time zone default now() not null,primary key(id));alter table public.dwr_entries enable row level security;
create table public.dpr_entries("id" uuid default gen_random_uuid() not null,"project_id" uuid not null,"boq_item_id" uuid,"date" date default CURRENT_DATE not null,"description" text,"location_block" text,"category" text,"pct_done" numeric,"qty_done" numeric default 0 not null,"subcontractor" text,"engineer" text,"site_incharge" text,"work_status" text default 'Completed'::text check(work_status = ANY (ARRAY['Completed'::text, 'Partial'::text, 'Delayed - Carry Forward'::text, 'Cancelled'::text, 'Not Started'::text])),"carry_forward" boolean default false,"reason" text,"created_by" uuid,"created_at" timestamp with time zone default now() not null,primary key(id));alter table public.dpr_entries enable row level security;
create table public.materials("id" uuid default gen_random_uuid() not null,"name" text not null,"unit" text not null,"category" text,"opening_stock" numeric default 0 not null,"created_at" timestamp with time zone default now() not null,primary key(id));alter table public.materials enable row level security;
create table public.material_transactions("id" uuid default gen_random_uuid() not null,"project_id" uuid not null,"material_id" uuid not null,"date" date default CURRENT_DATE not null,"type" text not null check(type = ANY (ARRAY['Inward'::text, 'Consumption'::text])),"quantity" numeric not null,"reference" text,"remarks" text,"created_by" uuid,"created_at" timestamp with time zone default now() not null,primary key(id));alter table public.material_transactions enable row level security;
create table public.issues("id" uuid default gen_random_uuid() not null,"project_id" uuid not null,"date" date default CURRENT_DATE not null,"title" text not null,"description" text,"category" text,"priority" text default 'Medium'::text check(priority = ANY (ARRAY['Low'::text, 'Medium'::text, 'High'::text, 'Critical'::text])),"raised_by" uuid,"assigned_to" text,"status" text default 'Open'::text not null check(status = ANY (ARRAY['Open'::text, 'In Progress'::text, 'Resolved'::text, 'Closed'::text])),"resolution" text,"photo_url" text,"created_at" timestamp with time zone default now() not null,primary key(id));alter table public.issues enable row level security;
create table public.subcon_ledger("id" uuid default gen_random_uuid() not null,"project_id" uuid not null,"subcontractor" text not null,"date" date default CURRENT_DATE not null,"type" text not null check(type = ANY (ARRAY['Work Order'::text, 'Running Bill'::text, 'Final Bill'::text, 'Advance'::text, 'Retention Release'::text, 'Deduction'::text])),"description" text,"wo_po_number" text,"work_order_amount" numeric default 0,"invoice_amount" numeric default 0,"amount_paid" numeric default 0,"remarks" text,"created_by" uuid,"created_at" timestamp with time zone default now() not null,primary key(id));alter table public.subcon_ledger enable row level security;
create table public.vendor_ledger("id" uuid default gen_random_uuid() not null,"project_id" uuid not null,"vendor" text not null,"date" date default CURRENT_DATE not null,"type" text not null check(type = ANY (ARRAY['Purchase'::text, 'Advance'::text, 'Return'::text, 'Debit Note'::text, 'Credit Note'::text])),"description" text,"po_number" text,"po_amount" numeric default 0,"invoice_amount" numeric default 0,"amount_paid" numeric default 0,"remarks" text,"created_by" uuid,"created_at" timestamp with time zone default now() not null,primary key(id));alter table public.vendor_ledger enable row level security;
create table public.material_orders("id" uuid default gen_random_uuid() not null,"project_id" uuid not null,"vendor" text not null,"material" text not null,"date" date default CURRENT_DATE not null,"po_number" text,"ordered_qty" numeric not null,"unit" text not null,"rate" numeric default 0,"pay_status" text default 'Pending'::text not null check(pay_status = ANY (ARRAY['Pending'::text, 'Partial'::text, 'Paid'::text])),"remarks" text,"created_by" uuid,"created_at" timestamp with time zone default now() not null,primary key(id));alter table public.material_orders enable row level security;
create table public.material_order_deliveries("id" uuid default gen_random_uuid() not null,"order_id" uuid not null,"date" date default CURRENT_DATE not null,"delivered_qty" numeric not null,"dc_number" text,"created_at" timestamp with time zone default now() not null,primary key(id));alter table public.material_order_deliveries enable row level security;
create table public.vendors("id" uuid default gen_random_uuid() not null,"vendor_name" text not null,"company_name" text,"mobile" text,"alt_contact" text,"category" text,"location" text,"material_type" text,"remarks" text,"visiting_card_url" text,"created_by" uuid,"created_at" timestamp with time zone default now() not null,primary key(id));alter table public.vendors enable row level security;
grant usage on schema public,auth,storage to authenticated,anon;grant all on all tables in schema public to authenticated,anon;
create function public.my_role() returns text language sql stable as $$select role from public.profiles where id=auth.uid()$$;
CREATE OR REPLACE FUNCTION public.apply_dpr_to_boq()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.boq_item_id is not null then
    update public.boq_items
      set cum_done = least(boq_qty, cum_done + coalesce(new.qty_done,0))
      where id = new.boq_item_id;
  end if;
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.can_see_finance()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(public.my_role() in ('md','qms','accounts','admin'), false);
$function$
;
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id, username, name, role, avatar)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1)),
    coalesce(new.raw_user_meta_data->>'name', 'User'),
    coalesce(new.raw_user_meta_data->>'role', 'engineer'),
    coalesce(new.raw_user_meta_data->>'avatar', 'U')
  )
  on conflict (id) do nothing;
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.my_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select role from public.profiles where id = auth.uid();
$function$
;
create view public.projects_view as  SELECT p.id,
    p.name,
    p.location,
    p.client_name,
    p.value,
    p.start_date,
    p.end_date,
    p.status,
    p.created_by,
    p.created_at,
    COALESCE(bq.total_qty, (0)::numeric) AS total_boq_qty,
    COALESCE(bq.total_done, (0)::numeric) AS total_done_qty,
        CASE
            WHEN (COALESCE(bq.total_qty, (0)::numeric) > (0)::numeric) THEN round(((100.0 * bq.total_done) / bq.total_qty), 1)
            ELSE (0)::numeric
        END AS progress_pct
   FROM (projects p
     LEFT JOIN ( SELECT boq_items.project_id,
            sum(boq_items.boq_qty) AS total_qty,
            sum(boq_items.cum_done) AS total_done
           FROM boq_items
          GROUP BY boq_items.project_id) bq ON ((bq.project_id = p.id)));grant select on public.projects_view to authenticated,anon;
create view public.indent_quotations_view as  SELECT id,
    indent_id,
    vendor_name,
    delivery_time,
    notes,
    attached_file_url,
    attached_file_name,
    uploaded_by,
    created_at,
        CASE
            WHEN (can_see_finance() OR (my_role() = 'sales'::text)) THEN rate
            ELSE NULL::numeric
        END AS rate,
        CASE
            WHEN (can_see_finance() OR (my_role() = 'sales'::text)) THEN total
            ELSE NULL::numeric
        END AS total
   FROM indent_quotations q;grant select on public.indent_quotations_view to authenticated,anon;
create view public.labour_categories_view as  SELECT id,
    labour_entry_id,
    trade,
    skill,
    male_count,
    female_count,
        CASE
            WHEN can_see_finance() THEN wage
            ELSE NULL::numeric
        END AS wage,
        CASE
            WHEN can_see_finance() THEN (((male_count + female_count))::numeric * wage)
            ELSE NULL::numeric
        END AS row_cost
   FROM labour_categories c;grant select on public.labour_categories_view to authenticated,anon;
create view public.material_orders_view as  SELECT o.id,
    o.project_id,
    o.vendor,
    o.material,
    o.date,
    o.po_number,
    o.ordered_qty,
    o.unit,
    o.pay_status,
    o.remarks,
    o.created_by,
    o.created_at,
    COALESCE(d.received_qty, (0)::numeric) AS received_qty,
    (o.ordered_qty - COALESCE(d.received_qty, (0)::numeric)) AS pending_qty,
        CASE
            WHEN (COALESCE(d.received_qty, (0)::numeric) >= o.ordered_qty) THEN 'Complete'::text
            ELSE 'Partial'::text
        END AS billing_status,
        CASE
            WHEN can_see_finance() THEN o.rate
            ELSE NULL::numeric
        END AS rate
   FROM (material_orders o
     LEFT JOIN ( SELECT material_order_deliveries.order_id,
            sum(material_order_deliveries.delivered_qty) AS received_qty
           FROM material_order_deliveries
          GROUP BY material_order_deliveries.order_id) d ON ((d.order_id = o.id)));grant select on public.material_orders_view to authenticated,anon;
create view public.boq_items_view as  SELECT id,
    project_id,
    item,
    unit,
    boq_qty,
    cum_done,
    is_extra,
    (boq_qty - cum_done) AS balance,
        CASE
            WHEN (boq_qty > (0)::numeric) THEN round(((100.0 * cum_done) / boq_qty), 1)
            ELSE (0)::numeric
        END AS progress_pct,
        CASE
            WHEN can_see_finance() THEN rate
            ELSE NULL::numeric
        END AS rate,
        CASE
            WHEN can_see_finance() THEN (rate * boq_qty)
            ELSE NULL::numeric
        END AS boq_value,
        CASE
            WHEN can_see_finance() THEN (rate * cum_done)
            ELSE NULL::numeric
        END AS done_value
   FROM boq_items b;grant select on public.boq_items_view to authenticated,anon;
create policy "authenticated upload issue photos" on "storage"."objects" for INSERT to "authenticated"  with check((bucket_id = 'issue-photos'::text));
create policy "authenticated read issue photos" on "storage"."objects" for SELECT to "authenticated" using((bucket_id = 'issue-photos'::text)) ;
create policy "authenticated upload visiting cards" on "storage"."objects" for INSERT to "authenticated"  with check((bucket_id = 'visiting-cards'::text));
create policy "authenticated read visiting cards" on "storage"."objects" for SELECT to "authenticated" using((bucket_id = 'visiting-cards'::text)) ;
create policy "authenticated upload quotations" on "storage"."objects" for INSERT to "authenticated"  with check((bucket_id = 'quotations'::text));
create policy "authenticated read quotations" on "storage"."objects" for SELECT to "authenticated" using((bucket_id = 'quotations'::text)) ;
create policy "profiles_self_update" on "public"."profiles" for UPDATE to public using((auth.uid() = id)) ;
create policy "profiles_select" on "public"."profiles" for SELECT to public using((auth.role() = 'authenticated'::text)) ;
create policy "projects_all" on "public"."projects" for ALL to public using((auth.role() = 'authenticated'::text)) with check((auth.role() = 'authenticated'::text));
create policy "boq_all" on "public"."boq_items" for ALL to public using((auth.role() = 'authenticated'::text)) with check((auth.role() = 'authenticated'::text));
create policy "indents_all" on "public"."indents" for ALL to public using((auth.role() = 'authenticated'::text)) with check((auth.role() = 'authenticated'::text));
create policy "indent_items_all" on "public"."indent_items" for ALL to public using((auth.role() = 'authenticated'::text)) with check((auth.role() = 'authenticated'::text));
create policy "indent_quotations_all" on "public"."indent_quotations" for ALL to public using((auth.role() = 'authenticated'::text)) with check((auth.role() = 'authenticated'::text));
create policy "labour_entries_all" on "public"."labour_entries" for ALL to public using((auth.role() = 'authenticated'::text)) with check((auth.role() = 'authenticated'::text));
create policy "labour_categories_all" on "public"."labour_categories" for ALL to public using((auth.role() = 'authenticated'::text)) with check((auth.role() = 'authenticated'::text));
create policy "dwr_all" on "public"."dwr_entries" for ALL to public using((auth.role() = 'authenticated'::text)) with check((auth.role() = 'authenticated'::text));
create policy "dpr_all" on "public"."dpr_entries" for ALL to public using((auth.role() = 'authenticated'::text)) with check((auth.role() = 'authenticated'::text));
create policy "materials_all" on "public"."materials" for ALL to public using((auth.role() = 'authenticated'::text)) with check((auth.role() = 'authenticated'::text));
create policy "material_tx_all" on "public"."material_transactions" for ALL to public using((auth.role() = 'authenticated'::text)) with check((auth.role() = 'authenticated'::text));
create policy "issues_all" on "public"."issues" for ALL to public using((auth.role() = 'authenticated'::text)) with check((auth.role() = 'authenticated'::text));
create policy "subcon_ledger_rw" on "public"."subcon_ledger" for ALL to public using(can_see_finance()) with check(can_see_finance());
create policy "vendor_ledger_rw" on "public"."vendor_ledger" for ALL to public using(can_see_finance()) with check(can_see_finance());
create policy "material_orders_all" on "public"."material_orders" for ALL to public using((auth.role() = 'authenticated'::text)) with check((auth.role() = 'authenticated'::text));
create policy "material_order_deliveries_all" on "public"."material_order_deliveries" for ALL to public using((auth.role() = 'authenticated'::text)) with check((auth.role() = 'authenticated'::text));
create policy "vendors_rw" on "public"."vendors" for ALL to public using((my_role() = ANY (ARRAY['md'::text, 'sales'::text, 'admin'::text]))) with check((my_role() = ANY (ARRAY['md'::text, 'sales'::text, 'admin'::text])));
CREATE TRIGGER on_dpr_insert AFTER INSERT ON public.dpr_entries FOR EACH ROW EXECUTE FUNCTION apply_dpr_to_boq();
create publication supabase_realtime;

