import type { ReactNode } from 'react';

export function EmptyState({
  title,
  description,
  action,
  compact = false,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-lg border border-dashed border-border-strong bg-bg-subtle text-center ${
        compact ? 'gap-1 px-4 py-6' : 'gap-2 px-6 py-16'
      }`}
    >
      <p className={compact ? 'text-body-sm font-medium text-fg-muted' : 'text-display-sm text-fg'}>{title}</p>
      {description ? (
        <p className={`max-w-sm text-fg-subtle ${compact ? 'text-body-sm' : 'text-body-md'}`}>{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
