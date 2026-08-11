'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { label: 'Specs', href: '/admin/specs' },
  { label: 'Categories', href: '/admin/categories' },
  { label: 'Users', href: '/admin/users' },
  { label: 'Archive', href: '/admin/archive' },
  { label: 'Settings', href: '/admin/settings' },
] as const;

export function AdminTabs() {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin sections" className="flex gap-1 overflow-x-auto border-b border-border px-4 no-scrollbar sm:px-6">
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={`shrink-0 border-b-2 px-3 py-3 text-body-sm font-medium transition-colors duration-fast ease-standard ${
              active ? 'border-accent text-fg' : 'border-transparent text-fg-muted hover:text-fg'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
