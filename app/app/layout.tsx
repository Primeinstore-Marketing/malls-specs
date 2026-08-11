import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { AppShell } from '@/components/shell/AppShell';
import './globals.css';

// Self-hosted rather than next/font/google: the Google Fonts URLs bundled
// with this Next.js version's font manifest are stale for these two
// families (404 on Google's own CDN at build time) — see project memory.
// Both files are variable fonts served by Google; declaring several
// `weight`-pinned entries against the same physical file is exactly what
// Google's own generated @font-face CSS does, and renders each weight
// correctly since the browser samples the variable font's weight axis.
const display = localFont({
  src: [
    { path: '../fonts/wix-madefor-display.woff2', weight: '600', style: 'normal' },
    { path: '../fonts/wix-madefor-display.woff2', weight: '700', style: 'normal' },
    { path: '../fonts/wix-madefor-display.woff2', weight: '800', style: 'normal' },
  ],
  variable: '--font-display-loaded',
  display: 'swap',
  fallback: ['Poppins', 'system-ui', 'sans-serif'],
});

const body = localFont({
  src: [
    { path: '../fonts/montserrat.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/montserrat.woff2', weight: '500', style: 'normal' },
    { path: '../fonts/montserrat.woff2', weight: '600', style: 'normal' },
    { path: '../fonts/montserrat.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-body-loaded',
  display: 'swap',
  fallback: ['Lato', 'system-ui', 'sans-serif'],
});

export const metadata: Metadata = {
  title: {
    default: 'Media Specs — Primedia Malls',
    template: '%s — Primedia Malls',
  },
  description:
    'Technical specifications, design guidelines and artwork requirements for every media format across the Primedia Malls network.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${display.variable} ${body.variable}`}>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
