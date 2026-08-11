import { notFound } from 'next/navigation';
import Image from 'next/image';
import {
  getCatalogue,
  getSpecification,
  getCategoryPath,
  getAssets,
  getRelatedSpecifications,
  getRevisions,
} from '@/lib/catalogue';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { TagChip } from '@/components/ui/TagChip';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { SpecBlockSection } from '@/components/spec/SpecBlockSection';
import { MetadataSection } from '@/components/spec/MetadataSection';
import { AttachmentsSection } from '@/components/spec/AttachmentsSection';
import { RelatedSpecs } from '@/components/spec/RelatedSpecs';
import { RevisionHistory } from '@/components/spec/RevisionHistory';
import { withBasePath } from '@/lib/basePath';

export function generateStaticParams() {
  const catalogue = getCatalogue();
  return Object.keys(catalogue.specifications).map((specId) => ({ specId }));
}

export default async function SpecPrintPage({ params }: { params: Promise<{ specId: string }> }) {
  const { specId } = await params;
  const catalogue = getCatalogue();
  const spec = getSpecification(specId, catalogue);
  if (!spec) notFound();

  const { category, subGroup } = getCategoryPath(spec, catalogue);
  const downloads = getAssets(spec.downloadIds, catalogue);
  const attachments = getAssets(spec.attachmentIds, catalogue);
  const related = getRelatedSpecifications(spec, catalogue);
  const revisions = getRevisions(spec, catalogue);
  const tags = spec.tagIds.map((id) => catalogue.tags[id]).filter((tag) => tag != null);

  return (
    <div className="mx-auto max-w-[720px] bg-bg px-8 py-10 text-fg print:px-0 print:py-0">
      <div className="mb-6 flex items-center justify-between border-b border-border pb-4">
        <Image
          src={withBasePath('/brand/logo-navy.svg')}
          alt="Primedia Malls"
          width={130}
          height={27}
          className="h-5 w-auto"
        />
        {category ? (
          <span className="text-body-sm text-fg-subtle">
            {category.name}
            {subGroup ? ` / ${subGroup.name}` : ''}
          </span>
        ) : null}
      </div>

      <h1 className="text-display-lg text-fg">{spec.title || 'Untitled specification'}</h1>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-body-sm text-fg-subtle">
        {spec.code ? (
          <span className="inline-flex h-[22px] items-center rounded-full border border-accent-border bg-accent-subtle px-2.5 text-mono-md text-accent-fg">
            {spec.code}
          </span>
        ) : null}
        <StatusBadge status={spec.status} />
        <span>v{spec.version}</span>
        <span aria-hidden="true">·</span>
        <span>Updated {spec.updatedAt ?? '—'}</span>
      </div>

      <p className="mt-4 max-w-prose text-body-lg text-fg-muted">{spec.description || '—'}</p>

      {tags.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <TagChip key={tag.id} tag={tag} />
          ))}
        </div>
      ) : null}

      <div className="mt-6 flex flex-col divide-y divide-border [&>section]:break-inside-avoid">
        {spec.blocks
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((block) => (
            <SpecBlockSection key={block.id} block={block} />
          ))}
        <MetadataSection fields={spec.metadata} />
        <AttachmentsSection attachments={attachments} />

        <section className="flex flex-col gap-2 py-5">
          <SectionLabel>Downloads</SectionLabel>
          {downloads.length === 0 ? (
            <p className="text-body-sm text-fg-subtle">No files available</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {downloads.map((asset) => (
                <li key={asset.id} className="text-body-sm text-fg">
                  {asset.filename || 'Untitled file'}
                  {asset.version ? ` — v${asset.version}` : ''}
                </li>
              ))}
            </ul>
          )}
        </section>

        <RelatedSpecs items={related} />
        <RevisionHistory revisions={revisions} />
      </div>

      <div className="mt-10 border-t border-border pt-4 text-body-sm text-fg-subtle">
        Primedia Malls — Media Specs · {spec.status} · v{spec.version} · Updated {spec.updatedAt ?? '—'}
      </div>
    </div>
  );
}
