import { Suspense } from 'react';
import type { Metadata } from 'next';
import { MediaExplorer } from '@/components/explorer/MediaExplorer';

export const metadata: Metadata = {
  title: 'Media Explorer',
  description: 'Every Primedia Malls and Hyprop Malls screen: search by mall, city or size, filter by portfolio, shape and province.',
};

export default function ExplorerPage() {
  return (
    <Suspense>
      <MediaExplorer />
    </Suspense>
  );
}
