-- ==============================================================================
-- PAPERERA COMPLETE SUPABASE DATABASE SCHEMA
-- Run this script in your Supabase SQL Editor.
-- ==============================================================================

-- 1. Enable pgcrypto extension for password hashing (supports extensions & public schemas)
create extension if not exists pgcrypto schema extensions;

-- Helper function: Hash password with pgcrypto (handles both schema 'extensions' and 'public')
create or replace function public.hash_password(p_password text)
returns text language plpgsql security definer set search_path = public, extensions as $$
begin
  return extensions.crypt(p_password, extensions.gen_salt('bf'));
exception when others then
  return crypt(p_password, gen_salt('bf'));
end;
$$;

-- Helper function: Verify password
create or replace function public.verify_password(p_password text, p_hash text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
begin
  return (extensions.crypt(p_password, p_hash) = p_hash);
exception when others then
  return (crypt(p_password, p_hash) = p_hash);
end;
$$;

-- 2. Admin Users Table (Admin ID / Username + Hashed Password in Supabase)
create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password_hash text not null,
  full_name text not null default 'Administrator',
  created_at timestamptz not null default now()
);

-- Insert default administrator if none exists (Username: admin, Password: admin123)
insert into public.admin_users (username, password_hash, full_name)
values ('admin', public.hash_password('admin123'), 'Head Administrator')
on conflict (username) do update
set password_hash = public.hash_password('admin123');

-- 3. Workers Table (Worker ID + Hashed Password created and managed by Admin)
create table if not exists public.workers (
  id uuid primary key default gen_random_uuid(),
  worker_code text unique not null,
  full_name text not null,
  password_hash text not null,
  role text not null default 'sales',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. App & Pricing Settings Table (Homepage prices, trial settings, worker commission rates)
create table if not exists public.app_settings (
  id text primary key default 'global_config',
  domain_base_price numeric(12,2) not null default 599.00,
  domain_prices jsonb not null default '{"in": 599, "com": 999, "org": 899, "co_in": 499, "edu_in": 1199}'::jsonb,
  ai_paper_rate numeric(12,2) not null default 500.00,
  ai_paper_count_text text not null default '50–60 papers',
  monthly_upkeep_rate numeric(12,2) not null default 500.00,
  ai_trial_enabled boolean not null default true,
  ai_trial_price numeric(12,2) not null default 0.00,
  ai_trial_papers text not null default '5 test question papers',
  worker_comm_basic_site numeric(12,2) not null default 100.00,
  worker_comm_ai_papers numeric(12,2) not null default 150.00,
  worker_comm_both numeric(12,2) not null default 250.00,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (
  id, domain_base_price, domain_prices, ai_paper_rate, ai_paper_count_text,
  monthly_upkeep_rate, ai_trial_enabled, ai_trial_price, ai_trial_papers,
  worker_comm_basic_site, worker_comm_ai_papers, worker_comm_both
) values (
  'global_config', 599.00, '{"in": 599, "com": 999, "org": 899, "co_in": 499, "edu_in": 1199}'::jsonb,
  500.00, '50–60 papers', 500.00, true, 0.00, '5 test question papers',
  100.00, 150.00, 250.00
) on conflict (id) do update
set domain_prices = coalesce(public.app_settings.domain_prices, '{"in": 599, "com": 999, "org": 899, "co_in": 499, "edu_in": 1199}'::jsonb);

-- 5. Clients / School Leads Table (Tracks which worker submitted the school)
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  school_name text not null,
  city text,
  contact_name text,
  contact_phone text not null,
  contact_email text,
  service_type text not null default 'basic_site', -- 'basic_site', 'ai_papers', 'both', 'domain', 'trial'
  notes text,
  worker_id uuid references public.workers(id) on delete set null,
  payment_status text not null default 'unpaid', -- 'unpaid', 'paid', 'cancelled'
  paid_amount numeric(12,2) not null default 0,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 6. Worker Daily & Weekly Targets Table
create table if not exists public.worker_targets (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.workers(id) on delete cascade,
  target_date date not null default current_date,
  daily_target_count integer not null default 0,
  daily_target_amount numeric(12,2) not null default 0,
  weekly_target_count integer not null default 0,
  weekly_target_amount numeric(12,2) not null default 0,
  note text,
  created_at timestamptz not null default now(),
  unique(worker_id, target_date)
);

-- 7. Public Website Inquiries Table
create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  school_name text not null,
  city text,
  contact_name text,
  contact_phone text not null,
  contact_email text,
  requested_services jsonb not null default '[]'::jsonb,
  total_amount numeric(12,2) not null default 0,
  payment_status text not null default 'unpaid',
  paid_amount numeric(12,2) not null default 0,
  paid_at timestamptz,
  is_trial boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

-- Add this when upgrading an existing database created before totals were added.
alter table public.inquiries
  add column if not exists total_amount numeric(12,2) not null default 0;

alter table public.inquiries
  add column if not exists payment_status text not null default 'unpaid';

alter table public.inquiries
  add column if not exists paid_amount numeric(12,2) not null default 0;

alter table public.inquiries
  add column if not exists paid_at timestamptz;

-- ==============================================================================
-- DATABASE SECURITY & RPC FUNCTIONS (Authentication and Business Logic)
-- ==============================================================================

-- 1. Admin Login RPC
create or replace function public.admin_login(p_username text, p_password text)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare
  v_admin public.admin_users%rowtype;
begin
  select * into v_admin from public.admin_users
  where lower(username) = lower(trim(p_username));

  if v_admin.id is null or not public.verify_password(p_password, v_admin.password_hash) then
    return json_build_object('success', false, 'error', 'Invalid Admin ID or password.');
  end if;

  return json_build_object(
    'success', true,
    'admin', json_build_object(
      'id', v_admin.id,
      'username', v_admin.username,
      'full_name', v_admin.full_name
    )
  );
end;
$$;

-- 2. Worker Login RPC
create or replace function public.worker_login(p_worker_code text, p_password text)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare
  v_worker public.workers%rowtype;
begin
  select * into v_worker from public.workers
  where upper(trim(worker_code)) = upper(trim(p_worker_code));

  if v_worker.id is null or not public.verify_password(p_password, v_worker.password_hash) then
    return json_build_object('success', false, 'error', 'Invalid Worker ID or password.');
  end if;

  if not v_worker.active then
    return json_build_object('success', false, 'error', 'This worker account has been deactivated.');
  end if;

  return json_build_object(
    'success', true,
    'worker', json_build_object(
      'id', v_worker.id,
      'worker_code', v_worker.worker_code,
      'full_name', v_worker.full_name,
      'role', v_worker.role
    )
  );
end;
$$;

-- 3. Admin: Create Worker RPC
create or replace function public.admin_create_worker(
  p_worker_code text,
  p_full_name text,
  p_password text,
  p_role text default 'sales'
)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare
  v_code text;
  v_new_id uuid;
begin
  v_code := upper(trim(p_worker_code));
  if v_code is null or v_code = '' then
    v_code := 'WKR-' || lpad(floor(random() * 900000 + 100000)::text, 6, '0');
  end if;

  if exists (select 1 from public.workers where upper(worker_code) = v_code) then
    return json_build_object('success', false, 'error', 'Worker ID ' || v_code || ' already exists.');
  end if;

  if length(p_password) < 4 then
    return json_build_object('success', false, 'error', 'Password must be at least 4 characters long.');
  end if;

  insert into public.workers (worker_code, full_name, password_hash, role, active)
  values (v_code, trim(p_full_name), public.hash_password(p_password), p_role, true)
  returning id into v_new_id;

  return json_build_object(
    'success', true,
    'worker', json_build_object(
      'id', v_new_id,
      'worker_code', v_code,
      'full_name', trim(p_full_name),
      'role', p_role
    )
  );
end;
$$;

-- 4. Admin: Change / Reset Worker Password RPC
create or replace function public.admin_update_worker_password(
  p_worker_id uuid,
  p_new_password text
)
returns json language plpgsql security definer set search_path = public, extensions as $$
begin
  if length(p_new_password) < 4 then
    return json_build_object('success', false, 'error', 'Password must be at least 4 characters long.');
  end if;

  update public.workers
  set password_hash = public.hash_password(p_new_password),
      updated_at = now()
  where id = p_worker_id;

  if not found then
    return json_build_object('success', false, 'error', 'Worker not found.');
  end if;

  return json_build_object('success', true, 'message', 'Worker password updated successfully.');
end;
$$;

-- 5. Admin: Change Admin Password RPC
create or replace function public.admin_change_own_password(
  p_username text,
  p_old_password text,
  p_new_password text
)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare
  v_admin_id uuid;
  v_curr_hash text;
begin
  select id, password_hash into v_admin_id, v_curr_hash from public.admin_users
  where lower(username) = lower(trim(p_username));

  if v_admin_id is null or not public.verify_password(p_old_password, v_curr_hash) then
    return json_build_object('success', false, 'error', 'Current password is incorrect.');
  end if;

  update public.admin_users
  set password_hash = public.hash_password(p_new_password)
  where id = v_admin_id;

  return json_build_object('success', true, 'message', 'Admin password changed successfully.');
end;
$$;

-- 6. Worker: Submit School Lead RPC
create or replace function public.worker_submit_lead(
  p_worker_id uuid,
  p_school_name text,
  p_city text,
  p_contact_name text,
  p_contact_phone text,
  p_contact_email text,
  p_service_type text,
  p_notes text
)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_lead_id uuid;
begin
  if trim(p_school_name) = '' or trim(p_contact_phone) = '' then
    return json_build_object('success', false, 'error', 'School name and contact phone are required.');
  end if;

  insert into public.clients (
    school_name, city, contact_name, contact_phone, contact_email,
    service_type, notes, worker_id, payment_status
  ) values (
    trim(p_school_name), trim(p_city), trim(p_contact_name), trim(p_contact_phone), trim(p_contact_email),
    coalesce(p_service_type, 'basic_site'), trim(p_notes), p_worker_id, 'unpaid'
  )
  returning id into v_lead_id;

  return json_build_object('success', true, 'lead_id', v_lead_id, 'message', 'School lead submitted successfully.');
end;
$$;

-- 7. Admin: Mark Lead Payment Status (Paid / Unpaid)
create or replace function public.admin_set_payment_status(
  p_client_id uuid,
  p_status text,
  p_amount numeric default 0
)
returns json language plpgsql security definer set search_path = public as $$
begin
  update public.clients
  set payment_status = p_status,
      paid_amount = case when p_status = 'paid' then coalesce(p_amount, paid_amount) else 0 end,
      paid_at = case when p_status = 'paid' then now() else null end,
      updated_at = now()
  where id = p_client_id;

  if not found then
    return json_build_object('success', false, 'error', 'Client not found.');
  end if;

  return json_build_object('success', true, 'status', p_status);
end;
$$;

-- 8. Admin: Mark Homepage Inquiry Payment Status
create or replace function public.admin_set_inquiry_payment_status(
  p_inquiry_id uuid,
  p_status text
)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_amount numeric;
begin
  select total_amount into v_amount
  from public.inquiries
  where id = p_inquiry_id;

  if not found then
    return json_build_object('success', false, 'error', 'Inquiry not found.');
  end if;

  update public.inquiries
  set payment_status = p_status,
      paid_amount = case when p_status = 'paid' then coalesce(v_amount, 0) else 0 end,
      paid_at = case when p_status = 'paid' then now() else null end
  where id = p_inquiry_id;

  return json_build_object('success', true, 'status', p_status);
end;
$$;

-- 8. Admin: Set Worker Daily & Weekly Targets
create or replace function public.admin_set_worker_target(
  p_worker_id uuid,
  p_daily_count integer default 0,
  p_daily_amount numeric default 0,
  p_weekly_count integer default 0,
  p_weekly_amount numeric default 0,
  p_note text default ''
)
returns json language plpgsql security definer set search_path = public as $$
begin
  insert into public.worker_targets (
    worker_id, target_date, daily_target_count, daily_target_amount,
    weekly_target_count, weekly_target_amount, note
  ) values (
    p_worker_id, current_date, p_daily_count, p_daily_amount,
    p_weekly_count, p_weekly_amount, p_note
  )
  on conflict (worker_id, target_date) do update
  set daily_target_count = excluded.daily_target_count,
      daily_target_amount = excluded.daily_target_amount,
      weekly_target_count = excluded.weekly_target_count,
      weekly_target_amount = excluded.weekly_target_amount,
      note = excluded.note;

  return json_build_object('success', true, 'message', 'Targets saved successfully.');
end;
$$;

-- 9. Get App Settings & Pricing RPC (Public)
create or replace function public.get_app_settings()
returns json language sql stable security definer set search_path = public as $$
  select row_to_json(s) from public.app_settings s where id = 'global_config';
$$;

-- 10. Admin: Update App Settings & Pricing RPC
create or replace function public.admin_update_settings(p_settings jsonb)
returns json language plpgsql security definer set search_path = public as $$
begin
  update public.app_settings
  set domain_base_price = coalesce((p_settings->>'domain_base_price')::numeric, domain_base_price),
      domain_prices = coalesce(p_settings->'domain_prices', domain_prices),
      ai_paper_rate = coalesce((p_settings->>'ai_paper_rate')::numeric, ai_paper_rate),
      ai_paper_count_text = coalesce(p_settings->>'ai_paper_count_text', ai_paper_count_text),
      monthly_upkeep_rate = coalesce((p_settings->>'monthly_upkeep_rate')::numeric, monthly_upkeep_rate),
      ai_trial_enabled = coalesce((p_settings->>'ai_trial_enabled')::boolean, ai_trial_enabled),
      ai_trial_price = coalesce((p_settings->>'ai_trial_price')::numeric, ai_trial_price),
      ai_trial_papers = coalesce(p_settings->>'ai_trial_papers', ai_trial_papers),
      worker_comm_basic_site = coalesce((p_settings->>'worker_comm_basic_site')::numeric, worker_comm_basic_site),
      worker_comm_ai_papers = coalesce((p_settings->>'worker_comm_ai_papers')::numeric, worker_comm_ai_papers),
      worker_comm_both = coalesce((p_settings->>'worker_comm_both')::numeric, worker_comm_both),
      updated_at = now()
  where id = 'global_config';

  return json_build_object('success', true, 'message', 'Settings updated successfully.');
end;
$$;

-- 11. Admin: Convert / Assign Homepage Inquiry to Client Lead
create or replace function public.admin_convert_inquiry_to_client(
  p_inquiry_id uuid,
  p_worker_id uuid default null,
  p_service_type text default 'basic_site'
)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_inq public.inquiries%rowtype;
  v_client_id uuid;
begin
  select * into v_inq from public.inquiries where id = p_inquiry_id;
  if v_inq.id is null then
    return json_build_object('success', false, 'error', 'Inquiry not found.');
  end if;

  insert into public.clients (
    school_name, city, contact_name, contact_phone, contact_email,
    service_type, notes, worker_id, payment_status
  ) values (
    v_inq.school_name, v_inq.city, v_inq.contact_name, v_inq.contact_phone, v_inq.contact_email,
    p_service_type, v_inq.notes, p_worker_id, 'unpaid'
  )
  returning id into v_client_id;

  return json_build_object('success', true, 'client_id', v_client_id, 'message', 'Inquiry converted to client lead.');
end;
$$;

-- 11. Worker Dashboard Data RPC
create or replace function public.get_worker_dashboard(p_worker_id uuid)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_settings public.app_settings%rowtype;
  v_target public.worker_targets%rowtype;
  v_clients json;
  v_earned numeric := 0;
  v_awaiting numeric := 0;
  v_basic_site_paid_count integer := 0;
  v_ai_papers_paid_count integer := 0;
  v_both_paid_count integer := 0;
begin
  select * into v_settings from public.app_settings where id = 'global_config';
  
  -- Get today or latest target
  select * into v_target from public.worker_targets
  where worker_id = p_worker_id
  order by target_date desc limit 1;

  -- Calculate earnings from PAID clients only
  select
    coalesce(sum(case 
      when c.service_type = 'basic_site' then v_settings.worker_comm_basic_site
      when c.service_type = 'ai_papers' then v_settings.worker_comm_ai_papers
      when c.service_type in ('both', 'all') then v_settings.worker_comm_both
      else v_settings.worker_comm_basic_site
    end), 0),
    coalesce(count(*) filter (where c.service_type = 'basic_site'), 0),
    coalesce(count(*) filter (where c.service_type = 'ai_papers'), 0),
    coalesce(count(*) filter (where c.service_type in ('both', 'all')), 0)
  into v_earned, v_basic_site_paid_count, v_ai_papers_paid_count, v_both_paid_count
  from public.clients c
  where c.worker_id = p_worker_id and c.payment_status = 'paid';

  -- Calculate potential awaiting payment from UNPAID clients
  select
    coalesce(sum(case 
      when c.service_type = 'basic_site' then v_settings.worker_comm_basic_site
      when c.service_type = 'ai_papers' then v_settings.worker_comm_ai_papers
      when c.service_type in ('both', 'all') then v_settings.worker_comm_both
      else v_settings.worker_comm_basic_site
    end), 0)
  into v_awaiting
  from public.clients c
  where c.worker_id = p_worker_id and c.payment_status = 'unpaid';

  -- Fetch worker's client list
  select json_agg(row_to_json(t)) into v_clients
  from (
    select c.id, c.school_name, c.city, c.contact_name, c.contact_phone,
           c.service_type, c.payment_status, c.paid_amount, c.paid_at, c.created_at,
           case 
             when c.payment_status = 'paid' then
               case 
                 when c.service_type = 'basic_site' then v_settings.worker_comm_basic_site
                 when c.service_type = 'ai_papers' then v_settings.worker_comm_ai_papers
                 when c.service_type in ('both', 'all') then v_settings.worker_comm_both
                 else v_settings.worker_comm_basic_site
               end
             else 0
           end as commission_earned
    from public.clients c
    where c.worker_id = p_worker_id
    order by c.created_at desc
  ) t;

  return json_build_object(
    'target', case when v_target.id is not null then row_to_json(v_target) else null end,
    'settings', row_to_json(v_settings),
    'earnings', json_build_object(
      'total_earned', v_earned,
      'awaiting_payment', v_awaiting,
      'basic_site_paid_count', v_basic_site_paid_count,
      'ai_papers_paid_count', v_ai_papers_paid_count,
      'both_paid_count', v_both_paid_count
    ),
    'clients', coalesce(v_clients, '[]'::json)
  );
end;
$$;

-- 12. Admin Dashboard Data RPC
create or replace function public.get_admin_dashboard()
returns json language plpgsql security definer set search_path = public as $$
declare
  v_settings public.app_settings%rowtype;
  v_workers json;
  v_clients json;
  v_inquiries json;
  v_paid_total numeric := 0;
  v_unpaid_total numeric := 0;
begin
  select * into v_settings from public.app_settings where id = 'global_config';

  -- Calculate summary stats
  select coalesce(sum(paid_amount), 0) into v_paid_total from public.clients where payment_status = 'paid';
  v_paid_total := v_paid_total + coalesce((select sum(paid_amount) from public.inquiries where payment_status = 'paid'), 0);
  select coalesce(count(*), 0) into v_unpaid_total from public.clients where payment_status = 'unpaid';

  -- Fetch workers with latest targets and performance
  select json_agg(row_to_json(w_row)) into v_workers
  from (
    select w.id, w.worker_code, w.full_name, w.role, w.active, w.created_at,
           t.daily_target_count, t.daily_target_amount,
           t.weekly_target_count, t.weekly_target_amount, t.note as target_note,
           (select count(*) from public.clients c where c.worker_id = w.id and c.payment_status = 'paid') as paid_leads_count,
           (select count(*) from public.clients c where c.worker_id = w.id and c.payment_status = 'unpaid') as unpaid_leads_count
    from public.workers w
    left join lateral (
      select daily_target_count, daily_target_amount, weekly_target_count, weekly_target_amount, note
      from public.worker_targets wt
      where wt.worker_id = w.id
      order by wt.target_date desc limit 1
    ) t on true
    order by w.created_at desc
  ) w_row;

  -- Fetch clients with worker attribution
  select json_agg(row_to_json(c_row)) into v_clients
  from (
    select c.id, c.school_name, c.city, c.contact_name, c.contact_phone, c.contact_email,
           c.service_type, c.notes, c.payment_status, c.paid_amount, c.paid_at, c.created_at,
           w.worker_code, w.full_name as worker_name,
           case 
             when c.payment_status = 'paid' then
               case 
                 when c.service_type = 'basic_site' then v_settings.worker_comm_basic_site
                 when c.service_type = 'ai_papers' then v_settings.worker_comm_ai_papers
                 when c.service_type in ('both', 'all') then v_settings.worker_comm_both
                 else v_settings.worker_comm_basic_site
               end
             else 0
           end as worker_commission
    from public.clients c
    left join public.workers w on c.worker_id = w.id
    order by c.created_at desc
  ) c_row;

  -- Fetch inquiries
  select json_agg(row_to_json(i_row)) into v_inquiries
  from (
    select id, school_name, city, contact_name, contact_phone, contact_email,
           requested_services, total_amount, payment_status, paid_amount, paid_at, is_trial, notes, created_at
    from public.inquiries
    order by created_at desc
  ) i_row;

  return json_build_object(
    'settings', row_to_json(v_settings),
    'stats', json_build_object(
      'paid_revenue', v_paid_total,
      'unpaid_leads_count', v_unpaid_total
    ),
    'workers', coalesce(v_workers, '[]'::json),
    'clients', coalesce(v_clients, '[]'::json),
    'inquiries', coalesce(v_inquiries, '[]'::json)
  );
end;
$$;

-- Grant permissions for public/anon access to the defined secure RPC functions
grant usage on schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;
grant select, insert, update on public.inquiries to anon, authenticated;

-- Homepage visitors submit inquiries anonymously. RLS must explicitly allow the insert.
alter table public.inquiries enable row level security;

do $$
declare
  policy_name text;
begin
  for policy_name in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'inquiries'
  loop
    execute format('drop policy if exists %I on public.inquiries', policy_name);
  end loop;
end
$$;

create policy "Public can submit inquiries"
  on public.inquiries
  for insert
  to anon, authenticated
  with check (true);
