import type { Metadata } from 'next';
import { RequestPage } from '@/components/request/RequestPage';

export const metadata: Metadata = {
  title: 'Plan your campaign',
  description: 'Choose Primedia Malls screens, tell us when, and send your campaign to Primedia sales. No account needed.',
};

export default function Page() {
  return <RequestPage />;
}
