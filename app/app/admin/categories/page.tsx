import type { Metadata } from 'next';
import { getCategoryTree } from '@/lib/catalogue';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';

export const metadata: Metadata = {
  title: 'Categories',
};

export default function AdminCategoriesPage() {
  const tree = getCategoryTree();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-body-sm text-fg-subtle">{tree.length} categories</p>
        <Button variant="primary" disabled title="Category manager — coming soon">
          Add category
        </Button>
      </div>

      {tree.length === 0 ? (
        <EmptyState
          title="No categories yet"
          description="Create the first category once the manager is connected, or replace the shipped catalogue file directly."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {tree.map(({ category, subGroups }) => (
            <li key={category.id} className="rounded-lg border border-border">
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-body-md font-medium text-fg">{category.name || 'Untitled category'}</span>
                <Button variant="secondary" className="h-7 px-2 text-body-sm" disabled title="Coming soon">
                  Edit
                </Button>
              </div>
              {subGroups.length > 0 ? (
                <ul className="flex flex-col gap-1 border-t border-border px-4 py-2">
                  {subGroups.map((sub) => (
                    <li key={sub.id} className="flex items-center justify-between py-1 text-body-sm text-fg-muted">
                      <span>{sub.name || 'Untitled group'}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
