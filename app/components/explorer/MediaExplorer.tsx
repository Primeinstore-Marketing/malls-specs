'use client';

import Link from 'next/link';
import { Zoomable } from '@/components/ui/ImageViewer';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Asset, Catalogue, Specification } from '@data-model';
import { getAssets } from '@/lib/catalogue';
import { downloadUrl, fileUrl } from '@/lib/api';
import { formatFileSize } from '@/lib/fileSize';
import { specHref, useLiveData } from '@/lib/liveData';
import type { LiveState } from '@/lib/liveData';
import { formatAspectRatio, getMalls, getScreenSize } from '@/lib/malls';
import type { Mall } from '@/lib/malls';
import { PROVINCE_ORDER, mallPlace, placeLine } from '@/lib/sites';
import { getScreenLayout } from '@/lib/screenLayouts';
import { EmptyState } from '@/components/ui/EmptyState';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { AddToProposal, RequireSignIn } from '@/components/portal/ui';
import { annualVisits, compact, deckMallForApp, mallPhoto, packagePhotos, screenPhotos } from '@/lib/insights';

/**
 * Media Explorer — every mall screen, as a picture gallery.
 * Two ways in: "Malls" (a card per mall, with its photo and audience) and
 * "Screens" (a card per screen, with that screen's own photo, or its shape
 * drawn to scale when there's no photo yet). One search box and one row of
 * filter chips work across both. Everything lives in the URL
 * (`/explorer?view=screens&shape=portrait`), so a view can be shared.
 */

type Portfolio = 'primedia' | 'hyprop';
type Shape = 'landscape' | 'portrait' | 'wide';
type View = 'malls' | 'screens';

const PORTFOLIO_LABEL: Record<Portfolio, string> = { primedia: 'Primedia Malls', hyprop: 'Hyprop Malls' };
const SHAPE_LABEL: Record<Shape, string> = { landscape: 'Landscape', portrait: 'Portrait', wide: 'Wide' };

interface Screen {
  readonly spec: Specification;
  readonly mall: Mall;
  /** Null for network-wide sizes, which belong to no one mall. */
  readonly province: string | null;
  readonly portfolio: Portfolio;
  readonly shape: Shape | null;
  readonly size: { width: number; height: number } | null;
  readonly sheet: Asset | null;
  /** The screen's own photo: an upload on the spec, else the deck's photo of this screen. */
  readonly photo: string | null;
  readonly text: string;
}

interface Filters {
  q: string;
  mall: string | null;
  view: View;
  portfolio: string[];
  shape: string[];
  province: string[];
}

const NO_FILTERS: Filters = { q: '', mall: null, view: 'malls', portfolio: [], shape: [], province: [] };

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
    const place = mallPlace(mall.id);
    for (const id of mall.specIds) {
      const spec = catalogue.specifications[id];
      if (!spec) continue;
      const size = getScreenSize(spec);
      const downloads = getAssets(spec.downloadIds, catalogue);
      const sheet = downloads.find((a) => a.mimeType === 'application/pdf') ?? null;
      const own = getAssets(spec.mediaIds, catalogue).find((a) => a.kind === 'image');
      const portfolio: Portfolio = mall.group === 'hyprop' || spec.categoryId === 'category-hyprop-malls' ? 'hyprop' : 'primedia';
      screens.push({
        spec,
        mall,
        province: place?.province ?? null,
        portfolio,
        shape: shapeOf(size),
        size,
        sheet,
        photo: own ? fileUrl(own.storageKey) : screenPhotos(spec.id)[0]?.src ?? null,
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
  return {
    q: params.get('q') ?? '',
    mall: params.get('mall'),
    view: params.get('view') === 'screens' ? 'screens' : 'malls',
    portfolio: list('portfolio'),
    shape: list('shape'),
    province: list('province'),
  };
}

function writeFilters(f: Filters): string {
  const q = new URLSearchParams();
  if (f.q.trim()) q.set('q', f.q.trim());
  if (f.mall) q.set('mall', f.mall);
  else if (f.view === 'screens') q.set('view', 'screens');
  for (const key of ['portfolio', 'shape', 'province'] as const) if (f[key].length) q.set(key, f[key].join(','));
  const s = q.toString();
  return s ? `?${s}` : '';
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

const mallLabel = (m: Mall) => (m.group === 'formats' ? 'Network-wide formats' : mallPlace(m.id)?.name ?? m.name);
const byName = (a: Mall, b: Mall) => mallLabel(a).localeCompare(mallLabel(b));

/** The mall's photo: the admin's upload or the deck's, else the first screen photo there. */
function mallCover(m: Mall, screens: readonly Screen[]): string | null {
  const d = deckMallForApp(m.id);
  const own = d ? mallPhoto(d.id) : null;
  return own?.src ?? screens.find((s) => s.mall.id === m.id && s.photo)?.photo ?? null;
}

/** Up to four shopper numbers for a mall, biggest story first. */
function mallStats(m: Mall): [string, string][] {
  const d = deckMallForApp(m.id);
  if (!d) return [];
  const out: [string, string][] = [];
  const visits = annualVisits(d);
  if (visits) out.push([compact(visits), 'Visits a year']);
  if (d.profile?.female) out.push([`${d.profile.female}%`, 'Women']);
  const top = d.profile?.ageBands?.length ? [...d.profile.ageBands].sort((a, b) => b.pct - a.pct)[0] : null;
  if (top) out.push([top.band.replace('-', '–'), `Top age · ${top.pct}%`]);
  if (d.media?.seenDigitalScreens) out.push([`${d.media.seenDigitalScreens}%`, 'See digital screens']);
  else if (d.profile?.lsm) out.push([`LSM ${d.profile.lsm.replace('&', ' & ')}`, 'Living standard']);
  return out.slice(0, 4);
}

/* ---------- Pieces ---------- */

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

/** A small outline of the shape, for the filter chips. */
function ShapeIcon({ shape }: { shape: Shape }) {
  const [w, h] = shape === 'portrait' ? [8, 13] : shape === 'wide' ? [16, 6] : [14, 9];
  return <span aria-hidden="true" className="inline-block rounded-[2px] border-[1.5px] border-current" style={{ width: w, height: h }} />;
}

/** The screen drawn to scale, for screens with no photo yet. */
function ShapeArt({ size }: { size: Screen['size'] }) {
  const ratio = size ? size.width / size.height : 16 / 9;
  return (
    <span className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_30%_20%,#2c4a8a,#1b3769_60%,#0f2147)] p-6" aria-hidden="true">
      <span
        className="block max-h-full max-w-full rounded-[3px] bg-gradient-to-br from-[#5B8CFF] to-[#2861FD] shadow-[0_12px_30px_rgba(0,0,0,0.35)] ring-1 ring-white/30"
        style={ratio >= 1 ? { width: '78%', aspectRatio: `${ratio}` } : { height: '82%', aspectRatio: `${ratio}` }}
      />
    </span>
  );
}

/** A cover photo that falls back to the drawn screen if it can't load. */
function Cover({ src }: { src: string | null }) {
  const [broken, setBroken] = useState<string | null>(null);
  if (!src || broken === src) return <ShapeArt size={null} />;
  // eslint-disable-next-line @next/next/no-img-element -- deck photo or API file
  return <img src={src} alt="" loading="lazy" onError={() => setBroken(src)} className="h-full w-full object-cover transition-transform duration-slow group-hover:scale-105" />;
}

function Flag({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex rounded-full bg-warning-bg px-2 py-0.5 text-[11px] font-semibold text-warning-fg">{children}</span>;
}

function Chip({ on, onClick, children, label }: { on: boolean; onClick: () => void; children: React.ReactNode; label?: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      onClick={onClick}
      className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-body-sm font-semibold transition-colors duration-fast ease-standard ${
        on ? 'border-fg bg-fg text-bg' : 'border-border bg-bg text-fg hover:border-fg'
      }`}
    >
      {children}
    </button>
  );
}

function ScreenCard({ s, live, showMall, onMall }: { s: Screen; live: LiveState; showMall: boolean; onMall: (id: string) => void }) {
  const layout = getScreenLayout(s.spec);
  const approval = s.spec.tagIds.includes('tag-approval-required' as never);
  const special = s.spec.tagIds.includes('tag-special-spec' as never);
  const href = specHref(s.spec.id, live);
  const bookable = s.mall.group !== 'formats';
  const sizeText = s.size ? `${s.size.width} × ${s.size.height}` : null;
  return (
    <article className="group flex flex-col overflow-hidden rounded-3xl border border-border bg-bg transition-shadow duration-fast ease-standard hover:shadow-3">
      <div className="relative aspect-[4/3] overflow-hidden bg-bg-subtle">
        <Zoomable src={s.photo} title={s.spec.title} detail={[mallLabel(s.mall), sizeText ? `${sizeText} px` : null].filter(Boolean).join(' · ')} specId={s.spec.id} className="h-full w-full">
          <ShapeArt size={s.size} />
        </Zoomable>
        <span className="pointer-events-none absolute left-3 top-3 flex gap-1.5">
          {s.shape ? <span className="rounded-full bg-[rgba(6,12,28,0.7)] px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">{SHAPE_LABEL[s.shape]}</span> : null}
          {!s.photo ? <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white">No photo yet</span> : null}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        {showMall ? (
          <button type="button" onClick={() => onMall(s.mall.id)} className="-my-1 inline-flex min-h-6 items-center self-start py-1 text-label-md font-semibold uppercase text-accent hover:underline">
            {mallLabel(s.mall)}
          </button>
        ) : null}
        <h3 className="text-body-lg font-semibold leading-snug text-fg">
          <Link href={href} className="hover:text-accent">
            {s.spec.title}
          </Link>
        </h3>
        <p className="text-body-sm text-fg-muted">
          {sizeText ? <span className="font-mono text-fg">{sizeText}</span> : 'Size on the spec sheet'}
          {layout ? ` · ${layout.summary}` : ''}
        </p>
        {special || approval ? (
          <div className="flex flex-wrap gap-1.5">
            {special ? <Flag>Special spec</Flag> : null}
            {approval ? <Flag>Mall approval needed</Flag> : null}
          </div>
        ) : null}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3">
          {s.sheet ? (
            <a href={downloadUrl(s.sheet.storageKey)} download={s.sheet.filename} className="inline-flex h-9 items-center rounded-full border border-border px-3.5 text-body-sm font-semibold text-fg hover:border-fg" title={`PDF · ${formatFileSize(s.sheet.sizeBytes)}`}>
              ↓ Spec PDF
            </a>
          ) : (
            <Link href={href} className="inline-flex h-9 items-center rounded-full border border-border px-3.5 text-body-sm font-semibold text-fg hover:border-fg">
              View spec
            </Link>
          )}
          {bookable ? <AddToProposal compact item={{ kind: 'screen', specId: s.spec.id, appMallId: s.mall.id, title: s.spec.title }} /> : null}
        </div>
      </div>
    </article>
  );
}

function MallCard({ mall, screens, all, onPick }: { mall: Mall; screens: readonly Screen[]; all: readonly Screen[]; onPick: (id: string) => void }) {
  const place = mallPlace(mall.id);
  const cover = mallCover(mall, all);
  const d = deckMallForApp(mall.id);
  const visits = d ? annualVisits(d) : null;
  const shapes = (['landscape', 'portrait', 'wide'] as const).map((sh) => [sh, screens.filter((s) => s.shape === sh).length] as const).filter(([, n]) => n);
  return (
    <Link
      href={`/explorer?mall=${mall.id}`}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey) return;
        event.preventDefault();
        onPick(mall.id);
      }}
      className="group flex flex-col overflow-hidden rounded-3xl border border-border bg-bg transition-shadow duration-fast ease-standard hover:shadow-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-brand-surface">
        <Cover src={cover} />
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[rgba(6,12,28,0.85)] via-[rgba(6,12,28,0.15)] to-transparent" />
        {visits ? (
          <span className="absolute left-3 top-3 rounded-full bg-[rgba(6,12,28,0.72)] px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur">
            {compact(visits)} visits a year
          </span>
        ) : null}
        <span className="absolute inset-x-4 bottom-3 flex flex-col">
          <strong className="text-body-lg font-semibold leading-tight text-white">{mallLabel(mall)}</strong>
          <span className="text-body-sm text-white/80">{mall.group === 'formats' ? 'Sizes used across the network' : place?.area ?? place?.city ?? ''}</span>
        </span>
      </div>
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <span className="text-body-sm font-semibold text-fg">{plural(screens.length, 'screen')}</span>
        <span className="flex items-center gap-3 text-body-sm text-fg-muted">
          {shapes.map(([sh, n]) => (
            <span key={sh} className="inline-flex items-center gap-1" title={`${n} ${SHAPE_LABEL[sh].toLowerCase()}`}>
              <ShapeIcon shape={sh} /> {n}
            </span>
          ))}
          <span aria-hidden="true" className="text-accent transition-transform group-hover:translate-x-0.5">→</span>
        </span>
      </div>
    </Link>
  );
}

/** One mall, opened: its photo, who shops there, its packages and every screen. */
function MallPage({ mall, screens, all, malls, live, onPick }: { mall: Mall; screens: readonly Screen[]; all: readonly Screen[]; malls: readonly Mall[]; live: LiveState; onPick: (id: string | null) => void }) {
  const place = mallPlace(mall.id);
  const network = mall.group === 'formats';
  const cover = network ? null : mallCover(mall, all);
  const d = deckMallForApp(mall.id);
  const stats = mallStats(mall);
  const near = place?.province ? malls.filter((m) => m.id !== mall.id && m.group !== 'formats' && mallPlace(m.id)?.province === place.province).sort(byName) : [];
  return (
    <div className="flex flex-col gap-10">
      <button type="button" onClick={() => onPick(null)} className="inline-flex h-10 items-center gap-2 self-start rounded-full border border-border px-4 text-body-sm font-semibold text-fg hover:border-fg">
        ← All malls
      </button>

      <section className="grid overflow-hidden rounded-3xl border border-border bg-bg lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]" aria-labelledby="mall-name">
        <div className="relative min-h-[220px] bg-brand-surface lg:min-h-[340px]">
          {cover ? (
            <Zoomable src={cover} title={mallLabel(mall)} detail={place ? placeLine(place) : undefined} className="absolute inset-0 h-full w-full" />
          ) : (
            <span className="absolute inset-0"><ShapeArt size={null} /></span>
          )}
        </div>
        <div className="flex flex-col gap-5 p-6 sm:p-8">
          <div className="flex flex-col gap-1.5">
            <span className="text-label-md font-semibold uppercase text-accent">{network ? 'Network-wide' : mall.group === 'hyprop' ? 'Hyprop Malls' : 'Primedia Malls'}</span>
            <h2 id="mall-name" className="text-display-lg text-fg">{mallLabel(mall)}</h2>
            <p className="text-body-md text-fg-muted">
              {network ? 'Sizes used across the network, not tied to one mall' : place ? placeLine(place) : ''} · {plural(screens.length, 'screen')}
            </p>
            {place?.note ? <p className="text-body-sm text-fg-subtle">{place.note}</p> : null}
          </div>
          {stats.length ? (
            <dl className="grid grid-cols-2 gap-2">
              {stats.map(([value, label]) => (
                <div key={label} className="flex flex-col-reverse rounded-2xl bg-bg-subtle px-4 py-3">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-fg-muted">{label}</dt>
                  <dd className="text-display-sm tabular-nums text-fg">{value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          <div className="mt-auto flex flex-wrap gap-2">
            {d ? (
              <Link href={`/insights/mall?id=${d.id}`} className="inline-flex h-11 items-center rounded-full bg-fg px-5 text-body-sm font-semibold text-bg hover:opacity-90">
                Who shops here
              </Link>
            ) : null}
            {mall.location ? (
              <Link href={`/?mall=${mall.id}`} className="inline-flex h-11 items-center rounded-full border border-border-strong px-5 text-body-sm font-semibold text-fg hover:border-fg">
                Show on map
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {d?.packages.length ? (
        <section className="flex flex-col gap-4" aria-labelledby="pkg-title">
          <h3 id="pkg-title" className="text-display-sm text-fg">Packages</h3>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {d.packages.map((pkg) => {
              const photo = packagePhotos(pkg.code)[0];
              const name = `${pkg.format}${pkg.units ? ` × ${pkg.units}` : ''}`;
              return (
                <div key={pkg.code} className="flex items-center gap-3 rounded-2xl border border-border bg-bg p-2.5 pr-4">
                  <Zoomable src={photo?.src ?? null} title={`${name} package`} packageCode={pkg.code} note={pkg.sites} className="h-16 w-20 rounded-xl">
                    <ShapeArt size={null} />
                  </Zoomable>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <strong className="text-body-md font-semibold text-fg">{name}</strong>
                    <span className="truncate text-body-sm text-fg-muted">{pkg.sites || 'Package'}</span>
                  </span>
                  <AddToProposal compact item={{ kind: 'package', code: pkg.code }} />
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-4" aria-labelledby="screens-title">
        <h3 id="screens-title" className="text-display-sm text-fg">Screens here</h3>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {screens.map((s) => (
            <ScreenCard key={s.spec.id} s={s} live={live} showMall={false} onMall={onPick} />
          ))}
        </div>
      </section>

      {near.length ? (
        <section className="flex flex-col gap-4" aria-labelledby="near-title">
          <h3 id="near-title" className="text-display-sm text-fg">More in {place?.province}</h3>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {near.map((m) => (
              <MallCard key={m.id} mall={m} screens={all.filter((s) => s.mall.id === m.id)} all={all} onPick={onPick} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
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
  const filtered = Boolean(filters.q.trim()) || filters.portfolio.length + filters.shape.length + filters.province.length > 0;
  const mall = filters.mall ? malls.find((m) => m.id === filters.mall) ?? null : null;
  const pick = (id: string | null) => update({ ...filters, mall: id }, true);
  useDocumentTitle(mall ? `${mallLabel(mall)} · Media Explorer` : null);
  const byMall = (items: readonly Screen[], m: Mall) => items.filter((s) => s.mall.id === m.id);

  // Malls with a matching screen: real malls by name, the network-wide sizes last.
  const shownMalls = malls.filter((m) => byMall(list, m).length).sort((a, b) => Number(a.group === 'formats') - Number(b.group === 'formats') || byName(a, b));
  const realMalls = shownMalls.filter((m) => m.group !== 'formats').length;

  function toggle(key: 'portfolio' | 'shape' | 'province', value: string) {
    const current = filters[key];
    update({ ...filters, mall: null, [key]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value] });
  }

  function clearAll() {
    setQuery('');
    update({ ...NO_FILTERS, view: filters.view });
  }

  const view = filters.view;
  const tab = (id: View, label: string, count: number) => (
    <button
      key={id}
      type="button"
      role="tab"
      aria-selected={!mall && view === id}
      onClick={() => update({ ...filters, mall: null, view: id }, true)}
      className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-body-sm font-semibold transition-colors ${!mall && view === id ? 'bg-bg text-fg shadow-1' : 'text-fg-muted hover:text-fg'}`}
    >
      {label}
      <span className={`rounded-full px-2 py-0.5 text-[11px] tabular-nums ${!mall && view === id ? 'bg-accent text-fg-on-accent' : 'bg-bg-muted text-fg-muted'}`}>{count}</span>
    </button>
  );

  /* ----- Results ----- */

  let results: React.ReactNode;
  if (mall) {
    const here = byMall(list, mall).length ? byMall(list, mall) : byMall(screens, mall);
    results = <MallPage mall={mall} screens={here} all={screens} malls={malls} live={live} onPick={pick} />;
  } else if (!list.length) {
    results = (
      <EmptyState
        title="Nothing matches."
        description="Try a mall, a city or a size such as 1920x1080 — or clear the filters."
        action={
          <button type="button" onClick={clearAll} className="inline-flex h-11 items-center rounded-full bg-accent px-5 text-body-sm font-semibold text-fg-on-accent hover:bg-accent-hover">
            Clear search and filters
          </button>
        }
      />
    );
  } else if (view === 'screens') {
    results = (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {list.map((s) => (
          <ScreenCard key={s.spec.id} s={s} live={live} showMall onMall={(id) => pick(id)} />
        ))}
      </div>
    );
  } else {
    results = (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {shownMalls.map((m) => (
          <MallCard key={m.id} mall={m} screens={byMall(list, m)} all={screens} onPick={pick} />
        ))}
      </div>
    );
  }

  /* ----- Page ----- */

  return (
    <div className="mx-auto flex w-full max-w-page flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8 lg:py-10" ref={topRef}>
      <header className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-display-xl text-fg">Media Explorer</h1>
            <p className="text-body-lg text-fg-muted">
              {plural(screens.length, 'screen')} in {plural(malls.filter((m) => m.group !== 'formats' && byMall(screens, m).length).length, 'mall')}. Find one, see it, add it to a proposal.
            </p>
          </div>
          <Link href={mall ? `/?mall=${mall.id}` : '/'} className="inline-flex h-10 items-center gap-2 rounded-full border border-border-strong px-4 text-body-sm font-semibold text-fg hover:border-fg">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Zm0 0v14m6-12v14" /></svg>
            Map
          </Link>
        </div>

        <label className="relative block">
          <span className="sr-only">Search malls and screens</span>
          <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-fg-subtle">
            <SearchIcon />
          </span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search a mall, city or size"
            autoComplete="off"
            className="h-14 w-full rounded-full border border-border-strong bg-bg pl-14 pr-5 text-body-lg text-fg shadow-1 outline-none transition-colors duration-fast ease-standard placeholder:text-fg-subtle focus:border-border-focus"
          />
        </label>

        <div className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Filters">
          {(Object.keys(SHAPE_LABEL) as Shape[]).map((sh) => (
            <Chip key={sh} on={filters.shape.includes(sh)} onClick={() => toggle('shape', sh)}>
              <ShapeIcon shape={sh} /> {SHAPE_LABEL[sh]}
            </Chip>
          ))}
          <span aria-hidden="true" className="mx-1 h-6 w-px shrink-0 bg-border" />
          {(Object.keys(PORTFOLIO_LABEL) as Portfolio[]).map((p) => (
            <Chip key={p} on={filters.portfolio.includes(p)} onClick={() => toggle('portfolio', p)}>
              {PORTFOLIO_LABEL[p]}
            </Chip>
          ))}
          <span aria-hidden="true" className="mx-1 h-6 w-px shrink-0 bg-border" />
          {PROVINCE_ORDER.filter((p) => screens.some((s) => s.province === p)).map((p) => (
            <Chip key={p} on={filters.province.includes(p)} onClick={() => toggle('province', p)}>
              {p}
            </Chip>
          ))}
          {filtered ? (
            <button type="button" onClick={clearAll} className="h-10 shrink-0 rounded-full px-3 text-body-sm font-semibold text-accent hover:bg-accent-subtle">
              ✕ Clear
            </button>
          ) : null}
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div role="tablist" aria-label="Show" className="inline-flex rounded-full bg-bg-subtle p-1">
          {tab('malls', 'Malls', realMalls)}
          {tab('screens', 'Screens', list.length)}
        </div>
        <p className="text-body-sm text-fg-muted" aria-live="polite">
          {mall
            ? `Inside ${mallLabel(mall)}`
            : filtered
              ? `${plural(list.length, 'screen')} in ${plural(realMalls, 'mall')} match`
              : view === 'malls'
                ? 'Pick a mall to see its screens'
                : 'Every screen, with its photo'}
        </p>
      </div>

      {results}
    </div>
  );
}
