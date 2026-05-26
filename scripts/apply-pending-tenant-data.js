#!/usr/bin/env node
/**
 * Ajustes de datos multitenant vía service role (sin DDL).
 * Uso: node scripts/apply-pending-tenant-data.js
 */
require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const ws = require("ws");

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false },
  realtime: { transport: ws }
});

function mergeMetadata(existing, patch) {
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing) ? { ...existing } : {};
  return { ...base, ...patch };
}

function placeholderWhatsApp(slug) {
  const s = String(slug || "tenant")
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 12)
    .padEnd(8, "0");
  return `webonly${s}@placeholder.local`;
}

async function main() {
  const { data: rows, error } = await supabase
    .from("restaurants")
    .select("id, name, demo_slug, is_demo, demo_expires_at, whatsapp_number, metadata");
  if (error) throw error;

  const results = [];
  const extendDays = Number(process.env.VITE_DEFAULT_DEMO_EXPIRES_DAYS || 14) || 14;

  for (const r of rows || []) {
    const slug = r.demo_slug || "";
    const meta = r.metadata && typeof r.metadata === "object" ? r.metadata : {};
    const patch = {};
    let touchExpires = false;

    if (!meta.service_plan) {
      patch.service_plan = r.is_demo ? "full" : "web";
      patch.bot_whatsapp_enabled = patch.service_plan === "web" ? false : meta.bot_whatsapp_enabled !== false;
    }

    const plan = String(patch.service_plan || meta.service_plan || "full").toLowerCase();
    if (plan === "web") {
      patch.bot_whatsapp_enabled = false;
      if (!r.whatsapp_number || String(r.whatsapp_number).includes("placeholder")) {
        const ph = placeholderWhatsApp(slug || r.id);
        const { error: waErr } = await supabase
          .from("restaurants")
          .update({ whatsapp_number: ph })
          .eq("id", r.id);
        if (waErr) results.push({ slug, error: `whatsapp: ${waErr.message}` });
        else results.push({ slug, whatsapp_placeholder: ph });
      }
    }

    if (slug === "andy" && r.is_demo) {
      const exp = r.demo_expires_at ? new Date(r.demo_expires_at) : null;
      const soon = !exp || exp.getTime() < Date.now() + 7 * 86400000;
      if (soon) {
        const next = new Date();
        next.setDate(next.getDate() + extendDays);
        touchExpires = true;
        const { error: expErr } = await supabase
          .from("restaurants")
          .update({ demo_expires_at: next.toISOString() })
          .eq("id", r.id);
        if (expErr) results.push({ slug, error: `expires: ${expErr.message}` });
        else results.push({ slug, demo_expires_at: next.toISOString() });
      }
    }

    if (Object.keys(patch).length) {
      const newMeta = mergeMetadata(meta, patch);
      const { error: upErr } = await supabase
        .from("restaurants")
        .update({ metadata: newMeta })
        .eq("id", r.id);
      if (upErr) results.push({ slug: slug || r.name, error: upErr.message });
      else results.push({ slug: slug || r.name, metadata: patch });
    } else if (!touchExpires) {
      results.push({ slug: slug || r.name, skipped: true });
    }
  }

  console.log(JSON.stringify({ ok: true, count: rows?.length || 0, results }, null, 2));
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
