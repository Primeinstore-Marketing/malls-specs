import type { Metadata } from 'next';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { Button } from '@/components/ui/Button';

export const metadata: Metadata = {
  title: 'Settings',
};

export default function AdminSettingsPage() {
  return (
    <div className="flex max-w-prose flex-col gap-8">
      <section className="flex flex-col gap-3">
        <SectionLabel>Integrations</SectionLabel>
        <p className="text-body-sm text-fg-muted">
          Where uploaded media, die lines and other files are stored. The reference system stored a GitHub personal
          access token in the browser to commit files directly to a repository — flagged in Phase 1 as a real
          security exposure and deliberately not reproduced here. This needs its own upload service before it can be
          wired up.
        </p>
        <div className="flex flex-col gap-1.5">
          <span className="text-label-md uppercase text-fg-subtle">Storage provider</span>
          <select disabled className="h-9 w-64 rounded-md border border-border-strong bg-bg-subtle px-3 text-body-sm text-fg-subtle">
            <option>Not configured</option>
          </select>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <SectionLabel>Storage</SectionLabel>
        <p className="text-body-sm text-fg-muted">Media, downloads and attachments currently have no configured backend.</p>
      </section>

      <section className="flex flex-col gap-3">
        <SectionLabel>Appearance</SectionLabel>
        <p className="text-body-sm text-fg-muted">Theme and branding are set in the design tokens, not here, for now.</p>
      </section>

      <Button variant="secondary" disabled className="w-fit" title="Coming soon">
        Save settings
      </Button>
    </div>
  );
}
