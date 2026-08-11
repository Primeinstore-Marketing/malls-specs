import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { SearchResultsView } from '@/components/search/SearchResultsView';

export const metadata: Metadata = {
  title: 'Search',
};

export default function SearchPage() {
  return (
    <div className="mx-auto flex max-w-page flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Search' }]} />

      <h1 className="text-display-xl text-fg">Search results</h1>

      <Suspense fallback={null}>
        <SearchResultsView />
      </Suspense>
    </div>
  );
}
