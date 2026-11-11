'use client';

import Link from 'next/link';
import { PROVINCES, STANDARD_BANDS, mallArea, mallName, mallPhoto } from '@/lib/insights';
import type { AudienceTarget, MallMatch } from '@/lib/insights';

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`inline-flex h-11 items-center rounded-full border px-4 text-body-sm font-semibold md:h-9 md:px-3.5 transition-colors duration-fast ease-standard ${
        on ? 'border-fg bg-fg text-bg' : 'border-border-strong bg-bg text-fg hover:border-fg'
      }`}
    >
      {children}
    </button>
  );
}

const toggle = (list: readonly string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

export function AudiencePicker({ value, onChange }: { value: AudienceTarget; onChange: (v: AudienceTarget) => void }) {
  const row = (legend: string, children: React.ReactNode) => (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-label-md font-semibold uppercase text-fg">{legend}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
  return (
    <div className="flex flex-col gap-5">
      {row(
        'Shoppers',
        (['any', 'female', 'male'] as const).map((g) => (
          <Chip key={g} on={value.gender === g} onClick={() => onChange({ ...value, gender: g })}>
            {g === 'any' ? 'Everyone' : g === 'female' ? 'Mostly women' : 'Mostly men'}
          </Chip>
        )),
      )}
      {row(
        'Age',
        STANDARD_BANDS.map((b) => (
          <Chip key={b} on={value.ages.includes(b)} onClick={() => onChange({ ...value, ages: toggle(value.ages, b) })}>
            {b.replace('-', '–')}
          </Chip>
        )),
      )}
      {row(
        'Living standard (LSM)',
        (['any', 'A', 'B', 'C'] as const).map((l) => (
          <Chip key={l} on={value.lsm === l} onClick={() => onChange({ ...value, lsm: l })}>
            {l === 'any' ? 'Any' : `LSM ${l}`}
          </Chip>
        )),
      )}
      {row(
        'Province',
        PROVINCES.map((p) => (
          <Chip key={p} on={value.provinces.includes(p)} onClick={() => onChange({ ...value, provinces: toggle(value.provinces, p) })}>
            {p}
          </Chip>
        )),
      )}
    </div>
  );
}

export function MatchRow({ m, rank, action }: { m: MallMatch; rank: number; action?: React.ReactNode }) {
  const photo = mallPhoto(m.mall.id);
  return (
    <li className="grid grid-cols-[72px_minmax(0,1fr)_auto] items-start gap-x-4 gap-y-3 rounded-2xl border border-border bg-bg p-3 sm:grid-cols-[96px_minmax(0,1fr)_auto_auto] sm:items-center">
      <span className="relative">
        {photo ? <img src={photo.src} alt="" loading="lazy" className="h-16 w-full rounded-xl object-cover" /> : <span className="block h-16 rounded-xl bg-bg-subtle" />}
        <span className="absolute -left-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-fg text-[11px] font-bold text-bg">{rank}</span>
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <Link href={`/insights/mall?id=${m.mall.id}`} className="text-body-md font-semibold text-fg hover:text-accent">
          {mallName(m.mall)}
        </Link>
        <span className="text-body-sm text-fg-muted">{mallArea(m.mall)}</span>
        <span className="text-body-sm text-fg-subtle">{m.reasons.slice(0, 2).join(' · ')}</span>
      </div>
      <span className="flex flex-col items-end gap-1" aria-label={`Fit ${m.score} out of 100`}>
        <span className="text-display-sm tabular-nums text-fg">{m.score}</span>
        <span className="h-1 w-12 overflow-hidden rounded-full bg-bg-muted" aria-hidden="true">
          <span className="block h-full rounded-full bg-accent" style={{ width: `${m.score}%` }} />
        </span>
      </span>
      {action ? <div className="col-span-3 sm:col-span-1">{action}</div> : null}
    </li>
  );
}

/** How the 0–100 fit score is worked out, in plain words. */
export function ScoreHelp() {
  return (
    <details className="group rounded-2xl bg-bg-subtle px-4 py-3 text-body-sm text-fg-muted">
      <summary className="cursor-pointer list-none font-semibold text-fg marker:hidden">
        How we score fit <span className="text-fg-subtle group-open:hidden">+</span>
      </summary>
      <p className="mt-2">Each mall gets up to 100 points from its shopper profile and advertising recall:</p>
      <ul className="mt-1 list-disc pl-5">
        <li>Age groups you chose — 30</li>
        <li>Share of women or men — 25</li>
        <li>LSM affinity — 15</li>
        <li>Visitors who notice digital screens — 15</li>
        <li>Size of the audience (visits a year) — 15</li>
      </ul>
      <p className="mt-2">Anything you leave as “Everyone” or “Any” isn’t scored. Source: TGISA 18B/19A and 15C/16C, Stats SA Community Survey — compiled April 2022.</p>
    </details>
  );
}

export function audienceQuery(a: AudienceTarget): string {
  const q = new URLSearchParams();
  if (a.gender !== 'any') q.set('gender', a.gender);
  if (a.ages.length) q.set('ages', a.ages.join(','));
  if (a.lsm !== 'any') q.set('lsm', a.lsm);
  if (a.provinces.length) q.set('provinces', a.provinces.join(','));
  return q.toString();
}

export function readAudience(params: URLSearchParams): AudienceTarget {
  const list = (k: string) => (params.get(k) ?? '').split(',').filter(Boolean);
  const gender = params.get('gender');
  const lsm = params.get('lsm');
  return {
    gender: gender === 'female' || gender === 'male' ? gender : 'any',
    ages: list('ages'),
    lsm: lsm === 'A' || lsm === 'B' || lsm === 'C' ? lsm : 'any',
    provinces: list('provinces'),
  };
}
