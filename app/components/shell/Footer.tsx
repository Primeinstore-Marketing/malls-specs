'use client';

import Link from 'next/link';
import { useAuthDialog } from '@/components/auth/AuthDialogContext';

interface FooterLink {
  readonly label: string;
  readonly href?: string;
}

const COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: 'Platform',
    links: [
      { label: 'Browse', href: '/browse' },
      { label: 'Search', href: '/search' },
      { label: 'Bookmarks', href: '/bookmarks' },
      { label: 'Recently viewed', href: '/recent' },
    ],
  },
  {
    title: 'Resources',
    links: [{ label: 'Documentation' }, { label: 'Component inventory' }, { label: 'Data model' }],
  },
  {
    title: 'Admin',
    links: [{ label: 'Sign in' }, { label: 'Management sheet', href: '/admin' }, { label: 'Settings' }],
  },
  { title: 'Legal', links: [{ label: 'Terms' }, { label: 'Privacy' }] },
];

export function Footer() {
  const { setOpen: setAuthOpen } = useAuthDialog();

  return (
    <footer className="mt-16 border-t border-border bg-bg-subtle">
      <div className="mx-auto grid max-w-page grid-cols-2 gap-8 px-4 py-10 sm:px-6 md:grid-cols-4 lg:px-8">
        {COLUMNS.map((column) => (
          <div key={column.title} className="flex flex-col gap-3">
            <span className="text-label-md uppercase text-fg-subtle">{column.title}</span>
            <ul className="flex flex-col gap-2">
              {column.links.map((link) => (
                <li key={link.label}>
                  {link.href ? (
                    <Link
                      href={link.href}
                      className="text-body-sm text-fg-muted transition-colors duration-fast ease-standard hover:text-fg"
                    >
                      {link.label}
                    </Link>
                  ) : link.label === 'Sign in' ? (
                    <button
                      type="button"
                      onClick={() => setAuthOpen(true)}
                      className="text-body-sm text-fg-muted transition-colors duration-fast ease-standard hover:text-fg"
                    >
                      {link.label}
                    </button>
                  ) : (
                    <span className="cursor-default text-body-sm text-fg-muted">{link.label}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto flex max-w-page flex-col gap-1 border-t border-border px-4 py-4 text-body-sm text-fg-subtle sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <span>Primedia Malls — Media Specs</span>
        <span>v0.1.0</span>
      </div>
    </footer>
  );
}
