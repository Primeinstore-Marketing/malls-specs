'use client';

import { toSummary } from '@data-model';
import { getCatalogue, getCategoryNames } from '@/lib/catalogue';
import { useCollections } from './CollectionsContext';
import { SpecificationList } from '@/components/catalogue/SpecificationList';

export function RecentlyViewedView() {
  const { collections, loaded } = useCollections();
  const catalogue = getCatalogue();

  const items = collections.recentlyViewed
    .map((record) => catalogue.specifications[record.specificationId])
    .filter((spec) => spec != null && spec.archivedAt === null)
    .map(toSummary);

  if (!loaded) return null;

  return (
    <SpecificationList
      items={items}
      emptyTitle="Nothing viewed yet"
      emptyDescription="Specifications you open will appear here, most recent first. This is stored on this device only."
      categoryNames={getCategoryNames(catalogue)}
    />
  );
}
