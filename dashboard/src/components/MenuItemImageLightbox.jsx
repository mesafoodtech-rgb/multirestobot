import { useEffect, useState } from "react";
import { getMenuImagePublicUrl } from "../lib/menuImageStorage";

export default function MenuItemImageLightbox({ fullPath, itemName, onClose }) {
  const [fullSrc, setFullSrc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const path = String(fullPath || "").trim();
    if (!path) {
      setLoadError("No hay imagen disponible.");
      setLoading(false);
      return undefined;
    }

    const url = getMenuImagePublicUrl(path);
    if (!url) {
      setLoadError("No se pudo resolver la URL de la imagen.");
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      setFullSrc(url);
      setLoading(false);
    };
    img.onerror = () => {
      if (cancelled) return;
      setLoadError("No se pudo cargar la imagen.");
      setLoading(false);
    };
    img.src = url;

    return () => {
      cancelled = true;
    };
  }, [fullPath]);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={itemName ? `Imagen de ${itemName}` : "Imagen del producto"}
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] max-w-3xl w-full rounded-xl border border-slate-700 bg-slate-950 p-3 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900/90 text-slate-200 hover:bg-slate-800"
          aria-label="Cerrar"
        >
          ×
        </button>
        {itemName ? (
          <p className="mb-2 pr-10 text-sm font-medium text-slate-200">{itemName}</p>
        ) : null}
        <div className="flex min-h-[12rem] items-center justify-center">
          {loading ? (
            <p className="text-sm text-slate-400">Cargando imagen…</p>
          ) : loadError ? (
            <p className="text-sm text-rose-300">{loadError}</p>
          ) : fullSrc ? (
            <img
              src={fullSrc}
              alt={itemName || "Producto"}
              className="max-h-[75vh] w-auto max-w-full rounded-lg object-contain"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
