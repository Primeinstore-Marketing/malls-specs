import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AdminTabs } from '@/components/admin/AdminTabs';

export const metadata: Metadata = {
  title: {
    default: 'Admin',
    template: '%s — Admin',
  },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-admin flex-col">
      <div className="flex items-center gap-2 px-4 pt-6 sm:px-6">
        <h1 className="text-display-sm text-fg">Site admin</h1>
        <span className="inline-flex h-5 items-center rounded-full border border-accent-border bg-accent-subtle px-2 text-label-md uppercase text-accent-fg">
          Admin
        </span>
      </div>

      <p className="mx-4 mt-2 max-w-prose text-body-sm text-fg-muted sm:mx-6">
        Edit malls, packages and photos, clients and photo rights. To change a screen’s size, artwork guide or pictures, open the screen and press Edit.
      </p>

      <div className="mt-4">
        <AdminTabs />
      </div>

      <div className="px-4 py-6 sm:px-6">{children}</div>
    </div>
  );
}
