'use client';

import { useEffect } from 'react';

/**
 * Sets the browser tab's title on pages whose subject is only known in the
 * browser (static export: `/portal/campaign?id=…`), so tabs, history and
 * bookmarks say which campaign or mall it is. Restores the old title on leave.
 */
export function useDocumentTitle(title: string | null | undefined) {
  useEffect(() => {
    if (!title) return;
    const before = document.title;
    document.title = `${title} — Primedia Malls`;
    return () => {
      document.title = before;
    };
  }, [title]);
}
