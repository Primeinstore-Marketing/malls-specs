'use client';

/**
 * The campaign a client is planning before they send it to Primedia sales.
 * Clients have no account, so it lives in their browser while they browse
 * the map and specs ("+ Add to request"), and goes to the API when they
 * send it from /request. If storage is blocked it still works for the visit.
 */
import { useSyncExternalStore } from 'react';

export interface DraftScreen {
  readonly specId: string;
  readonly appMallId: string;
  readonly title: string;
  readonly mallName: string;
}

export interface DraftMall {
  readonly id: string;
  readonly name: string;
}

export interface RequestDraft {
  readonly screens: readonly DraftScreen[];
  /** Malls they want with no particular screen: sales suggest the screens. */
  readonly malls: readonly DraftMall[];
}

const KEY = 'malls-specs:client-request';
const EMPTY: RequestDraft = { screens: [], malls: [] };

let state: RequestDraft = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<RequestDraft>) : null;
    if (parsed) state = { screens: Array.isArray(parsed.screens) ? parsed.screens : [], malls: Array.isArray(parsed.malls) ? parsed.malls : [] };
  } catch {
    // Storage blocked or damaged: start empty.
  }
}

function set(next: RequestDraft) {
  state = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Keep it for this visit only.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  load();
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    loaded = false;
    state = EMPTY;
    load();
    listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function useRequestDraft(): RequestDraft {
  return useSyncExternalStore(
    subscribe,
    () => (load(), state),
    () => EMPTY,
  );
}

export const requestDraft = {
  get: () => (load(), state),
  hasScreen: (specId: string) => (load(), state.screens.some((s) => s.specId === specId)),
  hasMall: (id: string) => (load(), state.malls.some((m) => m.id === id)),
  addScreen(s: DraftScreen) {
    load();
    if (state.screens.some((x) => x.specId === s.specId)) return;
    set({ ...state, screens: [...state.screens, s] });
  },
  removeScreen(specId: string) {
    load();
    set({ ...state, screens: state.screens.filter((s) => s.specId !== specId) });
  },
  addMall(m: DraftMall) {
    load();
    if (state.malls.some((x) => x.id === m.id)) return;
    set({ ...state, malls: [...state.malls, m] });
  },
  removeMall(id: string) {
    load();
    set({ ...state, malls: state.malls.filter((m) => m.id !== id) });
  },
  clear: () => set(EMPTY),
};

export const draftCount = (d: RequestDraft) => d.screens.length + d.malls.length;
