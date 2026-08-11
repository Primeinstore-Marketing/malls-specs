import type { Asset } from '@data-model';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { EmptyState } from '@/components/ui/EmptyState';
import { SCROLL_MARGIN } from './scrollMargin';

export function AttachmentsSection({ attachments }: { attachments: readonly Asset[] }) {
  return (
    <section id="attachments" className={`flex flex-col gap-2 py-5 ${SCROLL_MARGIN}`}>
      <SectionLabel>Attachments</SectionLabel>
      {attachments.length === 0 ? (
        <EmptyState compact title="No attachments" description="Images, video, PDF and CAD files." />
      ) : (
        <ul className="flex flex-col gap-2">
          {attachments.map((asset) => (
            <li
              key={asset.id}
              className="flex items-center gap-3 rounded-md border border-border px-3 py-2 text-body-sm"
            >
              <span className="flex-1 truncate text-fg">{asset.filename || 'Untitled file'}</span>
              <span className="text-label-md uppercase text-fg-subtle">{asset.kind}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
