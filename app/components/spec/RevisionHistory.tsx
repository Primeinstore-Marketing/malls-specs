import type { Revision } from '@data-model';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { SCROLL_MARGIN } from './scrollMargin';

export function RevisionHistory({ revisions }: { revisions: readonly Revision[] }) {
  return (
    <section id="history" className={`flex flex-col gap-2 py-5 ${SCROLL_MARGIN}`}>
      <SectionLabel>Revision history</SectionLabel>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[480px] text-left text-body-sm">
          <thead>
            <tr className="bg-bg-muted text-label-md uppercase text-fg-subtle">
              <th scope="col" className="px-3 py-2 font-normal">
                Version
              </th>
              <th scope="col" className="px-3 py-2 font-normal">
                Date
              </th>
              <th scope="col" className="px-3 py-2 font-normal">
                Author
              </th>
              <th scope="col" className="px-3 py-2 font-normal">
                Summary
              </th>
            </tr>
          </thead>
          <tbody>
            {revisions.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-fg-subtle">
                  No revisions recorded
                </td>
              </tr>
            ) : (
              revisions.map((revision) => (
                <tr key={revision.id} className="border-t border-border">
                  <td className="px-3 py-2 text-fg">v{revision.version}</td>
                  <td className="px-3 py-2 text-fg-subtle">{revision.createdAt ?? '—'}</td>
                  <td className="px-3 py-2 text-fg-subtle">{revision.createdBy ?? '—'}</td>
                  <td className="px-3 py-2 text-fg">{revision.summary || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
