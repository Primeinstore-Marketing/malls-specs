'use client';

import type { Asset, BlockLine, MetadataField, SpecBlock } from '@data-model';
import { getSpecification, getAssets, getRelatedSpecifications, getRevisions } from '@/lib/catalogue';
import { fileUrl } from '@/lib/api';
import { formatFileSize } from '@/lib/fileSize';
import { useLiveData } from '@/lib/liveData';
import { getMallForSpec, MALL_GROUP_LABELS } from '@/lib/malls';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { EmptyState } from '@/components/ui/EmptyState';
import { LinkButton } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { SpecActionBar } from './SpecActionBar';
import { RelatedSpecs } from './RelatedSpecs';
import { RevisionHistory } from './RevisionHistory';
import { MediaPane } from './MediaPane';
import { RecentlyViewedTracker } from './RecentlyViewedTracker';
import { ArtworkGuideCard } from './ArtworkGuideCard';
import { DownloadButtons } from './DownloadButtons';

/**
 * The full specification page. A client component so admin edits (loaded
 * after the page) show up without a rebuild: it renders the built-in data
 * first — matching the static HTML — then the live version.
 *
 * Laid out for reading, most important first: what the screen is, the size
 * to make artwork at, pictures, requirements, then any other details and
 * files. Sections with nothing in them aren't shown.
 */

/** Width/height and the artwork fields are shown in the hero, not repeated in Details. */
const HERO_KEYS = new Set(['width', 'height', 'fileFormats', 'videoFormats', 'maxFileSize', 'duration']);

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

function SectionTitle({ children }: { children: string }) {
  return <h2 className="text-display-sm text-fg">{children}</h2>;
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
      <path d="m5 12 5 5L20 7" />
    </svg>
  );
}

function ContentSection({ block }: { block: SpecBlock }) {
  if (block.lines.length === 0) return null;
  return (
    <section id={block.anchorId || block.id} className="flex flex-col gap-3">
      <SectionTitle>{block.label}</SectionTitle>
      <ul className={`rounded-xl border border-border bg-bg-subtle p-2 ${block.twoColumn ? 'sm:columns-2 sm:gap-2' : ''}`}>
        {block.lines.map((line: BlockLine, index) =>
          line.kind === 'subheading' ? (
            <li key={index} className="break-inside-avoid px-3 pb-1 pt-3 text-label-md uppercase text-fg-subtle">
              {line.text}
            </li>
          ) : (
            <li key={index} className="flex break-inside-avoid items-start gap-3 rounded-lg px-3 py-2.5 text-body-md text-fg">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-subtle text-accent-fg">
                <CheckIcon />
              </span>
              <span>
                {line.reference ? <span className="mr-1 font-bold text-accent-fg">{line.reference}</span> : null}
                {line.text}
              </span>
            </li>
          ),
        )}
      </ul>
    </section>
  );
}

function DetailsSection({ fields }: { fields: readonly MetadataField[] }) {
  if (fields.length === 0) return null;
  return (
    <section id="details" className="flex flex-col gap-3">
      <SectionTitle>Details</SectionTitle>
      <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
        {fields.map((field) => (
          <div key={field.id} className="flex flex-col gap-0.5 bg-bg px-4 py-3">
            <dt className="text-label-md uppercase text-fg-subtle">{field.label}</dt>
            <dd className="text-body-lg font-medium text-fg">
              {field.value}
              {field.unit ? <span className="ml-1 text-body-sm text-fg-subtle">{field.unit}</span> : null}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function FileIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <path d="M14 3v5h5" />
    </svg>
  );
}

/** Attachments — supporting documents. Downloads have their own buttons up top. */
function FilesSection({ attachments }: { attachments: readonly Asset[] }) {
  const files = attachments.map((asset) => ({ asset, download: false }));
  if (files.length === 0) return null;
  return (
    <section id="files" className="flex flex-col gap-3">
      <SectionTitle>Attachments</SectionTitle>
      <ul className="flex flex-col gap-2">
        {files.map(({ asset, download }) => (
          <li key={asset.id}>
            <a
              href={fileUrl(asset.storageKey)}
              {...(download ? { download: asset.filename } : { target: '_blank', rel: 'noreferrer' })}
              className="group flex items-center gap-3 rounded-xl border border-border px-4 py-3 transition-colors duration-fast ease-standard hover:border-accent hover:bg-bg-subtle"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-subtle text-accent-fg">
                <FileIcon />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body-md font-medium text-fg">{asset.caption || asset.filename}</span>
                <span className="block truncate text-body-sm text-fg-subtle">
                  {download ? 'Download' : 'Attachment'} · {asset.filename} · {formatFileSize(asset.sizeBytes)}
                </span>
              </span>
              <span className="shrink-0 text-body-sm font-semibold text-accent-fg opacity-0 transition-opacity group-hover:opacity-100">
                {download ? 'Download ↓' : 'Open ↗'}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function SpecDetailView({ specId }: { specId: string }) {
  const { catalogue, status } = useLiveData();
  const spec = getSpecification(specId, catalogue);

  if (!spec) {
    return (
      <div className="mx-auto max-w-page px-4 py-16 sm:px-6">
        <EmptyState
          title={status === 'loading' || status === 'idle' ? 'Loading…' : 'Screen not found'}
          description={
            status === 'loading' || status === 'idle'
              ? undefined
              : 'It may have been removed. Find it again from the mall map.'
          }
          action={status === 'ready' || status === 'offline' ? <LinkButton href="/">All malls</LinkButton> : undefined}
        />
      </div>
    );
  }

  const mall = getMallForSpec(spec.id, catalogue);
  const media = getAssets(spec.mediaIds, catalogue);
  const downloads = getAssets(spec.downloadIds, catalogue);
  const attachments = getAssets(spec.attachmentIds, catalogue);
  const related = getRelatedSpecifications(spec, catalogue);
  const revisions = getRevisions(spec, catalogue);
  const details = spec.metadata
    .filter((field) => !HERO_KEYS.has(field.key) && field.value)
    .sort((a, b) => a.order - b.order);
  const blocks = [...spec.blocks].sort((a, b) => a.order - b.order);
  const updated = formatDate(spec.updatedAt);

  return (
    <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-10 px-4 pb-16 pt-6 sm:px-6 lg:px-10 lg:pt-8">
      <RecentlyViewedTracker specId={spec.id} />

      <header className="flex flex-col gap-5">
        <Breadcrumbs
          items={[
            { label: 'All malls', href: '/' },
            ...(mall ? [{ label: mall.name, href: `/?mall=${mall.id}` }] : []),
            { label: spec.title || 'Untitled specification' },
          ]}
        />

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 flex-col gap-3">
            {mall ? (
              <span className="text-label-md uppercase text-accent-fg">
                {mall.name}
                <span className="text-fg-subtle"> · {MALL_GROUP_LABELS[mall.group]}</span>
              </span>
            ) : null}
            <h1 className="text-display-xl text-fg">{spec.title || 'Untitled specification'}</h1>
            <div className="flex flex-wrap items-center gap-2 text-body-sm text-fg-subtle">
              <StatusBadge status={spec.status} />
              {spec.code ? (
                <span className="rounded-full border border-border px-2.5 py-0.5 font-mono text-[12px] text-fg-muted">{spec.code}</span>
              ) : null}
              {updated ? <span>Updated {updated}</span> : null}
            </div>
          </div>
          <SpecActionBar spec={spec} />
        </div>

        {spec.description ? <p className="max-w-[68ch] text-body-lg text-fg-muted">{spec.description}</p> : null}

        <DownloadButtons downloads={downloads} />
      </header>

      <ArtworkGuideCard spec={spec} />

      {media.length > 0 ? (
        <section id="pictures" className="flex flex-col gap-3">
          <SectionTitle>Pictures</SectionTitle>
          <div className="h-[300px] overflow-hidden rounded-2xl border border-border sm:h-[420px]">
            <MediaPane media={media} />
          </div>
        </section>
      ) : null}

      {blocks.map((block) => (
        <ContentSection key={block.id} block={block} />
      ))}

      <DetailsSection fields={details} />
      <FilesSection attachments={attachments} />
      <RelatedSpecs items={related} />
      {revisions.length > 0 ? <RevisionHistory revisions={revisions} /> : null}
    </div>
  );
}
