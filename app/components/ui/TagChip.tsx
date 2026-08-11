import type { Tag, TagTone } from '@data-model';

const TONE_CLASSES: Record<TagTone, string> = {
  neutral: 'bg-neutral-bg text-neutral-fg border-neutral-border',
  info: 'bg-info-bg text-info-fg border-info-border',
  success: 'bg-success-bg text-success-fg border-success-border',
  warning: 'bg-warning-bg text-warning-fg border-warning-border',
  danger: 'bg-danger-bg text-danger-fg border-danger-border',
};

export function TagChip({ tag }: { tag: Tag }) {
  return (
    <span className={`inline-flex h-6 items-center rounded-full border px-2.5 text-label-md ${TONE_CLASSES[tag.tone]}`}>
      {tag.name}
    </span>
  );
}
