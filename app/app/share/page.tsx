import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AdminSessionProvider } from '@/components/auth/AdminSession';
import { ShareView } from '@/components/portal/ShareView';

export const metadata: Metadata = { title: 'Campaign proposal', robots: { index: false } };

/**
 * The client's booking page. It sits outside the site's shell; the session
 * provider is only there so staff who open a link (e.g. one a client sent
 * back with changes) can apply it to their saved campaign.
 */
export default function Page() {
  return (
    <Suspense>
      <AdminSessionProvider>
        <ShareView />
      </AdminSessionProvider>
    </Suspense>
  );
}
