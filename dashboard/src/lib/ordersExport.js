import {
  callableCustomerPhone,
  effectiveOrderTotal,
  formatGroupedItemLine,
  formatOrderStatusLabelEs,
  formatPaymentStatusLabelEs,
  formatPhoneLabel,
  subtotalForOrder,
  tableNumberLabel
} from "./format";
import { downloadCsv } from "./statsConfig";

const EXPORT_PAGE_SIZE = 500;
const EXPORT_MAX_ROWS = 10_000;

function formatOrderDateTime(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("es-AR", {
      dateStyle: "short",
      timeStyle: "short"
    });
  } catch {
    return String(iso);
  }
}

function paymentMethodLabel(order) {
  const pm = String(order?.payment_method || "").toLowerCase();
  if (pm.includes("mercado") || pm === "mp") return "Mercado Pago";
  if (pm.includes("efectivo")) return "Efectivo";
  return order?.payment_method || "";
}

function fulfillmentLabel(order) {
  const ft = String(order?.fulfillment_type || "").trim().toLowerCase();
  if (ft === "mesa") return "Mesa";
  if (ft === "local") return "Retiro local";
  if (ft === "delivery_mozo") return "Delivery mozo";
  if (ft === "delivery") return "Delivery";
  return ft || "";
}

/** Filas CSV para exportación de pedidos. */
export function orderRowsForCsv(orders) {
  return (orders || []).map((order) => {
    const phone = callableCustomerPhone(order);
    return [
      order?.id || "",
      formatOrderDateTime(order?.created_at),
      formatOrderStatusLabelEs(order),
      formatPaymentStatusLabelEs(order),
      paymentMethodLabel(order),
      fulfillmentLabel(order),
      tableNumberLabel(order) || "",
      phone ? formatPhoneLabel(phone) : "",
      formatGroupedItemLine(order?.items),
      String(subtotalForOrder(order)),
      order?.delivery_fee != null && order.delivery_fee !== ""
        ? String(order.delivery_fee)
        : "",
      order?.discount_amount != null && order.discount_amount !== ""
        ? String(order.discount_amount)
        : "",
      order?.tip_amount != null && order.tip_amount !== ""
        ? String(order.tip_amount)
        : "",
      String(effectiveOrderTotal(order)),
      String(order?.notes || "").replace(/\s+/g, " ").trim()
    ];
  });
}

export const ORDERS_CSV_HEADERS = [
  "id",
  "fecha_hora",
  "estado",
  "estado_pago",
  "medio_pago",
  "modalidad",
  "mesa",
  "telefono",
  "items",
  "subtotal",
  "envio",
  "descuento",
  "propina",
  "total",
  "notas"
];

export function downloadOrdersCsv(orders, { dateFrom = "", dateTo = "" } = {}) {
  const stamp = new Date().toISOString().slice(0, 10);
  const range =
    dateFrom && dateTo
      ? `${dateFrom}_${dateTo}`
      : dateFrom || dateTo || "filtro-actual";
  const slug = range.replace(/[^0-9_-]+/g, "-").replace(/^-|-$/g, "");
  downloadCsv(`pedidos-${slug || "export"}-${stamp}.csv`, ORDERS_CSV_HEADERS, orderRowsForCsv(orders));
}

/**
 * Carga todos los pedidos que coinciden con el query de Supabase (paginado).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {(q: import('@supabase/supabase-js').PostgrestFilterBuilder) => import('@supabase/supabase-js').PostgrestFilterBuilder} applyFilters
 */
export async function fetchAllOrdersForExport(supabase, applyFilters) {
  const all = [];
  let page = 0;
  while (all.length < EXPORT_MAX_ROWS) {
    const from = page * EXPORT_PAGE_SIZE;
    const to = from + EXPORT_PAGE_SIZE - 1;
    let query = supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .range(from, to);
    query = applyFilters(query);
    const { data, error } = await query;
    if (error) throw error;
    const batch = data || [];
    all.push(...batch);
    if (batch.length < EXPORT_PAGE_SIZE) break;
    page += 1;
  }
  if (all.length >= EXPORT_MAX_ROWS) {
    const err = new Error(
      `Se alcanzó el límite de ${EXPORT_MAX_ROWS} pedidos. Acotá el rango de fechas.`
    );
    err.code = "EXPORT_LIMIT";
    throw err;
  }
  return all;
}
