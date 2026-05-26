# MCP Supabase en Cursor

## Configuración

Archivo: `.cursor/mcp.json` (no se commitea; está en `.gitignore`).

Servidor oficial: `https://mcp.supabase.com/mcp`

## Proyecto nuevo

Si creaste otro proyecto en Supabase, cambiá `project_ref` en la URL del MCP y en `.env`:

```text
https://mcp.supabase.com/mcp?project_ref=zqlkvgweofwvxdzmngxl&features=database,docs,debugging,development
```

El ref sale de la URL del dashboard: `https://supabase.com/dashboard/project/TU_REF_NUEVO`.

## Activar en Cursor (una vez)

1. **Cursor Settings** → **Tools & MCP** (o **Features → MCP**).
2. Debería aparecer **supabase**; activalo si está apagado.
3. La primera vez te pedirá **iniciar sesión en Supabase** (OAuth en el navegador) y elegir la organización.
4. Reiniciá Cursor o recargá la ventana si no aparecen las herramientas.

## Sin OAuth (opcional)

Personal Access Token: [Account → Access Tokens](https://supabase.com/dashboard/account/tokens).

Algunos clientes aceptan variable de entorno `SUPABASE_ACCESS_TOKEN` en la config MCP; el servidor hosted suele preferir OAuth.

## Seguridad

- Revisá cada llamada a herramientas antes de aprobarla.
- En proyecto de producción, usá modo read-only si el asistente de conexión lo ofrece.
