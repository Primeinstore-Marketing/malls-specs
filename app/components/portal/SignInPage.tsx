'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { networkStats, compact } from '@/lib/insights';
import { useLiveData } from '@/lib/liveData';
import { usePortalUser } from '@/lib/portal/store';
import { Page } from './ui';
import { useAdminSession } from '@/components/auth/AdminSession';
import { SignInForm } from '@/components/auth/SignInForm';

export function SignInPage() {
  const next = useSearchParams().get('next') ?? '/portal';
  const { user } = usePortalUser();
  useLiveData(); // the deck's data arrives from the API after the page loads
  const s = networkStats();
  const { isAdmin } = useAdminSession();
  const router = useRouter();
  return (
    <Page>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:items-start">
        <div className="flex min-w-0 flex-col gap-5 rounded-3xl bg-brand-surface p-6 text-brand-on-surface sm:p-8">
          <span className="text-label-md font-semibold uppercase text-brand-on-surface-muted">Primedia Malls</span>
          <h1 className="text-display-xl">Plan, book and track mall media in one place</h1>
          <p className="text-body-lg text-brand-on-surface-muted">
            For Primedia sales: explore every screen, see who shops where, and take a campaign from brief to booking.
          </p>
          <dl className={`grid grid-cols-3 gap-4 transition-opacity ${s.malls ? 'opacity-100' : 'invisible opacity-0'}`}>
            <div><dt className="text-body-sm text-brand-on-surface-muted">Malls</dt><dd className="text-display-sm sm:text-display-md">{s.malls}</dd></div>
            <div><dt className="text-body-sm text-brand-on-surface-muted">Visits a year</dt><dd className="text-display-sm sm:text-display-md">{compact(s.annualVisits)}</dd></div>
            <div><dt className="text-body-sm text-brand-on-surface-muted">Notice mall ads</dt><dd className="text-display-sm sm:text-display-md">{s.noticeMallAds}%</dd></div>
          </dl>
        </div>
        <div className="flex flex-col gap-4">
          <h2 className="text-display-md text-fg">Sign in</h2>
          {user ? (
            <p className="text-body-md text-fg-muted">
              You’re signed in as {user.name}. <Link href="/portal" className="font-semibold text-accent hover:underline">Go to your workspace</Link>
              {isAdmin ? <> or <Link href="/admin/malls" className="font-semibold text-accent hover:underline">Site admin</Link></> : null}.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex min-w-0 flex-col gap-3 rounded-2xl border border-border bg-bg p-5">
                <div>
                  <h3 className="text-body-lg font-semibold text-fg">Primedia staff</h3>
                  <p className="text-body-sm text-fg-muted">Sales and admins: your work email and password.</p>
                </div>
                <SignInForm autoFocus onSignedIn={() => router.push(next)} />
              </div>
              <div className="flex min-w-0 flex-col gap-2 rounded-2xl bg-bg-subtle p-5">
                <h3 className="text-body-lg font-semibold text-fg">Clients</h3>
                <p className="text-body-sm text-fg-muted">
                  You don’t need to sign in. Open the link your account manager emailed you: it shows every screen booked, the artwork to supply, and lets you change or approve the proposal.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Page>
  );
}
