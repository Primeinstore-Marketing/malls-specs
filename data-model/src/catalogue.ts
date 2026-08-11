import type { Specification } from './specification';
import type { Category, SubGroup, Tag } from './taxonomy';
import type { Asset } from './assets';
import type { Revision } from './revision';
import type { User } from './access';
import type { SearchIndex } from './search';
import type { Timestamp } from './common';

/**
 * The whole catalogue.
 *
 * Entities are stored by id and referenced by id — never nested. This is what
 * lets a specification be edited without rewriting its category, and what lets
 * the search index be built without walking a tree.
 */
export type ById<T> = Readonly<Record<string, T>>;

export interface Catalogue {
  readonly specifications: ById<Specification>;
  readonly categories: ById<Category>;
  readonly subGroups: ById<SubGroup>;
  readonly tags: ById<Tag>;
  readonly assets: ById<Asset>;
  readonly revisions: ById<Revision>;
  readonly users: ById<User>;
  readonly index: SearchIndex;
  readonly schemaVersion: number;
  readonly generatedAt: Timestamp | null;
}

/** Bumped when a migration is required. Phase 5 reads this on load. */
export const SCHEMA_VERSION = 1;

export const emptyCatalogue = (): Catalogue => ({
  specifications: {}, categories: {}, subGroups: {}, tags: {},
  assets: {}, revisions: {}, users: {},
  index: { entries: [], builtAt: null },
  schemaVersion: SCHEMA_VERSION,
  generatedAt: null,
});

export const isEmpty = (c: Catalogue): boolean =>
  Object.keys(c.specifications).length === 0 &&
  Object.keys(c.categories).length === 0 &&
  Object.keys(c.subGroups).length === 0 &&
  Object.keys(c.tags).length === 0;
