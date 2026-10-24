import type { Asset } from '@data-model';
import { fileUrl } from '@/lib/api';
import { formatFileSize } from '@/lib/fileSize';

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
      <path d="M12 3v12m0 0-5-5m5 5 5-5" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}

function kindOf(asset: Asset): string {
  const extension = asset.filename.split('.').pop()?.toUpperCase() ?? '';
  return extension || asset.kind.toUpperCase();
}

/**
 * A screen's downloads — the spec sheet PDF first, then templates — as
 * proper buttons. The PDF is the primary action; everything else is
 * secondary.
 */
export function DownloadButtons({ downloads, compact = false }: { downloads: readonly Asset[]; compact?: boolean }) {
  if (downloads.length === 0) return null;
  const ordered = [...downloads].sort(
    (a, b) => Number(b.mimeType === 'application/pdf') - Number(a.mimeType === 'application/pdf'),
  );

  return (
    <div className={`flex flex-wrap gap-2 ${compact ? 'flex-col' : ''}`}>
      {ordered.map((asset, index) => {
        const primary = index === 0;
        return (
          <a
            key={asset.id}
            href={fileUrl(asset.storageKey)}
            download={asset.filename}
            className={`group inline-flex items-center gap-3 rounded-xl border px-4 py-2.5 transition-colors duration-fast ease-standard ${
              primary
                ? 'border-accent bg-accent text-fg-on-accent hover:bg-accent-hover'
                : 'border-border-strong bg-bg text-fg hover:border-accent hover:bg-bg-subtle'
            } ${compact ? 'w-full' : ''}`}
          >
            <DownloadIcon />
            <span className="flex min-w-0 flex-col text-left">
              <span className="truncate text-body-sm font-semibold">{asset.caption || asset.filename}</span>
              <span className={`text-[11px] ${primary ? 'opacity-80' : 'text-fg-subtle'}`}>
                {kindOf(asset)} · {formatFileSize(asset.sizeBytes)}
              </span>
            </span>
          </a>
        );
      })}
    </div>
  );
}
