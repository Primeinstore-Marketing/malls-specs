import type { Asset } from '@data-model';

export function DownloadsBar({ downloads }: { downloads: readonly Asset[] }) {
  return (
    <div className="flex shrink-0 flex-col gap-2 border-t border-border bg-bg-subtle px-4 py-4 sm:px-6">
      <p className="text-body-sm font-bold text-fg">Downloads</p>
      {downloads.length === 0 ? (
        <p className="text-body-sm text-fg-subtle">No files available</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {downloads.map((asset) => (
            <li
              key={asset.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border bg-bg px-3 py-2 text-body-sm"
            >
              <span className="truncate text-fg">{asset.filename || 'Untitled file'}</span>
              <span className="text-label-md uppercase text-fg-subtle">
                {asset.version ? `v${asset.version}` : asset.kind}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
