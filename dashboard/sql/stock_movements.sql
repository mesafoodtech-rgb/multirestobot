-- Historial de movimientos de inventario (ingredientes).
create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  stock_item_id uuid references public.stock_items(id) on delete set null,
  ingredient_name text,
  movement_type text not null check (
    movement_type in ('adjustment', 'recipe_use', 'replenish', 'delete')
  ),
  quantity_before numeric not null default 0,
  quantity_after numeric not null default 0,
  delta numeric not null default 0,
  unit text not null default 'UNIDAD',
  reference_label text,
  created_at timestamptz not null default now()
);

create index if not exists stock_movements_restaurant_created_idx
  on public.stock_movements (restaurant_id, created_at desc);

alter table public.stock_movements enable row level security;

drop policy if exists "restobot_stock_movements_anon_all" on public.stock_movements;
create policy "restobot_stock_movements_anon_all"
  on public.stock_movements for all to anon using (true) with check (true);

drop policy if exists "restobot_stock_movements_auth_all" on public.stock_movements;
create policy "restobot_stock_movements_auth_all"
  on public.stock_movements for all to authenticated using (true) with check (true);

grant select, insert on table public.stock_movements to anon, authenticated;
