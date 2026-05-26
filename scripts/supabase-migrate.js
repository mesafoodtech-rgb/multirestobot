/**
 * Ejecuta migraciones SQL idempotentes contra Postgres (Supabase).
 * Requiere SUPABASE_DB_URL o SUPABASE_DB_PASSWORD (+ SUPABASE_URL para armar la URL).
 */
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const SQL_DIR = path.join(__dirname, "..", "dashboard", "sql");

/** Orden documentado en RESTOBOT_FEATURE_PARITY_RUN_ORDER.sql + hardening. */
const MIGRATION_FILES = [
  "dashboard_users.sql",
  "dashboard_users_role_encargado.sql",
  "restaurants_config_columns.sql",
  "stock_manager_tables.sql",
  "stock_items_low_stock_threshold.sql",
  "demo_multi_tenant.sql",
  "orders_columns_patch.sql",
  "orders_customer_chat_id.sql",
  "orders_customer_phone.sql",
  "orders_delivery_columns.sql",
  "orders_delivery_denial_reason.sql",
  "orders_payment_paid_at.sql",
  "orders_pickup_ready_notify.sql",
  "orders_delivery_dispatch.sql",
  "orders_delivery_total_confirmed_at.sql",
  "orders_kitchen_mesa.sql",
  "dashboard_users_delivery_schedule.sql",
  "rls_policies_restobot.sql",
  "grants_api_roles_restobot.sql",
  "rls_tenant_hardening_v1.sql",
  "rls_tenant_hardening_dashboard_users_legacy.sql",
  "tenant_service_plans.sql",
  "realtime_setup.sql"
];

function resolveDatabaseUrl() {
  const direct = String(process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || "").trim();
  if (direct) return direct;

  const password = String(process.env.SUPABASE_DB_PASSWORD || "").trim();
  const supabaseUrl = String(process.env.SUPABASE_URL || "").trim();
  const ref = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
  if (!password || !ref) return null;

  const host = String(process.env.SUPABASE_DB_HOST || `db.${ref}.supabase.co`).trim();
  const port = String(process.env.SUPABASE_DB_PORT || "5432").trim();
  const user = String(process.env.SUPABASE_DB_USER || "postgres").trim();
  const database = String(process.env.SUPABASE_DB_NAME || "postgres").trim();
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

async function ensureMigrationsTable(client) {
  await client.query(`
    create table if not exists public.restobot_schema_migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    );
  `);
}

async function isApplied(client, filename) {
  const { rows } = await client.query(
    "select 1 from public.restobot_schema_migrations where filename = $1 limit 1",
    [filename]
  );
  return rows.length > 0;
}

async function markApplied(client, filename) {
  await client.query(
    "insert into public.restobot_schema_migrations (filename) values ($1) on conflict do nothing",
    [filename]
  );
}

async function runMigrationFile(client, filename) {
  const fullPath = path.join(SQL_DIR, filename);
  if (!fs.existsSync(fullPath)) {
    return { filename, skipped: true, reason: "file_missing" };
  }
  const sql = fs.readFileSync(fullPath, "utf8");
  try {
    await client.query(sql);
  } catch (err) {
    const msg = String(err.message || err);
    if (/already exists|duplicate|42710|42P07/i.test(msg)) {
      await markApplied(client, filename);
      return { filename, applied: true, note: "idempotent_skip" };
    }
    throw new Error(`${filename}: ${msg}`);
  }
  await markApplied(client, filename);
  return { filename, applied: true };
}

async function runSupabaseMigrations(options = {}) {
  const connectionString = resolveDatabaseUrl();
  if (!connectionString) {
    throw new Error(
      "Falta SUPABASE_DB_URL o SUPABASE_DB_PASSWORD (y SUPABASE_URL). " +
        "Copiá la connection string desde Supabase → Project Settings → Database."
    );
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: options.timeoutMs || 20000
  });

  await client.connect();
  try {
    await ensureMigrationsTable(client);
    const results = [];
    for (const file of MIGRATION_FILES) {
      if (await isApplied(client, file)) {
        results.push({ filename: file, skipped: true, reason: "already_applied" });
        continue;
      }
      results.push(await runMigrationFile(client, file));
    }
    return { ok: true, results };
  } finally {
    await client.end();
  }
}

module.exports = {
  MIGRATION_FILES,
  resolveDatabaseUrl,
  runSupabaseMigrations
};
