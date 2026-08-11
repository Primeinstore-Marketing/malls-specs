import { emptyCollections } from '@data-model';
import type { Collections, CollectionsAdapter } from '@data-model';

const STORAGE_KEY = 'pm_collections_v1';

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

/** Device-scoped storage for bookmarks/favourites/recently-viewed, per the `CollectionsAdapter` seam in data-model. */
export const localCollectionsAdapter: CollectionsAdapter = {
  async load(): Promise<Collections> {
    if (!isBrowser()) return emptyCollections();
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return emptyCollections();
      return { ...emptyCollections(), ...JSON.parse(raw) };
    } catch {
      return emptyCollections();
    }
  },

  async save(next: Collections): Promise<void> {
    if (!isBrowser()) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  },

  async clear(): Promise<void> {
    if (!isBrowser()) return;
    window.localStorage.removeItem(STORAGE_KEY);
  },
};
