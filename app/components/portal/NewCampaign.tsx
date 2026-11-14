'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { compact } from '@/lib/insights';
import type { AudienceTarget } from '@/lib/insights';
import { addDays, days, formatRange, reach, todayIso } from '@/lib/portal/logic';
import { portal, usePortalState } from '@/lib/portal/store';
import { clientEmail } from '@/lib/portal/email';
import { clientContact } from '@/lib/portal/share';
import { artworkSizes, campaignScreens } from '@/lib/portal/screens';
import { briefInventory, mallEntries, pkgKey, rowsFor as rowsForEntry, scrKey } from '@/lib/portal/mallScreens';
import { CLIENTS } from '@/lib/portal/seed';
import type { MallEntry as Entry } from '@/lib/portal/mallScreens';
import { useLiveData } from '@/lib/liveData';
import type { Campaign, DocKind, NewCampaignItem, PortalUser, Prospect } from '@/lib/portal/types';
import { AudiencePicker, readAudience } from '@/components/insights/AudiencePicker';
import { ClientField } from './ClientField';
import { Zoomable } from '@/components/ui/ImageViewer';
import { Page, RequireSignIn, Section } from './ui';
import { BriefDrop } from './BriefDrop';
import { SiteMatch } from './SiteMatch';
import { formatScreen, siteStatus, statusText, unmatchedSummary } from '@/lib/portal/siteStatus';
import { getMalls } from '@/lib/malls';
import type { SiteItem } from '@/lib/portal/types';
import type { BriefDraft } from '@/lib/api';

const input = 'h-10 w-full rounded-lg border border-border-strong bg-bg px-3 text-body-md text-fg outline-none focus:border-border-focus';
const fieldLabel = 'text-label-md font-semibold uppercase text-fg-muted';

function Form({ user }: { user: PortalUser }) {
  const params = useSearchParams();
  const router = useRouter();
  const sales = user.role === 'sales';
  const { catalogue } = useLiveData();
  // Two jobs: a proposal (screens we suggest), or the site list from PIMS once it's booked.
  const [kind, setKind] = useState<DocKind>(params.get('kind') === 'sitelist' ? 'sitelist' : 'proposal');
  // A site list made from a proposal starts with its name, client and dates.
  const { campaigns } = usePortalState();
  const [from] = useState(() => campaigns.find((x) => x.id === params.get('from')) ?? null);
  const [name, setName] = useState(from ? from.name : '');
  const [client, setClient] = useState<{ clientId: string | null; prospect: Prospect | null }>(from ? { clientId: from.clientId, prospect: from.prospect ?? null } : { clientId: sales ? null : user.clientId ?? null, prospect: null });
  const [objective, setObjective] = useState(from?.objective ?? '');
  const [start, setStart] = useState(from?.start ?? addDays(todayIso(), 30));
  const [end, setEnd] = useState(from?.end ?? addDays(todayIso(), 57));
  const [audience, setAudience] = useState<AudienceTarget>(() => readAudience(new URLSearchParams(params.toString())));
  // What's in the plan, keyed pkg:<code> or scr:<specId>, in the order it was ticked.
  const [picked, setPicked] = useState<Map<string, NewCampaignItem>>(new Map());
  // A client's site list, from their document: every row, as they gave it.
  const [siteLines, setSiteLines] = useState<SiteItem[]>([]);
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);

  // Every mall, ranked for the audience (it never hides one).
  const entries = useMemo(() => mallEntries(catalogue, audience), [audience, catalogue]);

  const inArea = (e: Entry) => !audience.provinces.length || audience.provinces.includes(e.province);
  const q = query.trim().toLowerCase();
  const found = q
    ? entries.filter((e) =>
        `${e.name} ${e.area} ${e.packages.map((p) => `${p.code} ${p.format}`).join(' ')} ${e.screens.map((s) => s.title).join(' ')}`.toLowerCase().includes(q),
      )
    : entries;
  const ordered = [...found.filter(inArea), ...found.filter((e) => !inArea(e))];
  const SHORT = 8;
  const hasPick = (e: Entry) => e.packages.some((p) => picked.has(pkgKey(p.code))) || e.screens.some((s) => picked.has(scrKey(s.id)));
  const visible = showAll || q ? ordered : ordered.filter((e, i) => i < SHORT || hasPick(e));
  const firstOutside = audience.provinces.length ? visible.findIndex((e) => !inArea(e)) : -1;

  const items = [
    ...[...picked.entries()].map(([key, item]) => ({ ...item, id: key }) as Parameters<typeof campaignScreens>[0][number]),
    ...siteLines,
  ];
  const hasLines = picked.size > 0 || siteLines.length > 0;
  const r = reach({ items, start, end });
  const screens = campaignScreens(items, catalogue);
  const { sizes, unknown } = artworkSizes(screens);
  const total = screens.reduce((n, x) => n + x.qty, 0);
  const mallCount = new Set(screens.map((x) => x.mallName)).size;
  const flight = days(start, end);

  // Who the proposal email goes to, if known yet.
  const recipient = clientContact(client.clientId) ?? (client.prospect?.email.trim() ? { name: client.prospect.name.trim() || client.prospect.company.trim(), email: client.prospect.email.trim() } : null);

  // The id the new campaign will get, so the email link can point at it before it's saved.
  const [newId] = useState(() => `c-${Math.random().toString(36).slice(2, 9)}`);
  const fields = () => ({
    id: newId,
    kind,
    name: name.trim() || 'Untitled campaign',
    clientId: client.clientId,
    prospect: client.prospect,
    objective,
    start: start || null,
    end: end || null,
    audience,
    items: items.map((i, n) => ({ ...i, id: `i-${newId.slice(2)}-${n}` })),
  });
  /** Sales, in one step: save the proposal, then open the emailer on its page (it marks it sent once emailed). */
  function createAndEmail() {
    save(false, false);
    router.push(`/portal/campaign?id=${newId}&email=1`);
  }

  function save(send: boolean, go = true): string {
    const id = portal.create({ ...fields() });
    if (send) portal.move(id, sales ? 'sent' : 'proposed');
    if (go) router.push(`/portal/campaign?id=${id}`);
    return id;
  }


  const toggle = (key: string, item: NewCampaignItem) =>
    setPicked((cur) => {
      const next = new Map(cur);
      if (next.has(key)) next.delete(key);
      else next.set(key, item);
      return next;
    });

  const rowsFor = (e: Entry) => rowsForEntry(e, catalogue);
  const allMalls = useMemo(() => getMalls(catalogue), [catalogue]);

  /* A proposal drafted by the AI from the client's brief. */
  const [aiDraft, setAiDraft] = useState<{ draft: BriefDraft; file: string; kept: number; dropped: number; truncated: boolean; undo: () => void } | null>(null);
  const [reasons, setReasons] = useState<Map<string, string>>(new Map());
  const [clientKey, setClientKey] = useState(0);
  function applyDraft(draft: BriefDraft, file: string, truncated = false) {
    const before = { name, client, objective, start, end, picked, reasons, siteLines, kind };
    // A document with site lines (a PIMS export) makes a site list.
    if (draft.sites?.length) setKind('sitelist');
    const rows = new Map(mallEntries(catalogue).flatMap((e) => rowsFor(e).map((r) => [r.key, r] as const)));
    const chosen = draft.items.filter((i) => rows.has(i.key));
    const iso = (d: string | null) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null);
    if (draft.name.trim()) setName(draft.name.trim());
    if (draft.objective.trim()) setObjective(draft.objective.trim());
    if (iso(draft.start)) setStart(iso(draft.start)!);
    if (iso(draft.end)) setEnd(iso(draft.end)!);
    const company = draft.client.company.trim();
    const known = company ? CLIENTS.find((c) => c.name.toLowerCase() === company.toLowerCase()) : undefined;
    if (known) setClient({ clientId: known.id, prospect: null });
    else if (company || draft.client.email.trim() || draft.client.contactName.trim()) {
      setClient({ clientId: null, prospect: { company, name: draft.client.contactName.trim(), email: draft.client.email.trim() } });
    }
    setClientKey((k) => k + 1);
    setPicked(new Map(chosen.map((i) => [i.key, rows.get(i.key)!.item] as const)));
    // A site list: keep every row; a matched row brings its screen (size, spec sheet, template).
    const used = new Set<string>();
    setSiteLines(
      (draft.sites ?? []).map((r, n) => {
        const row = r.match ? rows.get(r.match) : undefined;
        const screen = row?.item.kind === 'screen' ? row.item : undefined;
        let ref = r.siteNo || `line-${n + 1}`;
        while (used.has(ref)) ref = `${ref}-${n + 1}`;
        used.add(ref);
        return {
          id: `site:${ref}`, kind: 'site' as const, ref, no: r.no, siteNo: r.siteNo, town: r.town, mall: r.mall, location: r.location, size: r.size,
          start: r.start, end: r.end, specId: row?.specId ?? null, appMallId: screen?.appMallId ?? '',
        };
      }).map((line) => {
        // The AI left it unmatched, but its site code names the format (MAPP = Digi Engage): match it to that mall's screen.
        if (line.specId) return line;
        const f = formatScreen(line, allMalls, catalogue);
        return f ? { ...line, ...f } : line;
      }),
    );
    setReasons(new Map(chosen.map((i) => [i.key, i.reason] as const)));
    try {
      if (draft.noteForClient.trim()) sessionStorage.setItem(`malls-specs:draft-note:${newId}`, draft.noteForClient.trim());
    } catch {
      /* ignore */
    }
    setAiDraft({
      draft,
      file,
      truncated,
      kept: chosen.length + (draft.sites?.length ?? 0),
      dropped: draft.items.length - chosen.length,
      undo: () => {
        setName(before.name);
        setClient(before.client);
        setClientKey((k) => k + 1);
        setObjective(before.objective);
        setStart(before.start);
        setEnd(before.end);
        setPicked(before.picked);
        setReasons(before.reasons);
        setSiteLines(before.siteLines);
        setKind(before.kind);
        setAiDraft(null);
      },
    });
    document.getElementById('plan')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // What sales should look at: the AI's notes (not its generic unmatched line), then why each unmatched site isn't matched, worked out from the site's malls.
  const checks = aiDraft
    ? [...aiDraft.draft.missing.filter((m) => !/aren’t (matched to a screen|screens) on the site/.test(m)), ...unmatchedSummary(siteLines, allMalls)]
    : [];

  return (
    <Page>
      <header className="flex flex-col gap-2">
        <h1 className="text-display-lg text-fg">{!sales ? 'Tell us about your campaign' : kind === 'sitelist' ? 'New site list' : 'New proposal'}</h1>
        <p className="max-w-prose text-body-md text-fg-muted">
          {!sales
            ? 'Who you want to reach and when. We’ll suggest malls as you go, and your account manager will turn it into a proposal.'
            : kind === 'sitelist'
              ? 'Drop the PIMS export, check the sites, create.'
              : 'Pick the screens, add the client, create. Or drop their brief and it fills itself in.'}
        </p>
        {from ? <p className="text-body-sm text-fg-muted">Starting from the proposal “{from.name}”: its client and dates are filled in.</p> : null}
      </header>

      {sales ? <BriefDrop compact pims={kind === 'sitelist'} inventory={() => briefInventory(catalogue)} onDraft={applyDraft} /> : null}
      {aiDraft ? (
        <section role="status" className="flex flex-col gap-3 rounded-2xl border-2 border-accent bg-accent-subtle p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <strong className="text-body-lg text-fg">Drafted from {aiDraft.file}</strong>
              <p className="text-body-md text-fg">{aiDraft.draft.summary}</p>
              <p className="text-body-sm text-fg-muted">
                {aiDraft.draft.sites?.length
                  ? `All ${aiDraft.draft.sites.length} sites from the document are in the site list: ${aiDraft.draft.sites.filter((x) => x.match).length} matched to screens on the site, ${aiDraft.draft.sites.filter((x) => !x.match).length} marked “check”.`
                  : `${aiDraft.kept} ${aiDraft.kept === 1 ? 'screen' : 'screens'} chosen${aiDraft.dropped ? ` (${aiDraft.dropped} suggestion${aiDraft.dropped === 1 ? '' : 's'} not found and left out)` : ''}.`}{' '}
                Check the details and screens below, then create it.
              </p>
            </div>
            <button type="button" onClick={aiDraft.undo} className="inline-flex h-10 items-center rounded-full border border-border-strong bg-bg px-4 text-body-sm font-semibold text-fg hover:border-fg">Undo</button>
          </div>
          {aiDraft.truncated ? <p className="text-body-sm font-semibold text-warning-fg">The file was very long, so the AI read only the first part. Check the dates and screens against the rest of the brief.</p> : null}
          {checks.length ? (
            <div className="flex flex-col gap-1 rounded-xl bg-bg p-3">
              <span className="text-body-sm font-semibold text-warning-fg">Check before sending</span>
              <ul className="list-disc pl-5 text-body-sm text-fg">
                {checks.map((m) => <li key={m}>{m}</li>)}
              </ul>
            </div>
          ) : siteLines.length ? <p className="text-body-sm font-semibold text-success-fg">Every site is matched to a screen on the site.</p> : null}
          {siteLines.some((x) => !x.specId) ? (
            <SiteMatch
              lines={siteLines}
              onMatch={(ids, specId, appMallId) => setSiteLines((cur) => cur.map((x) => (ids.includes(x.id) ? { ...x, specId, appMallId } : x)))}
            />
          ) : null}
          {aiDraft.draft.noteForClient ? <p className="text-body-sm text-fg-muted">A note for the client is ready in the email: “{aiDraft.draft.noteForClient}”</p> : null}
        </section>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-8">
          <section id="basics" className="grid gap-4 rounded-2xl border border-border bg-bg p-5 sm:grid-cols-4">
            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className={fieldLabel}>Name</span>
              <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Winter soup range launch" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={fieldLabel}>Starts</span>
              <input type="date" className={input} value={start} min={todayIso()} onChange={(e) => setStart(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={fieldLabel}>Ends</span>
              <input type="date" className={input} value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
            </label>
            {sales ? <div className="sm:col-span-4"><ClientField key={clientKey} clientId={client.clientId} prospect={client.prospect} onChange={setClient} input={input} label={fieldLabel} /></div> : null}
            <details className="sm:col-span-4" open={Boolean(objective)}>
              <summary className="cursor-pointer text-body-sm font-semibold text-accent">{objective ? 'Objective' : '+ Add an objective (optional)'}</summary>
              <textarea rows={2} className={`${input} mt-2 h-auto py-2`} value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="Launch, awareness, drive store visits, a promotion…" />
            </details>
          </section>

          <details id="who" className="rounded-2xl bg-bg-subtle p-4" open={!sales}>
            <summary className="cursor-pointer text-body-sm font-semibold text-fg">Who do they want to reach? <span className="font-normal text-fg-muted">Optional: ranks the malls below by fit</span></summary>
            <div className="mt-4"><AudiencePicker value={audience} onChange={setAudience} /></div>
          </details>

          <Section title={kind === 'sitelist' && siteLines.length ? 'Add more screens' : 'Add screens'} id="fit">
            <p className="-mt-2 text-body-sm text-fg-muted">
              Best fit for your audience first{audience.provinces.length ? ', then other provinces' : ''}. Tick the screens you’d like.
            </p>
            <input
              type="search"
              className={input}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Find any of ${entries.length} malls, a screen, a province or a package code`}
              aria-label="Find a mall"
            />
            <ul className="flex flex-col gap-2">
              {visible.map((e, i) => {
                const rows = rowsFor(e);
                return (
                  <li key={e.key} className="flex flex-col gap-2">
                    {i === firstOutside ? <h3 className="mt-4 text-label-md font-semibold uppercase text-fg-muted">Other provinces</h3> : null}
                    <div className={`flex flex-col gap-3 rounded-xl border bg-bg p-4 ${hasPick(e) ? 'border-accent' : 'border-border'}`}>
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div className="flex min-w-0 flex-col">
                          <strong className="text-body-md font-semibold text-fg">{e.name}</strong>
                          {e.area ? <span className="text-body-sm text-fg-muted">{e.area}</span> : null}
                        </div>
                        {e.score !== null ? (
                          <span className="text-body-md font-bold tabular-nums text-accent">{e.score}<span className="text-body-sm font-medium text-fg-muted">/100 fit</span></span>
                        ) : (
                          <span className="text-body-sm text-fg-subtle">No audience data</span>
                        )}
                      </div>
                      {e.reasons.length ? <span className="text-body-sm text-fg-muted">{e.reasons.slice(0, 3).join(' · ')}</span> : null}

                      <ul className="grid gap-2 sm:grid-cols-2">
                        {rows.map((row) => {
                          const on = picked.has(row.key);
                          return (
                            <li key={row.key}>
                              <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-2 pr-3 ${on ? 'border-accent bg-accent-subtle' : 'border-border hover:border-border-strong'}`}>
                                <input type="checkbox" className="ml-1 accent-[var(--color-accent)]" checked={on} onChange={() => toggle(row.key, row.item)} aria-label={`${e.name}: ${row.title}`} />
                                <span className="relative shrink-0">
                                  <Zoomable src={row.photo} title={`${e.name} · ${row.title}`} specId={row.specId} note={row.photoNote} detail={row.width && row.height ? `${row.width} × ${row.height} px${row.qty > 1 ? ` · ${row.qty} screens` : ''}` : undefined} className="h-12 w-16 rounded-lg">
                                    <span className="flex h-full w-full items-center justify-center bg-bg-subtle" aria-hidden>
                                      {row.width && row.height ? (
                                        <span
                                          className="rounded-sm bg-gradient-to-br from-accent to-[#1e2761]"
                                          style={row.width >= row.height ? { width: 40, height: Math.max(6, Math.round((40 * row.height) / row.width)) } : { height: 36, width: Math.max(6, Math.round((36 * row.width) / row.height)) }}
                                        />
                                      ) : null}
                                    </span>
                                  </Zoomable>
                                  {row.photo && row.photoNote ? <span className="pointer-events-none absolute bottom-0.5 left-0.5 rounded bg-[rgba(6,12,28,0.7)] px-1 text-[9px] font-semibold leading-3 text-white" title={row.photoNote}>Deck</span> : null}
                                </span>
                                <span className="flex min-w-0 flex-1 flex-col">
                                  <span className={`truncate text-body-sm font-semibold ${on ? 'text-accent' : 'text-fg'}`}>{row.title}</span>
                                  <span className="font-mono text-[12px] tabular-nums text-fg-muted">
                                    {row.width && row.height ? `${row.width}×${row.height}` : 'Size to confirm'}
                                    {row.qty > 1 ? ` · ${row.qty} screens` : ''}
                                  </span>
                                </span>
                                {row.specId ? (
                                  <Link href={`/spec/${row.specId}`} target="_blank" className="shrink-0 text-[12px] font-semibold text-fg-muted hover:text-accent" onClick={(ev) => ev.stopPropagation()}>
                                    Spec ↗
                                  </Link>
                                ) : null}
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </li>
                );
              })}
            </ul>
            {!visible.length ? <p className="rounded-xl border border-dashed border-border-strong px-4 py-6 text-center text-body-sm text-fg-muted">No mall matches “{query}”.</p> : null}
            {!q && ordered.length > visible.length ? (
              <button type="button" onClick={() => setShowAll(true)} className="self-start rounded-full border border-border-strong px-4 py-2 text-body-sm font-semibold text-fg hover:bg-bg-subtle">
                Show all {ordered.length} malls
              </button>
            ) : null}
            {!q && showAll && ordered.length > SHORT ? (
              <button type="button" onClick={() => setShowAll(false)} className="self-start text-body-sm font-semibold text-accent hover:underline">
                Show fewer
              </button>
            ) : null}
          </Section>
        </div>

        {/* The plan stays in view; its list scrolls inside it so the buttons are always on screen. */}
        <aside id="plan" className="h-fit scroll-mt-24 lg:sticky lg:top-[calc(var(--topbar-height)+24px)] lg:flex lg:max-h-[calc(100dvh-var(--topbar-height)-48px)] lg:flex-col">
          <div className="flex min-h-0 flex-col gap-4 rounded-2xl bg-brand-surface p-5 text-brand-on-surface">
            <span className="text-label-md font-semibold uppercase text-brand-on-surface-muted">Your plan so far</span>
            <div className="flex flex-col gap-1">
              <div className="text-display-lg">{total} {total === 1 ? 'screen' : 'screens'}</div>
              <div className="text-body-sm text-brand-on-surface-muted">
                in {mallCount} {mallCount === 1 ? 'mall' : 'malls'} over {flight || '—'} days{r.visits ? ` · ~${compact(r.visits)} visits` : ''}
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-2">
              {sales && recipient?.email && hasLines ? (
                start && end ? (
                  <button type="button" onClick={createAndEmail} className="inline-flex h-11 w-full items-center justify-center rounded-full bg-accent px-4 text-body-sm font-semibold text-fg-on-accent hover:bg-accent-hover">
                    Create and email to {recipient.name.split(' ')[0] || 'the client'}
                  </button>
                ) : null
              ) : null}
              <button
                type="button"
                disabled={!start || !end}
                onClick={() => save(!sales)}
                className={
                  sales && recipient?.email && hasLines
                    ? 'inline-flex h-10 items-center justify-center rounded-full border border-white/25 px-4 text-body-sm font-semibold hover:bg-white/10 disabled:opacity-50'
                    : 'inline-flex h-11 items-center justify-center rounded-full bg-accent px-4 text-body-sm font-semibold text-fg-on-accent hover:bg-accent-hover disabled:opacity-50'
                }
              >
                {sales ? (recipient?.email && hasLines ? 'Create without sending' : kind === 'sitelist' ? 'Create site list' : 'Create proposal') : 'Send brief to Primedia'}
              </button>
              {!sales ? (
                <button type="button" onClick={() => save(false)} className="inline-flex h-10 items-center justify-center rounded-full border border-white/25 px-4 text-body-sm font-semibold hover:bg-white/10">
                  Save as draft
                </button>
              ) : null}
              {!start || !end ? <span className="text-body-sm text-brand-on-surface-muted">Choose the dates to continue.</span> : null}
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain pr-1">
            {siteLines.length ? (
              <div className="flex flex-col gap-1.5 border-t border-white/10 pt-4 text-body-sm">
                <div className="flex items-center justify-between gap-2">
                  <strong>Site list · {siteLines.length} {siteLines.length === 1 ? 'site' : 'sites'}</strong>
                  <button type="button" onClick={() => setSiteLines([])} className="text-[12px] text-brand-on-surface-muted underline hover:text-brand-on-surface">Remove list</button>
                </div>
                <span className="text-[12px] text-brand-on-surface-muted">{siteLines.filter((x) => x.specId).length} matched to screens on the site · {siteLines.filter((x) => !x.specId).length} to check</span>
                <ol className="flex flex-col gap-0.5">
                  {siteLines.slice(0, 200).map((x) => (
                    <li key={x.id} className="flex gap-2 text-[12px]">
                      <span className="w-6 shrink-0 tabular-nums text-brand-on-surface-muted">{x.no ?? ''}</span>
                      <span className="min-w-0 truncate" title={`${x.siteNo} · ${x.mall} · ${x.location}`}>{x.mall}{x.location ? ` · ${x.location}` : ''}</span>
                      {x.specId ? null : <span className="ml-auto shrink-0 text-warning-fg" title={statusText(siteStatus(x, allMalls))}>{siteStatus(x, allMalls).kind === 'no-mall' ? 'no mall' : 'no screen'}</span>}
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
            {picked.size ? (
              <ul className="flex flex-col gap-1.5 border-t border-white/10 pt-4 text-body-sm">
                {[...picked.keys()].map((k) => {
                  const sc = screens.find((x) => x.itemId === k);
                  return (
                    <li key={k} className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate">{sc ? `${sc.mallName} · ${sc.title}${sc.qty > 1 ? ` × ${sc.qty}` : ''}` : k.slice(4)}</span>
                        {reasons.get(k) ? <span className="truncate text-[12px] text-brand-on-surface-muted" title={reasons.get(k)}>{reasons.get(k)}</span> : null}
                      </span>
                      <button type="button" onClick={() => toggle(k, picked.get(k)!)} aria-label={`Remove ${sc?.title ?? k}`} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-brand-on-surface-muted hover:bg-white/10 hover:text-brand-on-surface">×</button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              siteLines.length ? null : <p className="border-t border-white/10 pt-4 text-body-sm text-brand-on-surface-muted">{kind === 'sitelist' ? 'Drop the PIMS export anywhere on this page.' : 'Tick screens on the left, or drop the client’s brief anywhere on this page.'}</p>
            )}
            {sizes.length || unknown ? (
              <div className="flex flex-col gap-2 border-t border-white/10 pt-4">
                <span className="text-body-sm text-brand-on-surface-muted">Artwork sizes</span>
                <ul className="flex flex-col gap-1 text-body-sm">
                  {sizes.map((z) => (
                    <li key={`${z.width}x${z.height}`} className="flex justify-between gap-3">
                      <span className="font-semibold tabular-nums">{z.width} × {z.height}</span>
                      <span className="text-brand-on-surface-muted">{z.orientation} · {z.screens}</span>
                    </li>
                  ))}
                  {unknown ? <li className="text-brand-on-surface-muted">{unknown} to confirm</li> : null}
                </ul>
              </div>
            ) : null}
            </div>
          </div>
        </aside>

        {/* Phones: the plan's total and the create button, always at the bottom of the screen. */}
        <div className="fixed inset-x-0 bottom-0 z-sticky border-t border-border bg-bg/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-page items-center justify-between gap-3">
            <a href="#plan" className="min-w-0 text-body-sm text-fg">
              <strong>{total} {total === 1 ? 'screen' : 'screens'}</strong>
              <span className="text-fg-muted"> · {mallCount} {mallCount === 1 ? 'mall' : 'malls'} · see plan</span>
            </a>
            <button
              type="button"
              disabled={!start || !end}
              onClick={() => (sales && recipient?.email && hasLines ? createAndEmail() : save(!sales))}
              className="inline-flex h-11 shrink-0 items-center rounded-full bg-accent px-5 text-body-sm font-semibold text-fg-on-accent hover:bg-accent-hover disabled:opacity-50"
            >
              {!start || !end ? 'Choose dates first' : sales ? (recipient?.email && hasLines ? 'Create and email' : kind === 'sitelist' ? 'Create site list' : 'Create proposal') : 'Send brief'}
            </button>
          </div>
        </div>
        <div aria-hidden="true" className="h-16 lg:hidden" />
      </div>
    </Page>
  );
}

export function NewCampaign() {
  const params = useSearchParams();
  // Switching between "New proposal" and "Site list from PIMS" in the menu starts a fresh form.
  const key = `${params.get('kind') ?? ''}:${params.get('from') ?? ''}`;
  return <RequireSignIn what="campaign planning">{(user) => <Form key={key} user={user} />}</RequireSignIn>;
}
