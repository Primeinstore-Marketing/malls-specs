import type { Metadata } from 'next';
import { ClientContactsPage } from '@/components/portal/AccountPage';

export const metadata: Metadata = { title: 'Client contacts' };

export default function Page() {
  return <ClientContactsPage />;
}
