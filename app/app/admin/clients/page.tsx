import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ClientsAdmin } from '@/components/admin/ClientsAdmin';

export const metadata: Metadata = { title: 'Clients' };

export default function Page() {
  return (
    <Suspense>
      <ClientsAdmin />
    </Suspense>
  );
}
