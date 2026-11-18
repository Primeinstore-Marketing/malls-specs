import type { ReactNode } from 'react';

export function EmptyState({
  title,
  description,
  action,
  compact = false,
  page = false,
}: {
  title: string;
  /** The whole page (e.g. "not found"): the title is the page's main heading. */
  page?: boolean;
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
      {page ? <h1 className="text-display-sm text-fg">{title}</h1> : <p className={compact ? 'text-body-sm font-medium text-fg-muted' : 'text-display-sm text-fg'}>{title}</p>}
      {description ? (
        <p className={`max-w-sm text-fg-subtle ${compact ? 'text-body-sm' : 'text-body-md'}`}>{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
