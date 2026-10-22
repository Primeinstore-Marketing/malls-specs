'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Specification, Tag } from '@data-model';
import { TagChip } from '@/components/ui/TagChip';
import { LinkButton } from '@/components/ui/Button';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { formatAspectRatio, getScreenSize, MALL_GROUP_LABELS } from '@/lib/malls';
import { PIN_SOURCE_LABELS } from '@/lib/malls';
import type { Mall, ScreenPin } from '@/lib/malls';
import { PinStatusDot } from './PinStatusDot';

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-2 last:border-b-0">
      <dt className="text-label-md uppercase text-fg-subtle">{label}</dt>
      <dd className="text-right font-mono text-mono-md text-fg">{value}</dd>
    </div>
  );
}

function locationLabel(pin: ScreenPin | undefined, mall: Mall): string {
  if (!pin) return mall.location ? 'Not placed yet' : 'No map for this location';
  return PIN_SOURCE_LABELS[pin.source];
}

/** Plain-language account of where an automatic position came from. */
function positionExplanation(pin: ScreenPin): string | null {
  switch (pin.source) {
    case 'osm-draft':
      return `Placed automatically at ${pin.note ?? 'a matching store'} on OpenStreetMap. The screen is at or near there, not necessarily at this exact spot.`;
    case 'estimated':
      return `Estimated position: ${pin.note ?? 'inferred from nearby places'}. Worth checking.`;
    case 'placeholder':
      return 'Nobody has placed this screen yet, so it’s parked in the middle of the mall as a placeholder.';
    default:
      return null;
  }
}

function ScreenDetail({
  spec,
  mall,
  pin,
  tags,
  index,
  total,
  onBack,
  editMode,
  onToggleEdit,
}: {
  spec: Specification;
  mall: Mall;
  pin: ScreenPin | undefined;
  tags: readonly Tag[];
  index: number;
  total: number;
  onBack: () => void;
  editMode: boolean;
  onToggleEdit: () => void;
}) {
  const explanation = pin ? positionExplanation(pin) : null;
  const size = getScreenSize(spec);
  const requirements = spec.blocks.flatMap((block) => block.lines.filter((line) => line.kind === 'item'));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onBack}
          className="w-fit text-body-sm text-fg-muted underline-offset-2 hover:text-fg hover:underline"
        >
          ← All screens
        </button>
        <span className="text-label-md uppercase text-fg-subtle">
          Screen {index + 1} of {total}
        </span>
        <h2 className="text-display-sm text-fg">{spec.title}</h2>
      </div>

      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <TagChip key={tag.id} tag={tag} />
          ))}
        </div>
      ) : null}

      <dl className="rounded-lg border border-border px-3">
        <DetailRow label="Resolution" value={size ? `${size.width} × ${size.height} px` : 'Not in source sheet'} />
        {size ? <DetailRow label="Aspect ratio" value={formatAspectRatio(size)} /> : null}
        {size ? (
          <DetailRow
            label="Orientation"
            value={size.width === size.height ? 'Square' : size.width > size.height ? 'Landscape' : 'Portrait'}
          />
        ) : null}
        <DetailRow label="Map position" value={locationLabel(pin, mall)} />
        {pin?.level ? <DetailRow label="Level" value={pin.level} /> : null}
      </dl>

      {explanation ? (
        <div className="flex flex-col gap-2 rounded-lg bg-bg-subtle p-3">
          <p className="text-body-sm text-fg-muted">{explanation}</p>
          {mall.location ? (
            editMode ? (
              <p className="text-body-sm font-medium text-fg">
                Drag it on the map, or click the map where it really is.
              </p>
            ) : (
              <button
                type="button"
                onClick={onToggleEdit}
                className="w-fit rounded-md border border-border-strong px-2.5 py-1 text-body-sm font-medium text-fg hover:border-border-control hover:bg-bg"
              >
                Fix position
              </button>
            )
          ) : null}
        </div>
      ) : null}

      {requirements.length > 0 ? (
        <div className="flex flex-col gap-2">
          <SectionLabel>Requirements</SectionLabel>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-body-sm text-fg-muted">
            {requirements.map((line, lineIndex) => (
              <li key={lineIndex}>{line.text}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <LinkButton href={`/spec/${spec.id}`} variant="primary" className="w-fit">
        Open full specification
      </LinkButton>
    </div>
  );
}

function MallOverview({
  mall,
  specs,
  pins,
  onSelect,
  editMode,
  onToggleEdit,
}: {
  mall: Mall;
  specs: readonly Specification[];
  pins: Readonly<Record<string, ScreenPin>>;
  onSelect: (specId: string) => void;
  editMode: boolean;
  onToggleEdit: () => void;
}) {
  const confirmedCount = specs.filter((spec) => pins[spec.id]?.source === 'confirmed').length;
  const toCheckCount = specs.length - confirmedCount;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <span className="text-label-md uppercase text-fg-subtle">{MALL_GROUP_LABELS[mall.group]}</span>
        <h2 className="text-display-lg text-fg">{mall.name}</h2>
        <p className="text-body-sm text-fg-muted">
          {specs.length} {specs.length === 1 ? 'screen' : 'screens'}
          {mall.location
            ? ` · ${confirmedCount} of ${specs.length} positions confirmed`
            : mall.group === 'formats'
              ? ' · standard formats, not tied to one mall'
              : ' · this mall isn’t on OpenStreetMap, so screens are shown in a grid'}
        </p>
      </div>

      {mall.location && editMode ? (
        <div className="flex flex-col gap-1 rounded-lg border border-accent-border bg-accent-subtle p-3 text-body-sm text-fg">
          <span className="font-semibold">Placing screens</span>
          <span className="text-fg-muted">
            Pick a screen below, then click the map where it is. Drag any screen on the map to move it.
          </span>
        </div>
      ) : mall.location && toCheckCount > 0 ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border-control p-3">
          <span className="text-body-sm text-fg-muted">
            {toCheckCount} {toCheckCount === 1 ? 'position is' : 'positions are'} automatic and{' '}
            {toCheckCount === 1 ? 'needs' : 'need'} checking.
          </span>
          <button
            type="button"
            onClick={onToggleEdit}
            className="shrink-0 rounded-md bg-accent px-2.5 py-1 text-body-sm font-medium text-fg-on-accent hover:bg-accent-hover"
          >
            Check positions
          </button>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <SectionLabel>Screens</SectionLabel>
        <ol className="flex flex-col">
          {specs.map((spec, index) => {
            const size = getScreenSize(spec);
            return (
              <li key={spec.id}>
                <button
                  type="button"
                  onClick={() => onSelect(spec.id)}
                  className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors duration-fast ease-standard hover:bg-bg-subtle"
                >
                  <span className="w-6 shrink-0 font-mono text-mono-md text-fg-subtle">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-body-sm font-medium text-fg">{spec.title}</span>
                  <span className="shrink-0 font-mono text-mono-md text-fg-muted">
                    {size ? `${size.width}×${size.height}` : 'TBC'}
                  </span>
                  {mall.location ? <PinStatusDot pin={pins[spec.id]} className="text-fg-subtle" /> : null}
                </button>
              </li>
            );
          })}
        </ol>
        {mall.location ? (
          <div className="flex flex-wrap gap-x-4 gap-y-1 px-2 pt-2 text-[11px] text-fg-subtle">
            <span className="inline-flex items-center gap-1.5">
              <PinStatusDot pin={{ lng: 0, lat: 0, source: 'confirmed' }} /> Confirmed
            </span>
            <span className="inline-flex items-center gap-1.5">
              <PinStatusDot pin={{ lng: 0, lat: 0, source: 'estimated' }} /> Approximate
            </span>
            <span className="inline-flex items-center gap-1.5">
              <PinStatusDot pin={{ lng: 0, lat: 0, source: 'placeholder' }} /> Placeholder
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PinSnippet({ specIds, pins }: { specIds: readonly string[]; pins: Readonly<Record<string, ScreenPin>> }) {
  const [copied, setCopied] = useState(false);
  const snippet = specIds
    .map((id) => {
      const pin = pins[id];
      const level = pin.level ? `, level: '${pin.level}'` : '';
      return `  '${id}': { lng: ${pin.lng}, lat: ${pin.lat}, source: 'confirmed'${level} },`;
    })
    .join('\n');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-accent-border bg-accent-subtle p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-label-md uppercase text-accent-fg">Moved this session</span>
        <button type="button" onClick={copy} className="text-body-sm font-semibold text-accent-fg hover:underline">
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p className="text-body-sm text-fg-muted">
        Paste into <code className="font-mono">SCREEN_PINS</code> in <code className="font-mono">app/lib/screenPins.ts</code>{' '}
        (replacing any existing line for the same screen). Changes are lost on reload until then.
      </p>
      <pre className="overflow-x-auto rounded-md bg-bg p-2 font-mono text-[11px] leading-relaxed text-fg">{snippet}</pre>
    </div>
  );
}

export interface ScreenPanelProps {
  readonly mall: Mall;
  readonly malls: readonly Mall[];
  readonly specs: readonly Specification[];
  readonly pins: Readonly<Record<string, ScreenPin>>;
  readonly tags: Readonly<Record<string, Tag>>;
  readonly focusedId: string | null;
  readonly onFocus: (specId: string | null) => void;
  readonly onMallChange: (mallId: string) => void;
  readonly editMode: boolean;
  readonly editedSpecIds: readonly string[];
  readonly onToggleEdit: () => void;
}

export function ScreenPanel({
  mall,
  malls,
  specs,
  pins,
  tags,
  focusedId,
  onFocus,
  onMallChange,
  editMode,
  editedSpecIds,
  onToggleEdit,
}: ScreenPanelProps) {
  const focusedIndex = specs.findIndex((spec) => spec.id === focusedId);
  const focused = focusedIndex >= 0 ? specs[focusedIndex] : null;
  const groups = (Object.keys(MALL_GROUP_LABELS) as (keyof typeof MALL_GROUP_LABELS)[])
    .map((group) => ({ group, malls: malls.filter((candidate) => candidate.group === group) }))
    .filter((entry) => entry.malls.length > 0);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Link
          href="/"
          className="inline-flex h-8 shrink-0 items-center rounded-md border border-border-strong px-2.5 text-body-sm text-fg-muted transition-colors duration-fast ease-standard hover:border-border-control hover:text-fg"
        >
          All malls
        </Link>
        <label className="min-w-0 flex-1">
          <span className="sr-only">Switch mall</span>
          <select
            value={mall.id}
            onChange={(event) => onMallChange(event.target.value)}
            className="h-8 w-full rounded-md border border-border-strong bg-bg px-2 text-body-sm text-fg outline-none focus:border-border-focus"
          >
            {groups.map((entry) => (
              <optgroup key={entry.group} label={MALL_GROUP_LABELS[entry.group]}>
                {entry.malls.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name} ({option.specIds.length})
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        {mall.location ? (
          <button
            type="button"
            onClick={onToggleEdit}
            aria-pressed={editMode}
            title={editMode ? 'Finish placing screens' : 'Place or move screens on the map'}
            className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-body-sm transition-colors duration-fast ease-standard ${
              editMode
                ? 'border-accent bg-accent text-fg-on-accent hover:bg-accent-hover'
                : 'border-border-strong text-fg-muted hover:border-border-control hover:text-fg'
            }`}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
              <path d="M12 21s-7-6.1-7-11.5A7 7 0 0 1 19 9.5C19 14.9 12 21 12 21Z" />
              <circle cx="12" cy="9.5" r="2.5" />
            </svg>
            {editMode ? 'Done' : 'Place'}
          </button>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-5">
        {editMode && editedSpecIds.length > 0 ? <PinSnippet specIds={editedSpecIds} pins={pins} /> : null}
        {focused ? (
          <ScreenDetail
            key={focused.id}
            spec={focused}
            mall={mall}
            pin={pins[focused.id]}
            tags={focused.tagIds.map((id) => tags[id]).filter((tag): tag is Tag => tag != null)}
            index={focusedIndex}
            total={specs.length}
            onBack={() => onFocus(null)}
            editMode={editMode}
            onToggleEdit={onToggleEdit}
          />
        ) : (
          <MallOverview
            mall={mall}
            specs={specs}
            pins={pins}
            onSelect={onFocus}
            editMode={editMode}
            onToggleEdit={onToggleEdit}
          />
        )}
      </div>
    </div>
  );
}
