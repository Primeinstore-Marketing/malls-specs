import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PortalHome } from '@/components/portal/PortalHome';

export const metadata: Metadata = { title: 'Workspace' };

export default function Page() {
  // The workspace reads its tab from the address (?tab=).
  return (
    <Suspense>
      <PortalHome />
    </Suspense>
  );
}
