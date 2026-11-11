import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CampaignView } from '@/components/portal/CampaignView';

export const metadata: Metadata = { title: 'Campaign' };

export default function Page() {
  return (
    <Suspense>
      <CampaignView />
    </Suspense>
  );
}
