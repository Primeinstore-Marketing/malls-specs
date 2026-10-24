/**
 * Where uploaded file bytes are kept. Workers KV for now (no setup, 25 MB
 * per file); an R2 version would implement the same three methods.
 */

export const MAX_FILE_BYTES = 25 * 1024 * 1024;

/** What may be uploaded, and how each type is classified. */
export const ALLOWED_TYPES: Readonly<Record<string, 'image' | 'video' | 'document' | 'cad' | 'archive' | 'other'>> = {
  'image/png': 'image',
  'image/jpeg': 'image',
  'image/webp': 'image',
  'image/gif': 'image',
  'image/svg+xml': 'image',
  'video/mp4': 'video',
  'video/webm': 'video',
  'application/pdf': 'document',
  'application/zip': 'archive',
  'application/x-zip-compressed': 'archive',
  'application/postscript': 'document', // .ai / .eps
  'image/vnd.adobe.photoshop': 'image', // .psd
  'application/acad': 'cad',
  'image/vnd.dwg': 'cad',
  'application/dxf': 'cad',
  'application/vnd.adobe.aftereffects.project': 'other', // .aep templates
};

export interface StoredFile {
  readonly body: ReadableStream;
  readonly mimeType: string;
  readonly filename: string;
}

export interface FileStore {
  put(key: string, body: ArrayBuffer, mimeType: string, filename: string): Promise<void>;
  get(key: string): Promise<StoredFile | null>;
  remove(key: string): Promise<void>;
}

export function kvFileStore(kv: KVNamespace): FileStore {
  return {
    async put(key, body, mimeType, filename) {
      await kv.put(key, body, { metadata: { mimeType, filename } });
    },
    async get(key) {
      const result = await kv.getWithMetadata<{ mimeType: string; filename: string }>(key, 'stream');
      if (!result.value || !result.metadata) return null;
      return { body: result.value, mimeType: result.metadata.mimeType, filename: result.metadata.filename };
    },
    async remove(key) {
      await kv.delete(key);
    },
  };
}

/** Keeps a filename readable but safe in a URL and a Content-Disposition header. */
export function safeFilename(name: string): string {
  const cleaned = name
    .normalize('NFKD')
    .replace(/[^\w.\- ]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 120);
  return cleaned || 'file';
}
