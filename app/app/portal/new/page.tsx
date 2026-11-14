import type { Metadata } from 'next';
import { Suspense } from 'react';
import { NewCampaign } from '@/components/portal/NewCampaign';

export const metadata: Metadata = { title: 'New proposal' };

export default function Page() {
  return (
    <Suspense>
      <NewCampaign />
    </Suspense>
  );
}
