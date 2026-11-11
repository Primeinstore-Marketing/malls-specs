'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { compact } from '@/lib/insights';
import type { AudienceTarget } from '@/lib/insights';
import { addDays, days, reach, todayIso } from '@/lib/portal/logic';
import { portal } from '@/lib/portal/store';
import { artworkSizes, campaignScreens } from '@/lib/portal/screens';
import { mallEntries, pkgKey, rowsFor as rowsForEntry, scrKey } from '@/lib/portal/mallScreens';
import type { MallEntry as Entry } from '@/lib/portal/mallScreens';
import { useLiveData } from '@/lib/liveData';
import type { NewCampaignItem, PortalUser, Prospect } from '@/lib/portal/types';
import { AudiencePicker, readAudience } from '@/components/insights/AudiencePicker';
import { ClientField } from './ClientField';
import { Page, RequireSignIn, Section } from './ui';

const input = 'h-10 w-full rounded-lg border border-border-strong bg-bg px-3 text-body-md text-fg outline-none focus:border-border-focus';
const fieldLabel = 'text-label-md font-semibold uppercase text-fg-muted';

function Form({ user }: { user: PortalUser }) {
  const params = useSearchParams();
  const router = useRouter();
  const sales = user.role === 'sales';
  const { catalogue } = useLiveData();
  const [name, setName] = useState('');
  const [client, setClient] = useState<{ clientId: string | null; prospect: Prospect | null }>({ clientId: sales ? null : user.clientId ?? null, prospect: null });
  const [objective, setObjective] = useState('');
  const [start, setStart] = useState(addDays(todayIso(), 30));
  const [end, setEnd] = useState(addDays(todayIso(), 57));
  const [audience, setAudience] = useState<AudienceTarget>(() => readAudience(new URLSearchParams(params.toString())));
  // What's in the plan, keyed pkg:<code> or scr:<specId>, in the order it was ticked.
  const [picked, setPicked] = useState<Map<string, NewCampaignItem>>(new Map());
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

  const items = [...picked.entries()].map(([key, item]) => ({ ...item, id: key }) as Parameters<typeof campaignScreens>[0][number]);
  const r = reach({ items, start, end });
  const screens = campaignScreens(items, catalogue);
  const { sizes, unknown } = artworkSizes(screens);
  const total = screens.reduce((n, x) => n + x.qty, 0);
  const mallCount = new Set(screens.map((x) => x.mallName)).size;
  const flight = days(start, end);

  function save(send: boolean) {
    const id = portal.create({
      name: name.trim() || 'Untitled campaign',
      clientId: client.clientId,
      prospect: client.prospect,
      objective,
      start: start || null,
      end: end || null,
      audience,
      items: items.map((i) => ({ ...i, id: `i-${Math.random().toString(36).slice(2, 9)}` })),
    });
    if (send) portal.move(id, sales ? 'sent' : 'proposed');
    router.push(`/portal/campaign?id=${id}`);
  }

  const toggle = (key: string, item: NewCampaignItem) =>
    setPicked((cur) => {
      const next = new Map(cur);
      if (next.has(key)) next.delete(key);
      else next.set(key, item);
      return next;
    });

  const rowsFor = (e: Entry) => rowsForEntry(e, catalogue);

  return (
    <Page>
      <header className="flex flex-col gap-3">
        <span className="text-label-md font-semibold uppercase text-accent">{sales ? 'New proposal' : 'Propose a campaign'}</span>
        <h1 className="text-display-xl text-fg">{sales ? 'Build a proposal' : 'Tell us about your campaign'}</h1>
        <p className="max-w-prose text-body-lg text-fg-muted">
          {sales
            ? 'Pick the malls and screens, then email it to the client. The client can be added now or later.'
            : 'Who you want to reach and when. We’ll suggest malls as you go, and your account manager will turn it into a proposal.'}
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-8">
          <Section title="1. The campaign" id="basics">
            <div className="grid gap-4 rounded-2xl border border-border bg-bg p-5 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className={fieldLabel}>Name</span>
                <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Winter soup range launch" />
              </label>
              {sales ? <ClientField clientId={client.clientId} prospect={client.prospect} onChange={setClient} input={input} label={fieldLabel} /> : null}
              <label className="flex flex-col gap-1.5">
                <span className={fieldLabel}>Starts</span>
                <input type="date" className={input} value={start} min={todayIso()} onChange={(e) => setStart(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={fieldLabel}>Ends</span>
                <input type="date" className={input} value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className={fieldLabel}>Objective</span>
                <textarea rows={3} className={`${input} h-auto py-2`} value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="Launch, awareness, drive store visits, a promotion…" />
              </label>
            </div>
          </Section>

          <Section title="2. Who you want to reach" id="who">
            <div className="rounded-2xl bg-bg-subtle p-5">
              <AudiencePicker value={audience} onChange={setAudience} />
            </div>
          </Section>

          <Section title="3. Choose screens" id="fit">
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
                                {row.photo ? (
                                  <span className="relative h-12 w-16 shrink-0">
                                    {/* eslint-disable-next-line @next/next/no-img-element -- deck or API photo */}
                                    <img src={row.photo} alt="" loading="lazy" className="h-12 w-16 rounded-lg object-cover" />
                                    {row.photoNote ? <span className="absolute bottom-0.5 left-0.5 rounded bg-[rgba(6,12,28,0.7)] px-1 text-[9px] font-semibold leading-3 text-white" title={row.photoNote}>Deck</span> : null}
                                  </span>
                                ) : (
                                  <span className="flex h-12 w-16 shrink-0 items-center justify-center rounded-lg bg-bg-subtle" aria-hidden>
                                    {row.width && row.height ? (
                                      <span
                                        className="rounded-sm bg-gradient-to-br from-accent to-[#1e2761]"
                                        style={row.width >= row.height ? { width: 40, height: Math.max(6, Math.round((40 * row.height) / row.width)) } : { height: 36, width: Math.max(6, Math.round((36 * row.width) / row.height)) }}
                                      />
                                    ) : null}
                                  </span>
                                )}
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

        <aside className="h-fit lg:sticky lg:top-[calc(var(--topbar-height)+24px)]">
          <div className="flex flex-col gap-4 rounded-2xl bg-brand-surface p-5 text-brand-on-surface">
            <span className="text-label-md font-semibold uppercase text-brand-on-surface-muted">Your plan so far</span>
            <div className="flex flex-col gap-1">
              <div className="text-display-lg">{total} {total === 1 ? 'screen' : 'screens'}</div>
              <div className="text-body-sm text-brand-on-surface-muted">
                in {mallCount} {mallCount === 1 ? 'mall' : 'malls'} over {flight || '—'} days{r.visits ? ` · ~${compact(r.visits)} visits` : ''}
              </div>
            </div>
            {picked.size ? (
              <ul className="flex flex-col gap-1.5 border-t border-white/10 pt-4 text-body-sm">
                {[...picked.keys()].map((k) => {
                  const sc = screens.find((x) => x.itemId === k);
                  return (
                    <li key={k} className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate">{sc ? `${sc.mallName} · ${sc.title}${sc.qty > 1 ? ` × ${sc.qty}` : ''}` : k.slice(4)}</span>
                      <button type="button" onClick={() => toggle(k, picked.get(k)!)} aria-label={`Remove ${sc?.title ?? k}`} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-brand-on-surface-muted hover:bg-white/10 hover:text-brand-on-surface">×</button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="border-t border-white/10 pt-4 text-body-sm text-brand-on-surface-muted">Tick screens in step 3.</p>
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
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={!start || !end}
                onClick={() => save(!sales)}
                className="inline-flex h-11 items-center justify-center rounded-full bg-accent px-4 text-body-sm font-semibold text-fg-on-accent hover:bg-accent-hover disabled:opacity-50"
              >
                {sales ? 'Create proposal' : 'Send brief to Primedia'}
              </button>
              {!sales ? (
                <button type="button" onClick={() => save(false)} className="inline-flex h-10 items-center justify-center rounded-full border border-white/25 px-4 text-body-sm font-semibold hover:bg-white/10">
                  Save as draft
                </button>
              ) : null}
              {!start || !end ? <span className="text-body-sm text-brand-on-surface-muted">Choose the dates to continue.</span> : null}
            </div>
          </div>
        </aside>
      </div>
    </Page>
  );
}

export function NewCampaign() {
  return <RequireSignIn what="campaign planning">{(user) => <Form user={user} />}</RequireSignIn>;
}
