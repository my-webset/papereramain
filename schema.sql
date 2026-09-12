-- ════════════════════════════════════════════════════════════
--  PAPERERA — Complete Supabase SQL Schema
--  Run this in your Supabase Project → SQL Editor → New Query
-- ════════════════════════════════════════════════════════════

-- 1. Orders Table
create table if not exists public.paperera_orders (
  id          text primary key,
  timestamp   timestamptz not null default now(),
  type        text not null default 'payment',
  school      text,
  place       text,
  contact     text,
  amount      numeric(10,2) default 0,
  status      text not null default 'pending',
  details     jsonb default '{}'::jsonb
);

-- Indexes for lightning fast searching & sorting
create index if not exists idx_paperera_orders_type      on public.paperera_orders(type);
create index if not exists idx_paperera_orders_status    on public.paperera_orders(status);
create index if not exists idx_paperera_orders_timestamp on public.paperera_orders(timestamp desc);
create index if not exists idx_paperera_orders_contact   on public.paperera_orders(contact);
create index if not exists idx_paperera_orders_school    on public.paperera_orders(school);

-- 2. Configuration Key-Value Table (stores prices, UPI ID, QR code)
create table if not exists public.paperera_kv (
  key         text primary key,
  value       text not null,
  updated_at  timestamptz default now()
);

-- 3. Row Level Security (RLS)
alter table public.paperera_orders enable row level security;
alter table public.paperera_kv enable row level security;

-- Allow public read & write via Anon Key
drop policy if exists "Public can read orders" on public.paperera_orders;
create policy "Public can read orders"
  on public.paperera_orders for select
  using (true);

drop policy if exists "Public can insert orders" on public.paperera_orders;
create policy "Public can insert orders"
  on public.paperera_orders for insert
  with check (true);

drop policy if exists "Public can update orders" on public.paperera_orders;
create policy "Public can update orders"
  on public.paperera_orders for update
  using (true);

drop policy if exists "Public can delete orders" on public.paperera_orders;
create policy "Public can delete orders"
  on public.paperera_orders for delete
  using (true);

drop policy if exists "Public can read kv" on public.paperera_kv;
create policy "Public can read kv"
  on public.paperera_kv for select
  using (true);

drop policy if exists "Public can write kv" on public.paperera_kv;
create policy "Public can write kv"
  on public.paperera_kv for all
  using (true)
  with check (true);
