'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { emptyCollections, RECENT_LIMIT } from '@data-model';
import type { Collections, SpecificationId } from '@data-model';
import { localCollectionsAdapter } from '@/lib/localCollectionsAdapter';

interface CollectionsContextValue {
  readonly collections: Collections;
  readonly loaded: boolean;
  readonly toggleBookmark: (id: SpecificationId) => void;
  readonly recordVisit: (id: SpecificationId) => void;
  readonly isBookmarked: (id: SpecificationId) => boolean;
}

const CollectionsContext = createContext<CollectionsContextValue | null>(null);

/**
 * Single shared instance of device-scoped collections state. Deliberately
 * NOT re-created per consumer — two independent instances reading/writing
 * the same localStorage key would race and clobber each other's writes
 * (e.g. a bookmark toggle overwriting a just-recorded visit).
 */
export function CollectionsProvider({ children }: { children: ReactNode }) {
  const [collections, setCollections] = useState<Collections>(emptyCollections());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    localCollectionsAdapter.load().then((loadedCollections) => {
      if (!cancelled) {
        setCollections(loadedCollections);
        setLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleBookmark = useCallback((id: SpecificationId) => {
    setCollections((prev) => {
      const has = prev.bookmarks.includes(id);
      const next: Collections = {
        ...prev,
        bookmarks: has ? prev.bookmarks.filter((bookmarkId) => bookmarkId !== id) : [...prev.bookmarks, id],
      };
      void localCollectionsAdapter.save(next);
      return next;
    });
  }, []);

  const recordVisit = useCallback((id: SpecificationId) => {
    setCollections((prev) => {
      const withoutThisSpec = prev.recentlyViewed.filter((record) => record.specificationId !== id);
      const next: Collections = {
        ...prev,
        recentlyViewed: [{ specificationId: id, visitedAt: new Date().toISOString() }, ...withoutThisSpec].slice(
          0,
          RECENT_LIMIT,
        ),
      };
      void localCollectionsAdapter.save(next);
      return next;
    });
  }, []);

  const isBookmarked = useCallback((id: SpecificationId) => collections.bookmarks.includes(id), [collections]);

  const value = useMemo(
    () => ({ collections, loaded, toggleBookmark, recordVisit, isBookmarked }),
    [collections, loaded, toggleBookmark, recordVisit, isBookmarked],
  );

  return <CollectionsContext.Provider value={value}>{children}</CollectionsContext.Provider>;
}

export function useCollections(): CollectionsContextValue {
  const ctx = useContext(CollectionsContext);
  if (!ctx) throw new Error('useCollections must be used within CollectionsProvider');
  return ctx;
}
