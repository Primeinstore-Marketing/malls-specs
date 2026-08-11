import type { Catalogue, IndexEntry } from '@data-model';

function normalise(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Builds the search index from the live catalogue. `Catalogue.index` ships
 * empty (no pre-built index service exists yet), so this computes one on
 * every call — cheap while the catalogue is small.
 */
export function buildSearchIndex(catalogue: Catalogue): readonly IndexEntry[] {
  return Object.values(catalogue.specifications)
    .filter((spec) => spec.archivedAt === null)
    .map((spec) => {
      const body = [
        ...spec.blocks.flatMap((block) => block.lines.map((line) => line.text)),
        ...spec.metadata.map((field) => field.value ?? ''),
      ]
        .filter(Boolean)
        .join(' ');
      const tagNames = spec.tagIds.map((id) => catalogue.tags[id]?.name ?? '').join(' ');
      const normalised = normalise([spec.title, spec.code, spec.description, body, tagNames].join(' '));

      return {
        id: spec.id,
        title: spec.title,
        code: spec.code,
        description: spec.description,
        categoryId: spec.categoryId,
        subGroupId: spec.subGroupId,
        tagIds: spec.tagIds,
        status: spec.status,
        body,
        normalised,
        updatedAt: spec.updatedAt,
      };
    });
}

/** Every query term must appear somewhere in the entry's normalised text. */
export function searchIndex(query: string, index: readonly IndexEntry[]): readonly IndexEntry[] {
  const terms = normalise(query).split(' ').filter(Boolean);
  if (terms.length === 0) return [];
  return index.filter((entry) => terms.every((term) => entry.normalised.includes(term)));
}
