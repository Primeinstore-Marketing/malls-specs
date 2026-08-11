import type { Metadata } from 'next';
import Link from 'next/link';
import { getCatalogue, getSpecificationSummaries } from '@/lib/catalogue';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';

export const metadata: Metadata = {
  title: 'Specs',
};

const COLUMNS = ['Name', 'Category', 'Status', ''] as const;

export default function AdminSpecsPage() {
  const catalogue = getCatalogue();
  const items = getSpecificationSummaries(catalogue);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-body-sm text-fg-subtle">{items.length} specifications</p>
        <Button variant="primary" disabled title="Specification editor — coming soon">
          Add spec
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <div
          className="hidden bg-bg-muted px-4 py-2 text-label-md uppercase text-fg-subtle sm:grid"
          style={{ gridTemplateColumns: '2fr 1fr 1fr 170px' }}
        >
          {COLUMNS.map((col) => (
            <span key={col}>{col}</span>
          ))}
        </div>

        {items.length === 0 ? (
          <div className="p-2">
            <EmptyState
              title="No specifications yet"
              description="Add the first specification once the editor is connected, or replace the shipped catalogue file directly."
            />
          </div>
        ) : (
          <ul>
            {items.map((spec) => {
              const category = spec.categoryId ? catalogue.categories[spec.categoryId] : null;
              return (
                <li key={spec.id} className="border-t border-border first:border-t-0">
                  <div
                    className="grid items-center gap-2 px-4 py-3 text-body-sm sm:gap-4"
                    style={{ gridTemplateColumns: '2fr 1fr 1fr 170px' }}
                  >
                    <Link href={`/spec/${spec.id}`} className="min-w-0 truncate font-medium text-fg hover:underline">
                      {spec.title || 'Untitled specification'}
                    </Link>
                    <span className="truncate text-fg-subtle">{category?.name || '—'}</span>
                    <StatusBadge status={spec.status} />
                    <div className="flex justify-end gap-1.5">
                      <Button variant="secondary" className="h-7 px-2 text-body-sm" disabled title="Coming soon">
                        Edit
                      </Button>
                      <Button variant="secondary" className="h-7 px-2 text-body-sm" disabled title="Coming soon">
                        Archive
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
