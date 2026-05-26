# Planes de servicio y almacenamiento del bot

## Planes

| Plan (`metadata.service_plan`) | Incluye | WhatsApp / wwebjs |
|--------------------------------|---------|-------------------|
| `web` | Carta pública (`/d/{slug}/menu`), mesa QR, panel admin/cocina/mozo, pedidos web | **No** |
| `full` | Todo lo anterior + bot de pedidos por WhatsApp | **Sí** (número real + proceso del bot) |

En plan **web**:

- `metadata.bot_whatsapp_enabled = false` (el bot ignora ese restaurante aunque compartan Supabase).
- No hace falta carpeta `.wwebjs_auth` ni contenedor extra para ese cliente.
- En BD se guarda un `whatsapp_number` **placeholder** único (solo para `UNIQUE` en la tabla), no es un número operativo.

En plan **full**:

- Número de WhatsApp real y único por restaurante.
- El proceso Node que atiende ese número debe usar su **propia sesión** de WhatsApp Web (ver abajo).

## Almacenamiento (por qué no mezclar clientes)

Hoy un despliegue típico tiene **una** sesión en:

- `WWEBJS_AUTH_PATH` (ej. `.wwebjs_auth`)
- `WWEBJS_CLIENT_ID` (ej. `multirestobot-main`)

Esa carpeta guarda cookies/sesión de **un solo** teléfono. Los clientes **solo web** no usan esa carpeta.

Cuando varios locales quieren **bot**, cada uno con su número necesita **aislamiento**:

```text
.wwebjs_auth/
  multirestobot-main/     ← un número (ej. primer cliente full)
  cliente-a/              ← otro número
  cliente-b/
```

Recomendación operativa: **un servicio Docker por restaurante con bot**, cada uno con:

```yaml
environment:
  WWEBJS_CLIENT_ID: cliente-a
  WWEBJS_AUTH_PATH: /app/.wwebjs_auth
volumes:
  - ./wwebjs_auth/cliente-a:/app/.wwebjs_auth
```

Los tenants `web` no llevan ese servicio → **cero** uso de disco wwebjs para ellos.

## Alta desde Maestro

Al crear demo/cliente, elegí **Plan web** o **Completo (+ WhatsApp)**.

API `POST /api/maestro/create-demo`:

```json
{
  "servicePlan": "web",
  "tenantMode": "production",
  "templateRestaurantId": "...",
  "demoSlug": "mi-local",
  "demoName": "Mi Local",
  "adminUsername": "admin",
  "adminPassword": "······"
}
```

Para `full` en producción, además: `"whatsappNumber": "569..."`.

## Migrar un local existente a solo web

En Supabase (metadata):

```sql
update public.restaurants
set metadata = coalesce(metadata, '{}'::jsonb)
  || '{"service_plan":"web","bot_whatsapp_enabled":false}'::jsonb
where demo_slug = 'mi-local';
```
