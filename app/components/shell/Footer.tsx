'use client';

import Link from 'next/link';
import { useAdminSession } from '@/components/auth/AdminSession';
import { usePortalUser } from '@/lib/portal/store';

/**
 * Only links that go somewhere. The portal columns follow the top bar:
 * Explorer, Insights and the workspace show once someone is signed in.
 */
export function Footer() {
  const { isAdmin, signOut } = useAdminSession();
  const { user } = usePortalUser();

  const columns: { title: string; links: { label: string; href?: string; onClick?: () => void }[] }[] = [
    {
      title: 'Screen specs',
      links: [
        { label: 'Mall screen map', href: '/' },
        { label: 'Browse specs', href: '/browse' },
        { label: 'Search', href: '/search' },
        { label: 'Bookmarks', href: '/bookmarks' },
        { label: 'Recently viewed', href: '/recent' },
      ],
    },
    user
      ? {
          title: 'Sales',
          links: [
            { label: 'Workspace', href: '/portal' },
            { label: 'New proposal', href: '/portal/new' },
            { label: 'Site list from PIMS', href: '/portal/new?kind=sitelist' },
            { label: 'Client contacts', href: '/portal/clients' },
            { label: 'Media Explorer', href: '/explorer' },
            { label: 'Insights', href: '/insights' },
          ],
        }
      : { title: 'Sales', links: [{ label: 'Sign in', href: '/sign-in' }] },
    ...(user ? [] : [{ title: 'Clients', links: [{ label: 'Plan your campaign', href: '/request' }] }]),
    ...(user
      ? [
          {
            title: 'Account',
            links: [
              ...(isAdmin ? [{ label: 'Site admin', href: '/admin/malls' }] : []),
              { label: 'Your account', href: '/account' },
              { label: 'Sign out', onClick: () => void signOut() },
            ],
          },
        ]
      : []),
  ];

  const linkClass = 'text-left text-body-sm text-fg-muted transition-colors duration-fast ease-standard hover:text-fg';
  return (
    <footer className="print:hidden mt-16 border-t border-border bg-bg-subtle">
      <div className="mx-auto grid max-w-page grid-cols-2 gap-8 px-4 py-10 sm:px-6 md:grid-cols-3 lg:px-8">
        {columns.map((column) => (
          <div key={column.title} className="flex flex-col gap-3">
            <span className="text-label-md uppercase text-fg-subtle">{column.title}</span>
            <ul className="flex flex-col gap-2">
              {column.links.map((link) => (
                <li key={link.label}>
                  {link.href ? (
                    <Link href={link.href} className={linkClass}>
                      {link.label}
                    </Link>
                  ) : (
                    <button type="button" onClick={link.onClick} className={linkClass}>
                      {link.label}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto flex max-w-page flex-col gap-1 border-t border-border px-4 py-4 text-body-sm text-fg-subtle sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <span>Primedia Malls</span>
        <span>v0.1.0</span>
      </div>
    </footer>
  );
}
