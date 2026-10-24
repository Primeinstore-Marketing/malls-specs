'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { useSearchPalette } from '@/components/search/SearchPaletteContext';
import { AccountMenu } from '@/components/auth/AccountMenu';
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

export function TopBar({ onMenuToggle }: { onMenuToggle: () => void }) {
  const { setOpen: setSearchOpen } = useSearchPalette();

  return (
    <header
      className="fixed inset-x-0 top-0 z-topbar flex h-[var(--topbar-height-sm)] items-stretch border-b border-border bg-bg/95 shadow-1 backdrop-blur md:h-[var(--topbar-height-md)] lg:h-[var(--topbar-height)]"
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-tooltip focus:rounded-md focus:bg-accent focus:px-3 focus:py-1.5 focus:text-fg-on-accent"
      >
        Skip to content
      </a>

      <div className="flex w-[var(--sidebar-width-md)] shrink-0 items-center bg-brand-surface px-4 lg:w-[var(--sidebar-width)]">
        <button
          type="button"
          onClick={onMenuToggle}
          className="mr-2 -ml-1 flex h-8 w-8 items-center justify-center rounded-md text-brand-on-surface md:hidden"
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
            className="h-[26px] w-auto"
            priority
          />
        </Link>
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-between gap-3 px-4">
        <Link href="/" className="hidden shrink-0 text-body-sm font-medium text-fg sm:block">
          Home
        </Link>

        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="flex h-8 w-full max-w-md items-center gap-2 rounded-md border border-border-strong bg-bg-subtle px-3 text-body-sm text-fg-subtle transition-colors duration-fast ease-standard hover:border-border-control hover:text-fg-muted"
        >
          <SearchIcon />
          <span className="flex-1 truncate text-left">Search specifications…</span>
          <kbd className="hidden rounded border border-border-strong bg-bg px-1.5 py-0.5 text-label-md text-fg-subtle sm:inline">
            ⌘K
          </kbd>
        </button>

        <div className="flex shrink-0 items-center gap-2">
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
