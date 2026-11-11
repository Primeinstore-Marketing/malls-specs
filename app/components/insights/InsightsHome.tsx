'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ANY_AUDIENCE, DECK_MALLS, annualVisits, compact, mallName, matchMalls, networkStats, rand, thousands } from '@/lib/insights';
import type { AudienceTarget, DeckMall } from '@/lib/insights';
import { AddToCampaign, Bar, Page, RequireSignIn, Section } from '@/components/portal/ui';
import { AudiencePicker, MatchRow, ScoreHelp, audienceQuery } from './AudiencePicker';

function Leaderboard({ title, note, rows }: { title: string; note: string; rows: { mall: DeckMall; value: number; label: string }[] }) {
  const max = Math.max(...rows.map((r) => r.value));
  return (
    <div className="flex flex-col gap-4 rounded-3xl bg-bg-subtle p-5">
      <div>
        <h3 className="text-body-lg font-semibold text-fg">{title}</h3>
        <p className="text-body-sm text-fg-muted">{note}</p>
      </div>
      <div className="flex flex-col gap-2">
        {rows.map((r) => (
          <Bar key={r.mall.id} label={<Link href={`/insights/mall?id=${r.mall.id}`} className="hover:text-accent hover:underline">{mallName(r.mall)}</Link>} pct={r.value} max={max} value={r.label} />
        ))}
      </div>
    </div>
  );
}

function Compare() {
  const [ids, setIds] = useState<string[]>(['canal-walk', 'menlyn', 'gateway']);
  const malls = ids.map((id) => DECK_MALLS.find((m) => m.id === id)).filter((m): m is DeckMall => Boolean(m));
  const rows: [string, (m: DeckMall) => string][] = [
    ['Province', (m) => m.province],
    ['Visits a year', (m) => (annualVisits(m) ? thousands(annualVisits(m) as number) : '—')],
    ['Household income / month', (m) => (m.profile?.householdIncome ? rand(m.profile.householdIncome) : '—')],
    ['Women', (m) => (m.profile?.female != null ? `${m.profile.female}%` : '—')],
    ['Biggest age group', (m) => { const b = [...(m.profile?.ageBands ?? [])].sort((x, y) => y.pct - x.pct)[0]; return b ? `${b.band} (${b.pct}%)` : '—'; }],
    ['Working', (m) => (m.profile?.working != null ? `${m.profile.working}%` : '—')],
    ['LSM affinity', (m) => m.profile?.lsm?.replace('&', ' & ') ?? '—'],
    ['Notice mall ads', (m) => (m.media?.noticeMallAds != null ? `${m.media.noticeMallAds}%` : '—')],
    ['See digital screens', (m) => (m.media?.seenDigitalScreens != null ? `${m.media.seenDigitalScreens}%` : '—')],
    ['Packages', (m) => m.packages.map((p) => p.format).join(', ')],
  ];
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-2 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <select
            key={i}
            aria-label={`Mall ${i + 1}`}
            value={ids[i] ?? ''}
            onChange={(e) => setIds((cur) => { const next = [...cur]; next[i] = e.target.value; return next.filter(Boolean); })}
            className="h-10 rounded-lg border border-border-strong bg-bg px-3 text-body-sm text-fg"
          >
            <option value="">—</option>
            {[...DECK_MALLS].sort((a, b) => mallName(a).localeCompare(mallName(b))).map((m) => (
              <option key={m.id} value={m.id}>{mallName(m)}</option>
            ))}
          </select>
        ))}
      </div>
      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[560px] text-left text-body-sm">
          <thead className="bg-bg-subtle">
            <tr>
              <th className="px-4 py-3 font-semibold text-fg-muted" />
              {malls.map((m) => (
                <th key={m.id} className="px-4 py-3 font-semibold text-fg">
                  <Link href={`/insights/mall?id=${m.id}`} className="hover:text-accent hover:underline">{mallName(m)}</Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, get]) => (
              <tr key={label} className="border-t border-border">
                <th scope="row" className="px-4 py-2.5 font-medium text-fg-muted">{label}</th>
                {malls.map((m) => (
                  <td key={m.id} className="px-4 py-2.5 tabular-nums text-fg">{get(m)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Insights() {
  const stats = networkStats();
  const [target, setTarget] = useState<AudienceTarget>({ ...ANY_AUDIENCE, gender: 'female', ages: ['25-34', '35-44'] });
  const matches = useMemo(() => matchMalls(target), [target]);
  const [showAll, setShowAll] = useState(false);
  const top = (key: (m: DeckMall) => number | null | undefined, n = 5) =>
    DECK_MALLS.map((m) => ({ mall: m, value: key(m) ?? 0 })).filter((r) => r.value > 0).sort((a, b) => b.value - a.value).slice(0, n);

  return (
    <Page>
      <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex max-w-2xl flex-col gap-3">
          <h1 className="text-display-xl text-fg">Who shops where</h1>
          <p className="text-body-lg text-fg-muted">Tell us who you want to reach. We’ll rank {stats.malls} malls by how well their shoppers fit.</p>
        </div>
        <dl className="grid grid-cols-3 gap-6 lg:gap-10">
          <div><dt className="text-body-sm text-fg-muted">Visits a year</dt><dd className="text-display-md text-fg">{compact(stats.annualVisits)}</dd></div>
          <div><dt className="text-body-sm text-fg-muted">Notice mall ads</dt><dd className="text-display-md text-fg">{stats.noticeMallAds}%</dd></div>
          <div><dt className="text-body-sm text-fg-muted">Packages</dt><dd className="text-display-md text-fg">{stats.packages}</dd></div>
        </dl>
      </header>

      <div className="grid gap-8 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="flex h-fit flex-col gap-6 rounded-3xl bg-bg-subtle p-5 lg:sticky lg:top-[calc(var(--topbar-height)+24px)]" aria-label="Your audience">
          <AudiencePicker value={target} onChange={setTarget} />
          <Link
            href={`/portal/new?${audienceQuery(target)}`}
            className="inline-flex h-11 items-center justify-center rounded-full bg-accent px-5 text-body-sm font-semibold text-fg-on-accent hover:bg-accent-hover"
          >
            Plan a campaign for this audience
          </Link>
        </aside>
        <div className="flex min-w-0 flex-col gap-4">
          <p className="text-body-md text-fg-muted" aria-live="polite">
            <strong className="font-semibold text-fg">{matches.length} malls</strong>, best fit first
          </p>
          <ol className="flex flex-col gap-2">
            {(showAll ? matches : matches.slice(0, 6)).map((m, i) => (
              <MatchRow
                key={m.mall.id}
                m={m}
                rank={i + 1}
                action={m.mall.packages[0] ? <AddToCampaign compact item={{ kind: 'package', code: m.mall.packages[0].code }} /> : null}
              />
            ))}
          </ol>
          {matches.length > 6 ? (
            <button type="button" onClick={() => setShowAll((x) => !x)} className="h-11 self-start rounded-full px-4 text-body-sm font-semibold text-accent hover:bg-accent-subtle">
              {showAll ? 'Show fewer' : `Show all ${matches.length} malls`}
            </button>
          ) : null}
          <ScoreHelp />
        </div>
      </div>

      <Section title="Leaderboards" id="boards">
        <div className="grid gap-4 lg:grid-cols-3">
          <Leaderboard title="Biggest audiences" note="Mall visits a year" rows={top(annualVisits).map((r) => ({ ...r, label: compact(r.value) }))} />
          <Leaderboard title="Most screen-aware" note="Notice ads on digital screens" rows={top((m) => m.media?.seenDigitalScreens).map((r) => ({ ...r, label: `${r.value}%` }))} />
          <Leaderboard title="Highest income" note="Household, a month" rows={top((m) => m.profile?.householdIncome).map((r) => ({ ...r, label: `R${compact(r.value)}` }))} />
        </div>
      </Section>

      <Section title="Compare malls" id="compare">
        <Compare />
      </Section>

      <p className="text-body-sm text-fg-subtle">
        Source: Rialtofoods media proposal, April 2022 — TGISA 18B/19A and 15C/16C, weighted to the population; Stats SA Community Survey, 5km catchment.
      </p>
    </Page>
  );
}

export function InsightsHome() {
  return <RequireSignIn what="audience insights">{() => <Insights />}</RequireSignIn>;
}
