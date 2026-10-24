'use client';

import { useSearchParams } from 'next/navigation';
import { SPEC_STATUSES } from '@data-model';
import type { CategoryId, SubGroupId, TagId, SpecStatus } from '@data-model';
import { getCategoryNames, getSpecificationSummaries } from '@/lib/catalogue';
import { SpecificationList } from './SpecificationList';
import { specHref, useLiveData } from '@/lib/liveData';

export function BrowseResultsView() {
  const searchParams = useSearchParams();
  // Live, so admin edits and added screens show here too.
  const live = useLiveData();
  const { catalogue } = live;

  const category = searchParams.get('category') ?? '';
  const subGroup = searchParams.get('subGroup') ?? '';
  const statusParam = searchParams.get('status') ?? '';
  const tag = searchParams.get('tag') ?? '';

  const status =
    statusParam && (SPEC_STATUSES as readonly string[]).includes(statusParam) ? (statusParam as SpecStatus) : undefined;

  const items = getSpecificationSummaries(catalogue, {
    categoryId: category ? (category as CategoryId) : undefined,
    subGroupId: subGroup ? (subGroup as SubGroupId) : undefined,
    status,
    tagId: tag ? (tag as TagId) : undefined,
  });
  const filtersApplied = Boolean(category || subGroup || statusParam || tag);

  return (
    <SpecificationList
      items={items}
      hrefFor={(id) => specHref(id, live)}
      filtersApplied={filtersApplied}
      categoryNames={getCategoryNames(catalogue)}
    />
  );
}
