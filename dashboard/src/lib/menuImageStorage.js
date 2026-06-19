import { supabase } from "../supabaseClient";
import { MENU_IMAGE_BUCKET } from "./menuImageConfig";
import { processMenuImageFile } from "./menuImageProcessing";

export function getMenuImagePublicUrl(path) {
  const normalized = String(path || "").trim();
  if (!normalized) return null;
  const { data } = supabase.storage.from(MENU_IMAGE_BUCKET).getPublicUrl(normalized);
  return data?.publicUrl || null;
}

function buildMenuImagePaths(restaurantId, itemId) {
  const base = `${restaurantId}/${itemId}`;
  return {
    thumbPath: `${base}/thumb.webp`,
    fullPath: `${base}/full.webp`
  };
}

async function uploadBlob(path, blob) {
  const { error } = await supabase.storage.from(MENU_IMAGE_BUCKET).upload(path, blob, {
    upsert: true,
    contentType: "image/webp",
    cacheControl: "31536000"
  });
  if (error) throw new Error(error.message || "No se pudo subir la imagen.");
}

export async function uploadMenuItemImages({ restaurantId, itemId, file }) {
  if (!restaurantId || !itemId) {
    throw new Error("Faltan datos del restaurante o del producto.");
  }
  const { thumbBlob, fullBlob } = await processMenuImageFile(file);
  const { thumbPath, fullPath } = buildMenuImagePaths(restaurantId, itemId);

  await uploadBlob(thumbPath, thumbBlob);
  await uploadBlob(fullPath, fullBlob);

  return {
    image_thumb_path: thumbPath,
    image_full_path: fullPath
  };
}

export async function deleteMenuItemImages(item) {
  const paths = [item?.image_thumb_path, item?.image_full_path]
    .map((p) => String(p || "").trim())
    .filter(Boolean);
  if (!paths.length) return;

  const { error } = await supabase.storage.from(MENU_IMAGE_BUCKET).remove(paths);
  if (error) throw new Error(error.message || "No se pudo eliminar la imagen del almacenamiento.");
}
