'use client';

import Link from 'next/link';
import { useAdminSession } from '@/components/auth/AdminSession';

/** Admins only: "Edit" beside a spec in a list, opening its page with the editor already open. */
export function AdminEditLink({ href, title }: { href: string; title: string }) {
  const { isAdmin } = useAdminSession();
  if (!isAdmin) return null;
  const to = `${href}${href.includes('?') ? '&' : '?'}edit=1`;
  return (
    <Link
      href={to}
      aria-label={`Edit ${title}`}
      className="flex h-8 shrink-0 items-center rounded-md px-3 text-body-sm font-semibold text-accent-fg hover:bg-bg-subtle"
    >
      Edit
    </Link>
  );
}
