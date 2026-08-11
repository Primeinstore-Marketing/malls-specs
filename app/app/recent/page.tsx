import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { RecentlyViewedView } from '@/components/collections/RecentlyViewedView';

export const metadata: Metadata = {
  title: 'Recently viewed',
};

export default function RecentPage() {
  return (
    <div className="mx-auto flex max-w-page flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Recently viewed' }]} />

      <div>
        <h1 className="text-display-xl text-fg">Recently viewed</h1>
        <p className="mt-1 max-w-prose text-body-md text-fg-muted">
          Specifications you&apos;ve opened recently on this device, most recent first.
        </p>
      </div>

      <RecentlyViewedView />
    </div>
  );
}
