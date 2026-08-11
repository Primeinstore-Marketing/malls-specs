'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCatalogue } from '@/lib/catalogue';
import { buildSearchIndex, searchIndex } from '@/lib/search';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useSearchPalette } from './SearchPaletteContext';

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

export function CommandPalette() {
  const { open, setOpen } = useSearchPalette();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const index = useMemo(() => buildSearchIndex(getCatalogue()), []);
  const results = useMemo(() => searchIndex(query, index).slice(0, 8), [query, index]);

  useEffect(() => {
    function handleGlobalKeydown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(!open);
      }
    }
    window.addEventListener('keydown', handleGlobalKeydown);
    return () => window.removeEventListener('keydown', handleGlobalKeydown);
  }, [open, setOpen]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      const id = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!open) return null;

  const select = (id: string) => {
    setOpen(false);
    router.push(`/spec/${id}`);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setOpen(false);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const active = results[activeIndex];
      if (active) select(active.id);
      else if (query.trim()) {
        setOpen(false);
        router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-modal flex items-start justify-center bg-fg/40 px-4 pt-[15vh]" onClick={() => setOpen(false)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search specifications"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleKeyDown}
        className="w-full max-w-xl overflow-hidden rounded-xl border border-border bg-bg shadow-4"
      >
        <label className="relative block border-b border-border">
          <span className="sr-only">Search all specifications</span>
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-fg-subtle">
            <SearchIcon />
          </span>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search specifications…"
            className="h-14 w-full bg-transparent pl-11 pr-4 text-body-lg text-fg outline-none placeholder:text-fg-subtle"
          />
        </label>

        <div className="max-h-96 overflow-y-auto p-2">
          {query.trim() === '' ? (
            <p className="px-3 py-6 text-center text-body-sm text-fg-subtle">
              Search by title, code, description or tag.
            </p>
          ) : results.length === 0 ? (
            <p className="px-3 py-6 text-center text-body-sm text-fg-subtle">
              No specifications match “{query}”.
            </p>
          ) : (
            <ul>
              {results.map((entry, i) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => select(entry.id)}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-body-sm transition-colors duration-fast ease-standard ${
                      i === activeIndex ? 'bg-accent-subtle text-fg' : 'text-fg hover:bg-bg-subtle'
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{entry.title || 'Untitled specification'}</span>
                      {entry.description ? (
                        <span className="block truncate text-body-sm text-fg-subtle">{entry.description}</span>
                      ) : null}
                    </span>
                    <StatusBadge status={entry.status} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {query.trim() !== '' ? (
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              router.push(`/search?q=${encodeURIComponent(query.trim())}`);
            }}
            className="flex w-full items-center justify-between border-t border-border px-4 py-2.5 text-body-sm text-fg-muted transition-colors duration-fast ease-standard hover:bg-bg-subtle hover:text-fg"
          >
            <span>
              View all results for “{query}”
            </span>
            <kbd className="rounded border border-border-strong bg-bg-subtle px-1.5 py-0.5 text-label-md text-fg-subtle">
              ↵
            </kbd>
          </button>
        ) : null}
      </div>
    </div>
  );
}
