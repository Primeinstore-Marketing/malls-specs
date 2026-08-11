import type { CategoryId, SubGroupId, TagId, AssetId } from './ids';
import type { Slug, SortOrder, Audited, Archivable } from './common';
import type { MetadataTemplate } from './content';

/**
 * The three classification axes, kept deliberately distinct.
 *
 *   Category — where does this live.   Exclusive, ordered, navigable.
 *   SubGroup — an optional middle tier. Nullable, as in the reference system.
 *   Tag      — what is this like.       Many-to-many, unordered, never a tree.
 *
 * Collapsing any two of these is the usual failure mode in specification
 * portals and is what makes them unmaintainable once the catalogue grows.
 */

export interface Category extends Audited, Archivable {
  readonly id: CategoryId;
  readonly name: string;
  readonly slug: Slug;
  readonly description: string;
  readonly order: SortOrder;
  /** Optional category header image. */
  readonly mediaId: AssetId | null;
  /** Sub-groups belonging to this category, in authored order. */
  readonly subGroupIds: readonly SubGroupId[];
  /**
   * Metadata fields that new specifications in this category inherit.
   * This is how a domain convention is expressed without a schema change.
   */
  readonly metadataTemplate: MetadataTemplate;
  /** Block labels new specifications in this category start with. */
  readonly blockTemplate: readonly string[];
}

export const emptyCategory = (id: CategoryId, order: SortOrder): Category => ({
  id, name: '', slug: '', description: '', order,
  mediaId: null, subGroupIds: [],
  metadataTemplate: { fields: [] }, blockTemplate: [],
  createdAt: null, createdBy: null, updatedAt: null, updatedBy: null,
  archivedAt: null, archivedBy: null,
});

export interface SubGroup extends Audited, Archivable {
  readonly id: SubGroupId;
  readonly categoryId: CategoryId;
  readonly name: string;
  readonly slug: Slug;
  readonly description: string;
  readonly order: SortOrder;
}

export const emptySubGroup = (id: SubGroupId, categoryId: CategoryId, order: SortOrder): SubGroup => ({
  id, categoryId, name: '', slug: '', description: '', order,
  createdAt: null, createdBy: null, updatedAt: null, updatedBy: null,
  archivedAt: null, archivedBy: null,
});

export type TagTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export interface Tag extends Audited {
  readonly id: TagId;
  readonly name: string;
  readonly slug: Slug;
  readonly description: string;
  readonly tone: TagTone;
  /** Denormalised for facet counts. Recomputed, never authored. */
  readonly usageCount: number;
}

export const emptyTag = (id: TagId): Tag => ({
  id, name: '', slug: '', description: '', tone: 'neutral', usageCount: 0,
  createdAt: null, createdBy: null, updatedAt: null, updatedBy: null,
});
