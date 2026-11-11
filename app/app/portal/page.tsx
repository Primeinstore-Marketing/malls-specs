import type { Metadata } from 'next';
import { PortalHome } from '@/components/portal/PortalHome';

export const metadata: Metadata = { title: 'Campaigns' };

export default function Page() {
  return <PortalHome />;
}
