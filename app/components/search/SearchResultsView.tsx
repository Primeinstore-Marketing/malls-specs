'use client';

import { useSearchParams } from 'next/navigation';
import { toSummary } from '@data-model';
import { getCategoryNames } from '@/lib/catalogue';
import { buildSearchIndex, searchIndex } from '@/lib/search';
import { SpecificationList } from '@/components/catalogue/SpecificationList';
import { specHref, useLiveData } from '@/lib/liveData';

export function SearchResultsView() {
  const searchParams = useSearchParams();
  const query = (searchParams.get('q') ?? '').trim();
  // Live, so admin edits and added screens show here too.
  const live = useLiveData();
  const { catalogue } = live;

  const items = query
    ? searchIndex(query, buildSearchIndex(catalogue))
        .map((entry) => catalogue.specifications[entry.id])
        .filter((spec) => spec != null)
        .map(toSummary)
    : [];

  return (
    <>
      <p className="max-w-prose text-body-md text-fg-muted">
        {query ? (
          <>
            Showing results for <span className="font-medium text-fg">“{query}”</span>
          </>
        ) : (
          'Enter a query to search titles, codes, descriptions and tags.'
        )}
      </p>

      <SpecificationList
        hrefFor={(id) => specHref(id, live)}
        items={items}
        emptyTitle={query ? 'No matching specifications' : 'No search query'}
        emptyDescription={
          query
            ? 'Try a different term, or browse the full catalogue instead.'
            : 'Use the search bar or press ⌘K to start a search.'
        }
        filtersApplied={Boolean(query)}
        categoryNames={getCategoryNames(catalogue)}
      />
    </>
  );
}
