import type { Metadata } from 'next';
import { ScreensAdmin } from '@/components/admin/ScreensAdmin';

export const metadata: Metadata = { title: 'Screens' };

export default function Page() {
  return <ScreensAdmin />;
}
