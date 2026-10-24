'use client';

import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import {
  asBlockId,
  asCategoryId,
  asMetadataFieldId,
  asSpecificationId,
  asSubGroupId,
  asTagId,
  emptyBlock,
  emptyMetadataField,
  emptySpecification,
  slugify,
} from '@data-model';
import type { MetadataField, SpecBlock, Specification, Tag } from '@data-model';
import { getMallFiling, getScreenSize } from '@/lib/malls';
import type { Mall } from '@/lib/malls';
import { Button } from '@/components/ui/Button';
import { Portal } from '@/components/ui/Portal';

/**
 * The admin form for editing a screen's spec, or adding a new screen to a
 * mall. Produces a complete Specification record; the caller saves it.
 */

export interface ScreenEditorProps {
  readonly mode: 'edit' | 'add';
  readonly mall: Mall;
  /** The screen being edited (edit mode only). */
  readonly spec?: Specification;
  readonly tags: readonly Tag[];
  /** Every spec id in use, so a new screen gets a unique one. */
  readonly existingIds: ReadonlySet<string>;
  readonly adminEmail: string;
  readonly onCancel: () => void;
  readonly onSave: (spec: Specification) => Promise<void>;
}

function requirementsOf(spec: Specification | undefined): string {
  if (!spec) return '';
  return spec.blocks
    .flatMap((block) => block.lines.filter((line) => line.kind === 'item').map((line) => line.text))
    .join('\n');
}

function uniqueId(base: string, taken: ReadonlySet<string>): string {
  const stem = `spec-${slugify(base)}`.slice(0, 90).replace(/-+$/, '');
  let id = stem;
  for (let n = 2; taken.has(id); n += 1) id = `${stem}-${n}`;
  return id;
}

function withDimension(fields: readonly MetadataField[], key: 'width' | 'height', value: number | null, specKey: string) {
  const label = key === 'width' ? 'Width' : 'Height';
  const existing = fields.find((field) => field.key === key);
  const field: MetadataField = {
    ...(existing ?? emptyMetadataField(asMetadataFieldId(`field-${specKey}-${key}`), key, label, key === 'width' ? 0 : 1)),
    type: 'dimension',
    unit: 'px',
    indexed: true,
    value: value != null ? String(value) : null,
  };
  return existing ? fields.map((candidate) => (candidate.key === key ? field : candidate)) : [...fields, field];
}

export function ScreenEditor({ mode, mall, spec, tags, existingIds, adminEmail, onCancel, onSave }: ScreenEditorProps) {
  const size = spec ? getScreenSize(spec) : null;
  const [title, setTitle] = useState(spec?.title ?? '');
  const [width, setWidth] = useState(size ? String(size.width) : '');
  const [height, setHeight] = useState(size ? String(size.height) : '');
  const [description, setDescription] = useState(spec?.description ?? '');
  const [tagIds, setTagIds] = useState<ReadonlySet<string>>(new Set(spec?.tagIds ?? []));
  const [requirements, setRequirements] = useState(requirementsOf(spec));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  const parseDimension = (value: string) => {
    if (!value.trim()) return null;
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 && parsed <= 20000 ? parsed : NaN;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const cleanTitle = title.trim();
    const w = parseDimension(width);
    const h = parseDimension(height);
    if (!cleanTitle) return setError('Give the screen a title.');
    if (Number.isNaN(w) || Number.isNaN(h)) return setError('Width and height must be whole numbers of pixels.');
    if ((w == null) !== (h == null)) return setError('Enter both width and height, or leave both empty.');

    const now = new Date().toISOString();
    const lines = requirements
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((text) => ({ kind: 'item' as const, text, reference: null }));

    let base: Specification;
    if (mode === 'add') {
      const filing = getMallFiling(mall.id);
      const id = uniqueId(`${mall.name} ${cleanTitle}`, existingIds);
      base = {
        ...emptySpecification(asSpecificationId(id)),
        slug: slugify(`${mall.name} ${cleanTitle}`),
        categoryId: filing ? asCategoryId(filing.categoryId) : null,
        subGroupId: filing?.subGroupId ? asSubGroupId(filing.subGroupId) : null,
        status: 'published',
        version: 1,
        publishedAt: now,
        createdAt: now,
        createdBy: adminEmail as Specification['createdBy'],
      };
    } else {
      base = { ...spec!, version: spec!.version + 1 };
    }

    const key = base.id.replace(/^spec-/, '');
    const otherBlocks = base.blocks.filter((block) => block.anchorId !== 'requirements');
    const requirementsBlock: SpecBlock | null =
      lines.length > 0
        ? {
            ...(base.blocks.find((block) => block.anchorId === 'requirements') ??
              emptyBlock(asBlockId(`block-${key}-requirements`), 'Requirements', 0)),
            anchorId: 'requirements',
            lines,
          }
        : null;

    const next: Specification = {
      ...base,
      title: cleanTitle,
      description: description.trim(),
      tagIds: tags.filter((tag) => tagIds.has(tag.id)).map((tag) => asTagId(tag.id)),
      metadata: withDimension(withDimension(base.metadata, 'width', w, key), 'height', h, key),
      blocks: requirementsBlock ? [requirementsBlock, ...otherBlocks] : otherBlocks,
      searchText: [mall.name, cleanTitle, description.trim()].filter(Boolean).join(' '),
      updatedAt: now,
      updatedBy: adminEmail as Specification['updatedBy'],
    };

    setSaving(true);
    try {
      await onSave(next);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Couldn’t save. Try again.');
      setSaving(false);
    }
  };

  const inputClass =
    'h-9 w-full rounded-md border border-border-strong bg-bg px-3 text-body-sm text-fg outline-none transition-colors duration-fast ease-standard focus-visible:border-border-focus';
  const labelClass = 'text-label-md uppercase text-fg-subtle';

  return (
    <Portal>
      <div className="fixed inset-0 z-modal flex items-end justify-center bg-[rgba(6,12,28,0.55)] backdrop-blur-md sm:items-center sm:px-4" onClick={onCancel}>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="screen-editor-title"
          onClick={(event) => event.stopPropagation()}
          className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-xl border border-border bg-bg shadow-4 sm:rounded-xl"
        >
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-label-md uppercase text-fg-subtle">{mall.name}</span>
              <h2 id="screen-editor-title" className="text-display-sm text-fg">
                {mode === 'add' ? 'Add a screen' : `Edit ${spec?.title}`}
              </h2>
            </div>
            <button
              type="button"
              onClick={onCancel}
              aria-label="Close"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-fg-subtle hover:text-fg"
            >
              ✕
            </button>
          </div>

          <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
            <div className="flex flex-col gap-4 overflow-y-auto px-5 py-5">
              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>Screen name</span>
                <input ref={titleRef} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className={inputClass} placeholder="e.g. Centre Court LED" />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>Width (px)</span>
                  <input value={width} onChange={(e) => setWidth(e.target.value)} inputMode="numeric" className={`${inputClass} font-mono`} placeholder="1920" />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>Height (px)</span>
                  <input value={height} onChange={(e) => setHeight(e.target.value)} inputMode="numeric" className={`${inputClass} font-mono`} placeholder="1080" />
                </label>
              </div>

              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>Description</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-border-strong bg-bg px-3 py-2 text-body-sm text-fg outline-none focus-visible:border-border-focus"
                  placeholder="Where it is, what it shows, anything a designer should know."
                />
              </label>

              <fieldset className="flex flex-col gap-2">
                <legend className={`${labelClass} mb-1.5`}>Tags</legend>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => {
                    const checked = tagIds.has(tag.id);
                    return (
                      <label
                        key={tag.id}
                        className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-body-sm transition-colors duration-fast ease-standard ${
                          checked ? 'border-accent bg-accent-subtle text-accent-fg' : 'border-border-strong text-fg-muted hover:text-fg'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setTagIds((current) => {
                              const next = new Set(current);
                              if (next.has(tag.id)) next.delete(tag.id);
                              else next.add(tag.id);
                              return next;
                            })
                          }
                          className="sr-only"
                        />
                        {tag.name}
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>Requirements — one per line</span>
                <textarea
                  value={requirements}
                  onChange={(e) => setRequirements(e.target.value)}
                  rows={4}
                  className="w-full rounded-md border border-border-strong bg-bg px-3 py-2 text-body-sm text-fg outline-none focus-visible:border-border-focus"
                  placeholder={'Send email to the mall for approval.\nRevenue share applies.'}
                />
              </label>

              {mode === 'add' ? (
                <p className="text-body-sm text-fg-subtle">
                  After saving, click the map to place the new screen.
                </p>
              ) : null}

              {error ? (
                <p role="alert" className="rounded-md border border-danger-border bg-danger-bg px-3 py-2 text-body-sm text-danger-fg">
                  {error}
                </p>
              ) : null}
            </div>

            <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
              <Button type="button" variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? 'Saving…' : mode === 'add' ? 'Add screen' : 'Save changes'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </Portal>
  );
}
