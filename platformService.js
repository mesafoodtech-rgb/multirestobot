const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { supabase, TABLES, createTenantFromTemplate } = require("./database");

const PLATFORM_USERS_TABLE = "platform_users";

const PLATFORM_ADMIN_EMAIL = String(process.env.PLATFORM_ADMIN_EMAIL || "")
  .trim()
  .toLowerCase();
const PLATFORM_ADMIN_PASSWORD = String(process.env.PLATFORM_ADMIN_PASSWORD || "").trim();
const PLATFORM_TEMPLATE_RESTAURANT_ID = String(
  process.env.PLATFORM_TEMPLATE_RESTAURANT_ID || process.env.TEMPLATE_RESTAURANT_ID || ""
).trim();
const PUBLIC_DEMO_EXPIRES_HOURS = Math.max(
  1,
  Math.min(168, Number(process.env.PUBLIC_DEMO_EXPIRES_HOURS || 24) || 24)
);
const PUBLIC_DASHBOARD_BASE_URL = String(process.env.PUBLIC_DASHBOARD_BASE_URL || "https://app.mesafood.shop")
  .trim()
  .replace(/\/+$/, "");
const PLATFORM_SESSION_SECRET = String(
  process.env.PLATFORM_SESSION_SECRET || process.env.MAESTRO_PASSWORD || process.env.VITE_MAESTRO_PASSWORD || ""
).trim();

const RESTAURANT_PATCH_COLUMNS = new Set([
  "delivery_enabled",
  "local_enabled",
  "mesa_enabled",
  "cash_enabled",
  "mercadopago_enabled",
  "stats_enabled",
  "is_demo",
  "demo_expires_at",
  "name",
  "public_name"
]);

const METADATA_PATCH_KEYS = new Set([
  "service_plan",
  "bot_whatsapp_enabled",
  "qr_menu_enabled",
  "mesa_qr_enabled",
  "orders_panel_enabled",
  "menu_panel_enabled",
  "settings_panel_enabled",
  "users_panel_enabled",
  "stock_panel_enabled",
  "billing_status",
  "owner_email",
  "owner_phone",
  "registration_source"
]);

function normalizeEmail(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase();
}

/** Mismo formato que el login del panel cuando el usuario ingresa su email. */
function emailToDashboardUsername(email) {
  const e = normalizeEmail(email);
  if (!e) return "";
  if (e.includes("@")) {
    return e.replace(/@/, "_at_").replace(/[^a-z0-9._-]/g, "").slice(0, 40);
  }
  return e.replace(/[^a-z0-9._-]/g, "").slice(0, 40);
}

function normalizePhone(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  return digits.length >= 8 ? digits : "";
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function timingSafeEqualString(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

function verifyPlatformAdminCredentials(email, password) {
  const normEmail = normalizeEmail(email);
  if (!PLATFORM_ADMIN_EMAIL || !PLATFORM_ADMIN_PASSWORD) {
    return { ok: false, error: "Plataforma sin credenciales de admin configuradas." };
  }
  if (!normEmail || normEmail !== PLATFORM_ADMIN_EMAIL) {
    return { ok: false, error: "Email o contraseña incorrectos." };
  }
  if (!timingSafeEqualString(String(password || ""), PLATFORM_ADMIN_PASSWORD)) {
    return { ok: false, error: "Email o contraseña incorrectos." };
  }
  return { ok: true };
}

function signPlatformToken(payload) {
  if (!PLATFORM_SESSION_SECRET) {
    throw new Error("Falta PLATFORM_SESSION_SECRET (o MAESTRO_PASSWORD) para sesiones de plataforma.");
  }
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", PLATFORM_SESSION_SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verifyPlatformToken(token) {
  if (!PLATFORM_SESSION_SECRET) {
    return { ok: false, error: "Servidor sin PLATFORM_SESSION_SECRET." };
  }
  const parts = String(token || "").split(".");
  if (parts.length !== 2) return { ok: false, error: "Token inválido." };
  const [body, sig] = parts;
  const expected = crypto.createHmac("sha256", PLATFORM_SESSION_SECRET).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, error: "Token inválido." };
  }
  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return { ok: false, error: "Token inválido." };
  }
  if (payload.sub !== "platform_admin") return { ok: false, error: "Token inválido." };
  if (!payload.exp || Date.now() > payload.exp) return { ok: false, error: "Sesión expirada." };
  return { ok: true, payload };
}

function createPlatformAdminToken() {
  const ttlMs = 24 * 60 * 60 * 1000;
  return signPlatformToken({
    sub: "platform_admin",
    iat: Date.now(),
    exp: Date.now() + ttlMs
  });
}

function extractBearerToken(req) {
  const h = String(req.headers.authorization || "").trim();
  if (!h.toLowerCase().startsWith("bearer ")) return "";
  return h.slice(7).trim();
}

function requirePlatformAuth(req) {
  const token = extractBearerToken(req);
  if (!token) return { ok: false, status: 401, error: "Falta Authorization: Bearer …" };
  const v = verifyPlatformToken(token);
  if (!v.ok) return { ok: false, status: 401, error: v.error || "No autorizado." };
  return { ok: true };
}

async function registerPublicDemo({ email, password, businessName, phone, slug }) {
  const normEmail = normalizeEmail(email);
  const pw = String(password || "");
  const name = String(businessName || "").trim();
  const phoneNorm = normalizePhone(phone);

  if (!PLATFORM_TEMPLATE_RESTAURANT_ID) {
    throw new Error("Servidor sin PLATFORM_TEMPLATE_RESTAURANT_ID configurado.");
  }
  if (!isValidEmail(normEmail)) {
    throw new Error("Email inválido.");
  }
  if (pw.length < 6) {
    throw new Error("Contraseña: mínimo 6 caracteres.");
  }
  if (name.length < 2) {
    throw new Error("Nombre del local demasiado corto.");
  }
  if (!phoneNorm) {
    throw new Error("Teléfono inválido (mínimo 8 dígitos).");
  }

  const { data: existing, error: exErr } = await supabase
    .from(PLATFORM_USERS_TABLE)
    .select("id")
    .eq("email", normEmail)
    .maybeSingle();
  if (exErr && exErr.code !== "42P01") {
    throw new Error(`No se pudo verificar email: ${exErr.message}`);
  }
  if (existing) {
    throw new Error("Ya existe una demo con ese email.");
  }

  const dashboardUsername = emailToDashboardUsername(normEmail);
  if (dashboardUsername.length < 3) {
    throw new Error("Email demasiado corto para generar usuario.");
  }

  const demoExpiresAt = new Date(Date.now() + PUBLIC_DEMO_EXPIRES_HOURS * 3600000).toISOString();

  const tenant = await createTenantFromTemplate({
    templateRestaurantId: PLATFORM_TEMPLATE_RESTAURANT_ID,
    tenantSlug: slug,
    tenantName: name,
    isDemo: true,
    expiresDays: 1,
    demoExpiresAtIso: demoExpiresAt,
    adminUsername: dashboardUsername,
    adminPassword: pw,
    servicePlan: "web"
  });

  const restaurantId = tenant.restaurantId;

  try {
    const { data: restRow, error: restErr } = await supabase
      .from(TABLES.restaurants)
      .select("metadata")
      .eq("id", restaurantId)
      .maybeSingle();
    if (restErr) throw new Error(restErr.message);

    const prevMeta =
      restRow?.metadata && typeof restRow.metadata === "object" && !Array.isArray(restRow.metadata)
        ? restRow.metadata
        : {};
    const nextMeta = {
      ...prevMeta,
      owner_email: normEmail,
      owner_phone: phoneNorm,
      billing_status: "demo",
      registration_source: "platform"
    };

    const { error: metaErr } = await supabase
      .from(TABLES.restaurants)
      .update({ metadata: nextMeta, demo_expires_at: demoExpiresAt })
      .eq("id", restaurantId);
    if (metaErr) throw new Error(metaErr.message);

    const passwordHash = bcrypt.hashSync(pw, 10);
    const { error: puErr } = await supabase.from(PLATFORM_USERS_TABLE).insert({
      email: normEmail,
      password_hash: passwordHash,
      restaurant_id: restaurantId,
      business_name: name,
      phone: phoneNorm,
      dashboard_username: dashboardUsername
    });
    if (puErr) {
      if (puErr.code === "42P01") {
        throw new Error(
          "Tabla platform_users no existe. Ejecutá npm run db:migrate o dashboard/sql/platform_users.sql."
        );
      }
      throw new Error(`No se pudo registrar la cuenta: ${puErr.message}`);
    }
  } catch (e) {
    await supabase.from(TABLES.restaurants).delete().eq("id", restaurantId);
    throw e;
  }

  const tenantSlug = tenant.tenantSlug || tenant.demoSlug;
  return {
    ok: true,
    email: normEmail,
    slug: tenantSlug,
    restaurantId,
    demoExpiresAt,
    dashboardUsername,
    loginUrl: `${PUBLIC_DASHBOARD_BASE_URL}/d/${encodeURIComponent(tenantSlug)}/login`,
    panelUrl: `${PUBLIC_DASHBOARD_BASE_URL}/d/${encodeURIComponent(tenantSlug)}`
  };
}

async function resolvePublicLogin({ email, password }) {
  const normEmail = normalizeEmail(email);
  const pw = String(password || "");
  if (!normEmail || pw.length < 1) {
    return { ok: false, error: "Email y contraseña requeridos." };
  }

  const { data, error } = await supabase
    .from(PLATFORM_USERS_TABLE)
    .select("id, password_hash, restaurant_id, dashboard_username, email")
    .eq("email", normEmail)
    .maybeSingle();

  if (error) {
    if (error.code === "42P01") {
      return { ok: false, error: "Registro de plataforma no disponible." };
    }
    return { ok: false, error: error.message };
  }
  if (!data) {
    return { ok: false, error: "Email o contraseña incorrectos." };
  }

  let bcryptOk = false;
  try {
    bcryptOk = bcrypt.compareSync(pw, String(data.password_hash || ""));
  } catch {
    bcryptOk = false;
  }
  if (!bcryptOk) {
    return { ok: false, error: "Email o contraseña incorrectos." };
  }

  const { data: rest, error: rErr } = await supabase
    .from(TABLES.restaurants)
    .select("demo_slug, demo_expires_at, is_demo, name")
    .eq("id", data.restaurant_id)
    .maybeSingle();
  if (rErr || !rest?.demo_slug) {
    return { ok: false, error: "Tenant no encontrado." };
  }
  if (rest.demo_expires_at && new Date(rest.demo_expires_at).getTime() < Date.now()) {
    return { ok: false, error: "Tu demo venció. Contactá al equipo para activar tu plan.", code: "demo_expired" };
  }

  const slug = rest.demo_slug;
  return {
    ok: true,
    email: data.email,
    slug,
    restaurantId: data.restaurant_id,
    businessName: rest.name,
    demoExpiresAt: rest.demo_expires_at,
    dashboardUsername: data.dashboard_username,
    loginUrl: `${PUBLIC_DASHBOARD_BASE_URL}/d/${encodeURIComponent(slug)}/login`,
    panelUrl: `${PUBLIC_DASHBOARD_BASE_URL}/d/${encodeURIComponent(slug)}`
  };
}

async function listPlatformTenants() {
  const { data: restaurants, error: rErr } = await supabase
    .from(TABLES.restaurants)
    .select(
      "id, name, public_name, demo_slug, demo_expires_at, is_demo, delivery_enabled, local_enabled, mesa_enabled, cash_enabled, mercadopago_enabled, stats_enabled, metadata, created_at"
    )
    .not("demo_slug", "is", null)
    .order("created_at", { ascending: false });
  if (rErr) throw new Error(rErr.message);

  const { data: owners, error: oErr } = await supabase
    .from(PLATFORM_USERS_TABLE)
    .select("email, phone, business_name, restaurant_id, dashboard_username, created_at");
  if (oErr && oErr.code !== "42P01") throw new Error(oErr.message);

  const ownerByRest = new Map((owners || []).map((o) => [o.restaurant_id, o]));

  return (restaurants || []).map((r) => {
    const owner = ownerByRest.get(r.id);
    const meta =
      r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata) ? r.metadata : {};
    const expired =
      r.demo_expires_at != null && new Date(r.demo_expires_at).getTime() < Date.now();
    return {
      id: r.id,
      name: r.name,
      slug: r.demo_slug,
      isDemo: Boolean(r.is_demo),
      demoExpiresAt: r.demo_expires_at,
      demoExpired: expired,
      servicePlan: meta.service_plan || (meta.bot_whatsapp_enabled === false ? "web" : "full"),
      billingStatus: meta.billing_status || (r.is_demo ? "demo" : "active"),
      ownerEmail: owner?.email || meta.owner_email || null,
      ownerPhone: owner?.phone || meta.owner_phone || null,
      flags: {
        delivery_enabled: r.delivery_enabled,
        local_enabled: r.local_enabled,
        mesa_enabled: r.mesa_enabled,
        cash_enabled: r.cash_enabled,
        mercadopago_enabled: r.mercadopago_enabled,
        stats_enabled: r.stats_enabled
      },
      metadata: meta,
      createdAt: r.created_at,
      panelUrl: r.demo_slug
        ? `${PUBLIC_DASHBOARD_BASE_URL}/d/${encodeURIComponent(r.demo_slug)}`
        : null
    };
  });
}

async function patchPlatformTenant(restaurantId, patch) {
  const rid = String(restaurantId || "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rid)) {
    throw new Error("restaurantId inválido.");
  }
  if (!patch || typeof patch !== "object") {
    throw new Error("Patch vacío.");
  }

  const { data: current, error: cErr } = await supabase
    .from(TABLES.restaurants)
    .select("*")
    .eq("id", rid)
    .maybeSingle();
  if (cErr) throw new Error(cErr.message);
  if (!current) throw new Error("Tenant no encontrado.");

  const rowPatch = {};
  for (const [k, v] of Object.entries(patch)) {
    if (RESTAURANT_PATCH_COLUMNS.has(k)) rowPatch[k] = v;
  }

  const metaIn = patch.metadata && typeof patch.metadata === "object" ? patch.metadata : {};
  const prevMeta =
    current.metadata && typeof current.metadata === "object" && !Array.isArray(current.metadata)
      ? current.metadata
      : {};
  const nextMeta = { ...prevMeta };
  for (const [k, v] of Object.entries(metaIn)) {
    if (METADATA_PATCH_KEYS.has(k)) nextMeta[k] = v;
  }
  for (const [k, v] of Object.entries(patch)) {
    if (METADATA_PATCH_KEYS.has(k)) nextMeta[k] = v;
  }
  if (Object.keys(metaIn).length || Object.keys(patch).some((k) => METADATA_PATCH_KEYS.has(k))) {
    rowPatch.metadata = nextMeta;
  }

  if (patch.activate === true) {
    rowPatch.is_demo = false;
    rowPatch.demo_expires_at = null;
    nextMeta.billing_status = nextMeta.billing_status === "demo" ? "active" : nextMeta.billing_status || "active";
    rowPatch.metadata = nextMeta;
  }

  if (!Object.keys(rowPatch).length) {
    throw new Error("Nada que actualizar (campos no permitidos).");
  }

  const { data: updated, error: uErr } = await supabase
    .from(TABLES.restaurants)
    .update(rowPatch)
    .eq("id", rid)
    .select("id, name, demo_slug, demo_expires_at, is_demo, metadata")
    .single();
  if (uErr) throw new Error(uErr.message);

  return { ok: true, tenant: updated };
}

module.exports = {
  emailToDashboardUsername,
  verifyPlatformAdminCredentials,
  createPlatformAdminToken,
  requirePlatformAuth,
  registerPublicDemo,
  resolvePublicLogin,
  listPlatformTenants,
  patchPlatformTenant,
  PUBLIC_DASHBOARD_BASE_URL
};
