import type { Metadata } from 'next';
import { getUsers } from '@/lib/catalogue';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';

export const metadata: Metadata = {
  title: 'Users',
};

export default function AdminUsersPage() {
  const users = getUsers();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-body-sm text-fg-subtle">{users.length} users</p>
        <Button variant="primary" disabled title="User management — coming soon">
          Invite user
        </Button>
      </div>

      {users.length === 0 ? (
        <EmptyState
          title="No users yet"
          description="Invite the first user once accounts are connected to a backend."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {users.map((user) => (
            <li key={user.id} className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-body-md font-medium text-fg">{user.name || 'Unnamed user'}</p>
                <p className="truncate text-body-sm text-fg-subtle">{user.email || '—'}</p>
              </div>
              <span className="shrink-0 text-label-md uppercase text-fg-subtle">{user.role}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
