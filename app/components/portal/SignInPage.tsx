'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { networkStats, compact } from '@/lib/insights';
import { useLiveData } from '@/lib/liveData';
import { userById } from '@/lib/portal/logic';
import { usePortalUser } from '@/lib/portal/store';
import { AccountPicker, Page } from './ui';
import { useAuthDialog } from '@/components/auth/AuthDialogContext';
import { useAdminSession } from '@/components/auth/AdminSession';

export function SignInPage() {
  const next = useSearchParams().get('next') ?? '/portal';
  const { user } = usePortalUser();
  useLiveData(); // the deck's data arrives from the API after the page loads
  const s = networkStats();
  const { setOpen: openAdminSignIn } = useAuthDialog();
  const { isAdmin, admin } = useAdminSession();
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
              You’re signed in as {userById(user.id)?.name}. <Link href="/portal" className="font-semibold text-accent hover:underline">Go to your campaigns</Link>, or pick another account.
            </p>
          ) : null}
          <AccountPicker next={next} />
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-bg p-5">
            <div className="flex min-w-0 flex-col">
              <h3 className="text-body-lg font-semibold text-fg">Admin</h3>
              <p className="text-body-sm text-fg-muted">
                {isAdmin ? `You’re signed in as ${admin?.name ?? 'an admin'}.` : 'Keep malls, screens, pictures, clients and photo rights up to date. Email and password.'}
              </p>
            </div>
            {isAdmin ? (
              <Link href="/admin/malls" className="inline-flex h-10 items-center rounded-full bg-accent px-4 text-body-sm font-semibold text-fg-on-accent hover:bg-accent-hover">Go to Site admin</Link>
            ) : (
              <button type="button" onClick={() => openAdminSignIn(true)} className="inline-flex h-10 items-center rounded-full border border-border-strong px-4 text-body-sm font-semibold text-fg hover:border-fg">
                Admin sign in
              </button>
            )}
          </div>
          <p className="text-body-sm text-fg-subtle">
            Demo account — campaigns are saved in this browser only. To see the client’s side, open a proposal’s client link (“Copy client link” on any campaign).
          </p>
        </div>
      </div>
    </Page>
  );
}
