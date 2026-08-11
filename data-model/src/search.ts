import type { SpecificationId, CategoryId, SubGroupId, TagId } from './ids';
import type { SpecStatus } from './status';

/**
 * Search and filter.
 *
 * The reference system filters the sidebar tree by title substring and has no
 * results surface at all. This is a pre-built index over every searchable
 * field, so the command palette can match codes, descriptions, tags and body
 * text without loading the catalogue.
 */

export interface IndexEntry {
  readonly id: SpecificationId;
  readonly title: string;
  readonly code: string;
  readonly description: string;
  readonly categoryId: CategoryId | null;
  readonly subGroupId: SubGroupId | null;
  readonly tagIds: readonly TagId[];
  readonly status: SpecStatus;
  /** Concatenated block lines, metadata values and attachment filenames. */
  readonly body: string;
  /** Lowercased, punctuation-stripped, for prefix matching. */
  readonly normalised: string;
  readonly updatedAt: string | null;
}

export interface SearchIndex {
  readonly entries: readonly IndexEntry[];
  readonly builtAt: string | null;
}

export const emptySearchIndex = (): SearchIndex => ({ entries: [], builtAt: null });

export type SortKey = 'relevance' | 'title' | 'code' | 'updated' | 'order';
export type SortDirection = 'asc' | 'desc';
export type ViewMode = 'list' | 'grid';

/** Every field here maps to a URL parameter, so a filtered view is shareable. */
export interface FilterState {
  readonly query: string;
  readonly categoryIds: readonly CategoryId[];
  readonly subGroupIds: readonly SubGroupId[];
  readonly tagIds: readonly TagId[];
  readonly statuses: readonly SpecStatus[];
  readonly updatedWithinDays: number | null;
  readonly includeArchived: boolean;
  readonly sort: SortKey;
  readonly direction: SortDirection;
  readonly view: ViewMode;
  readonly page: number;
  readonly pageSize: number;
}

export const emptyFilterState = (): FilterState => ({
  query: '', categoryIds: [], subGroupIds: [], tagIds: [], statuses: [],
  updatedWithinDays: null, includeArchived: false,
  sort: 'order', direction: 'asc', view: 'list', page: 1, pageSize: 25,
});

export const activeFilterCount = (f: FilterState): number =>
  f.categoryIds.length + f.subGroupIds.length + f.tagIds.length + f.statuses.length +
  (f.updatedWithinDays !== null ? 1 : 0) + (f.includeArchived ? 1 : 0) +
  (f.query.trim() ? 1 : 0);

export interface SearchResult {
  readonly id: SpecificationId;
  readonly score: number;
  /** Character ranges to highlight, per matched field. */
  readonly highlights: Readonly<Record<string, readonly [number, number][]>>;
}

export interface FacetCount<T extends string> {
  readonly value: T;
  readonly count: number;
}

export interface Facets {
  readonly categories: readonly FacetCount<string>[];
  readonly subGroups: readonly FacetCount<string>[];
  readonly tags: readonly FacetCount<string>[];
  readonly statuses: readonly FacetCount<SpecStatus>[];
}

export const emptyFacets = (): Facets => ({
  categories: [], subGroups: [], tags: [], statuses: [],
});
