'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { networkStats, compact } from '@/lib/insights';
import { userById } from '@/lib/portal/logic';
import { usePortalUser } from '@/lib/portal/store';
import { AccountPicker, Page } from './ui';

export function SignInPage() {
  const next = useSearchParams().get('next') ?? '/portal';
  const { user } = usePortalUser();
  const s = networkStats();
  return (
    <Page>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:items-start">
        <div className="flex flex-col gap-5 rounded-3xl bg-brand-surface p-6 text-brand-on-surface sm:p-8">
          <span className="text-label-md font-semibold uppercase text-brand-on-surface-muted">Primedia Malls</span>
          <h1 className="text-display-xl">Plan, book and track mall media in one place</h1>
          <p className="text-body-lg text-brand-on-surface-muted">
            For Primedia sales: explore every screen, see who shops where, and take a campaign from brief to booking.
          </p>
          <dl className="grid grid-cols-3 gap-4">
            <div><dt className="text-body-sm text-brand-on-surface-muted">Malls</dt><dd className="text-display-md">{s.malls}</dd></div>
            <div><dt className="text-body-sm text-brand-on-surface-muted">Visits a year</dt><dd className="text-display-md">{compact(s.annualVisits)}</dd></div>
            <div><dt className="text-body-sm text-brand-on-surface-muted">Notice mall ads</dt><dd className="text-display-md">{s.noticeMallAds}%</dd></div>
          </dl>
        </div>
        <div className="flex flex-col gap-4">
          <h2 className="text-display-md text-fg">Sales sign in</h2>
          {user ? (
            <p className="text-body-md text-fg-muted">
              You’re signed in as {userById(user.id)?.name}. <Link href="/portal" className="font-semibold text-accent hover:underline">Go to your campaigns</Link>, or pick another account.
            </p>
          ) : null}
          <AccountPicker next={next} />
          <p className="text-body-sm text-fg-subtle">
            Demo account — campaigns are saved in this browser only. To see the client’s side, open a proposal’s client link (“Copy client link” on any campaign).
          </p>
        </div>
      </div>
    </Page>
  );
}
