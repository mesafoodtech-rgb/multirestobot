-- Cuentas de registro self-serve (mesafood.shop → demo 24h).
-- Una fila por email; enlaza al tenant en restaurants.

create table if not exists public.platform_users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  password_hash text not null,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  business_name text not null,
  phone text,
  dashboard_username text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists platform_users_email_lower_idx
  on public.platform_users (lower(email));

create unique index if not exists platform_users_restaurant_id_idx
  on public.platform_users (restaurant_id);

comment on table public.platform_users is
  'Dueños registrados desde la landing; 1 demo por email. Login panel con dashboard_username (email normalizado).';
