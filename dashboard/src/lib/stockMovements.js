import { withRestaurantScope } from "./restaurantTenant";

const TABLE = "stock_movements";

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} restaurantId
 * @param {{
 *   stockItemId?: string | null,
 *   ingredientName: string,
 *   movementType: string,
 *   quantityBefore: number,
 *   quantityAfter: number,
 *   unit: string,
 *   referenceLabel?: string | null
 * }} entry
 */
export async function logStockMovement(supabase, restaurantId, entry) {
  const rid = String(restaurantId || "").trim();
  if (!rid) return { ok: false, skipped: true };

  const before = Number(entry.quantityBefore);
  const after = Number(entry.quantityAfter);
  const delta = Math.round((after - before) * 1000) / 1000;

  const row = {
    restaurant_id: rid,
    stock_item_id: entry.stockItemId || null,
    ingredient_name: String(entry.ingredientName || "").trim() || null,
    movement_type: String(entry.movementType || "adjustment").trim(),
    quantity_before: Number.isFinite(before) ? before : 0,
    quantity_after: Number.isFinite(after) ? after : 0,
    delta,
    unit: String(entry.unit || "UNIDAD").trim() || "UNIDAD",
    reference_label: entry.referenceLabel ? String(entry.referenceLabel).trim() : null,
    created_at: new Date().toISOString()
  };

  const { error } = await withRestaurantScope(supabase.from(TABLE).insert(row), rid);
  if (error) {
    if (/does not exist|42P01/i.test(error.message || "")) {
      return { ok: false, skipped: true, reason: "table_missing" };
    }
    return { ok: false, error };
  }
  return { ok: true };
}

export const STOCK_MOVEMENT_LABELS = {
  adjustment: "Ajuste manual",
  recipe_use: "Uso de receta",
  replenish: "Reposición",
  delete: "Eliminación"
};

export function movementTypeLabel(type) {
  return STOCK_MOVEMENT_LABELS[type] || type || "—";
}
