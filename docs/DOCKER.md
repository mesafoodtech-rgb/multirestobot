# Docker — multirestobot

Este repo es **multirestobot**, independiente del despliegue **restobot** en `/root/restobot`.

## Servicios

| Servicio Compose | Contenedor | Puerto host |
|------------------|------------|-------------|
| `multirestobot` | `multirestobot-whatsapp` | **3011** → 3000 (API / bot) |
| `dashboard` | `multirestobot-dashboard` | **5183** → 5173 (panel Vite) |

Puertos distintos a restobot (3001 / 5173) para poder correr ambos en el mismo servidor.

## Comandos

```bash
cd /root/multirestobot
docker compose build multirestobot
docker compose up -d
docker compose logs -f multirestobot-whatsapp
docker compose restart multirestobot dashboard
```

- Panel: http://127.0.0.1:5183  
- API bot: http://127.0.0.1:3011  

## WhatsApp (wwebjs)

En `.env`:

```env
WWEBJS_CLIENT_ID=multirestobot-main
WWEBJS_AUTH_PATH=.wwebjs_auth
```

La sesión queda en `./.wwebjs_auth/multirestobot-main/` (o la carpeta que defina `WWEBJS_CLIENT_ID`).

## Varios clientes plan FULL (3+ contenedores WhatsApp)

Modelo recomendado:

1. **Un contenedor `api`** — `WHATSAPP_BOT_ENABLED=0`, puerto **3011**. Atiende dashboard, mesa, maestro, login.
2. **Un contenedor `dashboard`** — puerto **5183**, proxy → `http://api:3000`.
3. **Un contenedor `wa-<slug>` por cliente full** — cada uno con su carpeta `wwebjs_auth/<slug>` y su QR.

Plantilla lista para 3 locales: [`docker-compose.full-tenants.example.yml`](../docker-compose.full-tenants.example.yml).

```bash
cp docker-compose.full-tenants.example.yml docker-compose.override.yml
# Editar slugs (deben coincidir con demo_slug en Supabase)
mkdir -p wwebjs_auth/pizzeria-centro wwebjs_auth/sushi-norte wwebjs_auth/bar-sur
docker compose build api
docker compose up -d
docker compose logs -f wa-pizzeria-centro   # QR del teléfono de ese local
```

En Supabase, por cada local full:

- `demo_slug` = mismo string que `WWEBJS_CLIENT_ID` (ej. `pizzeria-centro`)
- `whatsapp_number` = número real que conectás en **ese** contenedor (único en la tabla)
- `metadata.service_plan` = `full`

Clientes **solo web** no llevan servicio `wa-*` (cero Chromium extra).

Ver también `docker-compose.bot-tenant.example.yml` (un solo bot de ejemplo).
