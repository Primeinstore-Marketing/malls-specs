import type { Specification, Tag } from '@data-model';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { TagChip } from '@/components/ui/TagChip';

export function SpecHead({ spec, tags }: { spec: Specification; tags: readonly Tag[] }) {
  return (
    <div className="flex flex-col gap-3 py-5">
      <h1 className="text-display-lg text-fg">{spec.title || 'Untitled specification'}</h1>

      <div className="flex flex-wrap items-center gap-2 text-body-sm text-fg-subtle">
        <StatusBadge status={spec.status} />
        <span>v{spec.version}</span>
        <span aria-hidden="true">·</span>
        <span>Updated {spec.updatedAt ?? '—'}</span>
      </div>

      <p className="max-w-prose text-body-lg text-fg-muted">{spec.description || '—'}</p>

      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <TagChip key={tag.id} tag={tag} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
