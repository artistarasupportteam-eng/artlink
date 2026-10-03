const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function readArtwork(file: File, maxBytes = 1_200_000): Promise<string> {
  if (!IMAGE_TYPES.includes(file.type)) {
    throw new Error("Use a JPEG, PNG, or WebP image.");
  }
  if (file.size > 12_000_000) {
    throw new Error("That image is too large to process.");
  }
  const dataUrl = await compressImage(file, 1200, 0.82);
  if (dataUrl.length > Math.ceil(maxBytes * 1.4)) {
    const smaller = await compressImage(file, 960, 0.72);
    if (smaller.length > Math.ceil(maxBytes * 1.4)) {
      throw new Error("Image is still too large after compression. Try a smaller file.");
    }
    return smaller;
  }
  return dataUrl;
}

function compressImage(file: File, maxEdge: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Could not read that image."));
        return;
      }
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const out = canvas.toDataURL("image/jpeg", quality);
      URL.revokeObjectURL(url);
      resolve(out);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image."));
    };
    image.src = url;
  });
}

export async function readVideo(file: File, maxBytes: number): Promise<string> {
  const ok = file.type === "video/mp4" || file.type === "video/webm";
  if (!ok) throw new Error("Use an MP4 or WebM video, or paste an HTTPS link.");
  if (file.size > maxBytes) {
    throw new Error(`Video must be under ${Math.round(maxBytes / 1_000_000)} MB, or use an HTTPS link.`);
  }
  const dataUrl = await fileToDataUrl(file);
  if (!dataUrl.startsWith("data:video/mp4") && !dataUrl.startsWith("data:video/webm")) {
    throw new Error("Unsupported video file.");
  }
  return dataUrl;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
}
