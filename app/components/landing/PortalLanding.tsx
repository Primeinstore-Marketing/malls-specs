'use client';

import { CLIENT_REQUESTS } from '@/lib/features';
import Image from 'next/image';
import Link from 'next/link';
import { compact, networkStats } from '@/lib/insights';
import { useLiveData } from '@/lib/liveData';
import { getMalls } from '@/lib/malls';
import { withBasePath } from '@/lib/basePath';
import { useAuthDialog } from '@/components/auth/AuthDialogContext';

/**
 * What a first-time visitor sees on the home page: what the portal does,
 * for whom, and how to get in. The spec library follows underneath.
 * Uses only Primedia's own hero photo (deck photos aren't cleared yet).
 */

const STEPS = [
  CLIENT_REQUESTS
    ? ['Plan it, or send us your site list', 'Plan your own campaign here: pick malls and screens, add your dates and send it to sales. Or email your account manager the site list or brief you already have (Excel, PDF, Word or PowerPoint). Either way, they turn it into a proposal.']
    : ['Send us your site list or brief', 'Email your account manager the booking sheet, site list or brief you already have: Excel, PDF, Word or PowerPoint. They turn it into a proposal in minutes.'],
  ['You get one link', 'It opens your site list, grouped by creative: how many videos or stills to make, at what size, with the template for each. No account needed.'],
  ['Approve in one click', 'Approve the whole site list, or ask for changes with a note to your account manager.'],
  ['Send the artwork', 'One file per creative, built in its After Effects template, before the campaign starts.'],
] as const;

/** The four groups the site serves, each with its way in. Matches Phase 5 — Portal UX Design, section 2. */
const AUDIENCES = [
  ['Visitors', 'Designers, agencies and studios: find a screen, check its size, download the spec sheet and After Effects template. No sign-in.'],
  ['Sales', 'Primedia account managers: drop the client’s site list or brief and the proposal fills itself in. Check it and email the client one link.'],
  ['Clients', CLIENT_REQUESTS ? 'Brands and agencies: plan your own campaign and send it to sales, or send your site list. Then approve the proposal from one link that shows how many creatives to supply.' : 'Brands and agencies: send your site list, then approve it from one link that shows how many creatives to supply.'],
  ['Admin', 'Primedia staff: keep malls, screens, pictures, clients, photo rights and accounts up to date.'],
] as const;

export function PortalLanding() {
  const live = useLiveData(); // the deck's data arrives from the API after the page loads
  const s = networkStats();
  // The same count as the mall list and map (the deck covers fewer malls than the site).
  const mallCount = getMalls(live.catalogue).filter((m) => m.group !== 'formats').length;
  const ready = s.malls > 0;
  const { setOpen: openAdminSignIn } = useAuthDialog();
  const link = 'mt-auto self-start text-body-sm font-semibold text-accent hover:underline';
  const ways: Record<(typeof AUDIENCES)[number][0], React.ReactNode> = {
    Visitors: <a href="#specs" className={link}>Browse screen specs</a>,
    Sales: <Link href="/sign-in" className={link}>Sign in</Link>,
    Clients: CLIENT_REQUESTS ? <Link href="/request" className={link}>Plan your campaign</Link> : <a href="#how-title" className={link}>How it works</a>,
    Admin: <button type="button" onClick={() => openAdminSignIn(true)} className={link}>Admin sign in</button>,
  };
  return (
    <div className="flex flex-col">
      <section className="relative overflow-hidden bg-brand-surface text-brand-on-surface">
        <div className="absolute inset-0 hidden lg:block">
          <Image src={withBasePath('/hero/mall-atrium.jpg')} alt="" fill priority sizes="60vw" className="object-cover object-center opacity-60 [mask-image:linear-gradient(to_left,black_35%,transparent_75%)]" />
        </div>
        <div className="relative mx-auto flex max-w-page flex-col gap-8 px-4 py-14 sm:px-6 lg:px-8 lg:py-24">
          <div className="flex max-w-2xl flex-col gap-5">
            <span className="text-label-md font-semibold uppercase text-brand-on-surface-muted">Primedia Malls media portal</span>
            <h1 className="text-display-2xl">Put your brand where South Africa shops</h1>
            <p className="text-body-lg text-brand-on-surface-muted">
              Digital screens in {mallCount ? `${mallCount} malls` : 'malls'} across South Africa. Your booking shows every screen you’ll be on and the artwork size each one needs.
            </p>
            <div className="flex flex-wrap gap-3">
              {CLIENT_REQUESTS ? (
                <>
                  <Link href="/request" className="inline-flex h-12 items-center rounded-full bg-accent px-6 text-body-md font-semibold text-fg-on-accent hover:bg-accent-hover">
                    Plan your campaign
                  </Link>
                  <Link href="/sign-in" className="inline-flex h-12 items-center rounded-full border border-white/25 px-6 text-body-md font-semibold text-brand-on-surface hover:bg-white/10">
                    Sales sign in
                  </Link>
                </>
              ) : (
                <Link href="/sign-in" className="inline-flex h-12 items-center rounded-full bg-accent px-6 text-body-md font-semibold text-fg-on-accent hover:bg-accent-hover">
                  Sign in
                </Link>
              )}
              <a href="#specs" className="inline-flex h-12 items-center rounded-full border border-white/25 px-6 text-body-md font-semibold text-brand-on-surface hover:bg-white/10">
                Browse screen specs
              </a>
            </div>
          </div>
          <p className="text-body-sm text-brand-on-surface-muted">Booked with us? Open the link in your email from your account manager.</p>
          <dl className={`grid max-w-2xl grid-cols-3 gap-6 border-t border-white/15 pt-6 transition-opacity ${ready ? 'opacity-100' : 'invisible opacity-0'}`}>
            <div><dt className="text-body-sm text-brand-on-surface-muted">Visits a year</dt><dd className="text-display-md">{compact(s.annualVisits)}</dd></div>
            <div><dt className="text-body-sm text-brand-on-surface-muted">Notice mall ads</dt><dd className="text-display-md">{s.noticeMallAds}%</dd></div>
            <div><dt className="text-body-sm text-brand-on-surface-muted">Provinces</dt><dd className="text-display-md">{s.provinces}</dd></div>
          </dl>
        </div>
      </section>

      <section className="mx-auto flex w-full max-w-page flex-col gap-6 px-4 pt-14 sm:px-6 lg:px-8 lg:pt-20" aria-labelledby="who-title">
        <h2 id="who-title" className="text-display-lg text-fg">Who it’s for</h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {AUDIENCES.map(([who, text], i) => (
            <li key={who} className="flex flex-col gap-2 rounded-2xl border border-border bg-bg p-5">
              <span className="text-label-md font-semibold uppercase text-fg-muted">{i + 1}</span>
              <h3 className="text-body-lg font-semibold text-fg">{who}</h3>
              <p className="text-body-sm text-fg-muted">{text}</p>
              {ways[who]}
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto grid w-full max-w-page gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:px-8 lg:py-20" aria-labelledby="how-title">
        <div className="flex flex-col gap-3">
          <h2 id="how-title" className="text-display-lg text-fg">How it works</h2>
          <p className="text-body-md text-fg-muted">For clients and their agencies: {CLIENT_REQUESTS ? 'from your plan or site list' : 'from your site list'} to approved screens and artwork, in four steps.</p>
          {CLIENT_REQUESTS ? <Link href="/request" className="self-start text-body-sm font-semibold text-accent hover:underline">Plan your campaign →</Link> : null}
        </div>
        <ol className="grid gap-6 sm:grid-cols-2">
          {STEPS.map(([title, text], i) => (
            <li key={title} className="flex flex-col gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-subtle text-body-md font-bold text-accent">{i + 1}</span>
              <h3 className="text-body-lg font-semibold text-fg">{title}</h3>
              <p className="text-body-sm text-fg-muted">{text}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
