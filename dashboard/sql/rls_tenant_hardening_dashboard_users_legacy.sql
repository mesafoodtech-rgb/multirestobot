-- Complemento de rls_tenant_hardening_v1.sql: quita la política permisiva inicial
-- creada en dashboard_users.sql ("dashboard_users_allow_all").
drop policy if exists "dashboard_users_allow_all" on public.dashboard_users;
