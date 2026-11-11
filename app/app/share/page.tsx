import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ShareView } from '@/components/portal/ShareView';

export const metadata: Metadata = { title: 'Campaign proposal', robots: { index: false } };

export default function Page() {
  return (
    <Suspense>
      <ShareView />
    </Suspense>
  );
}
