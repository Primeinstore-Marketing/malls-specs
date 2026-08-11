import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getCatalogue, getCategoryTree, getTags } from '@/lib/catalogue';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { SearchBar } from '@/components/catalogue/SearchBar';
import { FilterPanel } from '@/components/catalogue/FilterPanel';
import { BrowseResultsView } from '@/components/catalogue/BrowseResultsView';

export const metadata: Metadata = {
  title: 'Browse',
};

export default function BrowsePage() {
  const catalogue = getCatalogue();
  const tree = getCategoryTree(catalogue);
  const tags = getTags(catalogue);

  return (
    <div className="mx-auto flex max-w-page flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Browse' }]} />

      <div>
        <h1 className="text-display-xl text-fg">Browse specifications</h1>
        <p className="mt-1 max-w-prose text-body-md text-fg-muted">
          Every specification in the catalogue, filterable by category, sub-group, status and tag.
        </p>
      </div>

      <SearchBar />

      <Suspense fallback={null}>
        <FilterPanel tree={tree} tags={tags} />
        <BrowseResultsView />
      </Suspense>
    </div>
  );
}
