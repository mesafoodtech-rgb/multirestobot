/** metadata.*_panel_enabled — ausente o true = pestaña visible; false = oculta. */

export function readOrdersPanelEnabled(metadata) {
  return metadata?.orders_panel_enabled !== false;
}

export function readMenuPanelEnabled(metadata) {
  return metadata?.menu_panel_enabled !== false;
}

export function readSettingsPanelEnabled(metadata) {
  return metadata?.settings_panel_enabled !== false;
}

export function readUsersPanelEnabled(metadata) {
  return metadata?.users_panel_enabled !== false;
}

const ADMIN_TAB_ORDER = [
  "orders",
  "menu",
  "qrmenu",
  "mesaqr",
  "stock",
  "stats",
  "users",
  "settings",
  "maestro"
];

export function isAdminTabEnabled(tab, ctx) {
  switch (tab) {
    case "orders":
      return ctx.ordersPanelEnabled;
    case "menu":
      return ctx.menuPanelEnabled;
    case "qrmenu":
      return ctx.canAccessFullAdminPanel && ctx.qrMenuEnabled;
    case "mesaqr":
      return ctx.canAccessFullAdminPanel && ctx.mesaQrEnabled;
    case "stock":
      return ctx.canAccessFullAdminPanel && ctx.stockPanelEnabled;
    case "stats":
      return ctx.canAccessFullAdminPanel && ctx.statsEnabled;
    case "users":
      return ctx.canAccessFullAdminPanel && ctx.usersPanelEnabled;
    case "settings":
      return ctx.canAccessFullAdminPanel && ctx.settingsPanelEnabled;
    case "maestro":
      return ctx.isMaestro;
    default:
      return false;
  }
}

export function pickFirstEnabledAdminTab(ctx) {
  for (const tab of ADMIN_TAB_ORDER) {
    if (isAdminTabEnabled(tab, ctx)) return tab;
  }
  return null;
}
