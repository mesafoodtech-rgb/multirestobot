import { useEffect, useRef, useState } from "react";
import { menuItemHasImage } from "../lib/menuImageConfig";
import { getMenuImagePublicUrl } from "../lib/menuImageStorage";
import MenuItemImageLightbox from "./MenuItemImageLightbox";

function PhotoIcon({ className = "h-4 w-4" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      className={className}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 7a2 2 0 0 1 2-2h3l1-2h4l1 2h3a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7z"
      />
      <circle cx="12" cy="13" r="3.25" />
    </svg>
  );
}

/**
 * Icono junto al producto: miniatura lazy (solo en viewport) y imagen completa al abrir.
 */
export default function MenuItemImageTrigger({ item, itemName, className = "" }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [thumbSrc, setThumbSrc] = useState(null);
  const [inView, setInView] = useState(false);
  const ref = useRef(null);

  const hasImage = menuItemHasImage(item);

  useEffect(() => {
    if (!hasImage || !ref.current) return undefined;
    const node = ref.current;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "120px", threshold: 0.01 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasImage, item?.id]);

  useEffect(() => {
    if (!inView || !item?.image_thumb_path) return;
    const url = getMenuImagePublicUrl(item.image_thumb_path);
    if (url) setThumbSrc(url);
  }, [inView, item?.image_thumb_path]);

  if (!hasImage) return null;

  return (
    <>
      <button
        ref={ref}
        type="button"
        title="Ver foto del plato"
        aria-label={itemName ? `Ver foto de ${itemName}` : "Ver foto del producto"}
        onClick={() => setLightboxOpen(true)}
        className={`inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-600/80 bg-slate-900/80 text-cyan-300/90 hover:border-cyan-500/40 hover:bg-slate-800 ${className}`}
      >
        {thumbSrc ? (
          <img
            src={thumbSrc}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <PhotoIcon />
        )}
      </button>
      {lightboxOpen ? (
        <MenuItemImageLightbox
          fullPath={item.image_full_path}
          itemName={itemName}
          onClose={() => setLightboxOpen(false)}
        />
      ) : null}
    </>
  );
}
