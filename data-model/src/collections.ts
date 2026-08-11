import type { SpecificationId } from './ids';
import type { Timestamp } from './common';

/**
 * Derived, device-scoped surfaces. Never authored, never part of the category
 * tree. Kept separate from the catalogue so the storage adapter can move them
 * to an account later without touching the content model.
 */

export interface VisitRecord {
  readonly specificationId: SpecificationId;
  readonly visitedAt: Timestamp;
}

export interface Collections {
  readonly bookmarks: readonly SpecificationId[];
  readonly favourites: readonly SpecificationId[];
  /** Most recent first, capped. */
  readonly recentlyViewed: readonly VisitRecord[];
}

export const RECENT_LIMIT = 25;

export const emptyCollections = (): Collections => ({
  bookmarks: [], favourites: [], recentlyViewed: [],
});

export interface CollectionsAdapter {
  load(): Promise<Collections>;
  save(next: Collections): Promise<void>;
  clear(): Promise<void>;
}
