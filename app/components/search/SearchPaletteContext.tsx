'use client';

import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

interface SearchPaletteContextValue {
  readonly open: boolean;
  readonly setOpen: (open: boolean) => void;
}

const SearchPaletteContext = createContext<SearchPaletteContextValue | null>(null);

export function SearchPaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const value = useMemo(() => ({ open, setOpen }), [open]);
  return <SearchPaletteContext.Provider value={value}>{children}</SearchPaletteContext.Provider>;
}

export function useSearchPalette(): SearchPaletteContextValue {
  const ctx = useContext(SearchPaletteContext);
  if (!ctx) throw new Error('useSearchPalette must be used within SearchPaletteProvider');
  return ctx;
}
