-- =============================================================================
-- Alta de un CLIENTE REAL (producción) — clonar menú desde plantilla
-- =============================================================================
-- Igual que demo_provision_new_demo.sql, pero:
--   is_demo = false
--   demo_expires_at = NULL  (sin vencimiento)
--   whatsapp_number = número real y único del local (obligatorio si hay UNIQUE)
--
-- Requisitos:
--   - demo_multi_tenant.sql ya ejecutado
--   - Rol postgres / service role en SQL Editor
--
-- Pasos:
--   1) Editá tpl, v_slug, v_name, v_plan, v_whatsapp (solo si v_plan = 'full') en el bloque DO.
--   2) Ejecutá una vez por cliente.
--   3) Creá usuario admin en dashboard_users con restaurant_id = UUID del NOTICE.
--   4) Probar: https://TU_DOMINIO/d/{v_slug}/login
-- =============================================================================

DO $$
DECLARE
  tpl uuid := '00000000-0000-0000-0000-000000000000'::uuid;
  v_slug text := 'mi-restaurante';
  v_name text := 'Mi Restaurante';
  v_whatsapp text := '56912345678';
  new_id uuid;
  n_menu int;
BEGIN
  IF tpl = '00000000-0000-0000-0000-000000000000'::uuid THEN
    RAISE EXCEPTION 'Configurá tpl con el UUID del restaurante plantilla.';
  END IF;

  IF length(trim(v_slug)) < 2 THEN
    RAISE EXCEPTION 'slug demasiado corto.';
  END IF;

  IF length(regexp_replace(v_whatsapp, '\D', '', 'g')) < 8 THEN
    RAISE EXCEPTION 'whatsapp_number inválido.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.restaurants
    WHERE lower(trim(demo_slug)) = lower(trim(v_slug))
  ) THEN
    RAISE EXCEPTION 'demo_slug ya existe: %', v_slug;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.restaurants
    WHERE regexp_replace(whatsapp_number, '\D', '', 'g')
      = regexp_replace(v_whatsapp, '\D', '', 'g')
  ) THEN
    RAISE EXCEPTION 'whatsapp_number ya está en uso.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.restaurants WHERE id = tpl) THEN
    RAISE EXCEPTION 'Plantilla no encontrada: %', tpl;
  END IF;

  INSERT INTO public.restaurants (
    name,
    public_name,
    whatsapp_number,
    opening_hours,
    policies,
    address,
    delivery_zones,
    delivery_enabled,
    local_enabled,
    mesa_enabled,
    cash_enabled,
    mercadopago_enabled,
    stats_enabled,
    table_count,
    metadata,
    demo_slug,
    demo_expires_at,
    is_demo
  )
  SELECT
    v_name,
    v_name,
    regexp_replace(v_whatsapp, '\D', '', 'g'),
    r.opening_hours,
    r.policies,
    r.address,
    r.delivery_zones,
    r.delivery_enabled,
    r.local_enabled,
    r.mesa_enabled,
    r.cash_enabled,
    r.mercadopago_enabled,
    r.stats_enabled,
    r.table_count,
    COALESCE(r.metadata, '{}'::jsonb),
    lower(trim(v_slug)),
    NULL,
    false
  FROM public.restaurants r
  WHERE r.id = tpl
  RETURNING id INTO new_id;

  INSERT INTO public.menu_items (
    restaurant_id,
    name,
    description,
    category,
    price,
    available
  )
  SELECT
    new_id,
    m.name,
    m.description,
    m.category,
    m.price,
    m.available
  FROM public.menu_items m
  WHERE m.restaurant_id = tpl;

  GET DIAGNOSTICS n_menu = ROW_COUNT;

  RAISE NOTICE 'Cliente creado: restaurant_id=% slug=% filas_menu=%', new_id, lower(trim(v_slug)), n_menu;
  RAISE NOTICE 'Siguiente: dashboard_users con restaurant_id=% → /d/%/login', new_id, lower(trim(v_slug));
END $$;
