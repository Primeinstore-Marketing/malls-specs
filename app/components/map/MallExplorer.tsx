'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { Specification } from '@data-model';
import { api, ApiError } from '@/lib/api';
import { refreshLiveData, specHref, useLiveData } from '@/lib/liveData';
import { getMalls } from '@/lib/malls';
import type { ScreenPin } from '@/lib/malls';
import { useAdminSession } from '@/components/auth/AdminSession';
import { MallIndex } from './MallIndex';
import { MallMap } from './MallMap';
import { GridCanvas } from './GridCanvas';
import { ScreenPanel } from './ScreenPanel';
import type { AdminControls, SaveState } from './ScreenPanel';
import { ScreenEditor } from './ScreenEditor';

/**
 * Home page: the mall index, or — with `?mall=` — that mall's map.
 * `?screen=` holds the focused screen so any view is a shareable link (the
 * spec page's "Show on map" button deep-links here). `?edit=1` turns on
 * placing screens, for signed-in admins only.
 */
export function MallExplorer() {
  const live = useLiveData();
  const { catalogue } = live;
  const malls = useMemo(() => getMalls(catalogue), [catalogue]);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { isAdmin, admin, sessionExpired } = useAdminSession();
  const editMode = isAdmin && searchParams.get('edit') === '1';

  // Positions being saved, shown immediately while the server confirms.
  const [pendingPins, setPendingPins] = useState<Readonly<Record<string, ScreenPin>>>({});
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'idle' });
  const [editor, setEditor] = useState<{ mode: 'edit' | 'add'; specId?: string } | null>(null);

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
      const pending = pendingPins[spec.id];
      if (pending) merged[spec.id] = pending;
    }
    return merged;
  }, [mall, specs, pendingPins]);
  // Visitors only see screens with a real (or store-matched) position; the
  // parked "?" placeholders are an admin to-do list.
  const mapPins = useMemo(() => {
    if (isAdmin) return pins;
    const visible: Record<string, ScreenPin> = {};
    for (const [specId, pin] of Object.entries(pins)) if (pin.source !== 'placeholder') visible[specId] = pin;
    return visible;
  }, [pins, isAdmin]);
  const screenParam = searchParams.get('screen');
  const focusedId = specs.some((spec) => spec.id === screenParam) ? screenParam : null;

  const hrefFor = useCallback(
    (mallId: string, specId: string | null, edit = editMode) => {
      const params = new URLSearchParams({ mall: mallId });
      if (specId) params.set('screen', specId);
      if (edit) params.set('edit', '1');
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

  // Double-click on a screen opens its full spec; not while placing, where
  // clicks are for moving screens.
  const openSpec = useCallback(
    (specId: string) => {
      if (!editMode) router.push(specHref(specId, live));
    },
    [editMode, router, live],
  );

  const toggleEdit = () => {
    if (!mall) return;
    router.replace(hrefFor(mall.id, focusedId, !editMode), { scroll: false });
  };

  /** Runs an admin change, then reloads live data so everyone's view matches the server. */
  const runChange = useCallback(
    async (label: string, change: () => Promise<unknown>) => {
      setSaveState({ kind: 'saving', message: label });
      try {
        await change();
        await refreshLiveData();
        setSaveState({ kind: 'saved', message: 'Saved — live for everyone now.' });
        return true;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) sessionExpired();
        setSaveState({ kind: 'error', message: error instanceof Error ? error.message : 'Couldn’t save.' });
        return false;
      }
    },
    [sessionExpired],
  );

  const movePin = useCallback(
    async (specId: string, lng: number, lat: number) => {
      const level = pins[specId]?.level ?? null;
      const position = { lng: Number(lng.toFixed(6)), lat: Number(lat.toFixed(6)), source: 'confirmed' as const };
      setPendingPins((current) => ({ ...current, [specId]: position }));
      await runChange('Saving position…', () => api.putPin(specId, position.lng, position.lat, level));
      setPendingPins((current) => {
        const next = { ...current };
        delete next[specId];
        return next;
      });
    },
    [pins, runChange],
  );

  const controls: AdminControls | null =
    isAdmin && admin
      ? {
          placing: editMode,
          togglePlacing: toggleEdit,
          saveState,
          dismissSaveState: () => setSaveState({ kind: 'idle' }),
          editSpec: (specId) => setEditor({ mode: 'edit', specId }),
          addScreen: () => setEditor({ mode: 'add' }),
          resetPin: (specId) => void runChange('Resetting position…', () => api.deletePin(specId)),
          deleteSpec: (specId) => {
            if (!window.confirm('Delete this screen? It disappears from the site for everyone.')) return;
            void runChange('Deleting…', () => api.deleteSpec(specId)).then((ok) => {
              if (ok) setFocus(null);
            });
          },
          isAdded: (specId) => live.addedSpecIds.has(specId),
        }
      : null;

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
    return <MallIndex malls={malls} specifications={catalogue.specifications} isAdmin={isAdmin} />;
  }

  const editorSpec = editor?.specId ? catalogue.specifications[editor.specId] : undefined;

  return (
    <div className="flex h-[calc(100dvh-var(--topbar-height-sm))] flex-col md:h-[calc(100dvh-var(--topbar-height-md))] lg:h-[calc(100dvh-var(--topbar-height))] lg:flex-row">
      <h1 className="sr-only">{mall.name} screen map</h1>
      <div className="min-h-0 flex-1">
        {mall.location ? (
          <MallMap
            mall={mall}
            location={mall.location}
            specs={specs}
            pins={mapPins}
            focusedId={focusedId}
            onFocus={setFocus}
            onOpen={openSpec}
            onStep={step}
            editMode={editMode}
            canEdit={isAdmin}
            onPinMove={(specId, lng, lat) => void movePin(specId, lng, lat)}
            onStartPlacing={toggleEdit}
          />
        ) : (
          <GridCanvas
            viewId={mall.id}
            title={mall.name}
            subtitle={
              mall.group === 'formats'
                ? 'Generic specs · used across the network'
                : 'Not on OpenStreetMap · screens shown as a grid'
            }
            specs={specs}
            focusedId={focusedId}
            onFocus={setFocus}
            onOpen={openSpec}
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
          focusedId={focusedId}
          onFocus={setFocus}
          onMallChange={(mallId) => router.push(hrefFor(mallId, null), { scroll: false })}
          admin={controls}
        />
      </aside>

      {editor && admin && (editor.mode === 'add' || editorSpec) ? (
        <ScreenEditor
          mode={editor.mode}
          mall={mall}
          spec={editorSpec}
          tags={Object.values(catalogue.tags)}
          existingIds={new Set(Object.keys(catalogue.specifications))}
          adminEmail={admin.email}
          onCancel={() => setEditor(null)}
          onSave={async (spec) => {
            const isNew = editor.mode === 'add';
            // Throws on failure so the form can show the error and stay open.
            await api.putSpec(spec, { mallId: mall.id, isNew });
            await refreshLiveData();
            setEditor(null);
            setSaveState({ kind: 'saved', message: isNew ? 'Screen added. Click the map to place it.' : 'Saved — live for everyone now.' });
            if (isNew) router.replace(hrefFor(mall.id, spec.id, mall.location != null), { scroll: false });
          }}
        />
      ) : null}
    </div>
  );
}
