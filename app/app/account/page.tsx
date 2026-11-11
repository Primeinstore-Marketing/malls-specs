import type { Metadata } from 'next';
import { AccountPage } from '@/components/portal/AccountPage';

export const metadata: Metadata = { title: 'Your account' };

export default function Page() {
  return <AccountPage />;
}
