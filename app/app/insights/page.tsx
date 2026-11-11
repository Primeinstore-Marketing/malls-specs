import type { Metadata } from 'next';
import { InsightsHome } from '@/components/insights/InsightsHome';

export const metadata: Metadata = { title: 'Audience insights' };

export default function Page() {
  return <InsightsHome />;
}
