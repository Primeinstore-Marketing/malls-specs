import { catalogue as seededCatalogue } from '@data/catalogue.seed';
import { toSummary } from '@data-model';
import type { Catalogue } from '@data-model';
import type { Category, SubGroup, Specification, Tag } from '@data-model';
import type { SpecStatus, SpecificationSummary } from '@data-model';
import type { CategoryId, SubGroupId, TagId, AssetId } from '@data-model';
import type { Asset } from '@data-model';
import type { Revision } from '@data-model';

/**
 * Service-layer seam. Every page reads through this module rather than the
 * shipped data file directly, so a real API or CMS can replace the adapter
 * later without touching a component.
 */
export function getCatalogue(): Catalogue {
  return liveCatalogue ?? seededCatalogue;
}

/** The built-in data, before any admin edits. */
export function getSeedCatalogue(): Catalogue {
  return seededCatalogue;
}

// Set by `lib/liveData.ts` once admin edits have loaded from the API, so
// every reader gets the merged catalogue without being rewritten.
let liveCatalogue: Catalogue | null = null;

export function setLiveCatalogue(catalogue: Catalogue | null) {
  liveCatalogue = catalogue;
}

export interface CategoryTreeNode {
  readonly category: Category;
  readonly subGroups: readonly SubGroup[];
}

/** Categories with their sub-groups attached, in authored order, archived branches excluded. */
export function getCategoryTree(catalogue: Catalogue = getCatalogue()): readonly CategoryTreeNode[] {
  return Object.values(catalogue.categories)
    .filter((category) => category.archivedAt === null)
    .sort((a, b) => a.order - b.order)
    .map((category) => ({
      category,
      subGroups: category.subGroupIds
        .map((id) => catalogue.subGroups[id])
        .filter((sub): sub is SubGroup => sub != null && sub.archivedAt === null)
        .sort((a, b) => a.order - b.order),
    }));
}

export function getCategory(id: string, catalogue: Catalogue = getCatalogue()): Category | null {
  return catalogue.categories[id] ?? null;
}

export function getSubGroup(id: string, catalogue: Catalogue = getCatalogue()): SubGroup | null {
  return catalogue.subGroups[id] ?? null;
}

export interface SpecificationFilter {
  readonly categoryId?: CategoryId;
  readonly subGroupId?: SubGroupId;
  readonly status?: SpecStatus;
  readonly tagId?: TagId;
}

/** Summaries for list views. Archived records are excluded; nothing else is filtered here. */
export function getSpecificationSummaries(
  catalogue: Catalogue = getCatalogue(),
  filter?: SpecificationFilter,
): readonly SpecificationSummary[] {
  return Object.values(catalogue.specifications)
    .filter((spec) => spec.archivedAt === null)
    .filter((spec) => !filter?.categoryId || spec.categoryId === filter.categoryId)
    .filter((spec) => !filter?.subGroupId || spec.subGroupId === filter.subGroupId)
    .filter((spec) => !filter?.status || spec.status === filter.status)
    .filter((spec) => !filter?.tagId || spec.tagIds.includes(filter.tagId as TagId))
    .map(toSummary);
}

export function getTags(catalogue: Catalogue = getCatalogue()): readonly Tag[] {
  return Object.values(catalogue.tags).sort((a, b) => a.name.localeCompare(b.name));
}

/** Category id → display name, for resolving `SpecificationSummary.categoryId` in list rows. */
export function getCategoryNames(catalogue: Catalogue = getCatalogue()): Readonly<Record<string, string>> {
  const names: Record<string, string> = {};
  for (const category of Object.values(catalogue.categories)) {
    names[category.id] = category.name || 'Untitled category';
  }
  return names;
}

export function getSpecification(id: string, catalogue: Catalogue = getCatalogue()): Specification | null {
  const spec = catalogue.specifications[id];
  return spec && spec.archivedAt === null ? spec : null;
}

export interface CategoryPath {
  readonly category: Category | null;
  readonly subGroup: SubGroup | null;
}

export function getCategoryPath(spec: Specification, catalogue: Catalogue = getCatalogue()): CategoryPath {
  return {
    category: spec.categoryId ? getCategory(spec.categoryId, catalogue) : null,
    subGroup: spec.subGroupId ? getSubGroup(spec.subGroupId, catalogue) : null,
  };
}

/** Resolves an ordered id list to assets, dropping any id that no longer resolves. */
export function getAssets(ids: readonly AssetId[], catalogue: Catalogue = getCatalogue()): readonly Asset[] {
  return ids.map((id) => catalogue.assets[id]).filter((asset): asset is Asset => asset != null);
}

export function getRelatedSpecifications(
  spec: Specification,
  catalogue: Catalogue = getCatalogue(),
): readonly SpecificationSummary[] {
  return spec.relatedIds
    .map((id) => catalogue.specifications[id])
    .filter((related): related is Specification => related != null && related.archivedAt === null)
    .map(toSummary);
}

/** Revision history, most recent first. */
export function getRevisions(spec: Specification, catalogue: Catalogue = getCatalogue()): readonly Revision[] {
  return spec.revisionIds
    .map((id) => catalogue.revisions[id])
    .filter((revision): revision is Revision => revision != null)
    .sort((a, b) => b.version - a.version);
}

export function getArchivedSpecificationSummaries(
  catalogue: Catalogue = getCatalogue(),
): readonly SpecificationSummary[] {
  return Object.values(catalogue.specifications)
    .filter((spec) => spec.archivedAt !== null)
    .map(toSummary);
}

export function getUsers(catalogue: Catalogue = getCatalogue()) {
  return Object.values(catalogue.users);
}

export interface CatalogueStats {
  readonly specificationCount: number;
  readonly categoryCount: number;
  readonly publishedCount: number;
}

export function getCatalogueStats(catalogue: Catalogue = getCatalogue()): CatalogueStats {
  const specs = Object.values(catalogue.specifications);
  return {
    specificationCount: specs.length,
    categoryCount: Object.values(catalogue.categories).filter((c) => c.archivedAt === null).length,
    publishedCount: specs.filter((s) => s.status === ('published' satisfies SpecStatus)).length,
  };
}
