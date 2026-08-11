import type { MetadataField } from '@data-model';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { SCROLL_MARGIN } from './scrollMargin';

function formatValue(field: MetadataField): string {
  if (field.value === null || field.value === '') return '—';
  return field.unit ? `${field.value} ${field.unit}` : field.value;
}

export function MetadataSection({ fields }: { fields: readonly MetadataField[] }) {
  return (
    <section id="metadata" className={`flex flex-col gap-2 py-5 ${SCROLL_MARGIN}`}>
      <SectionLabel>Metadata</SectionLabel>
      {fields.length === 0 ? (
        <p className="text-body-sm text-fg-subtle">—</p>
      ) : (
        <dl className="grid grid-cols-1 gap-x-8 gap-y-1.5 rounded-lg border border-border bg-bg-subtle p-4 sm:grid-cols-2">
          {fields.map((field) => (
            <div key={field.id} className="flex items-baseline justify-between gap-3 text-body-sm">
              <dt className="text-fg-subtle">{field.label}</dt>
              <dd className="text-fg">{formatValue(field)}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
