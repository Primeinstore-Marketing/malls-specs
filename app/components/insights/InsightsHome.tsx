'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ANY_AUDIENCE, DECK_MALLS, annualVisits, compact, mallArea, mallName, mallPhoto, matchMalls, networkStats, rand, thousands } from '@/lib/insights';
import type { AudienceTarget, DeckMall, MallMatch } from '@/lib/insights';
import { AddToProposal, Bar, Page, RequireSignIn, Section } from '@/components/portal/ui';
import { AudiencePicker, MatchRow, ScoreHelp, audienceQuery, audienceSummary } from './AudiencePicker';

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

function CoverPhoto({ src }: { src: string | null }) {
  const [broken, setBroken] = useState<string | null>(null);
  if (!src || broken === src) return null;
  // eslint-disable-next-line @next/next/no-img-element -- deck photo or API file
  return <img src={src} alt="" loading="lazy" onError={() => setBroken(src)} className="h-full w-full object-cover transition-transform duration-slow group-hover:scale-105" />;
}

function fitTone(score: number): string {
  return score >= 85 ? 'bg-success-bg text-success-fg' : score >= 65 ? 'bg-accent-subtle text-accent' : 'bg-bg-muted text-fg-muted';
}

/** Up to four shopper numbers, the same ones the proposal builder shows. */
function stats(m: DeckMall): [string, string][] {
  const out: [string, string][] = [];
  const visits = annualVisits(m);
  if (visits) out.push([compact(visits), 'Visits a year']);
  if (m.profile?.female) out.push([`${m.profile.female}%`, 'Women']);
  const top = m.profile?.ageBands?.length ? [...m.profile.ageBands].sort((a, b) => b.pct - a.pct)[0] : null;
  if (top) out.push([top.band.replace('-', '–'), `Top age · ${top.pct}%`]);
  if (m.media?.seenDigitalScreens) out.push([`${m.media.seenDigitalScreens}%`, 'See screens']);
  else if (m.profile?.lsm) out.push([`LSM ${m.profile.lsm.replace('&', ' & ')}`, 'Living standard']);
  return out.slice(0, 4);
}

/** The best fits, big: photo, fit score, the numbers that matter and one button. */
function TopCard({ m, rank }: { m: MallMatch; rank: number }) {
  const photo = mallPhoto(m.mall.id);
  const pkg = m.mall.packages[0];
  return (
    <li className="flex flex-col overflow-hidden rounded-3xl border border-border bg-bg">
      <Link href={`/insights/mall?id=${m.mall.id}`} className="group relative block aspect-[16/10] overflow-hidden bg-brand-surface">
        <CoverPhoto src={photo?.src ?? null} />
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[rgba(6,12,28,0.85)] via-transparent to-transparent" />
        <span className="absolute left-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white text-body-sm font-bold text-fg shadow-1">{rank}</span>
        <span className={`absolute right-3 top-3 rounded-full px-3 py-1 text-body-sm font-bold tabular-nums shadow-1 ${fitTone(m.score)}`} aria-label={`Fit ${m.score} out of 100`}>
          {m.score}<span className="font-semibold opacity-70">/100 fit</span>
        </span>
        <span className="absolute inset-x-4 bottom-3 flex flex-col">
          <strong className="text-display-sm leading-tight text-white">{mallName(m.mall)}</strong>
          <span className="text-body-sm text-white/80">{mallArea(m.mall)}</span>
        </span>
      </Link>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <dl className="grid grid-cols-2 gap-2">
          {stats(m.mall).map(([value, label]) => (
            <div key={label} className="flex flex-col-reverse rounded-xl bg-bg-subtle px-3 py-2">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-fg-muted">{label}</dt>
              <dd className="text-body-lg font-bold tabular-nums text-fg">{value}</dd>
            </div>
          ))}
        </dl>
        {m.reasons.length ? <p className="text-body-sm text-fg-muted">{m.reasons.slice(0, 2).join(' · ')}</p> : null}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
          <Link href={`/insights/mall?id=${m.mall.id}`} className="text-body-sm font-semibold text-accent hover:underline">
            Full profile →
          </Link>
          {pkg ? <AddToProposal compact item={{ kind: 'package', code: pkg.code }} /> : null}
        </div>
      </div>
    </li>
  );
}

function Insights() {
  const stats0 = networkStats();
  const [target, setTarget] = useState<AudienceTarget>({ ...ANY_AUDIENCE, gender: 'female', ages: ['25-34', '35-44'] });
  const matches = useMemo(() => matchMalls(target), [target]);
  const [showAll, setShowAll] = useState(false);
  const top = (key: (m: DeckMall) => number | null | undefined, n = 5) =>
    DECK_MALLS.map((m) => ({ mall: m, value: key(m) ?? 0 })).filter((r) => r.value > 0).sort((a, b) => b.value - a.value).slice(0, n);
  const podium = matches.slice(0, 3);
  const rest = matches.slice(3);

  return (
    <Page>
      <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex max-w-2xl flex-col gap-2">
          <h1 className="text-display-xl text-fg">Who shops where</h1>
          <p className="text-body-lg text-fg-muted">Pick the shoppers you want. The best-fit malls rise to the top.</p>
        </div>
        <dl className="grid grid-cols-3 gap-2 sm:gap-3">
          {([[compact(stats0.annualVisits), 'Visits a year'], [`${stats0.noticeMallAds}%`, 'Notice mall ads'], [String(stats0.malls), 'Malls']] as const).map(([v, k]) => (
            <div key={k} className="flex flex-col-reverse rounded-2xl bg-brand-surface px-4 py-3 text-brand-on-surface">
              <dt className="text-[11px] font-semibold uppercase tracking-wide opacity-75">{k}</dt>
              <dd className="text-display-sm tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      </header>

      <section aria-label="Your audience" className="flex flex-col gap-4 rounded-3xl border border-border bg-bg p-5 shadow-1 sm:p-6">
        <AudiencePicker rows value={target} onChange={setTarget} />
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <p className="text-body-sm text-fg-muted" aria-live="polite">
            <strong className="font-semibold text-fg">{matches.length} malls</strong> for {audienceSummary(target)}
          </p>
          <div className="flex flex-wrap gap-2">
            {target.gender !== 'any' || target.ages.length || target.lsm !== 'any' || target.provinces.length ? (
              <button type="button" onClick={() => setTarget(ANY_AUDIENCE)} className="inline-flex h-11 items-center rounded-full px-4 text-body-sm font-semibold text-fg-muted hover:bg-bg-subtle hover:text-fg">
                Start over
              </button>
            ) : null}
            <Link href={`/portal/new?${audienceQuery(target)}`} className="inline-flex h-11 items-center justify-center rounded-full bg-accent px-5 text-body-sm font-semibold text-fg-on-accent hover:bg-accent-hover">
              Build a proposal for these shoppers →
            </Link>
          </div>
        </div>
      </section>

      {matches.length ? (
        <section className="flex flex-col gap-4" aria-labelledby="best-title">
          <h2 id="best-title" className="text-display-md text-fg">Best fit</h2>
          <ol className="grid gap-4 md:grid-cols-3">
            {podium.map((m, i) => (
              <TopCard key={m.mall.id} m={m} rank={i + 1} />
            ))}
          </ol>
          {rest.length ? (
            <>
              <h3 className="pt-4 text-body-lg font-semibold text-fg">Also a good match</h3>
              <ol className="flex flex-col gap-2" start={4}>
                {(showAll ? rest : rest.slice(0, 6)).map((m, i) => (
                  <MatchRow
                    key={m.mall.id}
                    m={m}
                    rank={i + 4}
                    action={m.mall.packages[0] ? <AddToProposal compact item={{ kind: 'package', code: m.mall.packages[0].code }} /> : null}
                  />
                ))}
              </ol>
              {rest.length > 6 ? (
                <button type="button" onClick={() => setShowAll((x) => !x)} className="h-11 self-start rounded-full border border-border px-5 text-body-sm font-semibold text-fg hover:border-fg">
                  {showAll ? 'Show fewer' : `Show all ${matches.length} malls`}
                </button>
              ) : null}
            </>
          ) : null}
          <ScoreHelp />
        </section>
      ) : (
        <p className="rounded-3xl bg-bg-subtle p-8 text-center text-body-md text-fg-muted">No malls in those provinces. Pick another province or “Start over”.</p>
      )}

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
