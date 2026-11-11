'use client';

import Link from 'next/link';
import { Zoomable } from '@/components/ui/ImageViewer';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Asset, Catalogue, Specification } from '@data-model';
import { getAssets } from '@/lib/catalogue';
import { downloadUrl } from '@/lib/api';
import { formatFileSize } from '@/lib/fileSize';
import { specHref, useLiveData } from '@/lib/liveData';
import type { LiveState } from '@/lib/liveData';
import { formatAspectRatio, getMalls, getScreenSize } from '@/lib/malls';
import type { Mall } from '@/lib/malls';
import { MALL_PLACES, PROVINCE_ORDER, placeLine } from '@/lib/mallPlaces';
import { getScreenLayout } from '@/lib/screenLayouts';
import { MallOutlinePreview } from '@/components/map/MallOutlinePreview';
import { EmptyState } from '@/components/ui/EmptyState';
import { AddToCampaign, RequireSignIn } from '@/components/portal/ui';
import { annualVisits, compact, deckMallForApp, packagePhotos, topBand } from '@/lib/insights';

/**
 * Media Explorer — the "Mall screens" view of the Primedia Out of Home
 * website's Media Explorer, on the specs site's own live data:
 * search a mall, city, screen or size; filter by mall, portfolio, screen
 * shape and province; a "Find a mall" directory by province; and every
 * screen with its size, flags, spec sheet and full spec. The filters live in
 * the URL (`/explorer?mall=cresta&shape=portrait`), so views can be shared.
 */

type Portfolio = 'primedia' | 'hyprop';
type Shape = 'landscape' | 'portrait' | 'wide';

const PORTFOLIO_LABEL: Record<Portfolio, string> = { primedia: 'Primedia Malls', hyprop: 'Hyprop Malls' };
const SHAPE_LABEL: Record<Shape, string> = { landscape: 'Landscape', portrait: 'Portrait', wide: 'Wide' };

interface Group {
  readonly key: 'portfolio' | 'shape' | 'province';
  readonly legend: string;
  readonly options: readonly (readonly [string, string])[];
}

const GROUPS: readonly Group[] = [
  { key: 'portfolio', legend: 'Mall portfolio', options: Object.entries(PORTFOLIO_LABEL) },
  { key: 'shape', legend: 'Screen shape', options: Object.entries(SHAPE_LABEL) },
  { key: 'province', legend: 'Province', options: PROVINCE_ORDER.map((p) => [p, p] as const) },
];

interface Screen {
  readonly spec: Specification;
  readonly mall: Mall;
  /** Null for network-wide sizes, which belong to no one mall. */
  readonly province: string | null;
  readonly portfolio: Portfolio;
  readonly shape: Shape | null;
  readonly size: { width: number; height: number } | null;
  readonly sheet: Asset | null;
  readonly text: string;
}

interface Filters {
  q: string;
  mall: string | null;
  portfolio: string[];
  shape: string[];
  province: string[];
}

/* ---------- Search, as the specs site and the OOH site search ---------- */

// Accents and punctuation ignored; "1920 x 1080", "1920×1080" and "1920x1080" all match the same screens.
function normalise(text: string): string {
  return (
    ' ' +
    text
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/(\d)\s*[x×]\s*(\d)/g, '$1x$2')
      .replace(/[^a-z0-9x]+/g, ' ')
      .trim()
  );
}

function words(q: string): string[] {
  return normalise(q).split(' ').filter(Boolean);
}

function hit(text: string, ws: readonly string[]): boolean {
  return ws.every((w) => text.includes(w));
}

/* ---------- Screens from the live catalogue ---------- */

function shapeOf(size: { width: number; height: number } | null): Shape | null {
  if (!size) return null;
  if (size.width / size.height >= 2) return 'wide';
  return size.width >= size.height ? 'landscape' : 'portrait';
}

function buildScreens(catalogue: Catalogue): { malls: readonly Mall[]; screens: readonly Screen[] } {
  const malls = getMalls(catalogue);
  const screens: Screen[] = [];
  for (const mall of malls) {
    const place = MALL_PLACES[mall.id];
    for (const id of mall.specIds) {
      const spec = catalogue.specifications[id];
      if (!spec) continue;
      const size = getScreenSize(spec);
      const downloads = getAssets(spec.downloadIds, catalogue);
      const sheet = downloads.find((a) => a.mimeType === 'application/pdf') ?? null;
      const portfolio: Portfolio = mall.group === 'hyprop' || spec.categoryId === 'category-hyprop-malls' ? 'hyprop' : 'primedia';
      screens.push({
        spec,
        mall,
        province: place?.province ?? null,
        portfolio,
        shape: shapeOf(size),
        size,
        sheet,
        text: normalise(
          [
            spec.title,
            spec.description,
            mall.name,
            place ? [place.name, place.area, place.city, place.province].join(' ') : '',
            PORTFOLIO_LABEL[portfolio],
            size ? `${size.width}x${size.height} ${formatAspectRatio(size)}` : '',
          ].join(' '),
        ),
      });
    }
  }
  return { malls, screens };
}

function matches(s: Screen, f: Filters, ws: readonly string[]): boolean {
  if (f.portfolio.length && !f.portfolio.includes(s.portfolio)) return false;
  if (f.shape.length && (!s.shape || !f.shape.includes(s.shape))) return false;
  if (f.province.length && (!s.province || !f.province.includes(s.province))) return false;
  return hit(s.text, ws);
}

function readFilters(params: URLSearchParams): Filters {
  const list = (key: string) => (params.get(key) ?? '').split(',').filter(Boolean);
  return { q: params.get('q') ?? '', mall: params.get('mall'), portfolio: list('portfolio'), shape: list('shape'), province: list('province') };
}

function writeFilters(f: Filters): string {
  const q = new URLSearchParams();
  if (f.q.trim()) q.set('q', f.q.trim());
  if (f.mall) q.set('mall', f.mall);
  for (const key of ['portfolio', 'shape', 'province'] as const) if (f[key].length) q.set(key, f[key].join(','));
  const s = q.toString();
  return s ? `?${s}` : '';
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/* ---------- Pieces ---------- */

function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
      <path d="M5 12h14m-6-6 6 6-6 6" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

/** The screen in its own proportions, as the OOH cards draw it. */
function ShapeGlyph({ size }: { size: Screen['size'] }) {
  return (
    <span className="flex h-12 w-16 shrink-0 items-center justify-center rounded-lg bg-bg-subtle p-2" aria-hidden="true">
      {size ? (
        <span
          className={`block rounded-[2px] bg-gradient-to-br from-accent to-brand-surface ${size.height > size.width ? 'h-full' : 'w-full'}`}
          style={{ aspectRatio: `${size.width} / ${size.height}` }}
        />
      ) : (
        <span className="block h-full w-full rounded-[2px] border border-dashed border-border-strong" />
      )}
    </span>
  );
}

function Flag({ children, tone = 'accent' }: { children: React.ReactNode; tone?: 'accent' | 'amber' }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
        tone === 'amber' ? 'bg-[rgba(253,181,27,0.18)] text-[#7A5300]' : 'bg-accent-subtle text-accent'
      }`}
    >
      {children}
    </span>
  );
}

function ScreenCard({ s, live }: { s: Screen; live: LiveState }) {
  const layout = getScreenLayout(s.spec);
  const approval = s.spec.tagIds.includes('tag-approval-required' as never);
  const special = s.spec.tagIds.includes('tag-special-spec' as never);
  const href = specHref(s.spec.id, live);
  const bookable = s.mall.group !== 'formats';
  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-border bg-bg p-4 transition-colors duration-fast ease-standard hover:border-border-strong">
      <div className="flex gap-4">
        <ShapeGlyph size={s.size} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="text-body-md font-semibold text-fg">
            <Link href={href} className="hover:text-accent">
              {s.spec.title}
            </Link>
          </h3>
          <span className="text-body-sm text-fg-muted">
            <span className="font-mono">{s.size ? `${s.size.width} × ${s.size.height}` : 'Size on the spec sheet'}</span>
            {s.shape ? ` · ${layout ? layout.summary : SHAPE_LABEL[s.shape]}` : ''}
          </span>
          {special || approval ? (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {special ? <Flag tone="amber">Special spec</Flag> : null}
              {approval ? <Flag tone="amber">Mall approval needed</Flag> : null}
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-border pt-3">
        <span />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-body-sm">
          {s.sheet ? (
            <a href={downloadUrl(s.sheet.storageKey)} download={s.sheet.filename} className="font-semibold text-fg-muted hover:text-fg" title={`PDF · ${formatFileSize(s.sheet.sizeBytes)}`}>
              Spec PDF
            </a>
          ) : null}
          {bookable ? <AddToCampaign compact item={{ kind: 'screen', specId: s.spec.id, appMallId: s.mall.id, title: s.spec.title }} /> : null}
        </div>
      </div>
    </article>
  );
}

function Footprint({ mall, screens, small = false }: { mall: Mall; screens: readonly Screen[]; small?: boolean }) {
  return (
    <span className={`block shrink-0 overflow-hidden rounded-lg bg-bg-subtle ${small ? 'h-[58px] w-[84px]' : 'h-[82px] w-[120px]'}`}>
      {mall.location ? (
        <MallOutlinePreview
          location={mall.location}
          pins={screens.map((s) => mall.pins[s.spec.id]).filter((pin) => pin != null && pin.source !== 'placeholder')}
        />
      ) : null}
    </span>
  );
}

function MallGroup({ mall, screens, live }: { mall: Mall; screens: readonly Screen[]; live: LiveState }) {
  const place = MALL_PLACES[mall.id];
  const network = mall.group === 'formats';
  return (
    <section id={`mall-${mall.id}`} className="flex scroll-mt-40 flex-col gap-4" aria-labelledby={`mall-${mall.id}-name`}>
      <header className="flex flex-wrap items-center gap-4">
        {network ? null : <Footprint mall={mall} screens={screens} />}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-label-md font-semibold uppercase text-accent">
            {network ? 'Network-wide' : mall.group === 'hyprop' ? 'Hyprop Malls' : 'Primedia Malls'}
          </span>
          <h2 id={`mall-${mall.id}-name`} className="text-display-md text-fg">
            {network ? 'Network-wide formats' : place?.name ?? mall.name}
          </h2>
          <span className="text-body-md text-fg-muted">
            {network ? 'Sizes used across the network, not tied to one mall' : place ? placeLine(place) : ''}
            {' · '}
            {plural(screens.length, 'screen')}
          </span>
          {place?.note ? <span className="text-body-sm text-fg-subtle">{place.note}</span> : null}
        </div>
        {mall.location ? (
          <Link href={`/?mall=${mall.id}`} className="inline-flex items-center gap-1 text-body-md font-semibold text-accent hover:underline">
            Show on map <ArrowIcon />
          </Link>
        ) : network ? null : (
          <span className="text-body-sm text-fg-subtle">Not on the map yet</span>
        )}
      </header>
      <Audience mallId={mall.id} />
      <div className="grid gap-3 md:grid-cols-2">
        {screens.map((s) => (
          <ScreenCard key={s.spec.id} s={s} live={live} />
        ))}
      </div>
    </section>
  );
}

/** Who shops here and the packages on offer, from the proposal deck. */
function Audience({ mallId }: { mallId: string }) {
  const d = deckMallForApp(mallId);
  if (!d) return null;
  const p = d.profile;
  const visits = annualVisits(d);
  const facts = [
    visits ? `${compact(visits)} visits a year` : null,
    p?.female != null ? `${p.female}% women` : null,
    topBand(d) ? `Mostly ${topBand(d)?.replace('-', '–')}` : null,
    p?.lsm ? `LSM ${p.lsm.replace('&', ' & ')}` : null,
    d.media?.seenDigitalScreens ? `${d.media.seenDigitalScreens}% see digital screens` : null,
  ].filter(Boolean);
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-bg-subtle p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-body-sm text-fg">
          <strong className="font-semibold">Audience · </strong>
          {facts.join(' · ')}
        </span>
        <Link href={`/insights/mall?id=${d.id}`} className="text-body-sm font-semibold text-accent hover:underline">
          Audience insights →
        </Link>
      </div>
      <div className="flex flex-wrap gap-2">
        {d.packages.map((pkg) => (
          <div key={pkg.code} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-bg py-2 pl-2 pr-3">
            {packagePhotos(pkg.code)[0] ? <Zoomable src={packagePhotos(pkg.code)[0].src} title={`${pkg.format}${pkg.units ? ` × ${pkg.units}` : ''} package`} packageCode={pkg.code} note={pkg.sites} className="h-11 w-14 rounded" /> : null}
            <span className="flex flex-col">
              <span className="text-body-sm font-semibold text-fg">{pkg.format}{pkg.units ? ` × ${pkg.units}` : ''} package</span>
            </span>
            <AddToCampaign compact item={{ kind: 'package', code: pkg.code }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function MallTile({ mall, count, onPick }: { mall: Mall; count: number; onPick: (id: string) => void }) {
  const place = MALL_PLACES[mall.id];
  return (
    <Link
      href={`/explorer?mall=${mall.id}`}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey) return;
        event.preventDefault();
        onPick(mall.id);
      }}
      className="flex flex-col gap-0.5 rounded-lg border border-border bg-bg px-3.5 py-2.5 transition-colors duration-fast ease-standard hover:border-accent"
    >
      <strong className="text-body-md font-semibold text-fg">{place?.name ?? mall.name}</strong>
      <span className="text-body-sm text-fg-muted">
        {place?.area ?? ''}
        {place ? ' · ' : ''}
        {plural(count, 'screen')}
      </span>
    </Link>
  );
}

/* ---------- The explorer ---------- */

export function MediaExplorer() {
  return <RequireSignIn what="the Media Explorer">{() => <Explorer />}</RequireSignIn>;
}

function Explorer() {
  const live = useLiveData();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [filters, setFilters] = useState<Filters>(() => readFilters(new URLSearchParams(params.toString())));
  const [query, setQuery] = useState(filters.q);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  // Back/forward and links within the site change the URL: follow it.
  useEffect(() => {
    const next = readFilters(new URLSearchParams(params.toString()));
    setFilters(next);
    setQuery(next.q);
  }, [params]);

  const { malls, screens } = useMemo(() => buildScreens(live.catalogue), [live.catalogue]);

  function update(next: Filters, scroll = false) {
    setFilters(next);
    router.replace(`${pathname}${writeFilters(next)}`, { scroll: false });
    if (scroll && topRef.current && topRef.current.getBoundingClientRect().top < 0) {
      topRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // Typing searches across all malls again, after a short pause.
  useEffect(() => {
    if (query === filters.q) return;
    const timer = setTimeout(() => update({ ...filters, q: query, mall: null }), 150);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const ws = words(filters.q);
  const list = screens.filter((s) => matches(s, filters, ws));
  const filtered = Boolean(filters.q.trim()) || GROUPS.some((g) => filters[g.key].length > 0);
  const mall = filters.mall ? malls.find((m) => m.id === filters.mall) ?? null : null;
  const pick = (id: string | null) => update({ ...filters, mall: id }, true);

  const countIn = (items: readonly Screen[]) => new Set(items.filter((s) => s.mall.group !== 'formats').map((s) => s.mall.id)).size;
  const byMall = (items: readonly Screen[], m: Mall) => items.filter((s) => s.mall.id === m.id);

  let title: string;
  let summary: string;
  if (mall) {
    const here = byMall(list, mall).length || byMall(screens, mall).length;
    title = `${plural(here, 'screen')} at ${MALL_PLACES[mall.id]?.name ?? mall.name}`;
    summary = 'Every screen, with its spec sheet';
  } else {
    title = `${plural(list.length, 'screen')} in ${plural(countIn(list), 'mall')}`;
    const active = GROUPS.flatMap((g) => filters[g.key].map((v) => g.options.find((o) => o[0] === v)?.[1] ?? v));
    const parts = [filters.q.trim() ? `matching “${filters.q.trim()}”` : '', active.length ? `filtered by ${active.join(', ')}` : ''].filter(Boolean);
    const text = parts.join(', ');
    summary = text ? text.charAt(0).toUpperCase() + text.slice(1) : 'All screens';
  }

  function toggle(key: Group['key'], value: string) {
    const current = filters[key];
    update({ ...filters, mall: null, [key]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value] });
  }

  function clearAll() {
    setQuery('');
    update({ q: '', mall: null, portfolio: [], shape: [], province: [] });
  }

  /* ----- Results ----- */

  let results: React.ReactNode;
  if (mall) {
    const here = byMall(list, mall).length ? byMall(list, mall) : byMall(screens, mall);
    const province = MALL_PLACES[mall.id]?.province;
    const near = province
      ? malls
          .filter((m) => m.id !== mall.id && MALL_PLACES[m.id]?.province === province)
          .sort((a, b) => (MALL_PLACES[a.id]?.name ?? a.name).localeCompare(MALL_PLACES[b.id]?.name ?? b.name))
      : [];
    results = (
      <div className="flex flex-col gap-10">
        <button type="button" onClick={() => pick(null)} className="self-start text-body-lg font-semibold text-accent hover:underline">
          ← All malls
        </button>
        <MallGroup mall={mall} screens={here} live={live} />
        {near.length ? (
          <section className="flex flex-col gap-3" aria-labelledby="near-title">
            <h2 id="near-title" className="text-label-md font-semibold uppercase text-fg">
              Other malls in {province}
            </h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {near.map((m) => (
                <MallTile key={m.id} mall={m} count={byMall(screens, m).length} onPick={pick} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    );
  } else if (!list.length) {
    results = <EmptyState title="No screens match." description="Try a mall, a city or a size such as 1920x1080, or remove a filter." />;
  } else {
    const physical = malls.filter((m) => m.group !== 'formats' && byMall(list, m).length);
    const provinces = [...PROVINCE_ORDER, ''].map((p) => ({
      province: p,
      malls: physical
        .filter((m) => (MALL_PLACES[m.id]?.province ?? '') === p)
        .sort((a, b) => (MALL_PLACES[a.id]?.name ?? a.name).localeCompare(MALL_PLACES[b.id]?.name ?? b.name)),
    })).filter((g) => g.malls.length);
    const ordered = provinces.flatMap((g) => g.malls);
    const network = malls.filter((m) => m.group === 'formats' && byMall(list, m).length);
    results = (
      <div className="flex flex-col gap-12">
        <section className="flex flex-col gap-5 rounded-2xl border border-border bg-bg-subtle p-5 sm:p-6" aria-labelledby="dir-title">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="dir-title" className="text-display-sm text-fg">
              {filtered ? 'Malls with matching screens' : 'Find a mall'}
            </h2>
            <span className="text-body-sm text-fg-muted">Pick a mall to see its screens, sizes and spec sheets.</span>
          </div>
          {provinces.map((g) => (
            <div key={g.province || 'other'} className="flex flex-col gap-2">
              <h3 className="text-label-md font-semibold uppercase text-accent">{g.province || 'Other'}</h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {g.malls.map((m) => (
                  <MallTile key={m.id} mall={m} count={byMall(list, m).length} onPick={pick} />
                ))}
              </div>
            </div>
          ))}
        </section>
        <h2 className="text-label-md font-semibold uppercase text-accent">{filtered ? 'Matching screens' : 'All screens, mall by mall'}</h2>
        {[...ordered, ...network].map((m) => (
          <MallGroup key={m.id} mall={m} screens={byMall(list, m)} live={live} />
        ))}
      </div>
    );
  }

  /* ----- Page ----- */

  const chip = (group: Group, value: string, label: string) => {
    const on = filters[group.key].includes(value);
    return (
      <button
        key={value}
        type="button"
        aria-pressed={on}
        onClick={() => toggle(group.key, value)}
        className={`inline-flex h-9 items-center rounded-full border px-3.5 text-body-sm font-semibold transition-colors duration-fast ease-standard ${
          on ? 'border-fg bg-fg text-bg' : 'border-border-strong bg-bg text-fg hover:border-fg'
        }`}
      >
        {label}
      </button>
    );
  };

  const physicalMalls = malls
    .filter((m) => m.group !== 'formats')
    .sort((a, b) => (MALL_PLACES[a.id]?.name ?? a.name).localeCompare(MALL_PLACES[b.id]?.name ?? b.name));

  return (
    <div className="mx-auto flex w-full max-w-page flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8 lg:py-12" ref={topRef}>
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex flex-col gap-3">
          <h1 className="text-display-xl text-fg">Media Explorer</h1>
          <p className="max-w-prose text-body-lg text-fg-muted">
            Every screen in the Primedia Malls and Hyprop Malls networks, with its size, artwork guide and spec sheet.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setFiltersOpen((open) => !open)}
            aria-expanded={filtersOpen}
            aria-controls="explorer-filters"
            className="inline-flex h-10 items-center rounded-full border border-border-strong px-4 text-body-sm font-semibold text-fg lg:hidden"
          >
            Filters
          </button>
          <div className="inline-flex rounded-full bg-bg-subtle p-1" role="group" aria-label="View">
            <span aria-current="page" className="rounded-full bg-bg px-4 py-2 text-body-sm font-semibold text-fg shadow-1">
              Mall screens
            </span>
            <Link
              href={mall ? `/?mall=${mall.id}` : '/'}
              className="rounded-full px-4 py-2 text-body-sm font-semibold text-fg-muted hover:text-fg"
            >
              Map
            </Link>
          </div>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside
          id="explorer-filters"
          aria-label="Filters"
          className={`${filtersOpen ? 'flex' : 'hidden'} h-fit flex-col gap-6 rounded-2xl bg-bg-subtle p-6 lg:sticky lg:top-[calc(var(--topbar-height)+24px)] lg:flex`}
        >
          <label className="flex flex-col gap-2">
            <span className="text-label-md font-semibold uppercase text-fg">Mall</span>
            <select
              value={filters.mall ?? ''}
              onChange={(event) => pick(event.target.value || null)}
              className="h-11 rounded-lg border border-border-strong bg-bg px-3 text-body-md text-fg"
            >
              <option value="">All malls</option>
              {physicalMalls.map((m) => (
                <option key={m.id} value={m.id}>
                  {MALL_PLACES[m.id]?.name ?? m.name}
                </option>
              ))}
            </select>
          </label>
          {GROUPS.map((g) => (
            <fieldset key={g.key} className="flex flex-col gap-2">
              <legend className="mb-2 text-label-md font-semibold uppercase text-fg">{g.legend}</legend>
              <div className="flex flex-wrap gap-2">{g.options.map(([value, label]) => chip(g, value, label))}</div>
            </fieldset>
          ))}
          <p className="text-body-sm text-fg-muted">Every digital screen in the Primedia Malls and Hyprop Malls networks.</p>
          <button type="button" onClick={clearAll} className="self-start text-body-sm font-semibold text-accent hover:underline">
            Clear all filters
          </button>
        </aside>

        <div className="flex min-w-0 flex-col gap-6">
          <label className="relative block">
            <span className="sr-only">Search mall screens</span>
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-fg-subtle">
              <SearchIcon />
            </span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search a mall, city, screen or size"
              autoComplete="off"
              className="h-12 w-full rounded-xl border border-border-strong bg-bg pl-11 pr-4 text-body-md text-fg outline-none transition-colors duration-fast ease-standard placeholder:text-fg-subtle focus:border-border-focus"
            />
          </label>
          <p className="border-b border-border pb-4 text-body-lg text-fg" aria-live="polite">
            <strong className="font-semibold">{title}</strong> · {summary}
          </p>
          {results}
        </div>
      </div>
    </div>
  );
}
