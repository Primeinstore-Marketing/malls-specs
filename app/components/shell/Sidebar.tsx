'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import type { Specification } from '@data-model';
import { getCatalogue } from '@/lib/catalogue';
import { getMalls, getMallForSpec, getScreenSize, MALL_GROUP_LABELS } from '@/lib/malls';
import type { Mall, MallGroup } from '@/lib/malls';
import { projectOutline } from '@/components/map/MallOutlinePreview';
import { PinStatusDot } from '@/components/map/PinStatusDot';

/**
 * The site's main navigation: every mall, grouped by network, each opening
 * to its screens — the same structure as the home page's mall index, so the
 * way you find a spec is the same everywhere. Mall rows open that mall's
 * map; screen rows fly the map straight to that screen.
 */

type GroupFilter = MallGroup | 'all';

const GROUP_SHORT_LABELS: Readonly<Record<MallGroup, string>> = {
  malls: 'Malls',
  hyprop: 'Hyprop',
  formats: 'Formats',
};

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden="true"
      className={`shrink-0 transition-transform duration-fast ease-standard ${open ? 'rotate-90' : ''}`}
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

/** A tiny version of the mall's real outline, as its icon in the menu. */
function MallGlyph({ mall }: { mall: Mall }) {
  if (!mall.location) {
    return (
      <span
        aria-hidden="true"
        className="block h-5 w-7 shrink-0 rounded-[3px] border border-dashed border-current opacity-50"
      />
    );
  }
  const { path, center } = projectOutline(mall.location, [], 28, 20, 1.5);
  return (
    <svg viewBox="0 0 28 20" className="h-5 w-7 shrink-0" aria-hidden="true">
      {path ? (
        <path d={path} fill="currentColor" fillOpacity={0.18} stroke="currentColor" strokeWidth={1} strokeLinejoin="round" />
      ) : (
        <circle cx={center[0]} cy={center[1]} r={3} fill="currentColor" />
      )}
    </svg>
  );
}

interface ActiveLocation {
  readonly mallId: string | null;
  readonly specId: string | null;
}

function MallNav({ active }: { active: ActiveLocation }) {
  const catalogue = useMemo(() => getCatalogue(), []);
  const malls = useMemo(() => getMalls(catalogue), [catalogue]);
  const pathname = usePathname();
  const [query, setQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState<GroupFilter>('all');
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

  // Keep the mall you're looking at open in the menu.
  useEffect(() => {
    if (!active.mallId) return;
    setExpanded((prev) => (prev.has(active.mallId!) ? prev : new Set(prev).add(active.mallId!)));
  }, [active.mallId]);

  const specsOf = (mall: Mall) =>
    mall.specIds
      .map((id) => catalogue.specifications[id])
      .filter((spec): spec is Specification => spec != null);

  const q = query.trim().toLowerCase();
  const groups = (Object.keys(MALL_GROUP_LABELS) as MallGroup[])
    .filter((group) => groupFilter === 'all' || group === groupFilter)
    .map((group) => ({
      group,
      malls: malls
        .filter((mall) => mall.group === group)
        .map((mall) => {
          const specs = specsOf(mall);
          const mallMatches = !q || mall.name.toLowerCase().includes(q);
          const matchingSpecs = mallMatches ? specs : specs.filter((spec) => spec.title.toLowerCase().includes(q));
          return { mall, specs: matchingSpecs, mallMatches };
        })
        .filter((entry) => entry.mallMatches || entry.specs.length > 0),
    }))
    .filter((entry) => entry.malls.length > 0);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filterChip = (value: GroupFilter, label: string) => {
    const isActive = groupFilter === value;
    return (
      <button
        key={value}
        type="button"
        onClick={() => setGroupFilter(value)}
        aria-pressed={isActive}
        className={`h-6 min-w-0 flex-1 rounded-[5px] px-1 text-[10.5px] font-semibold tracking-tight transition-colors duration-fast ease-standard ${
          isActive
            ? 'bg-white text-brand shadow-1'
            : 'text-brand-on-surface-muted hover:bg-white/[0.08] hover:text-brand-on-surface'
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <nav aria-label="Find a screen" className="flex h-full w-full flex-col">
      <div className="flex flex-col gap-3 border-b border-white/10 px-3 pb-3 pt-4">
        <label className="relative block">
          <span className="sr-only">Find a mall or screen</span>
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-on-surface-muted">
            <SearchIcon />
          </span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a mall or screen…"
            className="h-8 w-full rounded-md border border-white/10 bg-white/10 pl-8 pr-2 text-body-sm text-brand-on-surface outline-none transition-colors duration-fast ease-standard placeholder:text-brand-on-surface-muted focus:border-white/25 focus:bg-white/[0.15]"
          />
        </label>
        <div className="flex gap-0.5 rounded-md bg-white/[0.08] p-0.5" role="group" aria-label="Filter by network">
          {filterChip('all', 'All')}
          {(Object.keys(GROUP_SHORT_LABELS) as MallGroup[]).map((group) =>
            filterChip(group, GROUP_SHORT_LABELS[group]),
          )}
        </div>
      </div>

      <div className="no-scrollbar flex-1 overflow-y-auto px-3 py-3">
        {groups.length === 0 ? (
          <p className="px-2 py-6 text-center text-body-sm text-brand-on-surface-muted">
            No malls or screens match &ldquo;{query}&rdquo;.
          </p>
        ) : (
          <div className="flex flex-col gap-5">
            {groups.map(({ group, malls: entries }) => (
              <section key={group} className="flex flex-col gap-1" aria-label={MALL_GROUP_LABELS[group]}>
                <div className="flex items-center gap-2 px-2 pb-1">
                  <span className="text-label-sm uppercase text-brand-on-surface-muted">{MALL_GROUP_LABELS[group]}</span>
                  <span className="font-mono text-[10px] text-brand-on-surface-muted opacity-70">{entries.length}</span>
                  <span className="h-px flex-1 bg-white/10" aria-hidden="true" />
                </div>
                <ul className="flex flex-col gap-0.5">
                  {entries.map(({ mall, specs }) => {
                    // A search that matched screens (not the mall) opens the mall to show them.
                    const isOpen = expanded.has(mall.id) || (q.length > 0 && specs.length > 0);
                    const isCurrentMall = active.mallId === mall.id;
                    const isMallPage = isCurrentMall && active.specId == null && pathname === '/';
                    return (
                      <li key={mall.id}>
                        <div
                          className={`group relative flex items-center rounded-md transition-colors duration-fast ease-standard ${
                            isMallPage ? 'bg-white/[0.12]' : 'hover:bg-white/[0.06]'
                          }`}
                        >
                          {isCurrentMall ? (
                            <span
                              aria-hidden="true"
                              className="absolute left-0 top-1/2 h-3/5 w-[2px] -translate-y-1/2 rounded-full bg-accent"
                            />
                          ) : null}
                          <Link
                            href={`/?mall=${mall.id}`}
                            aria-current={isMallPage ? 'page' : undefined}
                            className={`flex min-w-0 flex-1 items-center gap-2.5 py-1.5 pl-2.5 text-body-sm ${
                              isCurrentMall
                                ? 'text-brand-on-surface'
                                : 'text-brand-on-surface-muted group-hover:text-brand-on-surface'
                            }`}
                          >
                            <MallGlyph mall={mall} />
                            <span className="flex-1 truncate font-medium">{mall.name}</span>
                            <span className="font-mono text-[10px] opacity-70">{mall.specIds.length}</span>
                          </Link>
                          <button
                            type="button"
                            onClick={() => toggle(mall.id)}
                            aria-expanded={isOpen}
                            aria-label={`${isOpen ? 'Hide' : 'Show'} ${mall.name} screens`}
                            className="ml-1 mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded text-brand-on-surface-muted hover:bg-white/10 hover:text-brand-on-surface"
                          >
                            <ChevronIcon open={isOpen} />
                          </button>
                        </div>

                        {isOpen ? (
                          <ul className="mb-1 ml-[22px] mt-0.5 flex flex-col gap-0.5 border-l border-white/10 pl-2">
                            {specs.map((spec) => {
                              const isCurrentSpec = active.specId === spec.id;
                              const size = getScreenSize(spec);
                              return (
                                <li key={spec.id}>
                                  <Link
                                    href={`/?mall=${mall.id}&screen=${spec.id}`}
                                    aria-current={isCurrentSpec ? 'page' : undefined}
                                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-body-sm transition-colors duration-fast ease-standard ${
                                      isCurrentSpec
                                        ? 'bg-white/[0.12] text-brand-on-surface'
                                        : 'text-brand-on-surface-muted hover:bg-white/[0.06] hover:text-brand-on-surface'
                                    }`}
                                  >
                                    <PinStatusDot pin={mall.pins[spec.id]} />
                                    <span className="min-w-0 flex-1 truncate">{spec.title}</span>
                                    <span className="shrink-0 font-mono text-[10px] opacity-70">
                                      {size ? `${size.width}×${size.height}` : '—'}
                                    </span>
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 border-t border-white/10 px-3 py-2.5">
        <Link
          href="/"
          className="flex-1 rounded-md px-2 py-1.5 text-center text-body-sm text-brand-on-surface-muted hover:bg-white/[0.06] hover:text-brand-on-surface"
        >
          All malls
        </Link>
        <span className="h-4 w-px bg-white/10" aria-hidden="true" />
        <Link
          href="/browse"
          className="flex-1 rounded-md px-2 py-1.5 text-center text-body-sm text-brand-on-surface-muted hover:bg-white/[0.06] hover:text-brand-on-surface"
        >
          List view
        </Link>
      </div>
    </nav>
  );
}

/** Reads which mall/screen is on screen: `/?mall=&screen=` or `/spec/:id`. */
function MallNavWithLocation() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const specMatch = pathname.match(/^\/spec\/([^/]+)/);
  const specId = specMatch ? decodeURIComponent(specMatch[1]) : pathname === '/' ? searchParams.get('screen') : null;
  const mallId = specMatch ? (getMallForSpec(specId ?? '')?.id ?? null) : pathname === '/' ? searchParams.get('mall') : null;
  return <MallNav active={{ mallId, specId }} />;
}

export function Sidebar() {
  // `useSearchParams` needs a Suspense boundary for the static export.
  return (
    <Suspense fallback={<MallNav active={{ mallId: null, specId: null }} />}>
      <MallNavWithLocation />
    </Suspense>
  );
}
