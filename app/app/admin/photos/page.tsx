import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PhotoRightsAdmin } from '@/components/admin/PhotoRightsAdmin';

export const metadata: Metadata = { title: 'Photo rights' };

export default function Page() {
  return (
    <Suspense>
      <PhotoRightsAdmin />
    </Suspense>
  );
}
