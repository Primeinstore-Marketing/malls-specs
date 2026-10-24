'use client';

import { toSummary } from '@data-model';
import { getCategoryNames } from '@/lib/catalogue';
import { useCollections } from './CollectionsContext';
import { SpecificationList } from '@/components/catalogue/SpecificationList';
import { specHref, useLiveData } from '@/lib/liveData';

export function RecentlyViewedView() {
  const { collections, loaded } = useCollections();
  // Live, so admin edits and added screens show here too.
  const live = useLiveData();
  const { catalogue } = live;

  const items = collections.recentlyViewed
    .map((record) => catalogue.specifications[record.specificationId])
    .filter((spec) => spec != null && spec.archivedAt === null)
    .map(toSummary);

  if (!loaded) return null;

  return (
    <SpecificationList
      hrefFor={(id) => specHref(id, live)}
      items={items}
      emptyTitle="Nothing viewed yet"
      emptyDescription="Specifications you open will appear here, most recent first. This is stored on this device only."
      categoryNames={getCategoryNames(catalogue)}
    />
  );
}
