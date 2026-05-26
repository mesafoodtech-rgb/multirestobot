-- =============================================================================
-- Planes de servicio por restaurante (web vs completo con WhatsApp)
-- Idempotente. La fuente de verdad operativa es restaurants.metadata:
--   service_plan: "web" | "full"
--   bot_whatsapp_enabled: false en plan web
-- =============================================================================

comment on column public.restaurants.metadata is
  'JSON: service_plan (web|full), bot_whatsapp_enabled, qr_menu_enabled, mesa_qr_enabled, etc.';

-- Verificación (solo lectura)
select id, name, demo_slug, is_demo, metadata->>'service_plan' as service_plan,
       metadata->>'bot_whatsapp_enabled' as bot_whatsapp_enabled
from public.restaurants
order by name;
