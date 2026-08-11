'use client';

import { useSearchPalette } from '@/components/search/SearchPaletteContext';

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

export function SearchBar() {
  const { setOpen } = useSearchPalette();

  return (
    <button type="button" onClick={() => setOpen(true)} className="relative block w-full text-left">
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-fg-subtle">
        <SearchIcon />
      </span>
      <span className="flex h-12 w-full items-center rounded-lg border border-border-strong bg-bg pl-11 pr-16 text-body-md text-fg-subtle transition-colors duration-fast ease-standard hover:border-border-control">
        Search all specifications…
      </span>
      <kbd className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 rounded border border-border-strong bg-bg-subtle px-1.5 py-0.5 text-label-md text-fg-subtle">
        ⌘K
      </kbd>
    </button>
  );
}
