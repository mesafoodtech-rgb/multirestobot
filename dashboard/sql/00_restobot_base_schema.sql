-- =============================================================================
-- RestoBot / multirestobot — esquema BASE (tablas núcleo)
-- Ejecutar PRIMERO en un proyecto Supabase vacío, antes de las migraciones.
-- Idempotente (create if not exists / add column if not exists).
-- =============================================================================

create extension if not exists "pgcrypto";

-- ---------- restaurants ----------
create table if not exists public.restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  whatsapp_number text not null,
  opening_hours jsonb,
  policies jsonb,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists restaurants_whatsapp_number_idx
  on public.restaurants (whatsapp_number);

comment on table public.restaurants is 'Locales / tenants del bot y del panel.';

-- ---------- menu_items ----------
create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  description text,
  category text,
  price numeric(12, 2) not null default 0,
  tags jsonb default '[]'::jsonb,
  available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists menu_items_restaurant_id_idx
  on public.menu_items (restaurant_id);

-- ---------- orders ----------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  customer_number text,
  bot_number text,
  items jsonb not null default '[]'::jsonb,
  notes text,
  address text,
  status text not null default 'pending',
  payment_method text,
  payment_status text,
  total_price numeric(12, 2),
  total_amount numeric(12, 2),
  raw_request jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_restaurant_id_created_at_idx
  on public.orders (restaurant_id, created_at desc);

-- ---------- bot_interactions (nombre por defecto: bot_interactions) ----------
create table if not exists public.bot_interactions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references public.restaurants(id) on delete cascade,
  customer_number text,
  bot_number text,
  message_type text default 'text',
  user_message text,
  bot_response text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists bot_interactions_restaurant_customer_idx
  on public.bot_interactions (restaurant_id, customer_number, created_at desc);

-- Columnas usadas por el código pero sin migración suelta en el repo
alter table public.orders
  add column if not exists scheduled_delivery_at timestamptz;

comment on column public.orders.scheduled_delivery_at is
  'Entrega programada (mozo / delivery manual desde panel).';
