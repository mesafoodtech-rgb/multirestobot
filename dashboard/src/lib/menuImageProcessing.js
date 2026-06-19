const THUMB_MAX_PX = 96;
const FULL_MAX_PX = 600;
const THUMB_QUALITY = 0.75;
const FULL_QUALITY = 0.75;
const MAX_INPUT_BYTES = 12 * 1024 * 1024;

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo leer la imagen seleccionada."));
    };
    img.src = url;
  });
}

function scaleToFit(width, height, maxW, maxH) {
  const ratio = Math.min(maxW / width, maxH / height, 1);
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio))
  };
}

function drawToCanvas(img, maxW, maxH) {
  const { width, height } = scaleToFit(img.naturalWidth || img.width, img.naturalHeight || img.height, maxW, maxH);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo procesar la imagen en este navegador.");
  ctx.drawImage(img, 0, 0, width, height);
  return canvas;
}

function canvasToWebpBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("No se pudo convertir la imagen a WebP."));
          return;
        }
        resolve(blob);
      },
      "image/webp",
      quality
    );
  });
}

/**
 * Convierte un archivo de imagen a dos blobs WebP: miniatura y tamaño completo optimizado.
 */
export async function processMenuImageFile(file) {
  if (!file || !String(file.type || "").startsWith("image/")) {
    throw new Error("Seleccioná un archivo de imagen (JPG, PNG, WebP, etc.).");
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error("La imagen es demasiado grande (máx. 12 MB).");
  }

  const img = await loadImageFromFile(file);
  const thumbCanvas = drawToCanvas(img, THUMB_MAX_PX, THUMB_MAX_PX);
  const fullCanvas = drawToCanvas(img, FULL_MAX_PX, FULL_MAX_PX);
  const [thumbBlob, fullBlob] = await Promise.all([
    canvasToWebpBlob(thumbCanvas, THUMB_QUALITY),
    canvasToWebpBlob(fullCanvas, FULL_QUALITY)
  ]);

  return { thumbBlob, fullBlob };
}
