import type { UserId } from './ids';

/** ISO 8601 timestamp. Stored as a string so the model stays serialisable. */
export type Timestamp = string;

/** URL-safe identifier used in routes. Derived from a name, never authored directly. */
export type Slug = string;

/** A human ordering position. Authored, not alphabetical — specification
 *  catalogues have a conventional sequence that alphabetical order destroys. */
export type SortOrder = number;

export interface Audited {
  readonly createdAt: Timestamp | null;
  readonly createdBy: UserId | null;
  readonly updatedAt: Timestamp | null;
  readonly updatedBy: UserId | null;
}

export const emptyAudited = (): Audited => ({
  createdAt: null, createdBy: null, updatedAt: null, updatedBy: null,
});

/** Soft deletion. Nothing is destroyed outside the Archive tab. */
export interface Archivable {
  readonly archivedAt: Timestamp | null;
  readonly archivedBy: UserId | null;
}

export const emptyArchivable = (): Archivable => ({ archivedAt: null, archivedBy: null });

export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly errors: readonly ValidationError[] };

export interface ValidationError {
  readonly path: string;
  readonly code: ValidationCode;
  readonly message: string;
}

export type ValidationCode =
  | 'required'
  | 'duplicate'
  | 'not_found'
  | 'illegal_transition'
  | 'missing_replacement'
  | 'self_reference'
  | 'orphaned'
  | 'out_of_range';

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const fail = (errors: readonly ValidationError[]): Result<never> => ({ ok: false, errors });

export function slugify(input: string): Slug {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
