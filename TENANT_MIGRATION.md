# Migración multitenant — operación

## Estado en Supabase (aplicado vía API)

- Esquema `demo_slug`, `is_demo`, `restaurant_id` en usuarios: **ya existía**.
- Restaurante producción `67ed61eb-…`: slug **`restaurante-demo`** → `/d/restaurante-demo/login`
- Usuarios panel legado (`admin`, `encargado`, etc.): **`restaurant_id`** asignado a ese restaurante.

## Datos (sin Postgres)

```bash
node scripts/apply-pending-tenant-data.js
```

Ajusta `service_plan`, placeholder WhatsApp en plan web y extiende `demo_expires_at` del demo `andy` si vence pronto.

## Pendiente (requiere contraseña de Postgres)

En `.env` del servidor (bot Node):

```env
# Supabase → Project Settings → Database → Connection string (URI)
SUPABASE_DB_URL=postgresql://postgres.[ref]:[PASSWORD]@db.[ref].supabase.co:5432/postgres
```

Luego:

```bash
npm run db:migrate
# o
curl -X POST http://127.0.0.1:3011/api/maestro/run-migrations \
  -H 'Content-Type: application/json' \
  -d '{"maestroPassword":"TU_MAESTRO_PASSWORD"}'
```

Eso aplica SQL pendiente, sobre todo `dashboard/sql/rls_tenant_hardening_v1.sql` (quita lectura anon de `dashboard_users`).

## Alta cliente real (sin demo)

Panel Maestro → crear con `tenantMode: "production"` o SQL `tenant_provision_production.sql`.

API `POST /api/maestro/create-demo` acepta:

```json
{
  "tenantMode": "production",
  "templateRestaurantId": "uuid-plantilla",
  "demoSlug": "mi-local",
  "demoName": "Mi Local",
  "adminUsername": "admin",
  "adminPassword": "······",
  "whatsappNumber": "56912345678"
}
```

## Planes de servicio (precios / módulos)

Ver [docs/TENANT_SERVICES_AND_STORAGE.md](docs/TENANT_SERVICES_AND_STORAGE.md).

- **`web`**: carta QR, mesa, panel — sin bot ni wwebjs.
- **`full`**: lo anterior + WhatsApp (número real + proceso/carpeta propios).

Maestro al crear demo/cliente: selector de plan. API: `"servicePlan": "web" | "full"`.

Variable `WHATSAPP_BOT_ENABLED=0` en el `.env` del servidor: solo API web, sin arrancar Chromium.

## Código desplegado

- Filtro `restaurant_id` en mutaciones del dashboard (`withRestaurantScope`).
- `POST /api/dashboard/validate-session` (revalidación sin anon en `dashboard_users`).
- `POST /api/maestro/run-migrations` (SQL con `pg`).
