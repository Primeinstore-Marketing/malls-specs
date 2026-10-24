'use client';

import { toSummary } from '@data-model';
import { getCategoryNames } from '@/lib/catalogue';
import { useCollections } from './CollectionsContext';
import { SpecificationList } from '@/components/catalogue/SpecificationList';
import { specHref, useLiveData } from '@/lib/liveData';

export function BookmarksView() {
  const { collections, loaded } = useCollections();
  // Live, so admin edits and added screens show here too.
  const live = useLiveData();
  const { catalogue } = live;

  const items = collections.bookmarks
    .map((id) => catalogue.specifications[id])
    .filter((spec) => spec != null && spec.archivedAt === null)
    .map(toSummary);

  if (!loaded) return null;

  return (
    <SpecificationList
      hrefFor={(id) => specHref(id, live)}
      items={items}
      emptyTitle="No bookmarks yet"
      emptyDescription="Bookmark a specification from its detail page to save it here. Bookmarks are stored on this device only."
      categoryNames={getCategoryNames(catalogue)}
    />
  );
}
