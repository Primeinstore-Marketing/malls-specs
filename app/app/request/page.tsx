import type { Metadata } from 'next';
import Link from 'next/link';
import { RequestPage } from '@/components/request/RequestPage';
import { CLIENT_REQUESTS } from '@/lib/features';

export const metadata: Metadata = CLIENT_REQUESTS
  ? { title: 'Plan your campaign', description: 'Choose Primedia Malls screens, tell us when, and send your campaign to Primedia sales. No account needed.' }
  : { title: 'Book screens', robots: { index: false } };

export default function Page() {
  if (CLIENT_REQUESTS) return <RequestPage />;
  // Switched off for now (lib/features.ts): an old link lands here.
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-16">
      <h1 className="text-display-lg text-fg">Talk to your account manager</h1>
      <p className="text-body-lg text-fg-muted">To book screens, email your Primedia Malls account manager your brief or site list. They’ll send you a link to approve.</p>
      <Link href="/" className="self-start text-body-md font-semibold text-accent hover:underline">Back to the mall map</Link>
    </div>
  );
}
