import Link from 'next/link';
import type { SpecificationSummary } from '@data-model';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';

const COLUMNS = ['Specification', 'Code', 'Category', 'Status', 'Updated'] as const;

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function SpecificationList({
  items,
  hrefFor = (id) => `/spec/${id}`,
  emptyTitle = 'No specifications yet',
  emptyDescription = 'Specifications will appear here once they are added to the catalogue through the admin interface.',
  filtersApplied = false,
  categoryNames,
}: {
  items: readonly SpecificationSummary[];
  /** Where each row links. Client views pass `specHref` so admin-added screens reach their page. */
  hrefFor?: (specId: string) => string;
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
        <div className="hidden grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 bg-bg-muted px-4 py-2 text-label-md uppercase text-fg-subtle md:grid">
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
                {/* Phones and tablets: name, with network and date beneath and the status
                    on the right. From md up: the full five-column table. */}
                <Link
                  href={hrefFor(spec.id)}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-body-sm text-fg transition-colors duration-fast ease-standard hover:bg-bg-subtle md:grid-cols-[2fr_1fr_1fr_1fr_1fr] md:gap-4"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{spec.title || 'Untitled specification'}</span>
                    {spec.description ? (
                      <span className="hidden truncate text-body-sm text-fg-subtle md:block">{spec.description}</span>
                    ) : null}
                    <span className="block truncate text-body-sm text-fg-subtle md:hidden">
                      {[(spec.categoryId && categoryNames?.[spec.categoryId]) || null, formatDate(spec.updatedAt)]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                  <span className="hidden truncate text-mono-md text-fg-subtle md:block">{spec.code || '—'}</span>
                  <span className="hidden truncate text-fg-subtle md:block">
                    {(spec.categoryId && categoryNames?.[spec.categoryId]) ?? '—'}
                  </span>
                  <StatusBadge status={spec.status} />
                  <span className="hidden truncate text-fg-subtle md:block">{formatDate(spec.updatedAt) ?? '—'}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
