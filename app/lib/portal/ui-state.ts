'use client';

import { useSyncExternalStore } from 'react';
import type { NewCampaignItem } from './types';

/**
 * Short-lived UI state shared across the page, not saved: the
 * "add to which campaign?" sheet and the confirmation toast.
 */

export interface Toast {
  readonly id: number;
  readonly text: string;
  readonly href?: string;
  readonly undo?: () => void;
}

interface UiState {
  readonly picking: NewCampaignItem | null;
  readonly toast: Toast | null;
}

let state: UiState = { picking: null, toast: null };
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;

function set(next: Partial<UiState>) {
  state = { ...state, ...next };
  for (const l of listeners) l();
}

export const ui = {
  pick(item: NewCampaignItem | null) {
    set({ picking: item });
  },
  toast(t: Omit<Toast, 'id'>) {
    clearTimeout(timer);
    set({ toast: { ...t, id: Date.now() } });
    timer = setTimeout(() => set({ toast: null }), 6000);
  },
  dismiss() {
    clearTimeout(timer);
    set({ toast: null });
  },
};

const SERVER: UiState = { picking: null, toast: null };

export function useUi(): UiState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => SERVER,
  );
}
