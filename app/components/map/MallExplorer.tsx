'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { Specification } from '@data-model';
import { getCatalogue } from '@/lib/catalogue';
import { getMalls } from '@/lib/malls';
import type { ScreenPin } from '@/lib/malls';
import { MallIndex } from './MallIndex';
import { MallMap } from './MallMap';
import { GridCanvas } from './GridCanvas';
import { ScreenPanel } from './ScreenPanel';

/**
 * Home page: the mall index, or — with `?mall=` — that mall's map.
 * `?screen=` holds the focused screen so any view is a shareable link (the
 * spec page's "Show on map" button deep-links here). `?edit=1` turns on
 * pin placement; see `lib/screenPins.ts`.
 */
export function MallExplorer() {
  const catalogue = useMemo(() => getCatalogue(), []);
  const malls = useMemo(() => getMalls(catalogue), [catalogue]);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const editMode = searchParams.get('edit') === '1';

  // Pins moved or placed in edit mode this session, on top of SCREEN_PINS.
  const [pinEdits, setPinEdits] = useState<Readonly<Record<string, ScreenPin>>>({});

  const mall = malls.find((candidate) => candidate.id === searchParams.get('mall')) ?? null;
  const specs = useMemo(
    () =>
      (mall?.specIds ?? [])
        .map((id) => catalogue.specifications[id])
        .filter((spec): spec is Specification => spec != null),
    [mall, catalogue],
  );
  const pins = useMemo(() => {
    const merged: Record<string, ScreenPin> = { ...mall?.pins };
    for (const spec of specs) {
      const edit = pinEdits[spec.id];
      if (edit) merged[spec.id] = edit;
    }
    return merged;
  }, [mall, specs, pinEdits]);
  const screenParam = searchParams.get('screen');
  const focusedId = specs.some((spec) => spec.id === screenParam) ? screenParam : null;

  const hrefFor = useCallback(
    (mallId: string, specId: string | null) => {
      const params = new URLSearchParams({ mall: mallId });
      if (specId) params.set('screen', specId);
      if (editMode) params.set('edit', '1');
      return `${pathname}?${params.toString()}`;
    },
    [pathname, editMode],
  );

  const setFocus = useCallback(
    (specId: string | null) => {
      if (mall) router.replace(hrefFor(mall.id, specId), { scroll: false });
    },
    [mall, router, hrefFor],
  );

  // Prezi-style path: overview → screen 1 → … → last screen → overview.
  const step = useCallback(
    (direction: 1 | -1) => {
      if (specs.length === 0) return;
      const index = specs.findIndex((spec) => spec.id === focusedId);
      const next = index === -1 ? (direction === 1 ? 0 : specs.length - 1) : index + direction;
      setFocus(next < 0 || next >= specs.length ? null : specs[next].id);
    },
    [specs, focusedId, setFocus],
  );

  const toggleEdit = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (editMode) params.delete('edit');
    else params.set('edit', '1');
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const movePin = useCallback((specId: string, lng: number, lat: number) => {
    setPinEdits((current) => ({
      ...current,
      [specId]: { ...current[specId], lng: Number(lng.toFixed(6)), lat: Number(lat.toFixed(6)), source: 'confirmed' },
    }));
  }, []);

  useEffect(() => {
    if (!mall) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (target?.closest('input, select, textarea, [contenteditable="true"], [role="dialog"]')) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown' || event.key === 'PageDown') {
        event.preventDefault();
        step(1);
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp' || event.key === 'PageUp') {
        event.preventDefault();
        step(-1);
      } else if (event.key === 'Escape' || event.key === 'Home') {
        setFocus(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mall, step, setFocus]);

  if (!mall) {
    return <MallIndex malls={malls} specifications={catalogue.specifications} />;
  }

  const editedHere = specs.filter((spec) => pinEdits[spec.id] != null).map((spec) => spec.id);

  return (
    <div className="flex h-[calc(100dvh-var(--topbar-height-sm))] flex-col md:h-[calc(100dvh-var(--topbar-height-md))] lg:h-[calc(100dvh-var(--topbar-height))] lg:flex-row">
      <h1 className="sr-only">{mall.name} screen map</h1>
      <div className="min-h-0 flex-1">
        {mall.location ? (
          <MallMap
            mall={mall}
            location={mall.location}
            specs={specs}
            pins={pins}
            focusedId={focusedId}
            onFocus={setFocus}
            onStep={step}
            editMode={editMode}
            onPinMove={movePin}
            onStartPlacing={toggleEdit}
          />
        ) : (
          <GridCanvas
            viewId={mall.id}
            title={mall.name}
            subtitle={
              mall.group === 'formats'
                ? 'Standard formats · used across the network'
                : 'Not on OpenStreetMap · screens shown as a grid'
            }
            specs={specs}
            focusedId={focusedId}
            onFocus={setFocus}
            onStep={step}
          />
        )}
      </div>
      <aside
        aria-label={focusedId ? 'Screen details' : `${mall.name} screens`}
        className="h-[42%] shrink-0 border-t border-border bg-bg lg:h-auto lg:w-[360px] lg:border-l lg:border-t-0"
      >
        <ScreenPanel
          mall={mall}
          malls={malls}
          specs={specs}
          pins={pins}
          tags={catalogue.tags}
          focusedId={focusedId}
          onFocus={setFocus}
          onMallChange={(mallId) => router.push(hrefFor(mallId, null), { scroll: false })}
          editMode={editMode}
          editedSpecIds={editedHere}
          onToggleEdit={toggleEdit}
        />
      </aside>
    </div>
  );
}
