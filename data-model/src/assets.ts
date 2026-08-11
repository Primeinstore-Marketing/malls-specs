import type { AssetId } from './ids';
import type { Timestamp, SortOrder, Audited } from './common';

/**
 * Files.
 *
 * The reference system handles exactly two kinds: one JPEG per specification,
 * and a list of die-line PDFs committed to a repository through a
 * browser-held access token. This model generalises to the file types your
 * brief names — images, video, PDF, CAD — and abstracts storage so the token
 * strategy becomes one adapter rather than a property of the product.
 */

export type AssetKind = 'image' | 'video' | 'document' | 'cad' | 'archive' | 'other';

/**
 * Role determines where an asset surfaces, not what it is.
 *  media       — the specification image pane and its thumbnail strip
 *  download    — the pinned downloads bar (die lines, artwork templates)
 *  attachment  — the attachments section (supporting material)
 */
export type AssetRole = 'media' | 'download' | 'attachment';

export interface ImageMeta {
  readonly width: number | null;
  readonly height: number | null;
  /** Tiny blurred preview, inlined to prevent layout shift on load. */
  readonly placeholder: string | null;
  /** Object-position focal point, 0–1. The reference system hard-codes 30% on tablet. */
  readonly focalX: number | null;
  readonly focalY: number | null;
}

export const emptyImageMeta = (): ImageMeta => ({
  width: null, height: null, placeholder: null, focalX: null, focalY: null,
});

export interface Asset extends Audited {
  readonly id: AssetId;
  readonly role: AssetRole;
  readonly kind: AssetKind;
  readonly filename: string;
  /** Opaque storage key. The service layer resolves it to a URL. */
  readonly storageKey: string;
  readonly mimeType: string;
  readonly sizeBytes: number | null;
  /** Required for images and video; used as the accessible name. */
  readonly alt: string;
  readonly caption: string;
  readonly order: SortOrder;
  readonly image: ImageMeta | null;
  readonly durationSeconds: number | null;
  readonly uploadedAt: Timestamp | null;
  /** Version label for downloads, so a superseded die line is identifiable. */
  readonly version: string | null;
}

export const emptyAsset = (id: AssetId, role: AssetRole, order: SortOrder): Asset => ({
  id, role, kind: 'other',
  filename: '', storageKey: '', mimeType: '',
  sizeBytes: null, alt: '', caption: '', order,
  image: null, durationSeconds: null, uploadedAt: null, version: null,
  createdAt: null, createdBy: null, updatedAt: null, updatedBy: null,
});

/** Storage abstraction. Phase 5 ships a local adapter; the repository-token
 *  strategy the reference system uses becomes one implementation of this. */
export interface StorageAdapter {
  readonly id: string;
  put(file: File, role: AssetRole): Promise<{ storageKey: string }>;
  url(storageKey: string): string;
  remove(storageKey: string): Promise<void>;
}

export const ASSET_KIND_BY_MIME: Readonly<Record<string, AssetKind>> = {
  'image/png': 'image', 'image/jpeg': 'image', 'image/webp': 'image', 'image/svg+xml': 'image',
  'video/mp4': 'video', 'video/webm': 'video',
  'application/pdf': 'document',
  'application/zip': 'archive',
  'application/acad': 'cad', 'image/vnd.dwg': 'cad', 'application/dxf': 'cad',
};
