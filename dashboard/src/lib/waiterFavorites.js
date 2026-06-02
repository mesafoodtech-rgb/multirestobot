const STORAGE_PREFIX = "restobot_waiter_favorites_v1";

function storageKey(restaurantId, userId) {
  const rid = String(restaurantId || "").trim();
  const uid = String(userId || "anon").trim() || "anon";
  return `${STORAGE_PREFIX}:${rid}:${uid}`;
}

export function readWaiterFavoriteIds(restaurantId, userId) {
  try {
    const raw = localStorage.getItem(storageKey(restaurantId, userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.map((id) => String(id || "").trim()).filter(Boolean))];
  } catch {
    return [];
  }
}

export function writeWaiterFavoriteIds(restaurantId, userId, ids) {
  const list = [...new Set((ids || []).map((id) => String(id || "").trim()).filter(Boolean))];
  try {
    localStorage.setItem(storageKey(restaurantId, userId), JSON.stringify(list));
  } catch {
    /* quota / private mode */
  }
  return list;
}

export function toggleWaiterFavorite(restaurantId, userId, itemId) {
  const id = String(itemId || "").trim();
  if (!id) return readWaiterFavoriteIds(restaurantId, userId);
  const current = readWaiterFavoriteIds(restaurantId, userId);
  const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
  return writeWaiterFavoriteIds(restaurantId, userId, next);
}
