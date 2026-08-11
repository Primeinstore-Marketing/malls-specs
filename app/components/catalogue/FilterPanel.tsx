'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { STATUS_META, SPEC_STATUSES } from '@data-model';
import type { CategoryTreeNode } from '@/lib/catalogue';
import type { Tag } from '@data-model';

export function FilterPanel({ tree, tags }: { tree: readonly CategoryTreeNode[]; tags: readonly Tag[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const category = searchParams.get('category') ?? '';
  const subGroup = searchParams.get('subGroup') ?? '';
  const status = searchParams.get('status') ?? '';
  const tag = searchParams.get('tag') ?? '';

  const subGroups = tree.find((node) => node.category.id === category)?.subGroups ?? [];

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    if (key === 'category') next.delete('subGroup');
    router.push(next.toString() ? `${pathname}?${next.toString()}` : pathname);
  };

  const hasActiveFilter = Boolean(category || subGroup || status || tag);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-bg-subtle p-4 sm:flex-row sm:items-center">
      <span className="text-label-lg text-fg-subtle sm:mr-1">Filters</span>
      <div className="flex flex-1 flex-wrap gap-2">
        <select
          value={category}
          onChange={(event) => setParam('category', event.target.value)}
          disabled={tree.length === 0}
          aria-label="Category"
          className="h-8 min-w-[9rem] rounded-md border border-border-strong bg-bg px-2 text-body-sm text-fg disabled:cursor-not-allowed disabled:text-fg-subtle disabled:opacity-60"
        >
          <option value="">Category — all</option>
          {tree.map(({ category: c }) => (
            <option key={c.id} value={c.id}>
              {c.name || 'Untitled category'}
            </option>
          ))}
        </select>

        <select
          value={subGroup}
          onChange={(event) => setParam('subGroup', event.target.value)}
          disabled={subGroups.length === 0}
          aria-label="Sub-group"
          className="h-8 min-w-[9rem] rounded-md border border-border-strong bg-bg px-2 text-body-sm text-fg disabled:cursor-not-allowed disabled:text-fg-subtle disabled:opacity-60"
        >
          <option value="">Sub-group — all</option>
          {subGroups.map((sub) => (
            <option key={sub.id} value={sub.id}>
              {sub.name || 'Untitled group'}
            </option>
          ))}
        </select>

        <select
          value={status}
          onChange={(event) => setParam('status', event.target.value)}
          aria-label="Status"
          className="h-8 min-w-[9rem] rounded-md border border-border-strong bg-bg px-2 text-body-sm text-fg"
        >
          <option value="">Status — all</option>
          {SPEC_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_META[s].label}
            </option>
          ))}
        </select>

        <select
          value={tag}
          onChange={(event) => setParam('tag', event.target.value)}
          disabled={tags.length === 0}
          aria-label="Tags"
          className="h-8 min-w-[9rem] rounded-md border border-border-strong bg-bg px-2 text-body-sm text-fg disabled:cursor-not-allowed disabled:text-fg-subtle disabled:opacity-60"
        >
          <option value="">Tags — all</option>
          {tags.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {hasActiveFilter ? (
        <button
          type="button"
          onClick={() => router.push(pathname)}
          className="text-body-sm font-medium text-accent-fg transition-colors duration-fast ease-standard hover:text-accent-hover sm:ml-2"
        >
          Clear all
        </button>
      ) : (
        <p className="text-body-sm text-fg-subtle sm:ml-2">Filters activate once specifications are added.</p>
      )}
    </div>
  );
}
