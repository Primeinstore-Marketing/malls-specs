import Link from 'next/link';
import type { SpecificationSummary } from '@data-model';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { SCROLL_MARGIN } from './scrollMargin';

export function RelatedSpecs({ items }: { items: readonly SpecificationSummary[] }) {
  if (items.length === 0) return null;
  return (
    <section id="related" className={`flex flex-col gap-2 py-5 ${SCROLL_MARGIN}`}>
      <SectionLabel>Related specifications</SectionLabel>
      <ul className="grid gap-2 sm:grid-cols-2">
        {items.map((spec) => (
          <li key={spec.id}>
            <Link
              href={`/spec/${spec.id}`}
              className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2.5 text-body-sm transition-colors duration-fast ease-standard hover:border-border-strong hover:bg-bg-subtle"
            >
              <span className="truncate text-fg">{spec.title || 'Untitled specification'}</span>
              <StatusBadge status={spec.status} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
