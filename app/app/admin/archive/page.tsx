import type { Metadata } from 'next';
import { getArchivedSpecificationSummaries } from '@/lib/catalogue';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';

export const metadata: Metadata = {
  title: 'Archive',
};

export default function AdminArchivePage() {
  const items = getArchivedSpecificationSummaries();

  return (
    <div className="flex flex-col gap-4">
      <p className="text-body-sm text-fg-subtle">{items.length} archived specifications</p>

      {items.length === 0 ? (
        <EmptyState
          title="No archived specifications yet"
          description="Specifications you archive from the Specs tab will appear here and can be restored or permanently deleted."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((spec) => (
            <li key={spec.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3">
              <span className="min-w-0 truncate text-body-sm text-fg">{spec.title || 'Untitled specification'}</span>
              <StatusBadge status={spec.status} />
              <div className="flex shrink-0 gap-1.5">
                <Button variant="secondary" className="h-7 px-2 text-body-sm" disabled title="Coming soon">
                  Restore
                </Button>
                <Button variant="secondary" className="h-7 px-2 text-body-sm" disabled title="Coming soon">
                  Delete forever
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
