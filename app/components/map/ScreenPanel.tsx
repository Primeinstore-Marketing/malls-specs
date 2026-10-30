'use client';

import Link from 'next/link';
import type { Specification } from '@data-model';
import { LinkButton } from '@/components/ui/Button';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { formatAspectRatio, getScreenSize, MALL_GROUP_LABELS, PIN_SOURCE_LABELS } from '@/lib/malls';
import type { Mall, ScreenPin } from '@/lib/malls';
import { specHref, useLiveData } from '@/lib/liveData';
import { PinStatusDot } from './PinStatusDot';
import { DownloadButtons } from '@/components/spec/DownloadButtons';
import { getAssets } from '@/lib/catalogue';
import { fileUrl } from '@/lib/api';

export type SaveState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'saving' | 'saved' | 'error'; readonly message: string };

/** What a signed-in admin can do from the panel. Null for everyone else. */
export interface AdminControls {
  readonly placing: boolean;
  readonly togglePlacing: () => void;
  readonly saveState: SaveState;
  readonly dismissSaveState: () => void;
  readonly editSpec: (specId: string) => void;
  readonly addScreen: () => void;
  readonly resetPin: (specId: string) => void;
  /** Deletes a screen for everyone. */
  readonly deleteSpec: (specId: string) => void;
  readonly isAdded: (specId: string) => boolean;
}

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

const SMALL_BUTTON =
  'w-fit rounded-md border border-border-strong px-2.5 py-1 text-body-sm font-medium text-fg transition-colors duration-fast ease-standard hover:border-border-control hover:bg-bg-subtle';

function ScreenDetail({
  spec,
  mall,
  pin,
  index,
  total,
  onBack,
  admin,
}: {
  spec: Specification;
  mall: Mall;
  pin: ScreenPin | undefined;
  index: number;
  total: number;
  onBack: () => void;
  admin: AdminControls | null;
}) {
  const live = useLiveData();
  const downloads = getAssets(spec.downloadIds, live.catalogue);
  const pictures = getAssets(spec.mediaIds, live.catalogue).filter((asset) => asset.kind === 'image');
  const picture = pictures[0];
  const size = getScreenSize(spec);
  const explanation = pin ? positionExplanation(pin) : null;
  const isAdded = admin?.isAdded(spec.id) ?? false;

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
          {isAdded ? ' · added by an admin' : ''}
        </span>
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-display-sm text-fg">{spec.title}</h2>
          {admin ? (
            <button type="button" onClick={() => admin.editSpec(spec.id)} className={`${SMALL_BUTTON} shrink-0`}>
              Edit
            </button>
          ) : null}
        </div>
        {spec.description ? <p className="text-body-sm text-fg-muted">{spec.description}</p> : null}
      </div>

      {picture ? (
        <Link
          href={specHref(spec.id, live)}
          title="Open the full specification"
          className="group relative block overflow-hidden rounded-lg border border-border bg-bg-subtle"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- uploaded files come from the API, not the build */}
          {/* Not lazy: some browsers never load a lazy image that appears inside
              this scrolling panel until the page is reloaded. */}
          <img
            key={picture.id}
            src={fileUrl(picture.storageKey)}
            alt={picture.alt || picture.caption || `${spec.title} on site`}
            decoding="async"
            className="aspect-video w-full object-cover transition-transform duration-slow ease-standard group-hover:scale-[1.02]"
          />
          {pictures.length > 1 ? (
            <span className="absolute bottom-2 right-2 rounded-full bg-black/65 px-2 py-0.5 text-[11px] font-medium text-white">
              +{pictures.length - 1} more {pictures.length === 2 ? 'photo' : 'photos'}
            </span>
          ) : null}
        </Link>
      ) : null}

      <DownloadButtons downloads={downloads} compact />

      <dl className="rounded-lg border border-border px-3">
        <DetailRow label="Resolution" value={size ? `${size.width} × ${size.height} px` : 'Not set'} />
        {size ? <DetailRow label="Aspect ratio" value={formatAspectRatio(size)} /> : null}
        {size ? (
          <DetailRow
            label="Orientation"
            value={size.width === size.height ? 'Square' : size.width > size.height ? 'Landscape' : 'Portrait'}
          />
        ) : null}
        {admin ? <DetailRow label="Map position" value={locationLabel(pin, mall)} /> : null}
        {pin?.level ? <DetailRow label="Level" value={pin.level} /> : null}
      </dl>

      {/* How a position was found is admin housekeeping, not something visitors need. */}
      {admin && explanation ? (
        <div className="flex flex-col gap-2 rounded-lg bg-bg-subtle p-3">
          <p className="text-body-sm text-fg-muted">{explanation}</p>
          {mall.location ? (
            admin.placing ? (
              <p className="text-body-sm font-medium text-fg">Click the map where it really is, or drag it.</p>
            ) : (
              <button type="button" onClick={admin.togglePlacing} className={SMALL_BUTTON}>
                Fix position
              </button>
            )
          ) : null}
        </div>
      ) : null}

      {admin && pin?.source === 'confirmed' && mall.location ? (
        <div className="flex flex-wrap items-center gap-2">
          {!admin.placing ? (
            <button type="button" onClick={admin.togglePlacing} className={SMALL_BUTTON}>
              Move
            </button>
          ) : (
            <span className="text-body-sm text-fg-muted">Drag the screen on the map to move it.</span>
          )}
          {!isAdded ? (
            <button type="button" onClick={() => admin.resetPin(spec.id)} className={SMALL_BUTTON}>
              Reset to automatic position
            </button>
          ) : null}
        </div>
      ) : null}

      <LinkButton href={specHref(spec.id, live)} variant="primary" className="w-fit">
        Open full specification
      </LinkButton>

      {admin ? (
        <button
          type="button"
          onClick={() => admin.deleteSpec(spec.id)}
          className="w-fit text-body-sm text-danger-fg underline-offset-2 hover:underline"
        >
          Delete this screen
        </button>
      ) : null}
    </div>
  );
}

function MallOverview({
  mall,
  specs,
  pins,
  onSelect,
  admin,
}: {
  mall: Mall;
  specs: readonly Specification[];
  pins: Readonly<Record<string, ScreenPin>>;
  onSelect: (specId: string) => void;
  admin: AdminControls | null;
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
            ? admin
              ? ` · ${confirmedCount} of ${specs.length} positions confirmed`
              : ''
            : mall.group === 'formats'
              ? ' · standard formats, not tied to one mall'
              : ' · this mall isn’t on OpenStreetMap, so screens are shown in a grid'}
        </p>
      </div>

      {admin && mall.location && admin.placing ? (
        <div className="flex flex-col gap-1 rounded-lg border border-accent-border bg-accent-subtle p-3 text-body-sm text-fg">
          <span className="font-semibold">Placing screens</span>
          <span className="text-fg-muted">
            Pick a screen below, then click the map where it is. Drag any screen to move it. Each move saves
            straight away.
          </span>
        </div>
      ) : admin && mall.location && toCheckCount > 0 ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border-control p-3">
          <span className="text-body-sm text-fg-muted">
            {toCheckCount} {toCheckCount === 1 ? 'position is' : 'positions are'} automatic and{' '}
            {toCheckCount === 1 ? 'needs' : 'need'} checking.
          </span>
          <button
            type="button"
            onClick={admin.togglePlacing}
            className="shrink-0 rounded-md bg-accent px-2.5 py-1 text-body-sm font-medium text-fg-on-accent hover:bg-accent-hover"
          >
            Check positions
          </button>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <SectionLabel>Screens</SectionLabel>
          </div>
          {admin ? (
            <button type="button" onClick={admin.addScreen} className="text-body-sm font-semibold text-accent-fg hover:underline">
              + Add screen
            </button>
          ) : null}
        </div>
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
                  {admin && mall.location ? <PinStatusDot pin={pins[spec.id]} className="text-fg-subtle" /> : null}
                </button>
              </li>
            );
          })}
        </ol>
        {admin && mall.location ? (
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

function SaveStatus({ state, onDismiss }: { state: SaveState; onDismiss: () => void }) {
  if (state.kind === 'idle') return null;
  const tone =
    state.kind === 'error'
      ? 'border-danger-border bg-danger-bg text-danger-fg'
      : state.kind === 'saved'
        ? 'border-success-border bg-success-bg text-success-fg'
        : 'border-border bg-bg-subtle text-fg-muted';
  return (
    <div role="status" className={`flex items-start justify-between gap-3 rounded-lg border px-3 py-2 text-body-sm ${tone}`}>
      <span>{state.message}</span>
      {state.kind !== 'saving' ? (
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="shrink-0 opacity-70 hover:opacity-100">
          ✕
        </button>
      ) : null}
    </div>
  );
}

export interface ScreenPanelProps {
  readonly mall: Mall;
  readonly malls: readonly Mall[];
  readonly specs: readonly Specification[];
  readonly pins: Readonly<Record<string, ScreenPin>>;
  readonly focusedId: string | null;
  readonly onFocus: (specId: string | null) => void;
  readonly onMallChange: (mallId: string) => void;
  readonly admin: AdminControls | null;
}

export function ScreenPanel({ mall, malls, specs, pins, focusedId, onFocus, onMallChange, admin }: ScreenPanelProps) {
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
        {admin && mall.location ? (
          <button
            type="button"
            onClick={admin.togglePlacing}
            aria-pressed={admin.placing}
            title={admin.placing ? 'Finish placing screens' : 'Place or move screens on the map'}
            className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-body-sm transition-colors duration-fast ease-standard ${
              admin.placing
                ? 'border-accent bg-accent text-fg-on-accent hover:bg-accent-hover'
                : 'border-border-strong text-fg-muted hover:border-border-control hover:text-fg'
            }`}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
              <path d="M12 21s-7-6.1-7-11.5A7 7 0 0 1 19 9.5C19 14.9 12 21 12 21Z" />
              <circle cx="12" cy="9.5" r="2.5" />
            </svg>
            {admin.placing ? 'Done' : 'Place'}
          </button>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-5">
        {admin ? <SaveStatus state={admin.saveState} onDismiss={admin.dismissSaveState} /> : null}
        {focused ? (
          <ScreenDetail
            key={focused.id}
            spec={focused}
            mall={mall}
            pin={pins[focused.id]}
            index={focusedIndex}
            total={specs.length}
            onBack={() => onFocus(null)}
            admin={admin}
          />
        ) : (
          <MallOverview mall={mall} specs={specs} pins={pins} onSelect={onFocus} admin={admin} />
        )}
      </div>
    </div>
  );
}
