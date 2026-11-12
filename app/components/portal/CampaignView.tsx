'use client';

import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { mallArea, mallName, mallPhoto, matchMalls } from '@/lib/insights';
import { useLiveData } from '@/lib/liveData';
import type { DeckMall } from '@/lib/insights';
import {
  STEP_LABELS,
  canEdit,
  campaignClientName, clientName,
  days,
  formatRange,
  formatDate,
  itemKey,
  itemLabel,
  itemMall,
  docKind,
  docWords,
  phase,
  progress,
  stepIndex,
  timeAgo,
  userById,
  visibleTo,
} from '@/lib/portal/logic';
import { CLIENTS } from '@/lib/portal/seed';
import { campaignOwner, portal, usePortalState } from '@/lib/portal/store';
import type { Campaign, CampaignItem, NewCampaignItem, PortalUser, SiteItem } from '@/lib/portal/types';
import { EmptyState } from '@/components/ui/EmptyState';
import { AddToProposal, Avatar, Page, RequireSignIn, StatusPill } from './ui';
import { artworkSizes, campaignScreens, creativeGroups, screensFor, sheetHref } from '@/lib/portal/screens';
import { CreativeGroups, creativeSummary } from './CreativeGroups';
import { SiteMatch } from './SiteMatch';
import { unmatchedSummary } from '@/lib/portal/siteStatus';
import { getMalls } from '@/lib/malls';
import { SizeDownloads } from './SizeDownloads';
import { Zoomable } from '@/components/ui/ImageViewer';
import { buildClientEmail } from '@/lib/portal/email';
import { getScreenSize } from '@/lib/malls';
import { itemKey as itemKeyOf } from '@/lib/portal/mallScreens';
import { Emailer } from './Emailer';
import type { EmailKind } from '@/lib/portal/email';
import { ClientField } from './ClientField';
import { campaignContact, shareUrl } from '@/lib/portal/share';
import { Shape } from './ShareView';
import { canDeleteDraft, countdown, DeleteDraftButton } from './CampaignCard';
import { useAdminSession } from '@/components/auth/AdminSession';
import { RateCardEditor } from './RateCardEditor';

/**
 * One campaign, for whichever side is looking. Top to bottom: what it is,
 * where it's up to, the one thing to do next, the numbers, the media, and
 * a single timeline of messages and changes.
 */

const input =
  'h-11 w-full rounded-xl border border-border-strong bg-bg px-3 text-body-md text-fg outline-none transition-colors focus:border-border-focus disabled:border-transparent disabled:bg-bg-subtle disabled:text-fg';
const btn = {
  primary: 'inline-flex h-11 items-center justify-center rounded-full bg-accent px-5 text-body-sm font-semibold text-fg-on-accent hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40',
  secondary: 'inline-flex h-11 items-center justify-center rounded-full border border-border-strong bg-bg px-5 text-body-sm font-semibold text-fg hover:border-fg disabled:opacity-40',
  quiet: 'inline-flex h-11 items-center justify-center rounded-full px-4 text-body-sm font-semibold text-fg-muted hover:bg-bg-subtle hover:text-fg',
};
const label = 'text-label-md font-semibold uppercase text-fg-muted';

/* ---------- Progress ---------- */

function Steps({ c, role }: { c: Campaign; role: PortalUser['role'] }) {
  const at = stepIndex(c.status);
  return (
    <ol className="grid grid-cols-2 gap-2" aria-label="Progress">
      {(role === 'sales' && docKind(c) === 'sitelist' ? ['Site list', 'Site list sent'] : STEP_LABELS[role]).map((name, i) => (
        <li key={name} className="flex min-w-0 flex-col gap-2" aria-current={i === at ? 'step' : undefined}>
          <span className={`h-1 rounded-full ${i <= at ? 'bg-accent' : 'bg-bg-muted'}`} />
          <span className={`truncate text-body-sm ${i === at ? 'font-semibold text-fg' : i < at ? 'text-fg-muted' : 'text-fg-subtle'}`}>{name}</span>
        </li>
      ))}
    </ol>
  );
}

/* ---------- The next step ---------- */

function Checklist({ items }: { items: { done: boolean; text: string; href: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Before you send">
      {items.map((i) => (
        <li key={i.text}>
          {i.done ? (
            <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-success-bg px-3 text-body-sm font-medium text-success-fg">✓ {i.text}</span>
          ) : (
            <a href={i.href} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-dashed border-border-strong px-3 text-body-sm font-medium text-fg hover:border-accent hover:text-accent">
              + {i.text}
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

/** The client in a sentence: their name, or "the client" when there isn't one yet. */
const who = (c: Campaign) => (c.clientId || c.prospect?.company || c.prospect?.name ? campaignClientName(c) : 'the client');

/* ---------- Email to the client ---------- */

/** A ready-to-send email to the client, built from the latest version of the campaign. */
function useClientEmail(c: Campaign, user: PortalUser) {
  const { catalogue } = useLiveData();
  return (kind: EmailKind, note = '') => buildClientEmail(c, user, catalogue, kind, note);
}

/** The changes a client sent from their booking page: what they'd add, remove and move, to apply or set aside. */
function ClientChangesBox({ c }: { c: Campaign }) {
  const ch = c.clientChanges;
  if (!ch) return null;
  const key = (i: NewCampaignItem | CampaignItem) => itemKeyOf(i);
  const now = new Set(c.items.map(key));
  const asked = new Set(ch.items.map(key));
  const added = ch.items.filter((i) => !now.has(key(i)));
  const removed = c.items.filter((i) => !asked.has(key(i)));
  const dates = ch.start !== c.start || ch.end !== c.end;
  const label = (i: NewCampaignItem | CampaignItem) => itemLabel(i as CampaignItem);
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-accent bg-bg p-4">
      <strong className="text-body-md text-fg">{ch.name || 'The client'} asked for these changes · {timeAgo(ch.at)}</strong>
      <ul className="flex flex-col gap-1 text-body-sm text-fg">
        {added.length ? <li><span className="font-semibold text-success-fg">Add {added.length}:</span> {added.map(label).join('; ')}</li> : null}
        {removed.length ? <li><span className="font-semibold text-danger-fg">Remove {removed.length}:</span> {removed.map(label).join('; ')}</li> : null}
        {dates ? <li><span className="font-semibold">New dates:</span> {formatRange(ch.start, ch.end)} (now {formatRange(c.start, c.end)})</li> : null}
        {!added.length && !removed.length && !dates ? <li className="text-fg-muted">Same screens and dates as now.</li> : null}
      </ul>
      {ch.note ? <p className="rounded-xl bg-bg-subtle px-3 py-2 text-body-sm text-fg">“{ch.note}”</p> : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btn.primary} onClick={() => portal.applyClientChanges(c.id, { items: ch.items, start: ch.start, end: ch.end }, 'Applied the changes the client asked for')}>
          Apply these changes
        </button>
        <button type="button" className={btn.quiet} onClick={() => portal.dismissClientChanges(c.id)}>Set aside</button>
      </div>
      <p className="text-body-sm text-fg-muted">After applying, check the plan and send the updated proposal. The client’s link always shows the latest version.</p>
    </div>
  );
}

/** What the signed-in user can do next, given where the campaign is. */
function NextStep({ c, user }: { c: Campaign; user: PortalUser }) {
  // A note the AI drafted from the client's brief, when the proposal started that way.
  const [note, setNote] = useState(() => {
    try {
      return sessionStorage.getItem(`malls-specs:draft-note:${c.id}`) ?? '';
    } catch {
      return '';
    }
  });
  const [asking, setAsking] = useState(false);
  const sales = user.role === 'sales';
  const email = useClientEmail(c, user);
  const contact = campaignContact(c);
  // The builder's "Create and email" lands here with ?email=1: open the emailer straight away.
  const params = useSearchParams();
  const [emailing, setEmailing] = useState<EmailKind | null>(() => (params.get('email') === '1' && ['draft', 'changes', 'proposed'].includes(c.status) && c.items.length ? 'proposal' : null));
  const sentNote = useRef('');

  // Proposal (screens we suggest) or site list (from PIMS, once booked): the words follow.
  const w = docWords(c);
  const pimsNext =
    docKind(c) === 'proposal' ? (
      <Link href={`/portal/new?kind=sitelist&from=${c.id}`} className={btn.secondary}>Next: site list from PIMS</Link>
    ) : null;

  /** The account manager approves the proposal or site list for the client (who agreed by email, phone or in a meeting). */
  const approveForClient = () => {
    const how = window.prompt(
      `Approve the ${w.noun} for ${who(c)}? It moves the campaign to “Approved” so you can confirm the booking.\n\nHow did the client agree? (optional, e.g. “by email from Thandi, 12 Nov”)`,
      '',
    );
    if (how === null) return;
    portal.move(c.id, 'approved', `${w.Noun} approved by ${user.name} for the client${how.trim() ? `: ${how.trim()}` : '.'}`);
  };

  let title = '';
  let body: React.ReactNode = null;
  let tone: 'accent' | 'danger' | 'quiet' = 'accent';

  if (sales && ['draft', 'proposed', 'changes'].includes(c.status)) {
    const checks = [
      { done: Boolean(c.start && c.end), text: 'Dates', href: '#f-start' },
      { done: c.items.length > 0, text: 'Screens', href: '#media' },
    ];
    const ready = checks.every((x) => x.done);
    title = c.status === 'proposed' ? `${campaignClientName(c)} sent a request` : c.status === 'changes' ? 'Changes requested' : `Build the ${w.noun}`;
    body = (
      <>
        <ClientChangesBox c={c} />
        <p className="text-body-md text-fg-muted">
          {c.status === 'proposed' ? 'Shape the plan, then send it back as a proposal.' : c.status === 'changes' ? 'See what they asked for in the updates below.' : 'Send it to the client when it’s ready.'}
        </p>
        <Checklist items={checks} />
        {!contact?.email ? <p className="text-body-sm text-fg-muted">No client email yet — add one in <a href="#f-client" className="font-semibold text-accent hover:underline">Campaign details</a> below, or type it into the email.</p> : null}
        <textarea id="f-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Note for the client (optional)" className={`${input} h-auto py-2.5`} />
        <div className="flex flex-wrap gap-2">
          {ready ? (
            <button type="button" className={btn.primary} onClick={() => { sentNote.current = note; setEmailing('proposal'); }}>
              {contact?.name ? `Email ${w.noun} to ${contact.name.split(' ')[0]}` : `Email ${w.noun}`}
            </button>
          ) : (
            <button type="button" disabled className={btn.primary}>Email {w.noun} to client</button>
          )}
          {ready ? <button type="button" className={btn.secondary} onClick={approveForClient}>{w.approve} for the client</button> : null}
          {ready && docKind(c) === 'proposal' ? <DeckButton c={c} user={user} variant="secondary" /> : null}
          {c.status !== 'draft' ? <button type="button" className={btn.quiet} onClick={() => portal.move(c.id, 'declined', note)}>{c.status === 'proposed' ? 'Decline request' : 'Decline'}</button> : null}
        </div>
      </>
    );
  } else if (sales && c.status === 'approved') {
    title = `${w.Noun} approved`;
    body = (
      <>
        <p className="text-body-md text-fg-muted">Confirm to lock in the dates.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btn.primary} onClick={() => portal.move(c.id, 'booked')}>Confirm booking</button>
          {pimsNext}
          <button type="button" className={btn.quiet} onClick={() => portal.move(c.id, 'changes', 'Reopened to adjust the plan.')}>Reopen to edit</button>
        </div>
      </>
    );
  } else if (sales && c.status === 'sent') {
    title = `Waiting for ${who(c)}`;
    tone = 'quiet';
    body = (
      <>
        <p className="text-body-md text-fg-muted">They can approve the {w.noun} from the link in the email. If they agreed another way (email, phone, a meeting), approve it for them. Changed something since? “Email a reminder” sends the latest version.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btn.primary} onClick={approveForClient}>
            {w.approve} for the client
          </button>
          <button type="button" className={btn.secondary} onClick={() => setEmailing('reminder')}>Email a reminder</button>
          <button type="button" className={btn.quiet} onClick={() => portal.move(c.id, 'changes', 'Taken back to make changes.')}>Take back to edit</button>
        </div>
      </>
    );
  } else if (sales && c.status === 'booked' && phase(c) !== 'completed') {
    title = 'Booked';
    tone = 'quiet';
    body = (
      <>
        <p className="text-body-md text-fg-muted">Send {contact?.name.split(' ')[0] ?? 'the client'} the confirmation with the screens and artwork sizes. If you change the booking, send it again: it always has the latest version.</p>
        {docKind(c) === 'proposal' ? <p className="text-body-sm text-fg-muted">Once it’s booked in PIMS, make the site list from the PIMS export: the client approves the screens, and everyone sees how many files to make with which templates.</p> : null}
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btn.secondary} onClick={() => setEmailing('booked')}>Email booking confirmation</button>
          {pimsNext}
        </div>
      </>
    );
  } else if (!sales && c.status === 'draft') {
    title = 'Send your brief';
    body = (
      <>
        <p className="text-body-md text-fg-muted">Your account manager will come back with a proposal.</p>
        <Checklist items={[{ done: Boolean(c.start && c.end), text: 'Dates', href: '#f-start' }]} />
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Anything we should know? (optional)" className={`${input} h-auto py-2.5`} />
        <button type="button" disabled={!c.start || !c.end} className={`${btn.primary} self-start`} onClick={() => { portal.move(c.id, 'proposed', note); setNote(''); }}>
          Send brief to Primedia
        </button>
      </>
    );
  } else if (!sales && c.status === 'sent') {
    title = 'Your proposal is ready';
    body = asking ? (
      <>
        <textarea autoFocus value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="What would you like changed?" className={`${input} h-auto py-2.5`} />
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={!note.trim()} className={btn.primary} onClick={() => { portal.move(c.id, 'changes', note); setNote(''); setAsking(false); }}>Send to Primedia</button>
          <button type="button" className={btn.quiet} onClick={() => setAsking(false)}>Cancel</button>
        </div>
      </>
    ) : (
      <>
        <p className="text-body-md text-fg-muted">
          Check the screens and dates, then approve.
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btn.primary} onClick={() => portal.move(c.id, 'approved')}>Approve proposal</button>
          <button type="button" className={btn.secondary} onClick={() => setAsking(true)}>Request changes</button>
          <button type="button" className={btn.quiet} onClick={() => { if (window.confirm('Decline this proposal? Primedia will be told.')) portal.move(c.id, 'declined'); }}>Decline</button>
        </div>
      </>
    );
  } else if (!sales && ['proposed', 'changes', 'approved'].includes(c.status)) {
    title = c.status === 'approved' ? 'You approved this' : 'With Primedia';
    tone = 'quiet';
    body = <p className="text-body-md text-fg-muted">{c.status === 'approved' ? 'Primedia is confirming the booking.' : 'Your account manager is working on it.'}</p>;
  }
  if (!body) return null;
  const tones = {
    accent: 'bg-accent-subtle',
    danger: 'bg-danger-bg',
    quiet: 'bg-bg-subtle',
  };
  return (
    <section aria-labelledby="next-title" className={`flex flex-col gap-3 rounded-3xl p-5 sm:p-6 print:hidden ${tones[tone]}`}>
      <h2 id="next-title" className="text-body-lg font-semibold text-fg">{title}</h2>
      {body}
      {emailing ? (
        <Emailer
          email={email(emailing, emailing === 'proposal' ? sentNote.current || note : '')}
          title={{ proposal: 'Email the proposal', reminder: 'Email a reminder', booked: 'Email the booking confirmation' }[emailing]}
          doneLabel={emailing === 'proposal' ? 'I’ve sent it — mark as sent' : 'I’ve sent it'}
          onSent={() => {
            if (emailing === 'proposal') {
              portal.move(c.id, 'sent', sentNote.current || note);
              setNote('');
            } else portal.message(c.id, emailing === 'booked' ? 'Emailed the booking confirmation.' : 'Emailed a reminder.');
          }}
          onClose={() => setEmailing(null)}
        />
      ) : null}
    </section>
  );
}

/* ---------- Numbers ---------- */

function Numbers({ c }: { c: Campaign }) {
  const { catalogue } = useLiveData();
  const screens = campaignScreens(c.items, catalogue);
  const { sizes, unknown } = artworkSizes(screens);
  const total = screens.reduce((n, x) => n + x.qty, 0);
  const malls = new Set(c.items.map((i) => itemMall(i)?.id ?? i.id)).size;
  const ph = phase(c);
  const p = progress(c);
  const flight = days(c.start, c.end);
  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-3 gap-6 sm:max-w-xl">
        <div><dt className="text-body-sm text-fg-muted">Malls</dt><dd className="text-display-md text-fg">{malls}</dd></div>
        <div><dt className="text-body-sm text-fg-muted">Screens</dt><dd className="text-display-md text-fg">{total}</dd></div>
        <div><dt className="text-body-sm text-fg-muted">{ph === 'live' ? 'Through the flight' : 'Days'}</dt><dd className="text-display-md text-fg">{ph === 'live' ? `${Math.round(p * 100)}%` : flight || '—'}</dd></div>
      </dl>
      {sizes.length || unknown ? (
        <section aria-labelledby="sizes-title" className="flex flex-col gap-3 rounded-3xl bg-bg-subtle p-5">
          <h2 id="sizes-title" className={label}>Artwork sizes needed</h2>
          <ul className="flex flex-wrap gap-3">
            {sizes.map((z) => (
              <li key={`${z.width}x${z.height}`} className="flex items-center gap-3 rounded-2xl bg-bg px-4 py-3">
                <span className="flex h-9 w-9 items-center justify-center"><Shape w={z.width} h={z.height} size={34} /></span>
                <span className="flex flex-col">
                  <span className="text-body-md font-semibold tabular-nums text-fg">{z.width} × {z.height} px</span>
                  <span className="text-body-sm text-fg-muted">{z.orientation} · {z.screens} {z.screens === 1 ? 'screen' : 'screens'}</span>
                </span>
                <span className="ml-2"><SizeDownloads files={z.files} compact /></span>
              </li>
            ))}
            {unknown ? <li className="flex items-center rounded-2xl border border-dashed border-border-strong px-4 py-3 text-body-sm text-fg-muted">{unknown} {unknown === 1 ? 'screen' : 'screens'}: size to confirm</li> : null}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/* ---------- Screens ---------- */

/** The client's site list on this campaign, grouped by the creative each line needs, with what still needs checking. */
function SiteList({ c, editable }: { c: Campaign; editable: boolean }) {
  const { catalogue } = useLiveData();
  const sites = c.items.filter((i): i is SiteItem => i.kind === 'site').sort((a, b) => (a.no ?? 0) - (b.no ?? 0));
  const screens = campaignScreens(sites, catalogue);
  const groups = creativeGroups(sites, screens);
  const toCheck = sites.filter((x) => !x.specId).length;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-body-sm text-fg-muted">
        {sites.length} {sites.length === 1 ? 'site' : 'sites'} from the client’s list in {groups.length} {groups.length === 1 ? 'creative group' : 'creative groups'}. {creativeSummary(groups, 'site', 'sales')}
        {toCheck ? <> <span className="font-semibold text-warning-fg">{toCheck} not matched to a screen on the site:</span></> : null}
      </p>
      {toCheck ? (
        <ul className="list-disc pl-5 text-body-sm text-fg">
          {unmatchedSummary(sites, getMalls(catalogue)).map((m) => <li key={m}>{m}</li>)}
        </ul>
      ) : null}
      {editable && toCheck ? <SiteMatch lines={sites} onMatch={(ids, specId, appMallId) => portal.matchSites(c.id, ids, specId, appMallId)} /> : null}
      <CreativeGroups key={groups.map((g) => `${g.key}:${g.count}`).join(',')} groups={groups} start={c.start} end={c.end} audience="sales" onRemove={editable ? (itemId) => portal.remove(c.id, itemId) : undefined} />
    </div>
  );
}

function Items({ c, user }: { c: Campaign; user: PortalUser }) {
  const editable = canEdit(c, user);
  const { catalogue } = useLiveData();
  const groups = new Map<string, { mall: DeckMall | undefined; items: CampaignItem[] }>();
  for (const i of c.items) {
    const m = itemMall(i);
    const k = m?.id ?? 'other';
    groups.set(k, { mall: m, items: [...(groups.get(k)?.items ?? []), i] });
  }
  if (!c.items.length) {
    return <EmptyState title="No screens yet." description="Add screens from the Media Explorer or packages from Insights." />;
  }
  return (
    <div className="flex flex-col gap-3">
      {[...groups.values()].map(({ mall, items }) => {
        const photo = mall ? mallPhoto(mall.id) : null;
        return (
          <div key={mall?.id ?? 'other'} className="overflow-hidden rounded-2xl border border-border bg-bg print:break-inside-avoid">
            <div className="flex items-center gap-3 px-4 py-3">
              {photo ? <Zoomable src={photo.src} title={mall ? mallName(mall) : 'Mall'} detail={mall ? mallArea(mall) : undefined} className="h-11 w-16 rounded-lg" /> : null}
              <div className="flex min-w-0 flex-col">
                {mall ? (
                  <Link href={`/insights/mall?id=${mall.id}`} className="truncate text-body-md font-semibold text-fg hover:text-accent">{mallName(mall)}</Link>
                ) : (
                  <span className="text-body-md font-semibold text-fg">Other screens</span>
                )}
                <span className="truncate text-body-sm text-fg-muted">{mall ? mallArea(mall) : ''}</span>
              </div>
            </div>
            <ul className="border-t border-border">
              {items.map((i) => {
                return screensFor(i, catalogue).map((sc, n) => (
                  <li key={`${i.id}-${n}`} className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-0">
                    <span className="flex h-10 w-12 shrink-0 items-center justify-center"><Shape w={sc.width} h={sc.height} size={40} /></span>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-body-md font-medium text-fg">{sc.title}</span>
                      <span className="text-body-sm tabular-nums text-fg-muted">
                        {sc.width && sc.height ? `${sc.width} × ${sc.height} px` : 'Size to confirm'}
                        {sc.orientation ? ` · ${sc.orientation}` : ''}
                        {sc.ratio ? ` · ${sc.ratio}` : ''}
                        {i.kind === 'package' ? ` · ${i.code}` : ''}
                      </span>
                      {sc.assumed ? <span className="text-[12px] text-warning-fg">{sc.assumed}</span> : null}
                    </div>
                    <span className="shrink-0 text-body-md font-semibold tabular-nums text-fg">× {sc.qty}</span>
                    {sc.specId ? (
                      <Link href={`/spec/${sc.specId}`} className="shrink-0 text-body-sm font-semibold text-accent hover:underline print:hidden">Spec</Link>
                    ) : null}
                    {editable && n === 0 ? (
                      <button
                        type="button"
                        onClick={() => portal.remove(c.id, i.id)}
                        aria-label={`Remove ${itemLabel(i)}`}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-fg-subtle hover:bg-bg-subtle hover:text-danger-fg print:hidden"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
                      </button>
                    ) : null}
                  </li>
                ));
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function Suggestions({ c }: { c: Campaign }) {
  if (!c.audience) return null;
  const inIt = new Set(c.items.map((i) => itemMall(i)?.id));
  const ideas = matchMalls(c.audience).filter((m) => !inIt.has(m.mall.id) && m.mall.packages.length).slice(0, 3);
  if (!ideas.length) return null;
  return (
    <section className="flex flex-col gap-3 print:hidden" aria-labelledby="suggest-title">
      <h2 id="suggest-title" className={label}>Also fits this audience</h2>
      <ul className="grid gap-2 md:grid-cols-3">
        {ideas.map((m) => (
          <li key={m.mall.id} className="flex flex-col gap-2 rounded-2xl bg-bg-subtle p-3">
            <span className="flex items-baseline justify-between gap-2">
              <span className="truncate text-body-md font-semibold text-fg">{mallName(m.mall)}</span>
              <span className="text-body-sm font-bold tabular-nums text-accent">{m.score}</span>
            </span>
            <span className="text-body-sm text-fg-muted">{m.reasons[0]}</span>
            <div><AddToProposal compact item={{ kind: 'package', code: m.mall.packages[0].code }} /></div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ---------- Details ---------- */

function Details({ c, user }: { c: Campaign; user: PortalUser }) {
  const editable = canEdit(c, user);
  const sales = user.role === 'sales';
  // Read-only: a short list. Editable: the form. Print always gets the list.
  const summary = (
    <dl className={`grid gap-x-6 gap-y-3 rounded-2xl bg-bg-subtle p-5 text-body-md ${editable ? 'hidden print:grid' : ''}`}>
      <div><dt className={label}>Objective</dt><dd className="mt-1 text-fg">{c.objective || '—'}</dd></div>
    </dl>
  );
  if (!editable) return summary;
  return (
    <>
      {summary}
      <div className="grid gap-4 sm:grid-cols-2 print:hidden">
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className={label}>Name</span>
          <input className={input} value={c.name} onChange={(e) => portal.edit(c.id, { name: e.target.value })} />
        </label>
        {sales ? (
          <ClientField
            id="f-client"
            clientId={c.clientId}
            prospect={c.prospect}
            onChange={(next) => portal.edit(c.id, next)}
            input={input}
            label={label}
          />
        ) : null}
        <label className="flex flex-col gap-1.5">
          <span className={label}>Starts</span>
          <input id="f-start" type="date" className={input} value={c.start ?? ''} onChange={(e) => portal.edit(c.id, { start: e.target.value || null })} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>Ends</span>
          <input type="date" className={input} min={c.start ?? undefined} value={c.end ?? ''} onChange={(e) => portal.edit(c.id, { end: e.target.value || null })} />
        </label>
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className={label}>Objective</span>
          <textarea rows={2} className={`${input} h-auto py-2.5`} value={c.objective} placeholder="What should this campaign achieve?" onChange={(e) => portal.edit(c.id, { objective: e.target.value })} />
        </label>
      </div>
    </>
  );
}

/* ---------- Updates: messages and changes in one timeline ---------- */

function Updates({ c, user }: { c: Campaign; user: PortalUser }) {
  const [text, setText] = useState('');
  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col gap-3">
        {c.events.map((e) => {
          const who = userById(e.by);
          const me = e.by === user.id;
          if (e.kind !== 'message') {
            return (
              <li key={e.id} className="flex items-center gap-2 text-body-sm text-fg-subtle">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-border-strong" aria-hidden="true" />
                <span>
                  <span className="font-medium text-fg-muted">{me ? 'You' : who?.name.split(' ')[0] ?? 'Someone'}</span> {e.text.charAt(0).toLowerCase() + e.text.slice(1)} · {timeAgo(e.at)}
                </span>
              </li>
            );
          }
          return (
            <li key={e.id} className={`flex gap-2 ${me ? 'flex-row-reverse' : ''}`}>
              <Avatar user={who} size="sm" />
              <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-body-sm ${me ? 'rounded-tr-md bg-accent text-fg-on-accent' : 'rounded-tl-md bg-bg-subtle text-fg'}`}>
                <p>{e.text}</p>
                <p className={`mt-1 text-[11px] ${me ? 'opacity-80' : 'text-fg-subtle'}`}>{me ? 'You' : who?.name.split(' ')[0] ?? 'Someone'} · {timeAgo(e.at)}</p>
              </div>
            </li>
          );
        })}
      </ol>
      <form
        className="flex gap-2 print:hidden"
        onSubmit={(e) => {
          e.preventDefault();
          portal.message(c.id, text);
          setText('');
        }}
      >
        <input id="f-message" value={text} onChange={(e) => setText(e.target.value)} placeholder={user.role === 'sales' ? 'Add a note to this campaign…' : 'Message Primedia…'} className={input} aria-label={user.role === 'sales' ? 'Note' : 'Message'} />
        <button type="submit" disabled={!text.trim()} className={btn.primary}>{user.role === 'sales' ? 'Add' : 'Send'}</button>
      </form>
      {user.role === 'sales' ? <p className="text-body-sm text-fg-subtle print:hidden">Notes stay in the workspace. To reach the client, use the email buttons above.</p> : null}
    </div>
  );
}

/* ---------- Page ---------- */

/** Copies a link anyone can open, no account needed. */
function ShareButton({ c, user }: { c: Campaign; user: PortalUser }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={btn.quiet}
      onClick={() => {
        const url = shareUrl(c, user.id);
        const done = () => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        };
        // Clipboard can be blocked (permissions, plain http): show the link to copy by hand.
        if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, () => window.prompt('Copy this link:', url));
        else window.prompt('Copy this link:', url);
      }}
      aria-live="polite"
      title={user.role === 'sales' ? 'The booking page your client opens — no account needed' : 'A page anyone on your team can open — no account needed'}
    >
      {copied ? '✓ Link copied' : user.role === 'sales' ? 'Copy client link' : 'Copy share link'}
    </button>
  );
}

function PdfButton({ c, user }: { c: Campaign; user: PortalUser }) {
  return (
    <a className={btn.quiet} href={shareUrl(c, user.id, true)} target="_blank" rel="noreferrer">
      Download PDF
    </a>
  );
}

/** A PowerPoint of the proposal in Primedia Malls branding; each one is laid out differently. */
function DeckButton({ c, user, variant = 'quiet' }: { c: Campaign; user: PortalUser; variant?: 'quiet' | 'secondary' }) {
  const { catalogue } = useLiveData();
  const [state, setState] = useState<'idle' | 'making' | string>('idle');
  return (
    <>
      <button
        type="button"
        className={variant === 'secondary' ? btn.secondary : btn.quiet}
        disabled={state === 'making' || !c.items.length}
        title={c.items.length ? 'A PowerPoint of this proposal, laid out afresh each time' : 'Add screens first'}
        onClick={() => {
          setState('making');
          import('@/lib/portal/deck')
            .then(({ downloadDeck }) => downloadDeck(c, user, catalogue))
            .then(() => setState('idle'))
            .catch((e) => setState(e instanceof Error ? e.message : 'Couldn’t make the PowerPoint.'));
        }}
      >
        {state === 'making' ? 'Making the PowerPoint…' : 'Download PowerPoint'}
      </button>
      {state !== 'idle' && state !== 'making' ? <span role="alert" className="text-body-sm text-danger-fg">{state}</span> : null}
    </>
  );
}

function View({ id, user }: { id: string; user: PortalUser }) {
  const router = useRouter();
  const { campaigns, active } = usePortalState();
  const c = campaigns.find((x) => x.id === id);
  if (!c || !visibleTo(c, user)) {
    return <Page><EmptyState title="We can’t find that campaign." description="It may have been removed, or belong to another account." /></Page>;
  }
  const ph = phase(c);
  const editable = canEdit(c, user);
  const isActive = active[user.id] === c.id;
  const { isAdmin } = useAdminSession();
  const messages = c.events.filter((e) => e.kind === 'message').length;

  return (
    <Page>
      {/* Print-only letterhead: the PDF a client forwards. */}
      <div className="hidden items-baseline justify-between border-b border-border pb-4 print:flex">
        <strong className="text-body-lg">Primedia Malls · {docKind(c) === 'sitelist' ? 'Site list' : 'Campaign proposal'}</strong>
        <span className="text-body-sm text-fg-muted">{new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
      </div>

      <header className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-2">
            <Link href="/portal" className="text-body-sm font-semibold text-fg-muted hover:text-fg print:hidden">← {user.role === 'sales' ? 'Workspace' : 'My campaigns'}</Link>
            <span className="text-label-md font-semibold uppercase text-accent print:hidden">{docKind(c) === 'sitelist' ? 'Site list · from PIMS' : 'Proposal'}</span>
            <h1 className="text-display-xl text-fg">{c.name}</h1>
            {campaignOwner(c.id) && c.createdBy !== user.id ? <p className="text-body-sm text-fg-subtle print:hidden">Sales: {campaignOwner(c.id)}</p> : null}
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body-md text-fg-muted">
              {editable ? (
                <a href="#details" className="flex flex-wrap items-center gap-x-3 hover:text-fg hover:underline print:no-underline" title="Edit the campaign details">
                  <span>{campaignClientName(c)}</span>
                  <span aria-hidden="true">·</span>
                  <span>{formatRange(c.start, c.end)}</span>
                </a>
              ) : (
                <>
                  <span>{campaignClientName(c)}</span>
                  <span aria-hidden="true">·</span>
                  <span>{formatRange(c.start, c.end)}</span>
                </>
              )}
              {countdown(c) ? <><span aria-hidden="true">·</span><span className="font-semibold text-fg">{countdown(c)}</span></> : null}
              {ph || c.status === 'declined' ? <StatusPill status={c.status} phase={ph} /> : null}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1 print:hidden">
            {editable ? (
              // Makes this the proposal "Add to proposal" fills, then opens the Media Explorer.
              <Link href="/explorer" onClick={() => { if (!isActive) portal.setActive(c.id); }} className={btn.secondary}>+ Add screens</Link>
            ) : null}
            <PdfButton c={c} user={user} />
            <DeckButton c={c} user={user} />
            {canDeleteDraft(c, user, isAdmin) ? <DeleteDraftButton c={c} className="h-11 rounded-full px-4 hover:bg-danger-bg hover:no-underline" onDeleted={() => router.push('/portal')} /> : null}
            <ShareButton c={c} user={user} />
            {user.role === 'sales' ? (
              <button type="button" className={btn.quiet} onClick={() => router.push(`/portal/campaign?id=${portal.duplicate(c.id)}`)} title="A new draft with the same client, screens and audience; set new dates">
                Duplicate
              </button>
            ) : null}
          </div>
        </div>
        {!ph && c.status !== 'declined' ? <Steps c={c} role={user.role} /> : null}
      </header>

      {/* What to do next comes first; the details form below it. */}
      <NextStep c={c} user={user} />

      <section id="details" className="flex scroll-mt-28 flex-col gap-4" aria-labelledby="details-title">
        <h2 id="details-title" className="text-display-sm text-fg">Campaign details</h2>
        <Details c={c} user={user} />
      </section>

      {messages ? (
        <a href="#updates" className="-mt-4 self-start text-body-sm font-semibold text-accent hover:underline lg:hidden print:hidden">
          {messages} {messages === 1 ? 'message' : 'messages'} · Reply ↓
        </a>
      ) : null}

      <Numbers c={c} />

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-10">
          <section id="media" className="flex scroll-mt-28 flex-col gap-4" aria-labelledby="media-title">
            <h2 id="media-title" className="text-display-sm text-fg">{docKind(c) === 'sitelist' ? 'Site list' : 'Screens'}</h2>
            {c.items.some((i) => i.kind === 'site') ? <SiteList c={c} editable={editable} /> : null}
            {c.items.some((i) => i.kind !== 'site') || !c.items.length ? <Items c={{ ...c, items: c.items.filter((i) => i.kind !== 'site') }} user={user} /> : null}
            {editable ? <Suggestions c={c} /> : null}
          </section>
          {user.role === 'sales' ? <RateCardEditor c={c} user={user} editable={editable} /> : null}
        </div>
        <section id="updates" className="flex scroll-mt-28 flex-col gap-4 lg:sticky lg:top-[calc(var(--topbar-height)+24px)] lg:h-fit print:hidden" aria-labelledby="updates-title">
          <h2 id="updates-title" className="text-display-sm text-fg">Updates</h2>
          <Updates c={c} user={user} />
        </section>
      </div>

      <p className="text-body-sm text-fg-subtle">
        Visits are estimates from each mall’s annual foot count (Rialtofoods proposal, April 2022) over the flight dates. Media is subject to availability.
      </p>
    </Page>
  );
}

export function CampaignView() {
  const id = useSearchParams().get('id') ?? '';
  return <RequireSignIn what="this campaign">{(user) => <View id={id} user={user} />}</RequireSignIn>;
}
