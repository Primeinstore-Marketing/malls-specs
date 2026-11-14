'use client';

import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { withBasePath } from '@/lib/basePath';
import { api } from '@/lib/api';
import { isCleared, packagePhotos } from '@/lib/insights';
import { EmailButton } from '@/components/ui/EmailButton';
import { refreshLiveData, useLiveData } from '@/lib/liveData';
import { days, docWords, formatDate, formatRange, phase } from '@/lib/portal/logic';
import { artworkSizes, campaignScreens, creativeGroups } from '@/lib/portal/screens';
import { CreativeGroups, creativeSummary } from './CreativeGroups';
import type { BookedScreen, SizeFiles } from '@/lib/portal/screens';
import { entryKeyFor, entryPhoto, itemKey, mallEntries, mallFacts, rowsFor } from '@/lib/portal/mallScreens';
import type { MallEntry, ScreenRow } from '@/lib/portal/mallScreens';
import { decodeProposal, proposalUrl } from '@/lib/portal/share';
import type { SharedProposal } from '@/lib/portal/share';
import { portal, usePortalState, usePortalUser } from '@/lib/portal/store';
import type { Campaign, CampaignItem, NewCampaignItem } from '@/lib/portal/types';
import { SizeDownloads } from './SizeDownloads';
import { Zoomable } from '@/components/ui/ImageViewer';

/**
 * The client's booking page, opened from the link in their email — no
 * account needed. It answers: which screens, where, when, what they look
 * like, who shops there, and what artwork to send. While it's a proposal the
 * client can remove screens, add screens from any mall and propose new dates;
 * "Send changes" emails the account manager a link to the edited proposal.
 * Edits are kept in this browser until sent. Built to print: "Download PDF"
 * is this page without the editing tools.
 *
 * Public page: only uploaded or rights-cleared photos are shown.
 */

/** The screen drawn in its own proportions. */
export function Shape({ w, h, size = 56 }: { w: number | null; h: number | null; size?: number }) {
  if (!w || !h) return <span className="block rounded-md border border-dashed border-border-strong" style={{ width: size, height: size * 0.6 }} aria-hidden="true" />;
  const scale = size / Math.max(w, h);
  // Printed even when the browser leaves out background graphics (the PDF a client keeps).
  return <span className="block rounded-[3px] bg-gradient-to-br from-accent to-brand-surface" style={{ width: w * scale, height: h * scale, printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }} aria-hidden="true" />;
}

const res = (s: { width: number | null; height: number | null }) => (s.width && s.height ? `${s.width} × ${s.height} px` : 'Size to be confirmed');

function statusLine(p: SharedProposal): { text: string; tone: string } {
  const ph = phase({ status: p.status, start: p.start, end: p.end } as Campaign);
  if (ph === 'live') return { text: '● Live now', tone: 'bg-success-bg text-success-fg' };
  if (ph === 'completed') return { text: 'Finished', tone: 'bg-bg-muted text-fg-muted' };
  if (p.status === 'booked') return { text: 'Booked', tone: 'bg-success-bg text-success-fg' };
  if (p.status === 'approved') return { text: 'Approved — confirming', tone: 'bg-accent-subtle text-accent' };
  if (p.status === 'changes') return { text: 'Changes sent to Primedia', tone: 'bg-accent-subtle text-accent' };
  return { text: `${docWords(p).Noun} — waiting for your approval`, tone: 'bg-warning-bg text-warning-fg' };
}

/* ---------- The client's edits, kept in this browser until sent ---------- */

interface Edits {
  readonly items: readonly NewCampaignItem[];
  readonly start: string | null;
  readonly end: string | null;
}

const strip = (i: CampaignItem | NewCampaignItem): NewCampaignItem => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, ...rest } = i as CampaignItem;
  return rest as NewCampaignItem;
};

function useEdits(p: SharedProposal) {
  const key = `malls-specs:share:${p.id}:${p.at}`;
  const initial: Edits = { items: p.items.map(strip), start: p.start, end: p.end };
  const [edits, setEdits] = useState<Edits>(initial);
  const loaded = useRef(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) setEdits(JSON.parse(saved) as Edits);
    } catch {
      /* private window: edits just aren't kept */
    }
    loaded.current = true;
  }, [key]);
  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(key, JSON.stringify(edits));
    } catch {
      /* ignore */
    }
  }, [key, edits]);
  const reset = () => {
    setEdits(initial);
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  };
  return [edits, setEdits, reset] as const;
}

/* ---------- Approval on this page ---------- */

interface Approved {
  readonly name: string;
  readonly at: string;
}

/** Whether this proposal has been approved here: remembered in this browser, and checked with the API. */
function useApproval(p: SharedProposal) {
  const key = `malls-specs:approved:${p.id}:${p.at}`;
  const [approved, setApproved] = useState<Approved | null>(null);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) setApproved(JSON.parse(saved) as Approved);
    } catch {
      /* ignore */
    }
    api
      .approvals([p.id])
      .then(({ approvals }) => {
        const mine = approvals.filter((a) => a.at >= p.at).pop();
        if (mine) setApproved({ name: mine.name, at: mine.at });
      })
      .catch(() => {});
  }, [key, p.id, p.at]);
  const remember = (a: Approved) => {
    setApproved(a);
    try {
      localStorage.setItem(key, JSON.stringify(a));
    } catch {
      /* ignore */
    }
  };
  return [approved, remember] as const;
}

/* ---------- Small pieces ---------- */

/** A screen's thumbnail: click for the large photo, the spec, the spec sheet and the template. */
function Photo({ src, w, h, className, title, specId, note }: { src: string | null; w: number | null; h: number | null; className: string; title: string; specId: string | null; note?: string | null }) {
  return (
    <Zoomable src={src} title={title} specId={specId} note={note} className={className}>
      <span className="flex h-full w-full items-center justify-center bg-bg-subtle">
        <Shape w={w} h={h} size={44} />
      </span>
    </Zoomable>
  );
}

function Facts({ facts, max = 6 }: { facts: readonly string[]; max?: number }) {
  if (!facts.length) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Who shops here">
      {facts.slice(0, max).map((f) => (
        <li key={f} className="rounded-full bg-bg-subtle px-2.5 py-1 text-[12px] font-medium text-fg-muted">{f}</li>
      ))}
    </ul>
  );
}

const btnPrimary = 'inline-flex h-11 items-center rounded-full bg-accent px-5 text-body-sm font-semibold text-fg-on-accent hover:bg-accent-hover';
const btnSecondary = 'inline-flex h-11 items-center rounded-full border border-border-strong bg-bg px-5 text-body-sm font-semibold text-fg hover:border-fg';
const btnSmall = 'inline-flex h-9 shrink-0 items-center rounded-full border px-3 text-body-sm font-semibold';

/* ---------- The page ---------- */

function Booking({ p, shareKey, changesPending = false, reload }: { p: SharedProposal; shareKey?: string; changesPending?: boolean; reload?: () => void }) {
  const params = useSearchParams();
  const live = useLiveData();
  const { catalogue } = live;
  // This page sits outside the site's shell, so it loads admin edits itself:
  // chosen screens and templates, uploads, mall data and photo rights.
  useEffect(() => {
    if (live.status === 'idle') void refreshLiveData();
  }, [live.status]);
  const entries = useMemo(() => mallEntries(catalogue, undefined, live.version), [catalogue, live.version]);
  const rowCache = useMemo(() => new Map<string, ScreenRow[]>(), [catalogue, live.version]);
  const rowsOf = (e: MallEntry) => {
    if (!rowCache.has(e.key)) rowCache.set(e.key, rowsFor(e, catalogue, true));
    return rowCache.get(e.key)!;
  };
  const byKey = useMemo(() => new Map(entries.map((e) => [e.key, e])), [entries]);

  const ph = phase({ status: p.status, start: p.start, end: p.end } as Campaign);
  const [approved, rememberApproval] = useApproval(p);
  const [approving, setApproving] = useState(false);
  // ?preview=1: sales previewing what the client sees (in "Preview & download"); nothing can be approved or sent from it.
  const previewOnly = params.get('preview') === '1';
  const editable = !previewOnly && !approved && !['approved', 'booked', 'declined'].includes(p.status) && ph !== 'live' && ph !== 'completed';
  const [edits, setEdits, resetEdits] = useEdits(p);
  const items: CampaignItem[] = edits.items.map((i) => ({ ...i, id: itemKey(i) }) as CampaignItem);
  const current = new Set(items.map((i) => i.id));
  const original = new Set(p.items.map(itemKey));
  const added = items.filter((i) => !original.has(i.id));
  const removed = p.items.filter((i) => !current.has(itemKey(i))).map((i) => ({ ...i, id: itemKey(i) }) as CampaignItem);
  const datesChanged = edits.start !== p.start || edits.end !== p.end;
  // The client approves the site list as a whole or asks for changes; they don't edit lines here.
  const editingLines = false;
  const changed = editingLines && (added.length > 0 || removed.length > 0 || datesChanged);

  const screens = useMemo(() => campaignScreens(items, catalogue), [items, catalogue, live.version]);
  const removedScreens = useMemo(() => campaignScreens(removed, catalogue), [removed, catalogue]);
  const { sizes, unknown } = artworkSizes(screens);
  // Every line of the proposal, in order (a client's site list keeps its own numbering).
  const lines = items
    .flatMap((item) => screens.filter((x) => x.itemId === item.id).map((screen) => ({ item, screen })))
    .sort((a, b) => (a.screen.site?.no ?? 0) - (b.screen.site?.no ?? 0));
  // The creative to supply: one group per artwork size (or kind of site while its size is unknown).
  const creatives = creativeGroups(items, screens);
  const unitWord = lines.some((l) => l.screen.site) ? 'site' : 'screen';
  const total = screens.reduce((s, x) => s + x.qty, 0);
  const flight = days(edits.start, edits.end);
  const status = approved ? { text: 'Approved — Primedia is confirming', tone: 'bg-success-bg text-success-fg' } : statusLine(p);
  const first = p.from?.name.split(' ')[0] ?? 'your account manager';
  // Proposal (screens we suggest) or site list (from PIMS, once booked).
  const w = docWords(p);

  const has = (key: string) => current.has(key);
  const addItem = (item: NewCampaignItem) => setEdits((e) => (e.items.some((x) => itemKey(x) === itemKey(item)) ? e : { ...e, items: [...e.items, item] }));
  const removeItem = (key: string) => setEdits((e) => ({ ...e, items: e.items.filter((x) => itemKey(x) !== key) }));
  const putBack = (item: CampaignItem) => addItem(strip(item));

  useEffect(() => {
    if (params.get('print') !== '1') return;
    const t = setTimeout(() => window.print(), 900);
    return () => clearTimeout(t);
  }, [params]);

  // Read after mount so the server and browser render the same links.
  const [link, setLink] = useState('');
  useEffect(() => setLink(window.location.href.replace(/&print=1$/, '')), []);

  /* Group what's in the proposal (and what was taken out) by mall. */
  type Line = { item: CampaignItem; screen: BookedScreen; photo: string | null; removed: boolean };
  const groups = new Map<string, { entry: MallEntry | undefined; title: string; lines: Line[] }>();
  const photoFor = (item: CampaignItem, entry: MallEntry | undefined): string | null => {
    const row = entry ? rowsOf(entry).find((r) => r.key === item.id) : undefined;
    if (row) return row.photo;
    if (item.kind === 'package') {
      const pkg = packagePhotos(item.code).find((x) => isCleared(x));
      if (pkg) return pkg.src;
    }
    return entry ? entryPhoto(entry, true) : null;
  };
  const place = (list: readonly CampaignItem[], booked: readonly BookedScreen[], isRemoved: boolean) =>
    list.forEach((item) => {
      const k = entryKeyFor(item, entries) ?? 'other';
      const entry = byKey.get(k);
      const g = groups.get(k) ?? { entry, title: entry?.name ?? booked.find((s) => s.itemId === item.id)?.mallName ?? 'Other', lines: [] };
      for (const screen of booked.filter((s) => s.itemId === item.id)) g.lines.push({ item, screen, photo: photoFor(item, entry), removed: isRemoved });
      groups.set(k, g);
    });
  place(items, screens, false);
  if (editable) place(removed, removedScreens, true);

  /* Explore other malls. */
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const exploreRef = useRef<HTMLElement>(null);
  const q = query.trim().toLowerCase();
  const exploreList = q
    ? entries.filter((e) => `${e.name} ${e.area} ${e.screens.map((s) => s.title).join(' ')} ${e.packages.map((x) => x.format).join(' ')}`.toLowerCase().includes(q))
    : entries;
  const shownExplore = showAll || q ? exploreList : exploreList.slice(0, 6);
  const exploreMall = (name: string) => {
    setQuery(name);
    exploreRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  /* Emails. */
  const mail = (subject: string, body: string) =>
    p.from ? `mailto:${p.from.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` : undefined;
  const describe = (list: readonly CampaignItem[], booked: readonly BookedScreen[]) =>
    list.flatMap((i) => booked.filter((s) => s.itemId === i.id).map((s) => `- ${s.mallName} · ${s.title}${s.qty > 1 ? ` × ${s.qty}` : ''} (${res(s)})`));
  const changesLink = changed
    ? proposalUrl({ ...p, items, start: edits.start, end: edits.end, status: 'changes', at: new Date().toISOString() })
    : '';
  const changesBody = [
    `Hi ${first},`,
    '',
    `We'd like some changes to ${p.name}:`,
    ...(added.length ? ['', 'Please add:', ...describe(added, screens)] : []),
    ...(removed.length ? ['', 'Please remove:', ...describe(removed, removedScreens)] : []),
    ...(datesChanged ? ['', `New dates: ${formatRange(edits.start, edits.end)} (was ${formatRange(p.start, p.end)})`] : []),
    '',
    'The updated proposal, with every screen and artwork size:',
    changesLink,
    '',
    'Thanks',
  ].join('\n');

  /* Sending changes to the server (short links). */
  const [changeNote, setChangeNote] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sentChanges, setSentChanges] = useState(false);
  /** The whole list stays as it is; the note goes to the salesperson, who updates the proposal. */
  async function askForChanges() {
    if (!shareKey || !changeNote.trim()) return;
    setSending(true);
    setSendError(null);
    try {
      await api.sendProposalChanges(p.id, shareKey, { start: p.start, end: p.end, note: changeNote.trim(), name: '' });
      setSentChanges(true);
      setChangeNote('');
      reload?.();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setSendError(e instanceof Error ? e.message : `We couldn’t send that just now. Try again, or email ${first}.`);
    } finally {
      setSending(false);
    }
  }

  async function sendChanges() {
    if (!shareKey) return;
    setSending(true);
    setSendError(null);
    try {
      await api.sendProposalChanges(p.id, shareKey, { items: edits.items, start: edits.start, end: edits.end, note: changeNote.trim(), name: '' });
      setSentChanges(true);
      setChangeNote('');
      resetEdits();
      reload?.();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setSendError(e instanceof Error ? e.message : `We couldn’t send that just now. Try again, or email ${first}.`);
    } finally {
      setSending(false);
    }
  }

  /* Sales opening a link the client sent back: apply it to the campaign. */
  const { user } = usePortalUser();
  const state = usePortalState();
  const ownCampaign = user?.role === 'sales' ? state.campaigns.find((c) => c.id === p.id) : undefined;
  const [applied, setApplied] = useState(false);

  return (
    <div className="min-h-screen bg-bg-subtle print:bg-bg">
      {/* On paper (the PDF) the header is white with the navy logo, so it shows even when the browser leaves out background colours. */}
      <header className="bg-brand-surface text-brand-on-surface print:border-b print:border-border print:bg-white print:text-fg">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-8">
          <Image src={withBasePath('/brand/logo-white.svg')} alt="Primedia Malls" width={140} height={29} className="h-[26px] w-auto print:hidden" priority />
          <Image src={withBasePath('/brand/logo-navy.svg')} alt="" aria-hidden="true" width={140} height={29} className="hidden h-[26px] w-auto print:block" />
          <div className="flex items-center gap-3">
            <span className="text-body-sm text-brand-on-surface-muted print:text-fg-muted">Sent {formatDate(p.at.slice(0, 10))}</span>
            <button type="button" onClick={() => window.print()} className="h-10 rounded-full border border-white/25 px-4 text-body-sm font-semibold hover:bg-white/10 print:hidden">
              Download PDF
            </button>
          </div>
        </div>
      </header>

      {ownCampaign && p.status === 'changes' ? (
        <div className="border-b border-border bg-accent-subtle print:hidden">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-8">
            <p className="text-body-sm text-fg">{applied ? 'Applied. The campaign now matches what the client sent.' : `The client sent changes to “${ownCampaign.name}”.`}</p>
            {applied ? (
              <a href={withBasePath(`/portal/campaign?id=${ownCampaign.id}`)} className="text-body-sm font-semibold text-accent hover:underline">Open the proposal →</a>
            ) : (
              <button
                type="button"
                className={`${btnSmall} border-accent bg-accent text-fg-on-accent`}
                onClick={() => {
                  portal.applyClientChanges(ownCampaign.id, { items: p.items.map(strip), start: p.start, end: p.end }, 'Applied the changes the client sent from their booking page.');
                  setApplied(true);
                }}
              >
                Apply to the campaign
              </button>
            )}
          </div>
        </div>
      ) : null}

      {!approved && (sentChanges || changesPending) ? (
        <div className="border-b border-border bg-accent-subtle print:hidden" role="status">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-8">
            <p className="text-body-md text-fg">
              <strong>Your message is with {first}.</strong> {sentChanges ? `They’ve been told and will update the ${w.noun}; this page always shows the latest version.` : `They’ll update the ${w.noun}; this page always shows the latest version.`}
            </p>
            <EmailButton href={mail(`Changes to: ${p.name}`, `Hi ${first},\n\nI've sent some changes to ${p.name} from the booking page:\n${link}\n\nThanks`)} className={btnSmall + ' border-border-strong bg-bg text-fg'} align="right">
              Also email {first}
            </EmailButton>
          </div>
        </div>
      ) : null}

      {approved ? (
        <div className="border-b border-success-fg/20 bg-success-bg" role="status">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-4 sm:px-8">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-success-fg text-body-md font-bold text-bg" aria-hidden="true">✓</span>
            <p className="text-body-md text-success-fg">
              <strong>Approved{approved.name ? ` by ${approved.name}` : ''}</strong> on {formatDate(approved.at.slice(0, 10))}. {first === 'your account manager' ? 'Primedia' : first} has been told and will confirm the booking. Next: send your artwork, one file per size below.
            </p>
          </div>
        </div>
      ) : null}

      <main className={`mx-auto flex max-w-5xl flex-col gap-10 px-4 py-8 sm:px-8 sm:py-12 print:gap-6 print:py-6 ${editable ? 'pb-32 sm:pb-32' : ''}`}>
        {/* ---- Summary ---- */}
        <section className="flex flex-col gap-4">
          <span className="text-label-md font-semibold uppercase text-accent">{p.client && p.client !== 'No client yet' ? `Prepared for ${p.client}` : `Primedia Malls ${w.noun}`}</span>
          <h1 className="text-display-xl text-fg">{p.name}</h1>
          <div className="flex flex-wrap items-center gap-3 text-body-lg text-fg-muted">
            <span>{formatRange(edits.start, edits.end)}{flight ? ` · ${flight} days` : ''}</span>
            <span className={`rounded-full px-3 py-1 text-body-sm font-semibold ${status.tone}`}>{status.text}</span>
            {editable ? (
              <button type="button" onClick={() => setApproving(true)} className={`${btnPrimary} print:hidden`}>{w.approve}</button>
            ) : null}
          </div>
          {editingLines ? <DatesEditor start={edits.start} end={edits.end} onChange={(start, end) => setEdits((e) => ({ ...e, start, end }))} /> : null}
          {p.objective ? <p className="max-w-prose text-body-md text-fg">{p.objective}</p> : null}
          <dl className="mt-2 grid grid-cols-3 gap-6 border-t border-border pt-5 sm:max-w-xl">
            <div><dt className="text-body-sm text-fg-muted">Malls</dt><dd className="text-display-md text-fg">{[...groups.values()].filter((g) => g.lines.some((l) => !l.removed)).length}</dd></div>
            <div><dt className="text-body-sm text-fg-muted">{lines.some((l) => l.screen.site) ? 'Sites' : 'Screens'}</dt><dd className="text-display-md text-fg">{total}</dd></div>
            <div><dt className="text-body-sm text-fg-muted">Creatives</dt><dd className="text-display-md text-fg">{creatives.length}</dd></div>
          </dl>
          {editable ? (
            <p className="text-body-sm text-fg-muted print:hidden">
              Please check the {w.noun} below and approve it, or tell {first} what to change.
            </p>
          ) : null}
        </section>

        {/* ---- What to supply: the site list grouped by creative ---- */}
        <section className="flex flex-col gap-4" aria-labelledby="supply-title">
          <div className="flex flex-col gap-1">
            <h2 id="supply-title" className="text-display-sm text-fg">What you need to supply</h2>
            <p className="max-w-prose text-body-md text-fg">{creativeSummary(creatives, unitWord, 'client')}</p>
            <p className="text-body-sm text-fg-muted">
              One video or still per creative{edits.start ? `, before ${formatDate(edits.start)}` : ''}, built in its After Effects template; the spec sheet has the file types and safe areas.
              Open a creative to see its {unitWord}s. The approval covers the whole list ({lines.length} {lines.length === 1 ? unitWord : `${unitWord}s`}).
            </p>
          </div>
          {lines.length ? <CreativeGroups groups={creatives} start={edits.start} end={edits.end} audience="client" /> : <p className="rounded-3xl border border-dashed border-border-strong p-6 text-center text-body-md text-fg-muted">No sites yet.</p>}
        </section>

        {/* ---- The malls: pictures and who shops there ---- */}
        {groups.size ? (
          <section className="flex flex-col gap-4 print:hidden" aria-labelledby="malls-title">
            <h2 id="malls-title" className="text-display-sm text-fg">The malls</h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {[...groups.entries()].map(([key, g]) => {
                const facts = mallFacts(g.entry?.deck);
                const hero = g.entry ? entryPhoto(g.entry, true) : null;
                return (
                  <li key={key} className="flex gap-4 rounded-3xl bg-bg p-4">
                    {hero ? <Zoomable src={hero} title={g.title} detail={g.entry?.area} className="h-20 w-28 shrink-0 rounded-2xl" /> : null}
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <h3 className="text-body-md font-semibold text-fg">{g.title} <span className="font-normal text-fg-muted">· {g.lines.length} {g.lines.length === 1 ? 'line' : 'lines'}</span></h3>
                      {g.entry?.area ? <span className="text-body-sm text-fg-muted">{g.entry.area}</span> : null}
                      {facts.length ? <Facts facts={facts} max={4} /> : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {/* ---- Approve, or send changes ---- */}
        <section className={`flex flex-col gap-4 rounded-3xl p-5 sm:p-6 print:hidden ${changed ? 'border-2 border-accent bg-bg' : 'bg-bg'}`} aria-labelledby="decide-title">
          {changed ? (
            <>
              <h2 id="decide-title" className="text-body-lg font-semibold text-fg">Your changes</h2>
              <ul className="flex flex-col gap-1 text-body-md text-fg">
                {added.length ? <li>Add {added.length} {added.length === 1 ? 'item' : 'items'}: {describe(added, screens).map((x) => x.slice(2)).join('; ')}</li> : null}
                {removed.length ? <li>Remove {removed.length} {removed.length === 1 ? 'item' : 'items'}: {describe(removed, removedScreens).map((x) => x.slice(2)).join('; ')}</li> : null}
                {datesChanged ? <li>New dates: {formatRange(edits.start, edits.end)} (was {formatRange(p.start, p.end)})</li> : null}
              </ul>
              {shareKey ? (
                <>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-label-md font-semibold uppercase text-fg-muted">A note for {first} <span className="normal-case tracking-normal text-fg-subtle">(optional)</span></span>
                    <textarea rows={2} value={changeNote} onChange={(e) => setChangeNote(e.target.value)} className="w-full rounded-xl border border-border-strong bg-bg px-3 py-2.5 text-body-md text-fg outline-none focus:border-border-focus" />
                  </label>
                  {sendError ? <p role="alert" className="text-body-sm text-danger-fg">{sendError}</p> : null}
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={sending} onClick={() => void sendChanges()} className={btnPrimary}>{sending ? 'Sending…' : `Send changes to ${first}`}</button>
                    <button type="button" onClick={resetEdits} className={btnSecondary}>Undo all changes</button>
                  </div>
                  <p className="text-body-sm text-fg-muted">{first} sees your changes straight away and updates the proposal.</p>
                </>
              ) : (
                <>
                  <p className="text-body-sm text-fg-muted">Sending opens an email to {first} with these changes and a link to the updated proposal.</p>
                  <div className="flex flex-wrap gap-2">
                    <EmailButton href={mail(`Changes to: ${p.name}`, changesBody)} className={btnPrimary}>Send changes to {first}</EmailButton>
                    <button type="button" onClick={resetEdits} className={btnSecondary}>Undo all changes</button>
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <h2 id="decide-title" className="text-body-lg font-semibold text-fg">{editable ? `Approve the ${w.noun}` : 'Questions about your booking?'}</h2>
              <p className="text-body-md text-fg-muted">
                {editable ? `If the ${w.noun} is right, approve it in one step. If anything should change, tell ${first} below.` : `${p.from?.name.split(' ')[0] ?? 'Your account manager'} is your contact for artwork and anything else.`}
              </p>
              <div className="flex flex-wrap gap-2">
                {editable ? (
                  <button type="button" onClick={() => setApproving(true)} className={btnPrimary}>
                    {w.approve}
                  </button>
                ) : null}
                <EmailButton href={mail(`Question about: ${p.name}`, `Hi ${first},\n\n\n\n${link}`)} className={btnSecondary}>
                  Ask a question
                </EmailButton>
              </div>
              {editable && shareKey ? (
                <div className="flex flex-col gap-2 border-t border-border pt-4">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-label-md font-semibold uppercase text-fg-muted">Ask for changes</span>
                    <textarea rows={3} value={changeNote} onChange={(e) => setChangeNote(e.target.value)} placeholder="e.g. Please take out the Menlyn sites and add two at Canal Walk." className="w-full rounded-xl border border-border-strong bg-bg px-3 py-2.5 text-body-md text-fg outline-none focus:border-border-focus" />
                  </label>
                  {sendError ? <p role="alert" className="text-body-sm text-danger-fg">{sendError}</p> : null}
                  <button type="button" disabled={sending || !changeNote.trim()} onClick={() => void askForChanges()} className={`${btnSecondary} self-start disabled:opacity-50`}>
                    {sending ? 'Sending…' : `Send to ${first}`}
                  </button>
                </div>
              ) : null}
            </>
          )}
        </section>

        {editable ? (
          <div className="fixed inset-x-0 bottom-0 z-sticky border-t border-border bg-bg/95 backdrop-blur print:hidden">
            <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-8">
              <span className="min-w-0 flex-1 truncate text-body-sm text-fg-muted sm:flex-none">
                {changed ? 'You have changes that aren’t sent yet.' : `${total} ${lines.some((l) => l.screen.site) ? (total === 1 ? 'site' : 'sites') : total === 1 ? 'screen' : 'screens'} · ${formatRange(edits.start, edits.end)}`}
              </span>
              <div className="flex shrink-0 justify-end gap-2">
                {changed ? (
                  <>
                    <button type="button" onClick={resetEdits} className={`${btnSecondary} hidden sm:inline-flex`}>Undo</button>
                    {shareKey ? (
                      <button type="button" onClick={() => document.getElementById('decide-title')?.scrollIntoView({ behavior: 'smooth', block: 'center' })} className={`${btnPrimary} flex-1 justify-center sm:flex-none`}>Review and send changes</button>
                    ) : (
                      <EmailButton up align="right" href={mail(`Changes to: ${p.name}`, changesBody)} className={`${btnPrimary} justify-center`}>Send changes to {first}</EmailButton>
                    )}
                  </>
                ) : (
                  <button type="button" onClick={() => setApproving(true)} className={`${btnPrimary} justify-center whitespace-nowrap`}>{w.approve}</button>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {approving ? (
          <ApproveDialog
            p={p}
            shareKey={shareKey}
            total={total}
            malls={[...groups.values()].filter((g) => g.lines.some((l) => !l.removed)).length}
            sizes={sizes.map((z) => `${z.width} × ${z.height}`)}
            start={edits.start}
            end={edits.end}
            first={first}
            fallback={mail(`Approved: ${p.name}`, `Hi ${first},\n\nWe approve the booking for ${p.name} (${formatRange(p.start, p.end)}), ${total} screens.\n\n${link}\n\nThanks`)}
            onClose={() => setApproving(false)}
            onApproved={(a) => {
              rememberApproval(a);
              setApproving(false);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        ) : null}

        <footer className="flex flex-col gap-1 border-t border-border pt-6 text-body-sm">
          {p.from ? (
            <>
              <span className="font-semibold text-fg">{p.from.name}</span>
              <span className="text-fg-muted">{p.from.title}</span>
              <span className="select-all text-fg-muted">{p.from.email}</span>
            </>
          ) : null}
          <p className="mt-3 text-fg-subtle">Subject to availability; sites and individual screens are confirmed on booking. Shopper figures are from Primedia’s mall research.</p>
        </footer>
      </main>
    </div>
  );
}

function ApproveDialog({ p, shareKey, total, malls, sizes, start, end, first, fallback, onClose, onApproved }: {
  p: SharedProposal;
  shareKey?: string;
  total: number;
  malls: number;
  sizes: readonly string[];
  start: string | null;
  end: string | null;
  first: string;
  fallback: string | undefined;
  onClose: () => void;
  onApproved: (a: Approved) => void;
}) {
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = 'w-full rounded-xl border border-border-strong bg-bg px-3 text-body-md text-fg outline-none focus:border-border-focus';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function approve() {
    setBusy(true);
    setError(null);
    try {
      const { approval } = await api.approveProposal(p.id, { name: name.trim(), note: note.trim(), screens: total, k: shareKey });
      onApproved({ name: approval.name, at: approval.at });
    } catch {
      setError(`We couldn’t record it just now. Approve by email instead and ${first} will take it from there.`);
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-modal flex items-end justify-center bg-[rgba(6,12,28,0.55)] p-0 sm:items-center sm:p-6 print:hidden" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="approve-title"
        className="flex w-full max-w-lg flex-col gap-4 rounded-t-3xl bg-bg p-6 shadow-3 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="approve-title" className="text-display-sm text-fg">Approve {p.name}?</h2>
        <dl className="grid grid-cols-3 gap-3 rounded-2xl bg-bg-subtle p-4 text-body-sm">
          <div><dt className="text-fg-muted">Screens</dt><dd className="text-body-lg font-semibold text-fg">{total}</dd></div>
          <div><dt className="text-fg-muted">Malls</dt><dd className="text-body-lg font-semibold text-fg">{malls}</dd></div>
          <div><dt className="text-fg-muted">Dates</dt><dd className="font-semibold text-fg">{formatRange(start, end)}</dd></div>
          {sizes.length ? <div className="col-span-3"><dt className="text-fg-muted">Artwork sizes</dt><dd className="font-semibold tabular-nums text-fg">{sizes.join(' · ')}</dd></div> : null}
        </dl>
        <label className="flex flex-col gap-1.5">
          <span className="text-label-md font-semibold uppercase text-fg-muted">Your name <span className="normal-case tracking-normal text-fg-subtle">(optional)</span></span>
          <input autoFocus className={`${field} h-11`} value={name} onChange={(e) => setName(e.target.value)} placeholder="So Primedia knows who approved" autoComplete="name" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-label-md font-semibold uppercase text-fg-muted">Note <span className="normal-case tracking-normal text-fg-subtle">(optional)</span></span>
          <textarea rows={2} className={`${field} py-2`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything for your account manager" />
        </label>
        <p className="text-body-sm text-fg-muted">{first === 'your account manager' ? 'Primedia' : first} is told straight away and confirms the booking. Screens are subject to availability until then.</p>
        {error ? (
          <div className="flex flex-col gap-2 rounded-xl bg-warning-bg p-3 text-body-sm text-warning-fg">
            <span>{error}</span>
            {fallback ? <div className="self-start"><EmailButton href={fallback} className="font-semibold underline">Approve by email</EmailButton></div> : null}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => void approve()} className={`${btnPrimary} flex-1 justify-center disabled:opacity-60 sm:flex-none`}>
            {busy ? 'Approving…' : 'Approve'}
          </button>
          <button type="button" onClick={onClose} className={btnSecondary}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function DatesEditor({ start, end, onChange }: { start: string | null; end: string | null; onChange: (start: string | null, end: string | null) => void }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex h-10 items-center self-start rounded-full border border-border-strong px-4 text-body-sm font-semibold text-fg hover:border-fg print:hidden">
        Change the dates
      </button>
    );
  }
  const field = 'h-10 rounded-lg border border-border-strong bg-bg px-3 text-body-md text-fg outline-none focus:border-border-focus';
  return (
    <div className="flex flex-wrap items-end gap-3 print:hidden">
      <label className="flex flex-col gap-1">
        <span className="text-label-md font-semibold uppercase text-fg-muted">Starts</span>
        <input type="date" className={field} value={start ?? ''} onChange={(e) => onChange(e.target.value || null, end)} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-label-md font-semibold uppercase text-fg-muted">Ends</span>
        <input type="date" className={field} value={end ?? ''} min={start ?? undefined} onChange={(e) => onChange(start, e.target.value || null)} />
      </label>
      <button type="button" onClick={() => setOpen(false)} className="h-10 text-body-sm font-semibold text-fg-muted hover:text-fg">Done</button>
    </div>
  );
}

function LinkProblem({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-subtle p-6 text-center">
      <div className="flex max-w-md flex-col gap-3">
        <h1 className="text-display-md text-fg">{title}</h1>
        <p className="text-body-md text-fg-muted">{text}</p>
      </div>
    </div>
  );
}

/** A short link (/share?c=<id>&k=<key>): the proposal comes from the server, always the latest. */
function ServerBooking({ id, shareKey, code }: { id?: string; shareKey?: string; code?: string }) {
  const [state, setState] = useState<{ p: SharedProposal; pending: boolean; key: string } | 'loading' | string>('loading');
  const load = useCallback(() => {
    (code ? api.proposalByCode(code) : api.proposal(id ?? '', shareKey ?? '').then((r) => ({ ...r, key: shareKey ?? '' })))
      .then(({ proposal, changesPending, key }) => setState({ p: proposal, pending: changesPending, key }))
      .catch((e) => setState(e instanceof Error ? e.message : 'We couldn’t load this proposal.'));
  }, [id, shareKey, code]);
  useEffect(load, [load]);
  if (state === 'loading') {
    return <div className="flex min-h-screen items-center justify-center bg-bg-subtle"><div className="h-10 w-10 animate-spin rounded-full border-4 border-border border-t-accent" aria-label="Loading the proposal" /></div>;
  }
  if (typeof state === 'string') return <LinkProblem title="We couldn’t open this proposal" text={state} />;
  return <Booking key={state.p.at + state.p.status} p={state.p} shareKey={state.key} changesPending={state.pending} reload={load} />;
}

export function ShareView() {
  const params = useSearchParams();
  const id = params.get('c') ?? '';
  const shareKey = params.get('k') ?? '';
  const code = params.get('s') ?? '';
  if (code) return <ServerBooking code={code} />;
  if (id && shareKey) return <ServerBooking id={id} shareKey={shareKey} />;
  const packed = params.get('p') ?? '';
  const p = packed ? decodeProposal(packed) : null;
  if (!p) return <LinkProblem title="This booking link isn’t complete" text="Ask your Primedia account manager to send it again." />;
  return <Booking p={p} />;
}
