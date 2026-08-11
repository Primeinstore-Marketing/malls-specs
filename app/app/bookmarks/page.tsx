import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { BookmarksView } from '@/components/collections/BookmarksView';

export const metadata: Metadata = {
  title: 'Bookmarks',
};

export default function BookmarksPage() {
  return (
    <div className="mx-auto flex max-w-page flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Bookmarks' }]} />

      <div>
        <h1 className="text-display-xl text-fg">Bookmarks</h1>
        <p className="mt-1 max-w-prose text-body-md text-fg-muted">
          Specifications you&apos;ve bookmarked on this device.
        </p>
      </div>

      <BookmarksView />
    </div>
  );
}
