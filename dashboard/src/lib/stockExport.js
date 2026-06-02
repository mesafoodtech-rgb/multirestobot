import { downloadCsv } from "./statsConfig";
import {
  formatStockThresholdLabel,
  getEffectiveLowStockThreshold,
  isStockItemLow,
  normalizeStockUnit
} from "./stockAlerts";

function formatQuantity(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "0";
  if (Math.abs(numeric - Math.round(numeric)) < 0.0001) return String(Math.round(numeric));
  return numeric.toFixed(3).replace(/\.?0+$/, "");
}

export function stockRowsForCsv(stockItems) {
  return (stockItems || []).map((item) => {
    const unit = normalizeStockUnit(item?.unit);
    const threshold = getEffectiveLowStockThreshold(item);
    const low = isStockItemLow(item);
    return [
      item?.id || "",
      String(item?.name || "").trim(),
      formatQuantity(item?.current_stock),
      unit,
      formatStockThresholdLabel(item),
      String(threshold),
      low ? "SI" : "NO"
    ];
  });
}

export const STOCK_CSV_HEADERS = [
  "id",
  "ingrediente",
  "stock_actual",
  "unidad",
  "umbral_etiqueta",
  "umbral_numero",
  "alerta_bajo_stock"
];

export function downloadStockCsv(stockItems) {
  const stamp = new Date().toISOString().slice(0, 10);
  downloadCsv(`stock-${stamp}.csv`, STOCK_CSV_HEADERS, stockRowsForCsv(stockItems));
}

export function unavailableMenuRowsForCsv(menuItems) {
  return (menuItems || [])
    .filter((item) => item && item.available === false)
    .map((item) => [
      item.id || "",
      String(item.name || "").trim(),
      String(item.category || "").trim(),
      item.price != null ? String(item.price) : "",
      String(item.description || "").replace(/\s+/g, " ").trim()
    ]);
}

export const UNAVAILABLE_MENU_CSV_HEADERS = [
  "id",
  "producto",
  "categoria",
  "precio",
  "descripcion"
];

export function downloadUnavailableMenuCsv(menuItems) {
  const stamp = new Date().toISOString().slice(0, 10);
  const rows = unavailableMenuRowsForCsv(menuItems);
  downloadCsv(`productos-agotados-${stamp}.csv`, UNAVAILABLE_MENU_CSV_HEADERS, rows);
}
