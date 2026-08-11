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
        <h1 className="text-display-sm text-fg">Manage specifications</h1>
        <span className="inline-flex h-5 items-center rounded-full border border-accent-border bg-accent-subtle px-2 text-label-md uppercase text-accent-fg">
          Admin
        </span>
      </div>

      <div className="mx-4 mt-4 rounded-md border border-warning-border bg-warning-bg px-3 py-2 text-body-sm text-warning-fg sm:mx-6">
        Preview mode — this interface isn&apos;t connected to a backend yet, so sign-in, saves and uploads don&apos;t
        persist anywhere. It reads the live catalogue, but edits made here won&apos;t be saved.
      </div>

      <div className="mt-4">
        <AdminTabs />
      </div>

      <div className="px-4 py-6 sm:px-6">{children}</div>
    </div>
  );
}
