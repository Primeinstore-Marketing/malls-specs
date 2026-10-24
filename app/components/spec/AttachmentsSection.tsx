import type { Asset } from '@data-model';
import { fileUrl } from '@/lib/api';
import { formatFileSize } from '@/lib/fileSize';
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
            <li key={asset.id}>
              <a
                href={fileUrl(asset.storageKey)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 rounded-md border border-border px-3 py-2 text-body-sm transition-colors duration-fast ease-standard hover:border-accent hover:bg-bg-subtle"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-fg">{asset.caption || asset.filename || 'Untitled file'}</span>
                  {asset.caption ? <span className="block truncate text-[11px] text-fg-subtle">{asset.filename}</span> : null}
                </span>
                <span className="shrink-0 font-mono text-[11px] text-fg-subtle">{formatFileSize(asset.sizeBytes)}</span>
                <span className="shrink-0 text-label-md uppercase text-fg-subtle">{asset.kind}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
