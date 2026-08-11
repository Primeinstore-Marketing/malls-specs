'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { Footer } from './Footer';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { SearchPaletteProvider } from '@/components/search/SearchPaletteContext';
import { CommandPalette } from '@/components/search/CommandPalette';
import { AuthDialogProvider } from '@/components/auth/AuthDialogContext';
import { SignInDialog } from '@/components/auth/SignInDialog';
import { CollectionsProvider } from '@/components/collections/CollectionsContext';

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const pathname = usePathname();

  useEffect(() => {
    if (isDesktop) setMobileNavOpen(false);
  }, [isDesktop]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileNavOpen && !isDesktop ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileNavOpen, isDesktop]);

  // The print view is a bare, standalone document — no chrome, no palette —
  // matching the Phase 1 route table ("Print view | Bare | Public").
  if (pathname.endsWith('/print')) {
    return <>{children}</>;
  }

  const drawerInert = !isDesktop && !mobileNavOpen;
  // The specification detail view is a dedicated one-viewport app shell, and
  // the home page is now a pure hero (matching the reference app) — neither
  // shows a footer.
  const showFooter = pathname !== '/' && !pathname.startsWith('/spec/');

  return (
    <SearchPaletteProvider>
      <AuthDialogProvider>
        <CollectionsProvider>
          <div className="min-h-screen">
            <TopBar onMenuToggle={() => setMobileNavOpen((open) => !open)} />

            {!isDesktop && mobileNavOpen ? (
              <button
                type="button"
                aria-label="Close navigation"
                onClick={() => setMobileNavOpen(false)}
                className="fixed inset-0 z-scrim bg-fg/40"
              />
            ) : null}

            <aside
              aria-label="Category navigation"
              inert={drawerInert}
              className={`fixed bottom-0 left-0 top-[var(--topbar-height-sm)] z-drawer w-[var(--sidebar-width-md)] bg-brand-surface shadow-3 transition-transform duration-slow ease-expressive md:top-[var(--topbar-height-md)] md:z-sticky md:translate-x-0 md:border-r md:border-border-strong md:shadow-none lg:top-[var(--topbar-height)] lg:w-[var(--sidebar-width)] ${
                mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
              }`}
            >
              <Sidebar />
            </aside>

            <main
              id="main-content"
              className="flex min-h-screen flex-col pt-[var(--topbar-height-sm)] md:ml-[var(--sidebar-width-md)] md:pt-[var(--topbar-height-md)] lg:ml-[var(--sidebar-width)] lg:pt-[var(--topbar-height)]"
            >
              <div className="flex-1">{children}</div>
              {showFooter ? <Footer /> : null}
            </main>

            <CommandPalette />
            <SignInDialog />
          </div>
        </CollectionsProvider>
      </AuthDialogProvider>
    </SearchPaletteProvider>
  );
}
