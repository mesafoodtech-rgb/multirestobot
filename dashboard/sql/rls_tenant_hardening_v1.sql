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
