// Data Coach — compressione della foto nel browser. Nessuna dipendenza, nessun Firebase.
// Riduce il lato lungo a maxSide e produce un JPEG in base64 (senza prefisso data:) per la callable.
// L'orientamento EXIF è rispettato tramite createImageBitmap({ imageOrientation: "from-image" }).

const DEFAULTS = { maxSide: 1568, quality: 0.8 };

/**
 * @param {File|Blob} file foto scelta dall'utente
 * @param {{maxSide?: number, quality?: number}} [options]
 * @return {Promise<{base64: string, mediaType: string, width: number, height: number, bytes: number}>}
 */
export async function compressImage(file, options = {}) {
  const { maxSide, quality } = { ...DEFAULTS, ...options };
  const source = await loadSource(file);
  try {
    const scale = Math.min(1, maxSide / Math.max(source.width, source.height));
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff"; // i PNG con trasparenza diventano JPEG su fondo bianco
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(source.image, 0, 0, width, height);
    const blob = await toBlob(canvas, "image/jpeg", quality);
    const base64 = await blobToBase64(blob);
    return { base64, mediaType: "image/jpeg", width, height, bytes: blob.size };
  } finally {
    source.release();
  }
}

// Prova nell'ordine: createImageBitmap con orientamento EXIF, createImageBitmap semplice, <img> classico.
async function loadSource(file) {
  if (typeof createImageBitmap === "function") {
    for (const opts of [{ imageOrientation: "from-image" }, null]) {
      try {
        const bmp = opts ? await createImageBitmap(file, opts) : await createImageBitmap(file);
        return { image: bmp, width: bmp.width, height: bmp.height, release: () => bmp.close && bmp.close() };
      } catch (e) { /* si passa alla via successiva */ }
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Immagine non leggibile"));
      i.src = url;
    });
    return { image: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

function toBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Compressione non riuscita"))), type, quality);
  });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result);
      resolve(s.slice(s.indexOf(",") + 1));
    };
    r.onerror = () => reject(new Error("Lettura non riuscita"));
    r.readAsDataURL(blob);
  });
}
