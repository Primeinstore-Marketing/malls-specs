import { notFound } from 'next/navigation';
import { slugify } from '@data-model';
import {
  getCatalogue,
  getSpecification,
  getCategoryPath,
  getAssets,
  getRelatedSpecifications,
  getRevisions,
} from '@/lib/catalogue';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { SpecActionBar } from '@/components/spec/SpecActionBar';
import { AnchorRail } from '@/components/spec/AnchorRail';
import type { AnchorItem } from '@/components/spec/AnchorRail';
import { SpecHead } from '@/components/spec/SpecHead';
import { SpecBlockSection } from '@/components/spec/SpecBlockSection';
import { MetadataSection } from '@/components/spec/MetadataSection';
import { AttachmentsSection } from '@/components/spec/AttachmentsSection';
import { RelatedSpecs } from '@/components/spec/RelatedSpecs';
import { RevisionHistory } from '@/components/spec/RevisionHistory';
import { DownloadsBar } from '@/components/spec/DownloadsBar';
import { MediaPane } from '@/components/spec/MediaPane';
import { RecentlyViewedTracker } from '@/components/spec/RecentlyViewedTracker';

export function generateStaticParams() {
  const catalogue = getCatalogue();
  return Object.keys(catalogue.specifications).map((specId) => ({ specId }));
}

export default async function SpecPage({ params }: { params: Promise<{ specId: string }> }) {
  const { specId } = await params;
  const catalogue = getCatalogue();
  const spec = getSpecification(specId, catalogue);
  if (!spec) notFound();

  const { category, subGroup } = getCategoryPath(spec, catalogue);
  const media = getAssets(spec.mediaIds, catalogue);
  const downloads = getAssets(spec.downloadIds, catalogue);
  const attachments = getAssets(spec.attachmentIds, catalogue);
  const related = getRelatedSpecifications(spec, catalogue);
  const revisions = getRevisions(spec, catalogue);
  const tags = spec.tagIds.map((id) => catalogue.tags[id]).filter((tag) => tag != null);

  const backHref = subGroup && category ? `/category/${category.id}/${subGroup.id}` : category ? `/category/${category.id}` : '/browse';

  const anchors: AnchorItem[] = [
    ...spec.blocks.map((block) => ({ id: block.anchorId || slugify(block.label) || block.id, label: block.label })),
    { id: 'metadata', label: 'Metadata' },
    { id: 'attachments', label: 'Attachments' },
    ...(related.length > 0 ? [{ id: 'related', label: 'Related' }] : []),
    { id: 'history', label: 'History' },
  ];

  return (
    <div className="lg:grid lg:h-[calc(100vh-var(--topbar-height))] lg:grid-cols-[var(--panel-split)_1fr] xl:grid-cols-[var(--panel-split-xl)_1fr]">
      <RecentlyViewedTracker specId={spec.id} />
      <div className="flex flex-col lg:h-full lg:overflow-hidden">
        <div className="px-4 pt-4 sm:px-6">
          <Breadcrumbs
            items={[
              { label: 'Home', href: '/' },
              ...(category ? [{ label: category.name || 'Untitled category', href: `/category/${category.id}` }] : []),
              ...(subGroup && category
                ? [{ label: subGroup.name || 'Untitled group', href: `/category/${category.id}/${subGroup.id}` }]
                : []),
              { label: spec.title || 'Untitled specification' },
            ]}
          />
        </div>

        <SpecActionBar spec={spec} backHref={backHref} />
        <AnchorRail items={anchors} />

        <div className="flex flex-col px-4 sm:px-6 lg:flex-1 lg:overflow-y-auto">
          <SpecHead spec={spec} tags={tags} />
          {spec.blocks
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((block) => (
              <SpecBlockSection key={block.id} block={block} />
            ))}
          <MetadataSection fields={spec.metadata} />
          <AttachmentsSection attachments={attachments} />
          <RelatedSpecs items={related} />
          <RevisionHistory revisions={revisions} />
        </div>

        <DownloadsBar downloads={downloads} />
      </div>

      <div className="order-first h-[180px] sm:h-[220px] lg:order-last lg:h-full">
        <MediaPane media={media} />
      </div>
    </div>
  );
}
