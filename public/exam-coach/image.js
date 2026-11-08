// Exam Coach — photo compression in the browser. No dependencies, no Firebase.
// Scales the long edge down to maxSide (2576 px: current Claude models read images up to that size natively) and
// returns a JPEG in base64 without the data: prefix, ready for the callable. EXIF orientation is applied through
// createImageBitmap({ imageOrientation: "from-image" }). A byte cap keeps the photo well under the API image limit
// (5 MB): first a lower JPEG quality, then a smaller size.

const DEFAULTS = { maxSide: 2576, quality: 0.85, maxBytes: 3500000, minSide: 1024 };

/**
 * @param {File|Blob} file photo chosen by the user
 * @param {{maxSide?: number, quality?: number, maxBytes?: number, minSide?: number}} [options]
 * @return {Promise<{base64: string, mediaType: string, width: number, height: number, bytes: number, quality: number}>}
 */
export async function compressImage(file, options = {}) {
  const { maxSide, quality, maxBytes, minSide } = { ...DEFAULTS, ...options };
  const source = await loadSource(file);
  try {
    const longEdge = Math.max(source.width, source.height);
    const qualities = [...new Set([quality, Math.min(quality, 0.75), Math.min(quality, 0.65)])];
    let side = Math.min(maxSide, longEdge);
    let qi = 0;
    for (;;) {
      const out = await encode(source, side / longEdge, qualities[qi]);
      const lastTry = qi === qualities.length - 1 && side * 0.8 < minSide;
      if (out.blob.size <= maxBytes || lastTry) {
        const base64 = await blobToBase64(out.blob);
        return { base64, mediaType: "image/jpeg", width: out.width, height: out.height, bytes: out.blob.size, quality: qualities[qi] };
      }
      if (qi < qualities.length - 1) qi += 1;
      else side = Math.round(side * 0.8);
    }
  } finally {
    source.release();
  }
}

async function encode(source, scale, quality) {
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff"; // transparent PNGs become JPEGs on white
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source.image, 0, 0, width, height);
  const blob = await toBlob(canvas, "image/jpeg", quality);
  canvas.width = 0; // frees the bitmap memory early on iOS
  canvas.height = 0;
  return { blob, width, height };
}

function unreadable(message) {
  const err = new Error(message);
  err.code = "image/unreadable";
  return err;
}

// Tries in order: createImageBitmap with EXIF orientation, plain createImageBitmap, a classic <img>.
async function loadSource(file) {
  if (typeof createImageBitmap === "function") {
    for (const opts of [{ imageOrientation: "from-image" }, null]) {
      try {
        const bmp = opts ? await createImageBitmap(file, opts) : await createImageBitmap(file);
        return { image: bmp, width: bmp.width, height: bmp.height, release: () => bmp.close && bmp.close() };
      } catch (e) { /* next way */ }
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(unreadable("Image not readable"));
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
    canvas.toBlob((b) => (b ? resolve(b) : reject(unreadable("Compression failed"))), type, quality);
  });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result);
      resolve(s.slice(s.indexOf(",") + 1));
    };
    r.onerror = () => reject(unreadable("Reading failed"));
    r.readAsDataURL(blob);
  });
}
