import { STATUS_META } from '@data-model';
import type { SpecStatus } from '@data-model';

const TOKEN_KEY: Readonly<Record<SpecStatus, 'draft' | 'review' | 'published' | 'deprecated' | 'superseded'>> = {
  draft: 'draft',
  in_review: 'review',
  published: 'published',
  deprecated: 'deprecated',
  superseded: 'superseded',
};

const BG: Record<string, string> = {
  draft: 'bg-status-draft-bg text-status-draft-fg border-status-draft-border',
  review: 'bg-status-review-bg text-status-review-fg border-status-review-border',
  published: 'bg-status-published-bg text-status-published-fg border-status-published-border',
  deprecated: 'bg-status-deprecated-bg text-status-deprecated-fg border-status-deprecated-border',
  superseded: 'bg-status-superseded-bg text-status-superseded-fg border-status-superseded-border',
};

export function StatusBadge({ status }: { status: SpecStatus }) {
  const key = TOKEN_KEY[status];
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex h-[22px] items-center rounded-full border px-2.5 text-label-md ${BG[key]}`}
    >
      {meta.label}
    </span>
  );
}
