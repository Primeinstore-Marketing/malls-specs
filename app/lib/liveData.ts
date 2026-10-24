'use client';

import { useSyncExternalStore } from 'react';
import type { Asset, AssetId, Catalogue, Specification, SpecificationId } from '@data-model';
import { api, apiConfigured } from './api';
import type { LiveDataResponse } from './api';
import { getSeedCatalogue, setLiveCatalogue } from './catalogue';
import { setLivePlacement } from './malls';
import type { MallMapPin, ScreenPin } from './malls';

/**
 * Admin edits from the API, layered over the built-in catalogue.
 *
 * Everything starts from the built-in data (which is also what the static
 * HTML was rendered with, so hydration always matches); once the API
 * answers, the merged catalogue replaces it and subscribed components
 * re-render. Components that call `getCatalogue()` directly pick up the
 * merged data the next time they mount.
 */

export type LiveStatus = 'idle' | 'loading' | 'ready' | 'offline';

export interface LiveState {
  readonly status: LiveStatus;
  readonly catalogue: Catalogue;
  /** Bumped on every change; handy as a memo dependency. */
  readonly version: number;
  /** Specs added by admins — they have no pre-built `/spec/:id` page. */
  readonly addedSpecIds: ReadonlySet<string>;
  /** Specs whose built-in version an admin has edited. */
  readonly editedSpecIds: ReadonlySet<string>;
}

const initialState: LiveState = {
  status: 'idle',
  catalogue: getSeedCatalogue(),
  version: 0,
  addedSpecIds: new Set(),
  editedSpecIds: new Set(),
};

let state = initialState;
const listeners = new Set<() => void>();

function publish(next: LiveState) {
  state = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function apply(data: LiveDataResponse) {
  const seed = getSeedCatalogue();
  const specifications: Record<string, Specification> = { ...seed.specifications };
  const addedSpecIds = new Set<string>();
  const editedSpecIds = new Set<string>();
  const addedByMall: Record<string, string[]> = {};

  for (const record of data.specs) {
    specifications[record.id] = { ...record.data, id: record.id as SpecificationId };
    if (record.isNew) {
      addedSpecIds.add(record.id);
      if (record.mallId) (addedByMall[record.mallId] ??= []).push(record.id);
    } else {
      editedSpecIds.add(record.id);
    }
  }

  const pins: Record<string, ScreenPin> = {};
  for (const pin of data.pins) {
    pins[pin.specId] = { lng: pin.lng, lat: pin.lat, source: 'confirmed', ...(pin.level ? { level: pin.level } : {}) };
  }

  // Uploaded files join the catalogue's assets, and each is listed on its
  // spec by role — so an upload shows up without re-saving the spec.
  const assets: Record<string, Asset> = { ...seed.assets };
  const roleField = { media: 'mediaIds', download: 'downloadIds', attachment: 'attachmentIds' } as const;
  for (const { specId, ...asset } of data.assets ?? []) {
    const spec = specifications[specId];
    if (!spec) continue;
    assets[asset.id] = asset;
    const field = roleField[asset.role];
    if (!spec[field].includes(asset.id)) {
      specifications[specId] = { ...spec, [field]: [...spec[field], asset.id as AssetId] };
    }
  }

  const catalogue: Catalogue = { ...seed, specifications, assets };
  const planPins: Record<string, MallMapPin> = {};
  for (const pin of data.planPins ?? []) planPins[pin.specId] = { x: pin.x, y: pin.y, source: 'confirmed' };

  setLivePlacement({ pins, addedSpecIds: addedByMall, planPins });
  setLiveCatalogue(catalogue);
  publish({ status: 'ready', catalogue, version: state.version + 1, addedSpecIds, editedSpecIds });
}

// Each refresh is numbered; only the newest one's answer is applied. A
// refresh started after an admin saves must not be satisfied by a request
// that left before the save (it would show the old data).
let latestRequest = 0;

/** Loads (or reloads, after an admin saves) the edits from the API. */
export function refreshLiveData(): Promise<void> {
  if (!apiConfigured) return Promise.resolve();
  const request = ++latestRequest;
  if (state.status === 'idle') publish({ ...state, status: 'loading' });
  return api
    .data()
    .then((data) => {
      if (request === latestRequest) apply(data);
    })
    .catch(() => {
      // Keep showing whatever we had; the built-in data is always there.
      if (request === latestRequest) publish({ ...state, status: state.status === 'ready' ? 'ready' : 'offline' });
    });
}

export function useLiveData(): LiveState {
  return useSyncExternalStore(subscribe, () => state, () => initialState);
}

/** Where a spec's full page lives: pre-built for built-in specs, client-rendered for added ones. */
export function specHref(specId: string, live: LiveState = state): string {
  return live.addedSpecIds.has(specId) ? `/screen?id=${encodeURIComponent(specId)}` : `/spec/${specId}`;
}
