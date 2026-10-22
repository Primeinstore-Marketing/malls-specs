'use client';

import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import Link from 'next/link';
import type { Specification } from '@data-model';
import { getScreenSize, MALL_GROUP_LABELS } from '@/lib/malls';
import type { Mall, MallGroup } from '@/lib/malls';
import { EmptyState } from '@/components/ui/EmptyState';
import { MallOutlinePreview } from './MallOutlinePreview';

type GroupFilter = MallGroup | 'all';

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function NoMapIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" />
      <path d="M9 4v14M15 6v14" />
    </svg>
  );
}

/** The network-wide formats card has no place, so it previews the formats. */
function FormatPreview({ specs }: { specs: readonly Specification[] }) {
  return (
    <div className="flex h-full items-center justify-center gap-4 px-6">
      {specs.map((spec) => {
        const size = getScreenSize(spec);
        const ratio = size ? size.width / size.height : 16 / 9;
        const height = ratio >= 1 ? 64 / Math.min(ratio, 2.2) : 84;
        return (
          <span
            key={spec.id}
            className="block rounded-md border border-accent bg-accent-subtle transition-transform duration-slow ease-expressive group-hover:-translate-y-1"
            style={{ height, width: height * ratio }}
          />
        );
      })}
    </div>
  );
}

function StatTile({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-display text-[2rem] font-black leading-none tracking-tight text-fg">{value}</span>
      <span className="text-label-md uppercase text-fg-subtle">{label}</span>
    </div>
  );
}

function MallCard({ mall, specs, index }: { mall: Mall; specs: readonly Specification[]; index: number }) {
  const confirmed = specs.filter((spec) => mall.pins[spec.id]?.source === 'confirmed').length;
  const resolutions = Array.from(
    new Set(
      specs.map((spec) => {
        const size = getScreenSize(spec);
        return size ? `${size.width}×${size.height}` : null;
      }),
    ),
  ).filter((value): value is string => value != null);
  const shownResolutions = resolutions.slice(0, 2);

  return (
    <li className="mall-card-enter" style={{ '--enter-delay': `${Math.min(index, 16) * 35}ms` } as CSSProperties}>
      <Link
        href={`/?mall=${mall.id}`}
        className="group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-bg transition-[border-color,box-shadow,transform] duration-slow ease-expressive hover:-translate-y-1 hover:border-accent hover:shadow-3 focus-visible:border-border-focus focus-visible:outline-none"
      >
        <div className="relative aspect-[16/10] overflow-hidden border-b border-border bg-bg-subtle bg-[radial-gradient(var(--color-border)_1px,transparent_1px)] [background-size:14px_14px]">
          {mall.location ? (
            <MallOutlinePreview
              location={mall.location}
              pins={specs
                .map((spec) => mall.pins[spec.id])
                .filter((pin) => pin != null && pin.source !== 'placeholder')}
            />
          ) : mall.group === 'formats' ? (
            <FormatPreview specs={specs} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-fg-subtle">
              <NoMapIcon />
              <span className="text-label-md uppercase">Not on OpenStreetMap</span>
            </div>
          )}

          <span className="absolute left-3 top-3 rounded-full border border-border bg-bg px-2 py-0.5 font-mono text-[11px] font-medium text-fg-muted">
            {specs.length} {specs.length === 1 ? 'screen' : 'screens'}
          </span>
        </div>

        <div className="flex flex-1 flex-col gap-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-display-sm text-fg">{mall.name}</h3>
            <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-fg-muted transition-all duration-slow ease-expressive group-hover:translate-x-0.5 group-hover:border-accent group-hover:bg-accent group-hover:text-fg-on-accent">
              <ArrowIcon />
            </span>
          </div>

          {shownResolutions.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {shownResolutions.map((resolution) => (
                <span
                  key={resolution}
                  className="rounded-md bg-bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium text-fg-muted"
                >
                  {resolution}
                </span>
              ))}
              {resolutions.length > shownResolutions.length ? (
                <span className="px-1 py-0.5 font-mono text-[11px] text-fg-subtle">
                  +{resolutions.length - shownResolutions.length}
                </span>
              ) : null}
            </div>
          ) : (
            <span className="font-mono text-[11px] text-fg-subtle">Resolution TBC</span>
          )}

          {mall.location ? (
            <div className="mt-auto flex items-center gap-3 pt-1">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-bg-muted">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${(confirmed / Math.max(specs.length, 1)) * 100}%` }}
                />
              </div>
              <span className="shrink-0 text-label-sm uppercase text-fg-subtle">
                {confirmed}/{specs.length} confirmed
              </span>
            </div>
          ) : null}
        </div>
      </Link>
    </li>
  );
}

export function MallIndex({
  malls,
  specifications,
}: {
  malls: readonly Mall[];
  specifications: Readonly<Record<string, Specification>>;
}) {
  const [query, setQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState<GroupFilter>('all');

  const groupKeys = useMemo(
    () => (Object.keys(MALL_GROUP_LABELS) as MallGroup[]).filter((group) => malls.some((mall) => mall.group === group)),
    [malls],
  );

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = (mall: Mall) =>
      !q ||
      mall.name.toLowerCase().includes(q) ||
      mall.specIds.some((id) => specifications[id]?.title.toLowerCase().includes(q));
    return groupKeys
      .filter((group) => groupFilter === 'all' || group === groupFilter)
      .map((group) => ({ group, malls: malls.filter((mall) => mall.group === group && matches(mall)) }))
      .filter((entry) => entry.malls.length > 0);
  }, [malls, specifications, query, groupFilter, groupKeys]);

  const specsFor = (mall: Mall) =>
    mall.specIds.map((id) => specifications[id]).filter((spec): spec is Specification => spec != null);

  const screenCount = malls.reduce((sum, mall) => sum + mall.specIds.length, 0);
  const confirmedCount = malls.reduce(
    (sum, mall) => sum + Object.values(mall.pins).filter((pin) => pin.source === 'confirmed').length,
    0,
  );
  const locationCount = malls.filter((mall) => mall.group !== 'formats').length;

  const chip = (value: GroupFilter, label: string, count: number) => {
    const active = groupFilter === value;
    return (
      <button
        key={value}
        type="button"
        onClick={() => setGroupFilter(value)}
        aria-pressed={active}
        className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-body-sm font-medium transition-colors duration-fast ease-standard ${
          active
            ? 'border-fg bg-fg text-bg'
            : 'border-border-strong bg-bg text-fg-muted hover:border-border-control hover:text-fg'
        }`}
      >
        {label}
        <span className={`font-mono text-[11px] ${active ? 'text-bg' : 'text-fg-subtle'}`}>{count}</span>
      </button>
    );
  };

  let cardIndex = 0;

  return (
    <div className="flex flex-col">
      <header className="relative overflow-hidden border-b border-border bg-bg-subtle">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(var(--color-border-strong)_1px,transparent_1px)] opacity-60 [background-size:22px_22px] [mask-image:linear-gradient(to_bottom,black,transparent)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-32 h-[420px] w-[420px] rounded-full bg-accent opacity-[0.12] blur-[100px]"
        />
        <div className="relative mx-auto flex max-w-page flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
          <div className="flex flex-col gap-4">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-accent-border bg-accent-subtle py-1 pl-1.5 pr-3 text-label-md uppercase text-accent-fg">
              <span className="h-[5px] w-[5px] animate-pulse rounded-full bg-accent" aria-hidden="true" />
              Primedia Malls
            </span>
            <h1 className="max-w-3xl text-display-2xl text-fg">
              Every screen,
              <br />
              <span className="text-transparent [-webkit-text-stroke:2px_var(--color-fg-subtle)]">mall by mall.</span>
            </h1>
            <p className="max-w-prose text-body-lg text-fg-muted">
              Choose a mall to fly through its map and see each screen&rsquo;s size, format and booking requirements.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-x-10 gap-y-6">
            <StatTile value={locationCount} label="Locations" />
            <StatTile value={screenCount} label="Screens" />
            <StatTile value={confirmedCount} label="Positions confirmed" />
          </div>
        </div>
      </header>

      <div className="sticky top-[var(--topbar-height-sm)] z-raised border-b border-border bg-bg md:top-[var(--topbar-height-md)] lg:top-[var(--topbar-height)]">
        <div className="mx-auto flex max-w-page flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:px-8">
          <label className="relative w-full lg:max-w-xs">
            <span className="sr-only">Find a mall or screen</span>
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle">
              <SearchIcon />
            </span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find a mall or screen…"
              className="h-9 w-full rounded-full border border-border-strong bg-bg pl-9 pr-3 text-body-sm text-fg outline-none transition-colors duration-fast ease-standard placeholder:text-fg-subtle focus:border-border-focus"
            />
          </label>
          <div
            className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0"
            role="group"
            aria-label="Filter by network"
          >
            {chip('all', 'All', malls.length)}
            {groupKeys.map((group) =>
              chip(group, MALL_GROUP_LABELS[group], malls.filter((mall) => mall.group === group).length),
            )}
          </div>
          <Link
            href="/browse"
            className="shrink-0 text-body-sm text-fg-muted underline-offset-4 hover:text-fg hover:underline lg:ml-auto"
          >
            View as a list
          </Link>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-page flex-col gap-10 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        {groups.length === 0 ? (
          <EmptyState title="No matching malls" description="Try a mall name or a screen name like “Food Court”." />
        ) : (
          groups.map(({ group, malls: groupMalls }) => (
            <section key={group} className="flex flex-col gap-4" aria-labelledby={`group-${group}`}>
              <div className="flex items-baseline gap-3">
                <h2 id={`group-${group}`} className="text-display-sm text-fg">
                  {MALL_GROUP_LABELS[group]}
                </h2>
                <span className="font-mono text-mono-md text-fg-subtle">{groupMalls.length}</span>
                <span className="h-px flex-1 self-center bg-border" aria-hidden="true" />
              </div>
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {groupMalls.map((mall) => (
                  <MallCard key={mall.id} mall={mall} specs={specsFor(mall)} index={cardIndex++} />
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
