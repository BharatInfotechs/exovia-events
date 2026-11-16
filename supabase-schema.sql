
-- Exovia Events: centralized booking and operations schema.
-- Apply to a fresh Supabase project after reviewing role policies.
create extension if not exists pgcrypto;

create type public.exovia_role as enum ('super_admin','admin_client','sales_executive','event_manager','finance');
create type public.exovia_event_status as enum ('draft','published','booking_open','booking_closed','sold_out','completed','cancelled','archived');
create type public.exovia_booking_status as enum ('pending','reserved','confirmed','cancelled','rejected','completed');
create type public.exovia_payment_status as enum ('not_paid','submitted','under_verification','partially_paid','verified','rejected','refunded');
create type public.exovia_lead_status as enum ('new','contacted','interested','follow_up_required','booking_started','payment_pending','converted','lost','not_interested');

create table public.users (
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null,
 email text,
 phone text,
 role public.exovia_role not null default 'sales_executive',
 is_active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.employee_profiles (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null unique references public.users(id) on delete cascade,
 employee_code text not null unique,
 referral_code text not null unique,
 commission_rate numeric(5,2) not null default 0 check(commission_rate between 0 and 100),
 created_at timestamptz not null default now()
);
create table public.events (
 id uuid primary key default gen_random_uuid(),
 name text not null,
 slug text not null unique,
 description text not null default '',
 category text,
 city text not null,
 locality text,
 venue text,
 address text,
 latitude numeric(10,7),
 longitude numeric(10,7),
 banner_path text,
 status public.exovia_event_status not null default 'draft',
 public_visible boolean not null default false,
 vendor_booking_enabled boolean not null default false,
 customer_registration_enabled boolean not null default false,
 booking_opens_at timestamptz,
 booking_closes_at timestamptz,
 starts_at timestamptz,
 ends_at timestamptz,
 created_by uuid references public.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 archived_at timestamptz,
 check(ends_at is null or starts_at is null or ends_at >= starts_at)
);
create table public.event_dates (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.events(id) on delete restrict,
 event_date date not null,
 starts_at time,
 ends_at time,
 booking_opens_at timestamptz,
 booking_closes_at timestamptz,
 vendor_arrival_at time,
 setup_deadline_at time,
 total_capacity integer not null default 0 check(total_capacity >= 0),
 is_open boolean not null default false,
 special_instructions text,
 created_at timestamptz not null default now(),
 unique(event_id,event_date)
);
create table public.event_packages (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.events(id) on delete restrict,
 name text not null,
 description text,
 price_paise bigint not null check(price_paise >= 0),
 date_count integer not null default 1 check(date_count > 0),
 stall_quantity integer not null default 1 check(stall_quantity > 0),
 discount_paise bigint not null default 0 check(discount_paise >= 0),
 tax_percent numeric(5,2) not null default 0 check(tax_percent between 0 and 100),
 facilities jsonb not null default '[]',
 terms text,
 active boolean not null default true,
 booking_limit integer,
 created_at timestamptz not null default now(),
 unique(event_id,name)
);
create table public.stall_inventory (
 id uuid primary key default gen_random_uuid(),
 event_date_id uuid not null references public.event_dates(id) on delete restrict,
 stall_code text not null,
 category text,
 location_label text,
 price_paise bigint not null default 0 check(price_paise >= 0),
 status text not null default 'available' check(status in ('available','reserved','confirmed','closed')),
 notes text,
 created_at timestamptz not null default now(),
 unique(event_date_id,stall_code)
);
create table public.vendors (
 id uuid primary key default gen_random_uuid(),
 full_name text not null,
 business_name text not null,
 mobile text not null,
 whatsapp text,
 email text,
 category text,
 products_services text,
 city text,
 preferred_location text,
 electricity_required boolean not null default false,
 table_required boolean not null default false,
 lighting_required boolean not null default false,
 additional_equipment text,
 setup_requirements text,
 special_instructions text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.referrals (
 id uuid primary key default gen_random_uuid(),
 employee_user_id uuid not null references public.users(id) on delete restrict,
 referral_code text not null unique,
 is_active boolean not null default true,
 created_at timestamptz not null default now()
);
create table public.vendor_leads (
 id uuid primary key default gen_random_uuid(),
 vendor_id uuid references public.vendors(id) on delete set null,
 event_id uuid references public.events(id) on delete set null,
 status public.exovia_lead_status not null default 'new',
 assigned_employee_id uuid references public.users(id),
 referral_id uuid references public.referrals(id),
 preferred_dates date[] not null default '{}',
 package_interest uuid references public.event_packages(id),
 follow_up_at timestamptz,
 source text,
 notes text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.bookings (
 id uuid primary key default gen_random_uuid(),
 booking_code text not null unique default ('EXO-' || upper(substr(encode(gen_random_bytes(6),'hex'),1,10))),
 vendor_id uuid not null references public.vendors(id) on delete restrict,
 event_id uuid not null references public.events(id) on delete restrict,
 package_id uuid references public.event_packages(id) on delete restrict,
 referral_id uuid references public.referrals(id) on delete restrict,
 attributed_employee_id uuid references public.users(id) on delete restrict,
 status public.exovia_booking_status not null default 'pending',
 package_price_paise bigint not null check(package_price_paise >= 0),
 total_paise bigint not null check(total_paise >= 0),
 currency text not null default 'INR',
 notes text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 confirmed_at timestamptz
);
create table public.booking_slots (
 id uuid primary key default gen_random_uuid(),
 booking_id uuid not null references public.bookings(id) on delete restrict,
 event_date_id uuid not null references public.event_dates(id) on delete restrict,
 stall_inventory_id uuid references public.stall_inventory(id) on delete restrict,
 quantity integer not null default 1 check(quantity > 0),
 status text not null default 'reserved' check(status in ('reserved','confirmed','released')),
 created_at timestamptz not null default now(),
 unique(booking_id,event_date_id,stall_inventory_id)
);
create unique index booking_slots_unique_active_stall
 on public.booking_slots(stall_inventory_id)
 where stall_inventory_id is not null and status in ('reserved','confirmed');

create table public.payments (
 id uuid primary key default gen_random_uuid(),
 booking_id uuid not null references public.bookings(id) on delete restrict,
 expected_paise bigint not null check(expected_paise >= 0),
 submitted_paise bigint check(submitted_paise >= 0),
 status public.exovia_payment_status not null default 'not_paid',
 utr_reference text,
 submitted_at timestamptz,
 verified_by uuid references public.users(id),
 verified_at timestamptz,
 rejection_reason text,
 admin_notes text,
 created_at timestamptz not null default now()
);
create table public.payment_documents (
 id uuid primary key default gen_random_uuid(),
 payment_id uuid not null references public.payments(id) on delete restrict,
 storage_path text not null,
 original_filename text not null,
 mime_type text not null,
 size_bytes bigint not null check(size_bytes > 0),
 uploaded_at timestamptz not null default now()
);
create table public.setup_checklists (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.events(id) on delete restrict,
 title text not null,
 is_complete boolean not null default false,
 assigned_to uuid references public.users(id),
 due_at timestamptz,
 completed_at timestamptz,
 notes text,
 created_at timestamptz not null default now()
);
create table public.event_facilities (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.events(id) on delete restrict,
 name text not null,
 included boolean not null default false,
 provider text not null default 'exovia' check(provider in ('vendor','exovia','third_party')),
 responsible_user_id uuid references public.users(id),
 operational_status text not null default 'pending',
 notes text,
 created_at timestamptz not null default now()
);
create table public.banners (
 id uuid primary key default gen_random_uuid(),
 event_id uuid references public.events(id) on delete set null,
 title text not null,
 storage_path text not null,
 display_location text not null default 'home',
 starts_at timestamptz,
 ends_at timestamptz,
 active boolean not null default false,
 created_at timestamptz not null default now()
);
create table public.event_announcements (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.events(id) on delete cascade,
 title text not null,
 body text not null,
 publish_at timestamptz,
 published boolean not null default false,
 created_at timestamptz not null default now()
);
create table public.tasks (
 id uuid primary key default gen_random_uuid(),
 title text not null,
 description text,
 event_id uuid references public.events(id) on delete set null,
 assigned_to uuid references public.users(id),
 due_at timestamptz,
 status text not null default 'todo',
 priority text not null default 'medium',
 created_by uuid references public.users(id),
 created_at timestamptz not null default now()
);
create table public.activity_logs (
 id bigint generated always as identity primary key,
 actor_user_id uuid references public.users(id),
 action text not null,
 entity_type text not null,
 entity_id uuid,
 details jsonb not null default '{}',
 created_at timestamptz not null default now()
);
create table public.whatsapp_messages (
 id uuid primary key default gen_random_uuid(),
 recipient text not null,
 template_name text,
 message_type text not null,
 status text not null default 'queued',
 provider_message_id text,
 related_booking_id uuid references public.bookings(id),
 error_message text,
 created_at timestamptz not null default now()
);

create index events_public_idx on public.events(status,public_visible,booking_opens_at);
create index event_dates_event_date_idx on public.event_dates(event_id,event_date);
create index leads_assignee_status_idx on public.vendor_leads(assigned_employee_id,status);
create index bookings_event_status_idx on public.bookings(event_id,status);
create index payments_status_idx on public.payments(status,created_at desc);
create index tasks_assignee_due_idx on public.tasks(assigned_to,due_at);

create or replace function public.current_exovia_role()
returns public.exovia_role language sql stable security definer
set search_path=public as $$
 select role from public.users where id=auth.uid() and is_active=true
$$;
create or replace function public.is_exovia_admin()
returns boolean language sql stable security definer set search_path=public as $$
 select coalesce(public.current_exovia_role() in ('super_admin','admin_client'),false)
$$;

alter table public.users enable row level security;
alter table public.employee_profiles enable row level security;
alter table public.events enable row level security;
alter table public.event_dates enable row level security;
alter table public.event_packages enable row level security;
alter table public.stall_inventory enable row level security;
alter table public.vendors enable row level security;
alter table public.referrals enable row level security;
alter table public.vendor_leads enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_slots enable row level security;
alter table public.payments enable row level security;
alter table public.payment_documents enable row level security;
alter table public.setup_checklists enable row level security;
alter table public.event_facilities enable row level security;
alter table public.banners enable row level security;
alter table public.event_announcements enable row level security;
alter table public.tasks enable row level security;
alter table public.activity_logs enable row level security;
alter table public.whatsapp_messages enable row level security;

create policy "public read published events" on public.events for select to anon,authenticated
 using (status in ('published','booking_open','booking_closed','sold_out') and public_visible=true);
create policy "public read open dates" on public.event_dates for select to anon,authenticated
 using (is_open=true and exists(select 1 from public.events e where e.id=event_id and e.public_visible=true));
create policy "public read active packages" on public.event_packages for select to anon,authenticated
 using (active=true and exists(select 1 from public.events e where e.id=event_id and e.public_visible=true));
create policy "public read available stalls" on public.stall_inventory for select to anon,authenticated
 using (status='available' and exists(select 1 from public.event_dates d join public.events e on e.id=d.event_id where d.id=event_date_id and d.is_open and e.public_visible));
create policy "admin full users" on public.users for all to authenticated using(public.is_exovia_admin()) with check(public.is_exovia_admin());
create policy "users read own profile" on public.users for select to authenticated using(id=auth.uid());
create policy "admin employee profiles" on public.employee_profiles for all to authenticated using(public.is_exovia_admin()) with check(public.is_exovia_admin());
create policy "admin events" on public.events for all to authenticated using(public.is_exovia_admin() or public.current_exovia_role()='event_manager') with check(public.is_exovia_admin() or public.current_exovia_role()='event_manager');
create policy "admin dates" on public.event_dates for all to authenticated using(public.is_exovia_admin() or public.current_exovia_role()='event_manager') with check(public.is_exovia_admin() or public.current_exovia_role()='event_manager');
create policy "admin packages" on public.event_packages for all to authenticated using(public.is_exovia_admin()) with check(public.is_exovia_admin());
create policy "admin inventory" on public.stall_inventory for all to authenticated using(public.is_exovia_admin() or public.current_exovia_role()='event_manager') with check(public.is_exovia_admin() or public.current_exovia_role()='event_manager');
create policy "staff vendor leads" on public.vendor_leads for select to authenticated using(public.is_exovia_admin() or assigned_employee_id=auth.uid() or public.current_exovia_role()='event_manager');
create policy "admin manage leads" on public.vendor_leads for all to authenticated using(public.is_exovia_admin()) with check(public.is_exovia_admin());
create policy "admin manage vendors" on public.vendors for all to authenticated using(public.is_exovia_admin() or public.current_exovia_role()='event_manager') with check(public.is_exovia_admin() or public.current_exovia_role()='event_manager');
create policy "admin manage referrals" on public.referrals for all to authenticated using(public.is_exovia_admin()) with check(public.is_exovia_admin());
create policy "staff read bookings" on public.bookings for select to authenticated using(public.is_exovia_admin() or attributed_employee_id=auth.uid() or public.current_exovia_role()='event_manager' or public.current_exovia_role()='finance');
create policy "admin manage bookings" on public.bookings for all to authenticated using(public.is_exovia_admin() or public.current_exovia_role()='event_manager') with check(public.is_exovia_admin() or public.current_exovia_role()='event_manager');
create policy "staff read slots" on public.booking_slots for select to authenticated using(public.is_exovia_admin() or public.current_exovia_role()='event_manager');
create policy "admin manage slots" on public.booking_slots for all to authenticated using(public.is_exovia_admin() or public.current_exovia_role()='event_manager') with check(public.is_exovia_admin() or public.current_exovia_role()='event_manager');
create policy "finance payments" on public.payments for select to authenticated using(public.is_exovia_admin() or public.current_exovia_role()='finance');
create policy "finance manage payments" on public.payments for all to authenticated using(public.is_exovia_admin() or public.current_exovia_role()='finance') with check(public.is_exovia_admin() or public.current_exovia_role()='finance');
create policy "finance documents" on public.payment_documents for select to authenticated using(public.is_exovia_admin() or public.current_exovia_role()='finance');
create policy "finance manage documents" on public.payment_documents for all to authenticated using(public.is_exovia_admin() or public.current_exovia_role()='finance') with check(public.is_exovia_admin() or public.current_exovia_role()='finance');
create policy "admin facilities" on public.event_facilities for all to authenticated using(public.is_exovia_admin() or public.current_exovia_role()='event_manager') with check(public.is_exovia_admin() or public.current_exovia_role()='event_manager');
create policy "admin checklist" on public.setup_checklists for all to authenticated using(public.is_exovia_admin() or public.current_exovia_role()='event_manager') with check(public.is_exovia_admin() or public.current_exovia_role()='event_manager');
create policy "public active banners" on public.banners for select to anon,authenticated using(active=true and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>=now()));
create policy "admin manage banners" on public.banners for all to authenticated using(public.is_exovia_admin()) with check(public.is_exovia_admin());
create policy "public announcements" on public.event_announcements for select to anon,authenticated using(published=true and (publish_at is null or publish_at<=now()));
create policy "admin announcements" on public.event_announcements for all to authenticated using(public.is_exovia_admin()) with check(public.is_exovia_admin());
create policy "admin tasks" on public.tasks for all to authenticated using(public.is_exovia_admin() or assigned_to=auth.uid() or public.current_exovia_role()='event_manager') with check(public.is_exovia_admin() or assigned_to=auth.uid() or public.current_exovia_role()='event_manager');
create policy "admin logs read" on public.activity_logs for select to authenticated using(public.is_exovia_admin());
create policy "admin whatsapp logs" on public.whatsapp_messages for select to authenticated using(public.is_exovia_admin() or public.current_exovia_role()='sales_executive');

-- Booking inventory allocation must be performed transactionally by a trusted server/RPC.
-- This RPC is intentionally not granted to anon/authenticated in this starter migration.
create or replace function public.reserve_stall(p_event_date_id uuid,p_stall_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_date public.event_dates; v_stall public.stall_inventory;
begin
 select * into v_date from public.event_dates where id=p_event_date_id for update;
 if not found or not v_date.is_open then raise exception 'Booking date is closed'; end if;
 select * into v_stall from public.stall_inventory where id=p_stall_id and event_date_id=p_event_date_id for update;
 if not found or v_stall.status <> 'available' then raise exception 'Stall is no longer available'; end if;
 update public.stall_inventory set status='reserved' where id=p_stall_id and status='available';
 if not found then raise exception 'Stall is no longer available'; end if;
 return true;
end $$;
revoke all on function public.reserve_stall(uuid,uuid) from public,anon,authenticated;

-- Create a private storage bucket for payment evidence. Access should be granted via
-- narrowly scoped server-created signed URLs after authorization.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('exovia-payment-documents','exovia-payment-documents',false,5242880,array['image/jpeg','image/png','application/pdf'])
on conflict(id) do nothing;
