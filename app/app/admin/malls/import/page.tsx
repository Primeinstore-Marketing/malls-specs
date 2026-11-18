import type { Metadata } from 'next';
import { Suspense } from 'react';
import { MallDeckImport } from '@/components/admin/MallDeckImport';

export const metadata: Metadata = { title: 'Update malls from decks' };

export default function Page() {
  return (
    <Suspense>
      <MallDeckImport />
    </Suspense>
  );
}
