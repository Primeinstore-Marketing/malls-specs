import type { Metadata } from 'next';
import { PhotoRightsView } from '@/components/portal/PhotoRightsView';

export const metadata: Metadata = { title: 'Photo rights' };

export default function Page() {
  return <PhotoRightsView />;
}
