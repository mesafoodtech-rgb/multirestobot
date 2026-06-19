/** Bucket Supabase Storage para imágenes de productos (WebP). */
export const MENU_IMAGE_BUCKET = "menu-images";

/** ON solo si metadata.menu_images_enabled === true (función opt-in desde Panel Maestro). */
export function readMenuImagesEnabled(metadata) {
  return metadata?.menu_images_enabled === true;
}

export function menuItemHasImage(item) {
  return Boolean(item?.image_full_path || item?.image_thumb_path);
}
