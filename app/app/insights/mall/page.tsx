import type { Metadata } from 'next';
import { Suspense } from 'react';
import { MallInsight } from '@/components/insights/MallInsight';

export const metadata: Metadata = { title: 'Mall insights' };

export default function Page() {
  return (
    <Suspense>
      <MallInsight />
    </Suspense>
  );
}
