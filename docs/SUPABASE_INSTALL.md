# Instalación de base de datos (Supabase nueva)

## Un solo SQL (recomendado)

1. Abrí [Supabase](https://supabase.com/dashboard) → tu proyecto **nuevo** → **SQL Editor**.
2. Abrí en el repo: `dashboard/sql/RESTOBOT_FULL_INSTALL.sql`.
3. Copiá **todo** el archivo → pegá en el editor → **Run**.

Eso crea tablas, columnas, RLS, permisos `anon`/`authenticated`, endurecimiento de `dashboard_users` y Realtime en `orders`.

Regenerar el archivo unificado:

```bash
node scripts/build-full-install-sql.mjs
```

## Qué incluye / qué no

| Incluido | No incluido (después, a mano) |
|----------|-------------------------------|
| `restaurants`, `menu_items`, `orders`, `bot_interactions` | Filas de restaurantes ni menú |
| `dashboard_users` + stock | Usuario admin (hash bcrypt) |
| Multitenant (`demo_slug`, `restaurant_id`) | Copia desde base vieja (`pg_dump`) |
| Planes en `metadata` (comentario) | `menu_seed_resto_illimani.sql` |

## Estado proyecto `zqlkvgweofwvxdzmngxl`

Esquema aplicado vía Supabase MCP (migraciones + datos semilla). Ver tenants en Supabase Table Editor.

## Después del SQL

1. Actualizá `.env` con URL y claves del proyecto **nuevo**.
2. Creá el primer local:
   - **Panel Maestro** (`/maestro`) → crear demo/cliente, o
   - `dashboard/sql/tenant_provision_production.sql` / `demo_provision_new_demo.sql`.
3. Reiniciá bot y dashboard:

```bash
cd /root/multirestobot
docker compose build multirestobot && docker compose up -d
```

Panel: http://127.0.0.1:5183 — API bot: http://127.0.0.1:3011

## Si migrás datos desde la base vieja

No uses solo este SQL: hacé `pg_dump` / `pg_restore` de la base antigua y luego, si falta algo, `npm run db:migrate` contra la nueva.
