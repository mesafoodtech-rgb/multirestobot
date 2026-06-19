import { useRef, useState } from "react";
import { menuItemHasImage } from "../lib/menuImageConfig";
import { getMenuImagePublicUrl } from "../lib/menuImageStorage";
import MenuItemImageLightbox from "./MenuItemImageLightbox";

export default function MenuItemImageAdmin({
  item,
  disabled = false,
  onUpload,
  onRemove
}) {
  const inputRef = useRef(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const hasImage = menuItemHasImage(item);
  const thumbUrl = hasImage ? getMenuImagePublicUrl(item.image_thumb_path) : null;

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || disabled) return;
    await onUpload(file);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {hasImage ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setPreviewOpen(true)}
          className="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border border-slate-600 bg-slate-950 disabled:opacity-50"
          title="Ver imagen actual"
        >
          {thumbUrl ? (
            <img src={thumbUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-xs text-slate-400">IMG</span>
          )}
        </button>
      ) : null}
      <label className="inline-flex cursor-pointer items-center rounded-lg border border-slate-600 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          disabled={disabled}
          className="sr-only"
          onChange={handleFileChange}
        />
        {hasImage ? "Cambiar imagen" : "Subir imagen"}
      </label>
      {hasImage ? (
        <button
          type="button"
          disabled={disabled}
          onClick={onRemove}
          className="rounded-lg border border-rose-500/40 px-3 py-2 text-xs font-medium text-rose-300 hover:bg-rose-500/10 disabled:opacity-50"
        >
          Quitar
        </button>
      ) : null}
      {previewOpen ? (
        <MenuItemImageLightbox
          fullPath={item.image_full_path}
          itemName={item.name}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}
    </div>
  );
}
