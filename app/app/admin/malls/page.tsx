import type { Metadata } from 'next';
import { Suspense } from 'react';
import { MallsAdmin } from '@/components/admin/MallsAdmin';

export const metadata: Metadata = { title: 'Malls' };

export default function Page() {
  return (
    <Suspense>
      <MallsAdmin />
    </Suspense>
  );
}
