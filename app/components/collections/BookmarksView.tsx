'use client';

import { toSummary } from '@data-model';
import { getCatalogue, getCategoryNames } from '@/lib/catalogue';
import { useCollections } from './CollectionsContext';
import { SpecificationList } from '@/components/catalogue/SpecificationList';

export function BookmarksView() {
  const { collections, loaded } = useCollections();
  const catalogue = getCatalogue();

  const items = collections.bookmarks
    .map((id) => catalogue.specifications[id])
    .filter((spec) => spec != null && spec.archivedAt === null)
    .map(toSummary);

  if (!loaded) return null;

  return (
    <SpecificationList
      items={items}
      emptyTitle="No bookmarks yet"
      emptyDescription="Bookmark a specification from its detail page to save it here. Bookmarks are stored on this device only."
      categoryNames={getCategoryNames(catalogue)}
    />
  );
}
