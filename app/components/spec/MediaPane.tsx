import type { Asset } from '@data-model';

export function MediaPane({ media }: { media: readonly Asset[] }) {
  const primary = media[0];
  return (
    <div className="flex h-full flex-col bg-brand-surface">
      <div className="flex flex-1 items-center justify-center p-6">
        <span className="text-center text-body-sm text-brand-on-surface-muted">
          {primary?.alt || primary?.filename || 'No image uploaded'}
        </span>
      </div>
      <div className="border-t border-white/10 px-4 py-3 text-body-sm text-brand-on-surface-muted">
        {media.length} media item{media.length === 1 ? '' : 's'}
      </div>
    </div>
  );
}
