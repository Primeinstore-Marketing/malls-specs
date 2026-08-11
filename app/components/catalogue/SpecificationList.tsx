import Link from 'next/link';
import type { SpecificationSummary } from '@data-model';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';

const COLUMNS = ['Specification', 'Code', 'Category', 'Status', 'Updated'] as const;

export function SpecificationList({
  items,
  emptyTitle = 'No specifications yet',
  emptyDescription = 'Specifications will appear here once they are added to the catalogue through the admin interface.',
  filtersApplied = false,
  categoryNames,
}: {
  items: readonly SpecificationSummary[];
  emptyTitle?: string;
  emptyDescription?: string;
  filtersApplied?: boolean;
  categoryNames?: Readonly<Record<string, string>>;
}) {
  return (
    <div
      id="specifications"
      className="scroll-mt-[var(--topbar-height-sm)] md:scroll-mt-[var(--topbar-height-md)] lg:scroll-mt-[var(--topbar-height)]"
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="text-body-sm text-fg-subtle">
          {items.length} specification{items.length === 1 ? '' : 's'} ·{' '}
          {filtersApplied ? 'filters applied' : 'no filters applied'}
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <div
          className="hidden bg-bg-muted px-4 py-2 text-label-md uppercase text-fg-subtle sm:grid"
          style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr' }}
        >
          {COLUMNS.map((col) => (
            <span key={col}>{col}</span>
          ))}
        </div>

        {items.length === 0 ? (
          <div className="p-2">
            <EmptyState
              title={emptyTitle}
              description={emptyDescription}
              action={
                <Button variant="secondary" disabled>
                  Sign in to add a specification
                </Button>
              }
            />
          </div>
        ) : (
          <ul>
            {items.map((spec) => (
              <li key={spec.id} className="border-t border-border first:border-t-0">
                <Link
                  href={`/spec/${spec.id}`}
                  className="grid items-center gap-2 px-4 py-3 text-body-sm text-fg transition-colors duration-fast ease-standard hover:bg-bg-subtle sm:gap-4"
                  style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr' }}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{spec.title || 'Untitled specification'}</span>
                    {spec.description ? (
                      <span className="block truncate text-body-sm text-fg-subtle">{spec.description}</span>
                    ) : null}
                  </span>
                  <span className="truncate text-mono-md text-fg-subtle">{spec.code || '—'}</span>
                  <span className="truncate text-fg-subtle">
                    {(spec.categoryId && categoryNames?.[spec.categoryId]) ?? '—'}
                  </span>
                  <StatusBadge status={spec.status} />
                  <span className="truncate text-fg-subtle">{spec.updatedAt ?? '—'}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
