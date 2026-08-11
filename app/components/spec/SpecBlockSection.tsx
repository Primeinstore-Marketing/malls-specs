import type { SpecBlock, BlockLine } from '@data-model';
import { slugify } from '@data-model';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { SCROLL_MARGIN } from './scrollMargin';

function Line({ line }: { line: BlockLine }) {
  if (line.kind === 'subheading') {
    return <p className="pt-2 text-body-sm font-bold text-fg">{line.text}</p>;
  }
  return (
    <p className="flex items-baseline gap-2.5 py-0.5 text-body-sm text-fg">
      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent/50" aria-hidden="true" />
      <span>
        {line.reference ? <span className="mr-1 font-bold text-accent">{line.reference}</span> : null}
        {line.text}
      </span>
    </p>
  );
}

export function SpecBlockSection({ block }: { block: SpecBlock }) {
  const anchorId = block.anchorId || slugify(block.label) || block.id;
  return (
    <section id={anchorId} className={`flex flex-col gap-2 py-5 ${SCROLL_MARGIN}`}>
      <SectionLabel>{block.label}</SectionLabel>
      {block.lines.length === 0 ? (
        <p className="text-body-sm text-fg-subtle">—</p>
      ) : (
        <div className={block.twoColumn ? 'sm:columns-2 sm:gap-x-8' : 'flex flex-col'}>
          {block.lines.map((line, index) => (
            <div key={index} className="break-inside-avoid">
              <Line line={line} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
