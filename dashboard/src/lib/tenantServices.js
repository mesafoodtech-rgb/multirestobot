/** Planes comerciales / técnicos por restaurante (metadata.service_plan). */

export const SERVICE_PLAN_WEB = "web";
export const SERVICE_PLAN_FULL = "full";

export const SERVICE_PLAN_OPTIONS = [
  {
    id: SERVICE_PLAN_WEB,
    label: "Web (carta QR + mesa + panel)",
    short: "Solo web",
    description:
      "Menú público, pedidos por QR de mesa y panel operativo. Sin bot de WhatsApp ni sesión wwebjs."
  },
  {
    id: SERVICE_PLAN_FULL,
    label: "Completo (+ bot WhatsApp)",
    short: "Web + WA",
    description: "Todo lo web más bot de pedidos por WhatsApp (requiere número y despliegue del bot)."
  }
];

export function normalizeServicePlan(raw) {
  const v = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (v === SERVICE_PLAN_WEB || v === "solo_web" || v === "qr") return SERVICE_PLAN_WEB;
  if (v === SERVICE_PLAN_FULL || v === "completo" || v === "whatsapp" || v === "wa") {
    return SERVICE_PLAN_FULL;
  }
  return SERVICE_PLAN_FULL;
}

export function readServicePlanFromMetadata(metadata) {
  const m = metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : {};
  if (m.service_plan) return normalizeServicePlan(m.service_plan);
  if (m.bot_whatsapp_enabled === false) return SERVICE_PLAN_WEB;
  return SERVICE_PLAN_FULL;
}

export function tenantUsesWhatsappBot(metadataOrRestaurant) {
  const meta =
    metadataOrRestaurant?.metadata != null
      ? metadataOrRestaurant.metadata
      : metadataOrRestaurant;
  const plan = readServicePlanFromMetadata(meta);
  if (plan === SERVICE_PLAN_WEB) return false;
  const m = meta && typeof meta === "object" && !Array.isArray(meta) ? meta : {};
  return m.bot_whatsapp_enabled !== false;
}

export function servicePlanLabel(plan) {
  const p = normalizeServicePlan(plan);
  return SERVICE_PLAN_OPTIONS.find((o) => o.id === p)?.short || p;
}

/** Metadata base al dar de alta un tenant según plan. */
export function metadataForServicePlan(templateMetadata, servicePlan) {
  const plan = normalizeServicePlan(servicePlan);
  const base =
    templateMetadata && typeof templateMetadata === "object" && !Array.isArray(templateMetadata)
      ? { ...templateMetadata }
      : {};
  delete base.public_dashboard_base_url;

  base.service_plan = plan;
  base.qr_menu_enabled = base.qr_menu_enabled !== false;
  base.mesa_qr_enabled = base.mesa_qr_enabled !== false;

  if (plan === SERVICE_PLAN_WEB) {
    base.bot_whatsapp_enabled = false;
    base.bot_enforce_opening_hours = false;
    base.bot_runtime_switches_visible = false;
  } else {
    if (base.bot_whatsapp_enabled === undefined) base.bot_whatsapp_enabled = true;
  }

  return base;
}
