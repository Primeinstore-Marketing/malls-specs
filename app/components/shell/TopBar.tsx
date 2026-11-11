'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAdminSession } from '@/components/auth/AdminSession';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { useSearchPalette } from '@/components/search/SearchPaletteContext';
import { Notifications, PortalAccount } from '@/components/portal/Chrome';
import { usePortalUser } from '@/lib/portal/store';
import { withBasePath } from '@/lib/basePath';

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

export function TopBar({ onMenuToggle, compactBrand = false }: { onMenuToggle: () => void; compactBrand?: boolean }) {
  const { setOpen: setSearchOpen } = useSearchPalette();
  const { user } = usePortalUser();
  const { isAdmin } = useAdminSession();
  const pathname = usePathname();
  // Explorer, Insights and the workspace are for signed-in sales and clients only.
  const links = user
    ? [
        ['/explorer', 'Media Explorer'],
        ['/insights', 'Insights'],
        ['/portal', user.role === 'sales' ? 'Workspace' : 'My campaigns'],
      ]
    : [];

  return (
    <header
      className="print:hidden fixed inset-x-0 top-0 z-topbar flex h-[var(--topbar-height-sm)] items-stretch border-b border-border bg-bg/95 shadow-1 backdrop-blur md:h-[var(--topbar-height-md)] lg:h-[var(--topbar-height)]"
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-tooltip focus:rounded-md focus:bg-accent focus:px-3 focus:py-1.5 focus:text-fg-on-accent"
      >
        Skip to content
      </a>

      <div className={`flex shrink-0 items-center bg-brand-surface px-3 sm:px-4 ${compactBrand ? 'lg:px-6' : 'lg:w-[var(--sidebar-width)]'}`}>
        <button
          type="button"
          onClick={onMenuToggle}
          className="mr-2 -ml-1 flex h-8 w-8 items-center justify-center rounded-md text-brand-on-surface lg:hidden"
          aria-label="Toggle category navigation"
        >
          <MenuIcon />
        </button>
        <Link href="/" className="flex items-center" aria-label="Primedia Malls — home">
          <Image
            src={withBasePath('/brand/logo-white.svg')}
            alt="Primedia Malls"
            width={140}
            height={29}
            className="h-[22px] w-auto sm:h-[26px]"
            priority
          />
        </Link>
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-between gap-2 px-3 sm:gap-3 sm:px-4">
        {links.length ? (
          <nav aria-label="Pages" className="hidden shrink-0 items-center gap-1 md:flex">
            {links.map(([href, label]) => {
              const on = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={on ? 'page' : undefined}
                  className={`rounded-full px-3 py-1.5 text-body-sm font-medium transition-colors duration-fast ease-standard ${
                    on ? 'bg-accent-subtle text-accent' : 'text-fg-muted hover:bg-bg-subtle hover:text-fg'
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        ) : null}

        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          aria-label="Search specifications"
          className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center gap-2 rounded-md border border-border-strong bg-bg-subtle text-body-sm text-fg-subtle transition-colors duration-fast ease-standard hover:border-border-control hover:text-fg-muted sm:ml-0 sm:w-full sm:max-w-md sm:shrink sm:justify-start sm:px-3"
        >
          <SearchIcon />
          <span className="hidden flex-1 truncate text-left sm:inline">Search specifications…</span>
          <kbd className="hidden rounded border border-border-strong bg-bg px-1.5 py-0.5 text-label-md text-fg-subtle sm:inline">
            ⌘K
          </kbd>
        </button>

        <div className="flex shrink-0 items-center gap-2">
          <Notifications />
          <PortalAccount />
        </div>
      </div>
    </header>
  );
}
