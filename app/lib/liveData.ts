'use client';

import { useSyncExternalStore } from 'react';
import type { Catalogue } from '@data-model';
import { api, apiConfigured } from './api';
import type { LiveDataResponse } from './api';
import { getCodeCatalogue, getSeedCatalogue, setLiveCatalogue, snapshotState } from './catalogue';
import { mergeLiveData } from './mergeLive';
import { setLivePlacement } from './malls';

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
}

const initialState: LiveState = {
  status: 'idle',
  catalogue: getSeedCatalogue(),
  version: 0,
  addedSpecIds: snapshotState.addedSpecIds,
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
  // Merge onto the code catalogue, not the baked snapshot: the response is the
  // whole database, so anything removed since publishing drops out too.
  const merged = mergeLiveData(getCodeCatalogue(), data);
  setLivePlacement(merged.placement);
  setLiveCatalogue(merged.catalogue);
  publish({
    status: 'ready',
    catalogue: merged.catalogue,
    version: state.version + 1,
    addedSpecIds: merged.addedSpecIds,
  });
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
