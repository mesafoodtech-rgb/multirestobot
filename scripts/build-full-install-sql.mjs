#!/usr/bin/env node
/**
 * Genera dashboard/sql/RESTOBOT_FULL_INSTALL.sql concatenando base + migraciones.
 * Uso: node scripts/build-full-install-sql.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SQL_DIR = path.join(__dirname, "..", "dashboard", "sql");
const OUT = path.join(SQL_DIR, "RESTOBOT_FULL_INSTALL.sql");

const PARTS = [
  { file: "00_restobot_base_schema.sql", label: "BASE" },
  { file: "dashboard_users.sql", label: "dashboard_users" },
  { file: "dashboard_users_role_encargado.sql", label: "roles encargado" },
  { file: "restaurants_config_columns.sql", label: "restaurants config" },
  { file: "stock_manager_tables.sql", label: "stock" },
  { file: "stock_items_low_stock_threshold.sql", label: "stock threshold" },
  { file: "demo_multi_tenant.sql", label: "multi-tenant" },
  { file: "orders_columns_patch.sql", label: "orders patch" },
  { file: "orders_customer_chat_id.sql", label: "orders chat_id" },
  { file: "orders_customer_phone.sql", label: "orders phone" },
  { file: "orders_delivery_columns.sql", label: "orders delivery cols" },
  { file: "orders_delivery_denial_reason.sql", label: "orders denial" },
  { file: "orders_payment_paid_at.sql", label: "orders payment" },
  { file: "orders_pickup_ready_notify.sql", label: "orders pickup" },
  { file: "orders_delivery_dispatch.sql", label: "orders dispatch" },
  { file: "orders_delivery_total_confirmed_at.sql", label: "orders delivery confirm" },
  { file: "orders_kitchen_mesa.sql", label: "orders kitchen/mesa" },
  { file: "dashboard_users_delivery_schedule.sql", label: "delivery schedule" },
  { file: "rls_policies_restobot.sql", label: "RLS policies" },
  { file: "grants_api_roles_restobot.sql", label: "GRANTs" },
  { file: "rls_tenant_hardening_v1.sql", label: "RLS hardening" },
  { file: "rls_tenant_hardening_dashboard_users_legacy.sql", label: "RLS legacy policy drop", optional: true },
  { file: "tenant_service_plans.sql", label: "service plans comment" },
  { file: "realtime_setup.sql", label: "realtime" }
];

const header = `-- =============================================================================
-- RestoBot / multirestobot — INSTALACIÓN SQL COMPLETA
-- Generado por: node scripts/build-full-install-sql.mjs
-- Pegar en Supabase → SQL Editor → Run (proyecto vacío o re-ejecutar: idempotente).
--
-- NO incluye datos de menú ni restaurantes (ver demo_provision_*.sql / Maestro).
-- NO incluye: menu_seed_resto_illimani.sql, demo_cleanup_*, tenant_provision_*.sql
-- =============================================================================

`;

let body = header;

for (const part of PARTS) {
  const fp = path.join(SQL_DIR, part.file);
  if (!fs.existsSync(fp)) {
    if (part.optional) continue;
    throw new Error(`Falta archivo: ${part.file}`);
  }
  body += `\n-- ########## ${part.label} (${part.file}) ##########\n\n`;
  body += fs.readFileSync(fp, "utf8").trim();
  body += "\n\n";
}

fs.writeFileSync(OUT, body, "utf8");
console.log("OK →", OUT, "(" + body.length + " bytes)");
