'use client';

/**
 * Gets a photo ready to upload as a screen picture:
 *  - big phone photos are scaled down (longest side 2560 px) and saved as
 *    JPEG, so they upload in seconds and load fast on the spec page;
 *  - phone rotation is applied, so pictures aren't sideways;
 *  - iPhone HEIC photos are converted to JPEG where the browser can read them
 *    (Safari); elsewhere the message says how to get a JPEG.
 * GIF, SVG and videos go up as they are.
 */

const MAX_EDGE = 2560;
const QUALITY = 0.86;
/** Photos smaller than this, in a web format, are left alone. */
const SMALL_ENOUGH = 2.5 * 1024 * 1024;
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const isHeic = (f: File) => /image\/hei[cf]/i.test(f.type) || /\.hei[cf]$/i.test(f.name);
const asIs = (f: File) => /^(image\/(gif|svg\+xml)|video\/)/i.test(f.type);

export class UploadProblem extends Error {}

async function decode(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // Some browsers can only decode through an <img>.
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
      await img.decode();
      return await createImageBitmap(img);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

export async function prepareImage(file: File): Promise<File> {
  if (asIs(file)) {
    if (file.size > MAX_UPLOAD_BYTES) throw new UploadProblem(`${file.name} is over 25 MB. Make it shorter or smaller, then try again.`);
    return file;
  }
  const heic = isHeic(file);
  if (!heic && !file.type.startsWith('image/')) throw new UploadProblem(`${file.name} isn’t a picture. Use JPG, PNG, WebP or GIF (or MP4 for video).`);
  const webFormat = /image\/(jpeg|png|webp)/i.test(file.type);
  if (webFormat && file.size <= SMALL_ENOUGH) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await decode(file);
  } catch {
    if (heic) {
      throw new UploadProblem(
        `${file.name} is an iPhone HEIC photo, which this browser can’t open. Upload it from Safari, or AirDrop it to a Mac (it arrives as a JPG), or on the iPhone choose Settings → Camera → Formats → Most Compatible.`,
      );
    }
    throw new UploadProblem(`${file.name} couldn’t be opened as a picture. Save it as JPG or PNG and try again.`);
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  // PNGs with see-through parts (logos, artwork) stay PNG; photos become JPEG.
  const keepPng = /image\/png/i.test(file.type) && scale === 1 && file.size <= MAX_UPLOAD_BYTES;
  if (keepPng) return file;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
  if (!blob) return file;
  const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
  return new File([blob], name, { type: 'image/jpeg', lastModified: file.lastModified });
}
