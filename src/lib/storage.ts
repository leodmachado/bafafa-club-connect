import { supabase } from "@/integrations/supabase/client";
import { publicErrorMessage } from "@/lib/public-error";

const MAX_SOURCE_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_SOURCE_PIXELS = 24_000_000;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type PublicImageBucket = "event-images" | "avatars";

type PreparedImage = {
  file: File;
  width: number;
  height: number;
};

const OUTPUT_RULES: Record<
  PublicImageBucket,
  { maxWidth: number; maxHeight: number; maxBytes: number; quality: number }
> = {
  avatars: { maxWidth: 1024, maxHeight: 1024, maxBytes: 1_200_000, quality: 0.84 },
  "event-images": { maxWidth: 1920, maxHeight: 1440, maxBytes: 2_800_000, quality: 0.86 },
};

export function validateImageFile(file: File) {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error("Use uma imagem JPG, PNG ou WEBP.");
  }
  if (file.size <= 0 || file.size > MAX_SOURCE_IMAGE_BYTES) {
    throw new Error("A imagem original deve ter no máximo 8 MB.");
  }
}

export async function uploadPublicImage({
  bucket,
  folder,
  file,
}: {
  bucket: PublicImageBucket;
  folder: string;
  file: File;
}) {
  validateImageFile(file);
  const prepared = await prepareImageForUpload(file, bucket);
  const safeFolder = folder.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safeFolder) throw new Error("Pasta de imagem inválida.");

  const path = `${safeFolder}/${crypto.randomUUID()}.webp`;
  const { error } = await supabase.storage.from(bucket).upload(path, prepared.file, {
    cacheControl: "31536000",
    contentType: "image/webp",
    upsert: false,
  });

  if (error) {
    if (import.meta.env.DEV) console.error("[Storage upload]", error);
    throw new Error(
      publicErrorMessage(error, "Não foi possível enviar a imagem. Tente novamente."),
    );
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { url: data.publicUrl, path, width: prepared.width, height: prepared.height };
}

export async function removePublicImage(bucket: PublicImageBucket, url: string | null) {
  if (!url) return;
  const marker = `/storage/v1/object/public/${bucket}/`;
  const index = url.indexOf(marker);
  if (index < 0) return;
  const encodedPath = url.slice(index + marker.length).split("?")[0];
  const path = decodeURIComponent(encodedPath);
  if (!path || path.includes("..")) return;

  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error && import.meta.env.DEV) console.error("[Storage remove]", error);
}

async function prepareImageForUpload(
  file: File,
  bucket: PublicImageBucket,
): Promise<PreparedImage> {
  const detectedType = await detectImageType(file);
  if (!detectedType || detectedType !== file.type) {
    throw new Error("O conteúdo do arquivo não corresponde a uma imagem permitida.");
  }

  const image = await decodeImage(file);
  try {
    if (image.width <= 0 || image.height <= 0 || image.width * image.height > MAX_SOURCE_PIXELS) {
      throw new Error("A imagem possui dimensões muito grandes.");
    }

    const rule = OUTPUT_RULES[bucket];
    let { width, height } = fitWithin(image.width, image.height, rule.maxWidth, rule.maxHeight);
    let blob: Blob | null = null;
    let quality = rule.quality;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      blob = await renderWebp(image.source, width, height, quality);
      if (blob.size <= rule.maxBytes) break;

      const shrink = Math.max(0.68, Math.sqrt(rule.maxBytes / blob.size) * 0.92);
      width = Math.max(320, Math.round(width * shrink));
      height = Math.max(320, Math.round(height * shrink));
      quality = Math.max(0.62, quality - 0.06);
    }

    if (!blob || blob.size > rule.maxBytes) {
      throw new Error("Não foi possível otimizar a imagem para o tamanho seguro.");
    }

    return {
      file: new File([blob], `${crypto.randomUUID()}.webp`, {
        type: "image/webp",
        lastModified: Date.now(),
      }),
      width,
      height,
    };
  } finally {
    image.close();
  }
}

async function detectImageType(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng =
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a;
  const isWebp =
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";

  if (isJpeg) return "image/jpeg";
  if (isPng) return "image/png";
  if (isWebp) return "image/webp";
  return null;
}

async function decodeImage(file: File): Promise<{
  source: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
}> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      close: () => bitmap.close(),
    };
  }

  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = "async";
  image.src = objectUrl;
  await image.decode();
  return {
    source: image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    close: () => URL.revokeObjectURL(objectUrl),
  };
}

function fitWithin(width: number, height: number, maxWidth: number, maxHeight: number) {
  const ratio = Math.min(1, maxWidth / width, maxHeight / height);
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

function renderWebp(source: CanvasImageSource, width: number, height: number, quality: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Não foi possível processar a imagem neste aparelho.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(source, 0, 0, width, height);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Não foi possível converter a imagem."))),
      "image/webp",
      quality,
    );
  });
}
