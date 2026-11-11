import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AccountsAdmin } from '@/components/admin/AccountsAdmin';

export const metadata: Metadata = { title: 'Accounts' };

export default function Page() {
  return (
    <Suspense>
      <AccountsAdmin />
    </Suspense>
  );
}
