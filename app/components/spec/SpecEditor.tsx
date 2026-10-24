'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { asBlockId, asMetadataFieldId, asTagId, emptyBlock, emptyMetadataField, slugify } from '@data-model';
import type { Asset, AssetRole, BlockLine, MetadataField, SpecBlock, Specification, SpecStatus, Tag } from '@data-model';
import { api, ApiError, fileUrl } from '@/lib/api';
import { getArtworkGuide, matchesScreen, suggestedMaxFileSizeMb } from '@/lib/artwork';
import { formatFileSize } from '@/lib/fileSize';
import { refreshLiveData } from '@/lib/liveData';
import { getScreenSize } from '@/lib/malls';
import { Button } from '@/components/ui/Button';
import { Portal } from '@/components/ui/Portal';
import { useAdminSession } from '@/components/auth/AdminSession';

/**
 * The admin's full editor for one spec. Text changes are kept as a draft
 * until "Save"; uploads and file captions save immediately (they're
 * separate records), which the Pictures and Files tabs say.
 */

type Tab = 'details' | 'artwork' | 'specs' | 'content' | 'pictures' | 'files';

const TABS: readonly { id: Tab; label: string }[] = [
  { id: 'details', label: 'Details' },
  { id: 'artwork', label: 'Artwork' },
  { id: 'specs', label: 'Specifications' },
  { id: 'content', label: 'Content' },
  { id: 'pictures', label: 'Pictures' },
  { id: 'files', label: 'Files' },
];

/** Metadata keys edited on the Artwork tab rather than the Specifications tab. */
const ARTWORK_KEYS = ['fileFormats', 'videoFormats', 'maxFileSize', 'duration'] as const;
type ArtworkKey = (typeof ARTWORK_KEYS)[number];
const ARTWORK_LABELS: Readonly<Record<ArtworkKey, string>> = {
  fileFormats: 'Still formats',
  videoFormats: 'Motion formats',
  maxFileSize: 'Max file size',
  duration: 'Duration',
};

const STATUSES: readonly { value: SpecStatus; label: string }[] = [
  { value: 'published', label: 'Published — visible to everyone' },
  { value: 'draft', label: 'Draft — work in progress' },
];

const input =
  'h-9 w-full rounded-md border border-border-strong bg-bg px-3 text-body-sm text-fg outline-none transition-colors duration-fast ease-standard placeholder:text-fg-subtle focus-visible:border-border-focus';
const textarea =
  'w-full rounded-md border border-border-strong bg-bg px-3 py-2 text-body-sm text-fg outline-none placeholder:text-fg-subtle focus-visible:border-border-focus';
const label = 'text-label-md uppercase text-fg-subtle';
const iconButton =
  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border-strong text-fg-muted hover:border-border-control hover:text-fg disabled:opacity-30';

function linesToText(lines: readonly BlockLine[]): string {
  return lines.map((line) => (line.kind === 'subheading' ? `# ${line.text}` : line.text)).join('\n');
}

function textToLines(text: string): BlockLine[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) =>
      line.startsWith('# ')
        ? { kind: 'subheading' as const, text: line.slice(2).trim(), reference: null }
        : { kind: 'item' as const, text: line, reference: null },
    );
}

function move<T>(items: readonly T[], index: number, delta: -1 | 1): T[] {
  const next = [...items];
  const target = index + delta;
  if (target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

// ── uploads (Pictures + Files tabs) ───────────────────────────────────

function UploadButton({
  accept,
  multiple,
  onFiles,
  children,
}: {
  accept: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  children: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = '';
          if (files.length) onFiles(files);
        }}
      />
      <Button type="button" variant="secondary" onClick={() => ref.current?.click()}>
        {children}
      </Button>
    </>
  );
}

function AssetRow({
  asset,
  spec,
  onChanged,
  onError,
}: {
  asset: Asset;
  spec: Specification;
  onChanged: () => void;
  onError: (message: string) => void;
}) {
  const [caption, setCaption] = useState(asset.caption);
  const [alt, setAlt] = useState(asset.alt);
  const [busy, setBusy] = useState(false);
  const isPicture = asset.role === 'media';
  const match = isPicture ? matchesScreen(spec, asset.image?.width ?? null, asset.image?.height ?? null) : null;

  const save = async (changes: { caption?: string; alt?: string }) => {
    // Only save what actually changed.
    if ('caption' in changes && changes.caption === asset.caption) return;
    if ('alt' in changes && changes.alt === asset.alt) return;
    try {
      await api.updateAsset(asset.id, changes);
      onChanged();
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Couldn’t save the caption.');
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete ${asset.filename}? This removes it for everyone.`)) return;
    setBusy(true);
    try {
      await api.deleteAsset(asset.id);
      onChanged();
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Couldn’t delete the file.');
      setBusy(false);
    }
  };

  return (
    <li className="flex gap-3 rounded-lg border border-border p-3">
      {isPicture ? (
        <a href={fileUrl(asset.storageKey)} target="_blank" rel="noreferrer" className="h-20 w-28 shrink-0 overflow-hidden rounded bg-bg-muted">
          {asset.kind === 'video' ? (
            <span className="flex h-full items-center justify-center text-body-sm text-fg-muted">▶ Video</span>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fileUrl(asset.storageKey)} alt="" className="h-full w-full object-cover" />
          )}
        </a>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <a href={fileUrl(asset.storageKey)} target="_blank" rel="noreferrer" className="block truncate text-body-sm font-medium text-fg hover:underline">
              {asset.filename}
            </a>
            <span className="font-mono text-[11px] text-fg-subtle">
              {formatFileSize(asset.sizeBytes)}
              {asset.image?.width ? ` · ${asset.image.width}×${asset.image.height}` : ''}
            </span>
            {match === true ? (
              <span className="ml-2 text-[11px] font-semibold text-success-fg">✓ Matches screen size</span>
            ) : match === false ? (
              <span className="ml-2 text-[11px] font-semibold text-warning-fg">Not the screen size — fine for a site photo</span>
            ) : null}
          </div>
          <button type="button" onClick={remove} disabled={busy} className="shrink-0 text-body-sm text-danger-fg hover:underline disabled:opacity-50">
            Delete
          </button>
        </div>
        <input
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
          onBlur={() => void save({ caption })}
          placeholder={isPicture ? 'Caption, e.g. “Screen in situ, view from the escalator”' : 'Label, e.g. “Artwork template (PSD)”'}
          className={input}
          maxLength={500}
        />
        {isPicture ? (
          <input
            value={alt}
            onChange={(event) => setAlt(event.target.value)}
            onBlur={() => void save({ alt })}
            placeholder="Describe the image for screen readers"
            className={input}
            maxLength={300}
          />
        ) : null}
      </div>
    </li>
  );
}

function AssetList({
  title,
  hint,
  role,
  accept,
  assets,
  spec,
  onError,
}: {
  title: string;
  hint: string;
  role: AssetRole;
  accept: string;
  assets: readonly Asset[];
  spec: Specification;
  onError: (message: string) => void;
}) {
  const [uploading, setUploading] = useState<string[]>([]);

  const upload = async (files: File[]) => {
    for (const file of files) {
      if (file.size > 25 * 1024 * 1024) {
        onError(`${file.name} is over 25 MB. Compress it, or link to it from the description.`);
        continue;
      }
      setUploading((current) => [...current, file.name]);
      try {
        await api.uploadFile(spec.id, role, file);
        await refreshLiveData();
      } catch (error) {
        onError(`${file.name}: ${error instanceof Error ? error.message : 'upload failed.'}`);
      } finally {
        setUploading((current) => current.filter((name) => name !== file.name));
      }
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-body-md font-semibold text-fg">{title}</h3>
          <p className="text-body-sm text-fg-muted">{hint}</p>
        </div>
        <UploadButton accept={accept} multiple onFiles={(files) => void upload(files)}>
          Upload…
        </UploadButton>
      </div>
      {uploading.map((name) => (
        <p key={name} className="rounded-md bg-bg-subtle px-3 py-2 text-body-sm text-fg-muted">
          Uploading {name}…
        </p>
      ))}
      {assets.length === 0 && uploading.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border-strong px-3 py-6 text-center text-body-sm text-fg-subtle">
          Nothing here yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {assets.map((asset) => (
            <AssetRow key={asset.id} asset={asset} spec={spec} onChanged={() => void refreshLiveData()} onError={onError} />
          ))}
        </ul>
      )}
    </div>
  );
}

// ── the editor ────────────────────────────────────────────────────────

export interface SpecEditorProps {
  readonly spec: Specification;
  readonly tags: readonly Tag[];
  readonly assets: Readonly<Record<string, Asset>>;
  readonly isAdded: boolean;
  readonly mallId: string | null;
  readonly onClose: () => void;
}

export function SpecEditor({ spec, tags, assets, isAdded, mallId, onClose }: SpecEditorProps) {
  const { admin, sessionExpired } = useAdminSession();
  const [tab, setTab] = useState<Tab>('details');
  const [title, setTitle] = useState(spec.title);
  const [code, setCode] = useState(spec.code);
  const [description, setDescription] = useState(spec.description);
  const [status, setStatus] = useState<SpecStatus>(spec.status);
  const [tagIds, setTagIds] = useState<ReadonlySet<string>>(new Set(spec.tagIds));
  const [artwork, setArtwork] = useState<Record<ArtworkKey, string>>(() => {
    const values = {} as Record<ArtworkKey, string>;
    for (const key of ARTWORK_KEYS) values[key] = spec.metadata.find((field) => field.key === key)?.value ?? '';
    return values;
  });
  const [fields, setFields] = useState<MetadataField[]>(() =>
    spec.metadata.filter((field) => !(ARTWORK_KEYS as readonly string[]).includes(field.key)).sort((a, b) => a.order - b.order),
  );
  const [blocks, setBlocks] = useState<{ block: SpecBlock; text: string }[]>(() =>
    [...spec.blocks].sort((a, b) => a.order - b.order).map((block) => ({ block, text: linesToText(block.lines) })),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Any edit marks the draft dirty, so closing can warn.
  const touch = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setDirty(true);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') requestClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const requestClose = () => {
    if (dirty && !window.confirm('Discard your unsaved changes?')) return;
    onClose();
  };

  const media = spec.mediaIds.map((id) => assets[id]).filter((asset): asset is Asset => asset != null);
  const downloads = spec.downloadIds.map((id) => assets[id]).filter((asset): asset is Asset => asset != null);
  const attachments = spec.attachmentIds.map((id) => assets[id]).filter((asset): asset is Asset => asset != null);
  const size = getScreenSize(spec);
  const key = spec.id.replace(/^spec-/, '');

  const preview = useMemo(() => getArtworkGuide(spec), [spec]);

  const save = async () => {
    setError(null);
    if (!title.trim()) {
      setTab('details');
      setError('Give the screen a title.');
      return;
    }
    const usedKeys = new Set<string>();
    const metadata: MetadataField[] = [];
    for (const [index, field] of fields.entries()) {
      if (!field.label.trim()) continue;
      let fieldKey = field.key || slugify(field.label).replace(/-/g, '_') || `field_${index}`;
      while (usedKeys.has(fieldKey)) fieldKey = `${fieldKey}_2`;
      usedKeys.add(fieldKey);
      metadata.push({ ...field, key: fieldKey, order: index, value: field.value?.trim() ? field.value.trim() : null });
    }
    for (const [index, artworkKey] of ARTWORK_KEYS.entries()) {
      const value = artwork[artworkKey].trim();
      if (!value) continue;
      const existing = spec.metadata.find((field) => field.key === artworkKey);
      metadata.push({
        ...(existing ?? emptyMetadataField(asMetadataFieldId(`field-${key}-${artworkKey}`), artworkKey, ARTWORK_LABELS[artworkKey], 0)),
        value,
        order: 100 + index,
      });
    }

    const now = new Date().toISOString();
    const next: Specification = {
      ...spec,
      title: title.trim(),
      code: code.trim(),
      description: description.trim(),
      status,
      tagIds: tags.filter((tag) => tagIds.has(tag.id)).map((tag) => asTagId(tag.id)),
      metadata,
      blocks: blocks
        .filter(({ block }) => block.label.trim())
        .map(({ block, text }, index) => ({
          ...block,
          label: block.label.trim(),
          anchorId: block.anchorId || slugify(block.label) || block.id,
          order: index,
          lines: textToLines(text),
        })),
      searchText: [title, code, description].filter(Boolean).join(' '),
      version: spec.version + 1,
      updatedAt: now,
      updatedBy: (admin?.email ?? null) as Specification['updatedBy'],
    };

    setSaving(true);
    try {
      await api.putSpec(next, { mallId, isNew: isAdded });
      await refreshLiveData();
      setDirty(false);
      onClose();
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) sessionExpired();
      setError(caught instanceof Error ? caught.message : 'Couldn’t save.');
      setSaving(false);
    }
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-modal flex justify-end bg-[rgba(6,12,28,0.55)] backdrop-blur-md" onClick={requestClose}>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="spec-editor-title"
          onClick={(event) => event.stopPropagation()}
          className="flex h-full w-full max-w-3xl flex-col border-l border-border bg-bg shadow-4"
        >
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div className="min-w-0">
              <span className={label}>Editing</span>
              <h2 id="spec-editor-title" className="truncate text-display-sm text-fg">
                {spec.title}
              </h2>
            </div>
            <button type="button" onClick={requestClose} aria-label="Close editor" className="flex h-8 w-8 items-center justify-center rounded-full text-fg-subtle hover:text-fg">
              ✕
            </button>
          </div>

          <div role="tablist" className="no-scrollbar flex gap-1 overflow-x-auto border-b border-border px-4">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                onClick={() => setTab(item.id)}
                className={`shrink-0 border-b-2 px-3 py-2.5 text-body-sm font-medium transition-colors duration-fast ease-standard ${
                  tab === item.id ? 'border-accent text-fg' : 'border-transparent text-fg-muted hover:text-fg'
                }`}
              >
                {item.label}
                {item.id === 'pictures' && media.length ? <span className="ml-1.5 font-mono text-[11px] text-fg-subtle">{media.length}</span> : null}
                {item.id === 'files' && downloads.length + attachments.length ? (
                  <span className="ml-1.5 font-mono text-[11px] text-fg-subtle">{downloads.length + attachments.length}</span>
                ) : null}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            {tab === 'details' ? (
              <div className="flex flex-col gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className={label}>Screen name</span>
                  <input value={title} onChange={(e) => touch(setTitle)(e.target.value)} className={input} maxLength={200} />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className={label}>Reference code (optional)</span>
                  <input value={code} onChange={(e) => touch(setCode)(e.target.value)} className={`${input} font-mono`} placeholder="e.g. CRE-MB-01" maxLength={40} />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className={label}>Description</span>
                  <textarea
                    value={description}
                    onChange={(e) => touch(setDescription)(e.target.value)}
                    rows={5}
                    className={textarea}
                    placeholder="Where the screen is, what audience it reaches, anything a designer or planner should know."
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className={label}>Status</span>
                  <select value={status} onChange={(e) => touch(setStatus)(e.target.value as SpecStatus)} className={input}>
                    {STATUSES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <fieldset className="flex flex-col gap-2">
                  <legend className={`${label} mb-1.5`}>Tags</legend>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => {
                      const checked = tagIds.has(tag.id);
                      return (
                        <label
                          key={tag.id}
                          className={`inline-flex cursor-pointer items-center rounded-full border px-3 py-1 text-body-sm ${
                            checked ? 'border-accent bg-accent-subtle text-accent-fg' : 'border-border-strong text-fg-muted hover:text-fg'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={checked}
                            onChange={() =>
                              touch(setTagIds)(
                                ((current: ReadonlySet<string>) => {
                                  const next = new Set(current);
                                  if (next.has(tag.id)) next.delete(tag.id);
                                  else next.add(tag.id);
                                  return next;
                                })(tagIds),
                              )
                            }
                          />
                          {tag.name}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              </div>
            ) : null}

            {tab === 'artwork' ? (
              <div className="flex flex-col gap-4">
                <p className="text-body-sm text-fg-muted">
                  What designers should supply. The artwork size always comes from the screen&rsquo;s resolution (set it on the
                  Specifications tab). Leave a field empty to show our suggestion, marked with *.
                </p>
                <div className="rounded-lg border border-accent-border bg-accent-subtle p-3 text-body-sm">
                  <span className="font-semibold text-fg">Artwork size: </span>
                  <span className="font-mono text-fg">{size ? `${size.width} × ${size.height} px` : 'set width and height first'}</span>
                </div>
                {ARTWORK_KEYS.map((artworkKey) => {
                  const suggestion =
                    artworkKey === 'fileFormats'
                      ? 'JPG or PNG, RGB, 72 ppi'
                      : artworkKey === 'videoFormats'
                        ? 'MP4 (H.264), no audio'
                        : artworkKey === 'maxFileSize'
                          ? size
                            ? `${suggestedMaxFileSizeMb(size.width, size.height)} MB for stills`
                            : 'e.g. 5 MB'
                          : 'e.g. 10 seconds per spot';
                  return (
                    <label key={artworkKey} className="flex flex-col gap-1.5">
                      <span className={label}>{ARTWORK_LABELS[artworkKey]}</span>
                      <input
                        value={artwork[artworkKey]}
                        onChange={(e) => touch(setArtwork)({ ...artwork, [artworkKey]: e.target.value })}
                        placeholder={`Suggested: ${suggestion}`}
                        className={input}
                        maxLength={120}
                      />
                    </label>
                  );
                })}
                <p className="text-[11px] text-fg-subtle">
                  Currently showing: {preview.items.map((item) => `${item.label} ${item.value}${item.suggested ? '*' : ''}`).join(' · ')}
                </p>
              </div>
            ) : null}

            {tab === 'specs' ? (
              <div className="flex flex-col gap-3">
                <p className="text-body-sm text-fg-muted">
                  Measurements and facts shown in the Metadata section. Width and height (px) set the artwork size.
                </p>
                <div className="hidden grid-cols-[1fr_1fr_80px_104px] gap-2 px-1 sm:grid">
                  <span className={label}>Label</span>
                  <span className={label}>Value</span>
                  <span className={label}>Unit</span>
                  <span />
                </div>
                {fields.map((field, index) => (
                  <div key={field.id} className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_80px_104px]">
                    <input
                      value={field.label}
                      onChange={(e) => touch(setFields)(fields.map((f, i) => (i === index ? { ...f, label: e.target.value } : f)))}
                      className={input}
                      placeholder="e.g. Pixel pitch"
                      aria-label="Label"
                    />
                    <input
                      value={field.value ?? ''}
                      onChange={(e) => touch(setFields)(fields.map((f, i) => (i === index ? { ...f, value: e.target.value } : f)))}
                      className={input}
                      placeholder="e.g. 3.9"
                      aria-label="Value"
                    />
                    <input
                      value={field.unit ?? ''}
                      onChange={(e) => touch(setFields)(fields.map((f, i) => (i === index ? { ...f, unit: e.target.value || null } : f)))}
                      className={input}
                      placeholder="mm"
                      aria-label="Unit"
                    />
                    <div className="flex gap-1">
                      <button type="button" className={iconButton} disabled={index === 0} onClick={() => touch(setFields)(move(fields, index, -1))} aria-label="Move up">
                        ↑
                      </button>
                      <button type="button" className={iconButton} disabled={index === fields.length - 1} onClick={() => touch(setFields)(move(fields, index, 1))} aria-label="Move down">
                        ↓
                      </button>
                      <button
                        type="button"
                        className={iconButton}
                        disabled={field.key === 'width' || field.key === 'height'}
                        title={field.key === 'width' || field.key === 'height' ? 'Width and height are always kept' : 'Remove'}
                        onClick={() => touch(setFields)(fields.filter((_, i) => i !== index))}
                        aria-label="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  className="w-fit"
                  onClick={() =>
                    touch(setFields)([
                      ...fields,
                      { ...emptyMetadataField(asMetadataFieldId(`field-${key}-${Date.now().toString(36)}`), '', '', fields.length), indexed: false },
                    ])
                  }
                >
                  + Add a row
                </Button>
              </div>
            ) : null}

            {tab === 'content' ? (
              <div className="flex flex-col gap-4">
                <p className="text-body-sm text-fg-muted">
                  Sections of the spec, like Requirements or Installation. One point per line; start a line with{' '}
                  <code className="font-mono">#&nbsp;</code> to make it a sub-heading.
                </p>
                {blocks.map(({ block, text }, index) => (
                  <div key={block.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
                    <div className="flex gap-2">
                      <input
                        value={block.label}
                        onChange={(e) => touch(setBlocks)(blocks.map((b, i) => (i === index ? { ...b, block: { ...b.block, label: e.target.value } } : b)))}
                        className={`${input} font-semibold`}
                        placeholder="Section title"
                        aria-label="Section title"
                      />
                      <button type="button" className={iconButton} disabled={index === 0} onClick={() => touch(setBlocks)(move(blocks, index, -1))} aria-label="Move section up">
                        ↑
                      </button>
                      <button type="button" className={iconButton} disabled={index === blocks.length - 1} onClick={() => touch(setBlocks)(move(blocks, index, 1))} aria-label="Move section down">
                        ↓
                      </button>
                      <button
                        type="button"
                        className={iconButton}
                        onClick={() => window.confirm(`Remove the “${block.label || 'untitled'}” section?`) && touch(setBlocks)(blocks.filter((_, i) => i !== index))}
                        aria-label="Remove section"
                      >
                        ✕
                      </button>
                    </div>
                    <textarea
                      value={text}
                      onChange={(e) => touch(setBlocks)(blocks.map((b, i) => (i === index ? { ...b, text: e.target.value } : b)))}
                      rows={Math.max(4, text.split('\n').length + 1)}
                      className={textarea}
                      placeholder={'Send email to the mall for approval.\n# Installation\nArtwork goes live within 48 hours.'}
                    />
                    <label className="inline-flex items-center gap-2 text-body-sm text-fg-muted">
                      <input
                        type="checkbox"
                        checked={block.twoColumn}
                        onChange={(e) => touch(setBlocks)(blocks.map((b, i) => (i === index ? { ...b, block: { ...b.block, twoColumn: e.target.checked } } : b)))}
                      />
                      Show in two columns
                    </label>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  className="w-fit"
                  onClick={() =>
                    touch(setBlocks)([
                      ...blocks,
                      { block: emptyBlock(asBlockId(`block-${key}-${Date.now().toString(36)}`), '', blocks.length), text: '' },
                    ])
                  }
                >
                  + Add a section
                </Button>
              </div>
            ) : null}

            {tab === 'pictures' ? (
              <AssetList
                title="Pictures"
                hint={`Photos of the screen in place, or example artwork. JPG, PNG, WebP, GIF, SVG or MP4, up to 25 MB.${
                  size ? ` Artwork previews should be ${size.width}×${size.height} px.` : ''
                } Uploads save straight away.`}
                role="media"
                accept="image/*,video/mp4,video/webm"
                assets={media}
                spec={spec}
                onError={setError}
              />
            ) : null}

            {tab === 'files' ? (
              <div className="flex flex-col gap-8">
                <AssetList
                  title="Downloads"
                  hint="What designers take away: the spec PDF, After Effects templates (AEP), PSD/AI templates. Shown at the bottom of the spec. Saves straight away."
                  role="download"
                  accept=".pdf,.zip,.ai,.eps,.psd,.aep,.png,.jpg,.jpeg,application/pdf,application/zip"
                  assets={downloads}
                  spec={spec}
                  onError={setError}
                />
                <AssetList
                  title="Attachments"
                  hint="Supporting documents: site plans, CAD drawings, contracts. Saves straight away."
                  role="attachment"
                  accept=".pdf,.zip,.dwg,.dxf,.png,.jpg,.jpeg,application/pdf,application/zip"
                  assets={attachments}
                  spec={spec}
                  onError={setError}
                />
              </div>
            ) : null}
          </div>

          {error ? (
            <div role="alert" className="mx-5 mb-3 flex items-start justify-between gap-3 rounded-md border border-danger-border bg-danger-bg px-3 py-2 text-body-sm text-danger-fg">
              <span>{error}</span>
              <button type="button" onClick={() => setError(null)} aria-label="Dismiss">
                ✕
              </button>
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3">
            <span className="text-body-sm text-fg-subtle">{dirty ? 'Unsaved changes' : 'Pictures and files save as you upload'}</span>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={requestClose}>
                {dirty ? 'Cancel' : 'Close'}
              </Button>
              <Button type="button" variant="primary" onClick={() => void save()} disabled={saving || !dirty}>
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}
