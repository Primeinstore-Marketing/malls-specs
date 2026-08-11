'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getCategoryTree } from '@/lib/catalogue';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { EmptyState } from '@/components/ui/EmptyState';

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden="true"
      className={`shrink-0 transition-transform duration-fast ease-standard ${open ? 'rotate-90' : ''}`}
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

export function Sidebar() {
  const tree = useMemo(() => getCategoryTree(), []);
  const pathname = usePathname();
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tree;
    return tree.filter(
      (node) =>
        node.category.name.toLowerCase().includes(q) ||
        node.subGroups.some((sub) => sub.name.toLowerCase().includes(q)),
    );
  }, [tree, query]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <nav
      aria-label="Category navigation"
      className="flex h-full w-full flex-col gap-5 overflow-y-auto px-3 py-4 no-scrollbar"
    >
      <label className="relative block">
        <span className="sr-only">Filter navigation</span>
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-on-surface-muted">
          <SearchIcon />
        </span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter navigation…"
          className="h-8 w-full rounded-md border border-white/10 bg-white/10 pl-8 pr-2 text-body-sm text-brand-on-surface placeholder:text-brand-on-surface-muted outline-none transition-colors duration-fast ease-standard focus:border-white/25 focus:bg-white/[0.15]"
        />
      </label>

      <div className="flex flex-col gap-2">
        <SectionLabel>Categories</SectionLabel>

        {filtered.length === 0 ? (
          <div className="px-1">
            <EmptyState
              compact
              title={query ? 'No matching categories' : 'No categories yet'}
              description={
                query
                  ? 'Try a different search term.'
                  : 'Categories will appear here once the catalogue is populated.'
              }
            />
          </div>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {filtered.map(({ category, subGroups }) => {
              const hasChildren = subGroups.length > 0;
              const isOpen = expanded.has(category.id);
              const href = `/category/${category.id}`;
              const isSelected = pathname === href;
              return (
                <li key={category.id}>
                  <div
                    className={`group relative flex items-center gap-1 rounded-md pr-1 transition-colors duration-fast ease-standard ${
                      isSelected ? 'bg-accent/25' : 'hover:bg-white/[0.06]'
                    }`}
                  >
                    {isSelected ? (
                      <span
                        aria-hidden="true"
                        className="absolute left-0 top-1/2 h-3/5 w-[2px] -translate-y-1/2 rounded-full bg-accent"
                      />
                    ) : null}
                    <Link
                      href={href}
                      aria-current={isSelected ? 'page' : undefined}
                      className={`flex flex-1 items-center gap-2 px-2.5 py-1.5 text-body-sm ${
                        isSelected
                          ? 'text-brand-on-surface'
                          : 'text-brand-on-surface-muted group-hover:text-brand-on-surface'
                      }`}
                    >
                      <span className="h-1 w-1 shrink-0 rounded-full bg-current opacity-50" aria-hidden="true" />
                      <span className="flex-1 truncate">{category.name || 'Untitled category'}</span>
                    </Link>
                    {hasChildren ? (
                      <button
                        type="button"
                        onClick={() => toggle(category.id)}
                        aria-expanded={isOpen}
                        aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${category.name || 'category'}`}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-brand-on-surface-muted hover:text-brand-on-surface"
                      >
                        <ChevronIcon open={isOpen} />
                      </button>
                    ) : null}
                  </div>
                  {hasChildren && isOpen ? (
                    <ul className="ml-4 flex flex-col gap-0.5 border-l border-white/10 pl-2">
                      {subGroups.map((sub) => {
                        const subHref = `/category/${category.id}/${sub.id}`;
                        const isSubSelected = pathname === subHref;
                        return (
                          <li key={sub.id}>
                            <Link
                              href={subHref}
                              aria-current={isSubSelected ? 'page' : undefined}
                              className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-body-sm transition-colors duration-fast ease-standard ${
                                isSubSelected
                                  ? 'bg-accent/25 text-brand-on-surface'
                                  : 'text-brand-on-surface-muted hover:bg-white/[0.06] hover:text-brand-on-surface'
                              }`}
                            >
                              <span className="h-[3px] w-[3px] shrink-0 rounded-full bg-current opacity-60" aria-hidden="true" />
                              <span className="truncate">{sub.name || 'Untitled group'}</span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </nav>
  );
}
