/** Parsea monto en pesos (acepta coma decimal). */
export function parseMoneyAmount(raw) {
  const normalized = String(raw ?? "")
    .trim()
    .replace(",", ".");
  if (!normalized) return 0;
  const n = Number(normalized);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}

/**
 * @param {number} subtotal
 * @param {string|number} discountRaw
 * @param {string|number} tipRaw
 */
export function computeCheckoutTotals(subtotal, discountRaw, tipRaw) {
  const base = Math.round(Math.max(0, Number(subtotal) || 0) * 100) / 100;
  const discount = Math.min(base, parseMoneyAmount(discountRaw));
  const tip = parseMoneyAmount(tipRaw);
  const finalTotal = Math.max(0, Math.round((base - discount + tip) * 100) / 100);
  return { subtotal: base, discount, tip, finalTotal };
}
