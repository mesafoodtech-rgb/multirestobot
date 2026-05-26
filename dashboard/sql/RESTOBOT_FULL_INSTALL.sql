-- =============================================================================
-- RestoBot / multirestobot — INSTALACIÓN SQL COMPLETA
-- Generado por: node scripts/build-full-install-sql.mjs
-- Pegar en Supabase → SQL Editor → Run (proyecto vacío o re-ejecutar: idempotente).
--
-- NO incluye datos de menú ni restaurantes (ver demo_provision_*.sql / Maestro).
-- NO incluye: menu_seed_resto_illimani.sql, demo_cleanup_*, tenant_provision_*.sql
-- =============================================================================


-- ########## BASE (00_restobot_base_schema.sql) ##########

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


-- ########## dashboard_users (dashboard_users.sql) ##########

-- Usuarios del dashboard (admin / delivery). Ejecutar en Supabase SQL Editor.
-- Las contraseñas se guardan con bcrypt (hash en columna password_hash).
-- La política RLS es permisiva para la clave anon del frontend: en producción
-- conviene restringir (p. ej. Supabase Auth o Edge Functions con service role).

create table if not exists public.dashboard_users (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  password_hash text not null,
  role text not null check (role in ('admin', 'encargado', 'delivery', 'kitchen', 'waiter')),
  label text,
  is_active boolean not null default true,
  delivery_work_weekdays integer[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists dashboard_users_username_lower_idx
  on public.dashboard_users (lower(username));

alter table public.dashboard_users enable row level security;

drop policy if exists "dashboard_users_allow_all" on public.dashboard_users;
create policy "dashboard_users_allow_all"
  on public.dashboard_users
  for all
  using (true)
  with check (true);

comment on table public.dashboard_users is 'Cuentas para login del dashboard RestoBot (bcrypt).';
comment on column public.dashboard_users.delivery_work_weekdays is
  'Solo rol delivery: días permitidos para login (0–6, Date.getDay). NULL = todos los días.';


-- ########## roles encargado (dashboard_users_role_encargado.sql) ##########

-- Añade rol `encargado` (debajo de admin: solo pedidos + gestor de menú en el dashboard).
-- Ejecutar en Supabase SQL Editor después de dashboard_users.sql.

alter table public.dashboard_users drop constraint if exists dashboard_users_role_check;

alter table public.dashboard_users add constraint dashboard_users_role_check
  check (role in ('admin', 'delivery', 'kitchen', 'waiter', 'encargado'));


-- ########## restaurants config (restaurants_config_columns.sql) ##########

-- Columnas de configuracion editable por restaurante (dashboard).
-- Reemplazan los datos hardcoded del prompt de IA (`ia_service.js`).
-- Idempotente: re-ejecutable sin riesgo.

alter table public.restaurants
  add column if not exists public_name text,
  add column if not exists address text,
  add column if not exists delivery_zones text,
  add column if not exists delivery_enabled boolean not null default true,
  add column if not exists local_enabled boolean not null default true,
  add column if not exists mesa_enabled boolean not null default true,
  add column if not exists cash_enabled boolean not null default true,
  add column if not exists mercadopago_enabled boolean not null default true,
  add column if not exists stats_enabled boolean not null default true,
  add column if not exists table_count integer not null default 12;

-- `opening_hours` y `policies` ya existian; quedan como estan.

-- Politica RLS para que el dashboard (clave anon) pueda actualizar la fila
-- del restaurante. SELECT ya esta cubierto en rls_policies_restobot.sql.
-- Si no usas RLS aun, esta sentencia falla silenciosa al re-ejecutarse.

drop policy if exists "restobot_restaurants_anon_update" on public.restaurants;
create policy "restobot_restaurants_anon_update"
  on public.restaurants for update to anon using (true) with check (true);

drop policy if exists "restobot_restaurants_auth_update" on public.restaurants;
create policy "restobot_restaurants_auth_update"
  on public.restaurants for update to authenticated using (true) with check (true);

-- Verificacion (solo lectura)
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'restaurants'
  and column_name in ('public_name','address','delivery_zones','delivery_enabled','local_enabled','mesa_enabled','cash_enabled','mercadopago_enabled','stats_enabled','table_count','opening_hours','policies','name','whatsapp_number')
order by column_name;


-- ########## stock (stock_manager_tables.sql) ##########

-- Tablas para Gestor de stock y Recetario del dashboard.
-- Idempotente: se puede re-ejecutar sin perder datos existentes.

create table if not exists public.stock_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  current_stock numeric not null default 0 check (current_stock >= 0),
  unit text not null default 'UNIDAD',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (restaurant_id, name)
);

create table if not exists public.stock_recipes (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  preparation text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (restaurant_id, name)
);

create table if not exists public.stock_recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.stock_recipes(id) on delete cascade,
  ingredient_name text not null,
  quantity numeric not null default 1 check (quantity > 0),
  unit text not null default 'UNIDAD',
  created_at timestamp with time zone not null default now(),
  unique (recipe_id, ingredient_name)
);

alter table public.stock_items
  add column if not exists unit text not null default 'UNIDAD';

alter table public.stock_items
  add column if not exists low_stock_threshold numeric check (low_stock_threshold is null or low_stock_threshold >= 0);

alter table public.stock_items
  alter column current_stock type numeric using current_stock::numeric;

alter table public.stock_recipe_ingredients
  add column if not exists unit text not null default 'UNIDAD';

alter table public.stock_recipe_ingredients
  add column if not exists quantity numeric not null default 1;

update public.stock_items
set unit = case
  when upper(unit) in ('GR', 'GRS', 'GRAMO', 'GRAMOS') then 'G'
  when upper(unit) in ('LITRO', 'LITROS', 'LT') then 'L'
  when upper(unit) in ('MILILITRO', 'MILILITROS') then 'ML'
  else upper(unit)
end;

update public.stock_recipe_ingredients
set unit = case
  when upper(unit) in ('GR', 'GRS', 'GRAMO', 'GRAMOS') then 'G'
  when upper(unit) in ('LITRO', 'LITROS', 'LT') then 'L'
  when upper(unit) in ('MILILITRO', 'MILILITROS') then 'ML'
  else upper(unit)
end;

update public.stock_items
set name = translate(name, 'ÁÉÍÓÚáéíóú', 'AEIOUAEIOU')
where name <> translate(name, 'ÁÉÍÓÚáéíóú', 'AEIOUAEIOU');

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.stock_items to anon, authenticated;
grant select, insert, update, delete on table public.stock_recipes to anon, authenticated;
grant select, insert, update, delete on table public.stock_recipe_ingredients to anon, authenticated;

alter table public.stock_items enable row level security;
alter table public.stock_recipes enable row level security;
alter table public.stock_recipe_ingredients enable row level security;

drop policy if exists "restobot_stock_items_anon_all" on public.stock_items;
create policy "restobot_stock_items_anon_all"
  on public.stock_items for all to anon using (true) with check (true);

drop policy if exists "restobot_stock_items_auth_all" on public.stock_items;
create policy "restobot_stock_items_auth_all"
  on public.stock_items for all to authenticated using (true) with check (true);

drop policy if exists "restobot_stock_recipes_anon_all" on public.stock_recipes;
create policy "restobot_stock_recipes_anon_all"
  on public.stock_recipes for all to anon using (true) with check (true);

drop policy if exists "restobot_stock_recipes_auth_all" on public.stock_recipes;
create policy "restobot_stock_recipes_auth_all"
  on public.stock_recipes for all to authenticated using (true) with check (true);

drop policy if exists "restobot_stock_recipe_ingredients_anon_all" on public.stock_recipe_ingredients;
create policy "restobot_stock_recipe_ingredients_anon_all"
  on public.stock_recipe_ingredients for all to anon using (true) with check (true);

drop policy if exists "restobot_stock_recipe_ingredients_auth_all" on public.stock_recipe_ingredients;
create policy "restobot_stock_recipe_ingredients_auth_all"
  on public.stock_recipe_ingredients for all to authenticated using (true) with check (true);

select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('stock_items', 'stock_recipes', 'stock_recipe_ingredients')
order by table_name;


-- ########## stock threshold (stock_items_low_stock_threshold.sql) ##########

-- Umbral de alerta personalizado por ingrediente (null = default según unidad en el dashboard).
alter table public.stock_items
  add column if not exists low_stock_threshold numeric check (low_stock_threshold is null or low_stock_threshold >= 0);


-- ########## multi-tenant (demo_multi_tenant.sql) ##########

-- =============================================================================
-- RestoBot — multi-tenant demos (URL /d/{demo_slug}/…)
-- Ejecutar en Supabase → SQL Editor. Idempotente.
-- =============================================================================
-- Después de aplicar:
-- 1) Asigná demo_slug único a cada restaurante demo (ej. 'cliente-acme').
-- 2) Poné demo_expires_at si querés caducidad automática (ver demo_cleanup_expired.sql).
-- 3) Actualizá dashboard_users.restaurant_id = <uuid del restaurante> por usuario.
-- =============================================================================

-- ---------- restaurants ----------
alter table public.restaurants
  add column if not exists demo_slug text,
  add column if not exists demo_expires_at timestamptz,
  add column if not exists is_demo boolean not null default false;

comment on column public.restaurants.demo_slug is
  'Slug público: rutas /d/{slug}/login, /d/{slug}/carta, etc. Minúsculas, sin espacios.';
comment on column public.restaurants.demo_expires_at is
  'Si no null y < now(), el demo se considera vencido (bloqueo en app + limpieza opcional).';
comment on column public.restaurants.is_demo is
  'True si esta fila es una instancia de demo (operación interna).';

drop index if exists restaurants_demo_slug_lower_idx;
create unique index restaurants_demo_slug_lower_idx
  on public.restaurants (lower(trim(demo_slug)))
  where demo_slug is not null and length(trim(demo_slug)) > 0;

-- ---------- dashboard_users: pertenencia al restaurante ----------
alter table public.dashboard_users
  add column if not exists restaurant_id uuid references public.restaurants(id) on delete cascade;

comment on column public.dashboard_users.restaurant_id is
  'Restaurante al que pertenece el usuario del panel. Null = legado (único tenant).';

-- Unicidad: (restaurant_id, username) por demo; username global único solo si restaurant_id es null.
drop index if exists dashboard_users_username_lower_idx;
drop index if exists dashboard_users_restaurant_username_lower_idx;
drop index if exists dashboard_users_username_lower_legacy_idx;

create unique index dashboard_users_restaurant_username_lower_idx
  on public.dashboard_users (restaurant_id, lower(username))
  where restaurant_id is not null;

create unique index dashboard_users_username_lower_legacy_idx
  on public.dashboard_users (lower(username))
  where restaurant_id is null;

-- Verificación
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'restaurants'
  and column_name in ('demo_slug', 'demo_expires_at', 'is_demo')
order by column_name;

select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'dashboard_users'
  and column_name = 'restaurant_id';


-- ########## orders patch (orders_columns_patch.sql) ##########

alter table public.orders
  add column if not exists address text,
  add column if not exists total_price numeric(12,2),
  add column if not exists payment_method text,
  add column if not exists payment_status text,
  add column if not exists status text default 'pending';


-- ########## orders chat_id (orders_customer_chat_id.sql) ##########

-- Guardar el chatId original de WhatsApp (`message.from`) en cada pedido.
-- Esto evita "No LID for user" en cuentas multidispositivo: cuando el bot
-- inicia un mensaje (notifier de delivery), usa este id directo y no tiene
-- que adivinar entre @c.us / @lid.
alter table public.orders
  add column if not exists customer_chat_id text;


-- ########## orders phone (orders_customer_phone.sql) ##########

-- Agrega columna `customer_phone` a `orders`.
--
-- Motivo: cuando el cliente tiene activada la privacidad del numero en
-- WhatsApp, `message.from` viene como `<lid>@lid` y `customer_number` queda
-- guardado como LID (no sirve para llamar/WhatsApp desde el dashboard).
-- `customer_phone` guarda el telefono real resuelto via `message.getContact()`
-- cuando esta disponible. Si no, queda NULL y el dashboard cae al
-- customer_number con la heuristica de "parece telefono".
--
-- Idempotente: podes re-ejecutarlo sin riesgo.

alter table public.orders
  add column if not exists customer_phone text;

comment on column public.orders.customer_phone is
  'Telefono real del cliente (E.164 sin signos). Se completa cuando el LID se resuelve a un numero. Para pedidos viejos puede ser NULL.';


-- ########## orders delivery cols (orders_delivery_columns.sql) ##########

-- Paso 1: columnas delivery + totales (ejecutar en Supabase SQL Editor si aún no están)
alter table public.orders
  add column if not exists fulfillment_type text,
  add column if not exists subtotal_amount numeric(12,2),
  add column if not exists delivery_fee numeric(12,2),
  add column if not exists final_total_amount numeric(12,2),
  add column if not exists payment_link text,
  add column if not exists customer_notified_at timestamptz;


-- ########## orders denial (orders_delivery_denial_reason.sql) ##########

-- Motivo cuando el local no puede hacer delivery a la dirección (texto libre, mostrado al cliente por WhatsApp).
alter table public.orders
  add column if not exists delivery_denial_reason text;


-- ########## orders payment (orders_payment_paid_at.sql) ##########

-- Columnas para registrar pagos (efectivo / Mercado Pago) y cierre del pedido
-- (entregado / cancelado). Idempotente: se puede re-ejecutar sin riesgo.
-- Ejecutar en Supabase SQL Editor.

alter table public.orders
  add column if not exists payment_paid_at timestamptz,
  add column if not exists mp_payment_id text,
  add column if not exists delivered_at timestamptz,
  add column if not exists cancelled_at timestamptz;

create index if not exists orders_payment_status_idx
  on public.orders (payment_status);

create index if not exists orders_payment_method_idx
  on public.orders (payment_method);


-- ########## orders pickup (orders_pickup_ready_notify.sql) ##########

-- Retiro en local: el admin pide avisar al cliente; el bot envía WhatsApp y marca notificado.
-- Idempotente. Ejecutar en Supabase SQL Editor.

alter table public.orders
  add column if not exists pickup_ready_notify_requested_at timestamptz,
  add column if not exists pickup_ready_customer_notified_at timestamptz;

create index if not exists orders_pickup_ready_pending_idx
  on public.orders (pickup_ready_notify_requested_at)
  where pickup_ready_customer_notified_at is null;


-- ########## orders dispatch (orders_delivery_dispatch.sql) ##########

-- Despacho multi-repartidor: aviso desde admin, un repartidor toma el pedido, reporte de incidencias.
-- Ejecutar en Supabase SQL Editor (idempotente).

alter table public.orders
  add column if not exists delivery_ready_broadcast_at timestamptz,
  add column if not exists delivery_claimed_by_user_id uuid references public.dashboard_users (id) on delete set null,
  add column if not exists delivery_claimed_at timestamptz,
  add column if not exists delivery_issue_reported_at timestamptz,
  add column if not exists delivery_issue_reason text,
  add column if not exists delivery_issue_reported_by_user_id uuid references public.dashboard_users (id) on delete set null,
  add column if not exists delivery_en_route_customer_notified_at timestamptz,
  add column if not exists delivery_issue_acknowledged_at timestamptz;

create index if not exists orders_delivery_pool_idx
  on public.orders (restaurant_id, delivery_ready_broadcast_at)
  where delivery_claimed_by_user_id is null and delivery_ready_broadcast_at is not null;


-- ########## orders delivery confirm (orders_delivery_total_confirmed_at.sql) ##########

-- Marca de confirmación del total delivery + efectivo (sustituye el texto en notes).
alter table public.orders
  add column if not exists delivery_total_confirmed_at timestamptz null;

comment on column public.orders.delivery_total_confirmed_at is
  'Cliente confirmó el total con envío (efectivo); evita depender de texto en notes.';


-- ########## orders kitchen/mesa (orders_kitchen_mesa.sql) ##########

-- Cocina / mozo: mesa y momento en que cocina marcó el pedido como listo.
-- Ejecutar en Supabase SQL Editor (idempotente).

alter table public.orders
  add column if not exists table_number integer,
  add column if not exists kitchen_ready_at timestamptz;

comment on column public.orders.table_number is 'Número de mesa (pedidos desde mozo o asignación manual).';
comment on column public.orders.kitchen_ready_at is 'Cocina marcó el pedido listo para entrega/retiro/delivery.';

-- Ampliar roles del panel (antes solo admin, delivery)
alter table public.dashboard_users
  drop constraint if exists dashboard_users_role_check;

alter table public.dashboard_users
  add constraint dashboard_users_role_check
  check (role in ('admin', 'delivery', 'kitchen', 'waiter'));


-- ########## delivery schedule (dashboard_users_delivery_schedule.sql) ##########

-- Días permitidos para login de cuentas `delivery` (0=domingo … 6=sábado, igual que Date.getDay en JS).
-- NULL = puede entrar cualquier día (comportamiento anterior).
-- Ejecutar en Supabase SQL Editor si ya tenías la tabla `dashboard_users`.

alter table public.dashboard_users
  add column if not exists delivery_work_weekdays integer[];

comment on column public.dashboard_users.delivery_work_weekdays is
  'Solo delivery: días en los que puede iniciar sesión (0–6). NULL = todos los días.';


-- ########## RLS policies (rls_policies_restobot.sql) ##########

-- Políticas RLS — Paso 2 (dashboard con clave anon)
-- Ejecutá TODO este archivo en Supabase → SQL Editor (idempotente: podés re-ejecutar).
-- Después corré `rls_step2_verify.sql` para comprobar políticas y RLS sin tocar datos.
--
-- El bot Node debería usar SUPABASE_SERVICE_ROLE_KEY (no pasa por RLS).
-- El dashboard Vite usa SUPABASE_KEY (anon): si RLS está ON, hace falta estas políticas.
--
-- Seguridad: USING (true) permite a cualquiera con la clave anon leer/escribir esas tablas.
-- Para producción pública endurecé (auth, por restaurant_id, etc.).

-- ---------- restaurants ----------
alter table public.restaurants enable row level security;

drop policy if exists "restobot_restaurants_anon_select" on public.restaurants;
create policy "restobot_restaurants_anon_select"
  on public.restaurants for select to anon using (true);

drop policy if exists "restobot_restaurants_auth_select" on public.restaurants;
create policy "restobot_restaurants_auth_select"
  on public.restaurants for select to authenticated using (true);

-- UPDATE: necesario para guardar configuración (Admin → pestaña Configuración).
-- (También definidas en restaurants_config_columns.sql; conviven por DROP IF EXISTS.)
drop policy if exists "restobot_restaurants_anon_update" on public.restaurants;
create policy "restobot_restaurants_anon_update"
  on public.restaurants for update to anon using (true) with check (true);

drop policy if exists "restobot_restaurants_auth_update" on public.restaurants;
create policy "restobot_restaurants_auth_update"
  on public.restaurants for update to authenticated using (true) with check (true);

-- ---------- menu_items ----------
alter table public.menu_items enable row level security;

drop policy if exists "restobot_menu_items_anon_all" on public.menu_items;
create policy "restobot_menu_items_anon_all"
  on public.menu_items for all to anon using (true) with check (true);

drop policy if exists "restobot_menu_items_auth_all" on public.menu_items;
create policy "restobot_menu_items_auth_all"
  on public.menu_items for all to authenticated using (true) with check (true);

-- ---------- bot_interactions (nombre por defecto del proyecto) ----------
alter table public.bot_interactions enable row level security;

drop policy if exists "restobot_interactions_anon_select" on public.bot_interactions;
create policy "restobot_interactions_anon_select"
  on public.bot_interactions for select to anon using (true);

drop policy if exists "restobot_interactions_anon_insert" on public.bot_interactions;
create policy "restobot_interactions_anon_insert"
  on public.bot_interactions for insert to anon with check (true);

drop policy if exists "restobot_interactions_auth_select" on public.bot_interactions;
create policy "restobot_interactions_auth_select"
  on public.bot_interactions for select to authenticated using (true);

drop policy if exists "restobot_interactions_auth_insert" on public.bot_interactions;
create policy "restobot_interactions_auth_insert"
  on public.bot_interactions for insert to authenticated with check (true);

-- ---------- orders ----------
alter table public.orders enable row level security;

drop policy if exists "restobot_orders_anon_select" on public.orders;
create policy "restobot_orders_anon_select"
  on public.orders for select to anon using (true);

drop policy if exists "restobot_orders_anon_insert" on public.orders;
create policy "restobot_orders_anon_insert"
  on public.orders for insert to anon with check (true);

drop policy if exists "restobot_orders_anon_update" on public.orders;
create policy "restobot_orders_anon_update"
  on public.orders for update to anon using (true) with check (true);

drop policy if exists "restobot_orders_auth_select" on public.orders;
create policy "restobot_orders_auth_select"
  on public.orders for select to authenticated using (true);

drop policy if exists "restobot_orders_auth_insert" on public.orders;
create policy "restobot_orders_auth_insert"
  on public.orders for insert to authenticated with check (true);

drop policy if exists "restobot_orders_auth_update" on public.orders;
create policy "restobot_orders_auth_update"
  on public.orders for update to authenticated using (true) with check (true);

-- ---------- stock_items ----------
alter table public.stock_items enable row level security;

drop policy if exists "restobot_stock_items_anon_all" on public.stock_items;
create policy "restobot_stock_items_anon_all"
  on public.stock_items for all to anon using (true) with check (true);

drop policy if exists "restobot_stock_items_auth_all" on public.stock_items;
create policy "restobot_stock_items_auth_all"
  on public.stock_items for all to authenticated using (true) with check (true);

-- ---------- stock_recipes ----------
alter table public.stock_recipes enable row level security;

drop policy if exists "restobot_stock_recipes_anon_all" on public.stock_recipes;
create policy "restobot_stock_recipes_anon_all"
  on public.stock_recipes for all to anon using (true) with check (true);

drop policy if exists "restobot_stock_recipes_auth_all" on public.stock_recipes;
create policy "restobot_stock_recipes_auth_all"
  on public.stock_recipes for all to authenticated using (true) with check (true);

-- ---------- stock_recipe_ingredients ----------
alter table public.stock_recipe_ingredients enable row level security;

drop policy if exists "restobot_stock_recipe_ingredients_anon_all" on public.stock_recipe_ingredients;
create policy "restobot_stock_recipe_ingredients_anon_all"
  on public.stock_recipe_ingredients for all to anon using (true) with check (true);

drop policy if exists "restobot_stock_recipe_ingredients_auth_all" on public.stock_recipe_ingredients;
create policy "restobot_stock_recipe_ingredients_auth_all"
  on public.stock_recipe_ingredients for all to authenticated using (true) with check (true);

-- =============================================================================
-- Verificación (solo lectura; seguro re-ejecutar)
-- =============================================================================

-- Políticas creadas para anon/authenticated en las tablas del dashboard
select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd as operation
from pg_policies
where schemaname = 'public'
  and tablename in ('orders', 'menu_items', 'restaurants', 'bot_interactions', 'stock_items', 'stock_recipes', 'stock_recipe_ingredients')
  and policyname like 'restobot_%'
order by tablename, policyname;

-- RLS encendido en esas tablas (relrowsecurity = true)
select
  n.nspname as schema,
  c.relname as table,
  c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in ('orders', 'menu_items', 'restaurants', 'bot_interactions', 'stock_items', 'stock_recipes', 'stock_recipe_ingredients')
order by c.relname;


-- ########## GRANTs (grants_api_roles_restobot.sql) ##########

-- Permisos GRANT para roles API de Supabase (`anon`, `authenticated`).
-- PostgREST exige privilegio en la tabla además de las políticas RLS.
-- Si SELECT funciona pero UPDATE falla con "permission denied", ejecutá este archivo.
-- Idempotente: repetir GRANT es seguro.

grant usage on schema public to anon, authenticated;

grant select, update on table public.restaurants to anon, authenticated;

grant select, insert, update, delete on table public.menu_items to anon, authenticated;

grant select, insert, update on table public.orders to anon, authenticated;

grant select, insert on table public.bot_interactions to anon, authenticated;

grant select, insert, update, delete on table public.dashboard_users to anon, authenticated;

grant select, insert, update, delete on table public.stock_items to anon, authenticated;

grant select, insert, update, delete on table public.stock_recipes to anon, authenticated;

grant select, insert, update, delete on table public.stock_recipe_ingredients to anon, authenticated;


-- ########## RLS hardening (rls_tenant_hardening_v1.sql) ##########

-- =============================================================================
-- RLS — endurecimiento tenant (v1)
-- Idempotente. Ejecutar con rol postgres o vía scripts/supabase-migrate.js
-- =============================================================================
-- Objetivo:
--   · El panel ya no debe leer dashboard_users con anon (login/revalidación vía API Node).
--   · Lecturas públicas de menú siguen permitidas (carta / QR).
-- =============================================================================

-- ---------- dashboard_users: quitar acceso anon ----------
drop policy if exists "restobot_dashboard_users_anon_select" on public.dashboard_users;
drop policy if exists "restobot_dashboard_users_anon_insert" on public.dashboard_users;
drop policy if exists "restobot_dashboard_users_anon_update" on public.dashboard_users;
drop policy if exists "restobot_dashboard_users_anon_delete" on public.dashboard_users;

revoke select, insert, update, delete on table public.dashboard_users from anon;

-- authenticated (si usás Supabase Auth en el futuro)
drop policy if exists "restobot_dashboard_users_auth_select" on public.dashboard_users;
drop policy if exists "restobot_dashboard_users_auth_insert" on public.dashboard_users;
drop policy if exists "restobot_dashboard_users_auth_update" on public.dashboard_users;
drop policy if exists "restobot_dashboard_users_auth_delete" on public.dashboard_users;

create policy "restobot_dashboard_users_auth_select"
  on public.dashboard_users for select to authenticated using (true);

create policy "restobot_dashboard_users_auth_insert"
  on public.dashboard_users for insert to authenticated with check (true);

create policy "restobot_dashboard_users_auth_update"
  on public.dashboard_users for update to authenticated using (true) with check (true);

create policy "restobot_dashboard_users_auth_delete"
  on public.dashboard_users for delete to authenticated using (true);

-- Service role / postgres no usan estas políticas (bypass RLS).


-- ########## RLS legacy policy drop (rls_tenant_hardening_dashboard_users_legacy.sql) ##########

-- Complemento de rls_tenant_hardening_v1.sql: quita la política permisiva inicial
-- creada en dashboard_users.sql ("dashboard_users_allow_all").
drop policy if exists "dashboard_users_allow_all" on public.dashboard_users;


-- ########## service plans comment (tenant_service_plans.sql) ##########

-- =============================================================================
-- Planes de servicio por restaurante (web vs completo con WhatsApp)
-- Idempotente. La fuente de verdad operativa es restaurants.metadata:
--   service_plan: "web" | "full"
--   bot_whatsapp_enabled: false en plan web
-- =============================================================================

comment on column public.restaurants.metadata is
  'JSON: service_plan (web|full), bot_whatsapp_enabled, qr_menu_enabled, orders_panel_enabled, menu_panel_enabled, settings_panel_enabled, users_panel_enabled, etc.';

-- Verificación (solo lectura)
select id, name, demo_slug, is_demo, metadata->>'service_plan' as service_plan,
       metadata->>'bot_whatsapp_enabled' as bot_whatsapp_enabled
from public.restaurants
order by name;


-- ########## realtime (realtime_setup.sql) ##########

-- Habilita Supabase Realtime para que el dashboard reciba pedidos nuevos
-- sin necesidad de refrescar la pagina. Ejecutar UNA vez en:
--   Supabase → SQL Editor → New query → pegar y Run.
-- Es idempotente: se puede correr varias veces sin romper nada.

-- 1) Asegura que la publicacion "supabase_realtime" exista (en Supabase suele venir creada,
--    pero por las dudas la creamos vacia si no esta).
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end
$$;

-- 2) Agrega la tabla orders a la publicacion solo si aun no esta, para evitar el error
--    "relation is already member of publication".
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end
$$;

-- 3) REPLICA IDENTITY FULL hace que los eventos UPDATE viajen con toda la fila en payload.new.
--    Sin esto, los cambios de estado podrian llegar incompletos al cliente.
alter table public.orders replica identity full;

-- Opcional: si tambien queres que el menu_items cambie en vivo (precios, disponibilidad)
-- descomenta las lineas siguientes:
-- do $$
-- begin
--   if not exists (
--     select 1
--     from pg_publication_tables
--     where pubname = 'supabase_realtime'
--       and schemaname = 'public'
--       and tablename = 'menu_items'
--   ) then
--     alter publication supabase_realtime add table public.menu_items;
--   end if;
-- end
-- $$;
-- alter table public.menu_items replica identity full;

-- Verificacion rapida: deberia listar "orders" (y "menu_items" si lo activaste).
select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
order by tablename;

