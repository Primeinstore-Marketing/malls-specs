import type { Asset, AssetId, Catalogue, Specification, SpecificationId } from '@data-model';
import type { LiveDataResponse } from './api';
import type { MallMapPin, ScreenPin } from './malls';

/**
 * Layers what's in the database (the API's `GET /data`) over a base
 * catalogue. The database is the source of truth for every spec; this is
 * the one place that decides how its records combine with the base.
 *
 * Used twice, with the same rules: at publish time, to bake a snapshot of
 * the database into the static pages (`lib/liveSnapshot.json`, see
 * `scripts/snapshot-live.mjs`), and in the browser, to apply whatever has
 * changed since.
 */

export interface LivePlacement {
  readonly pins: Readonly<Record<string, ScreenPin>>;
  /** Screens added on the site, by mall id. */
  readonly addedSpecIds: Readonly<Record<string, readonly string[]>>;
  /** Positions on mall directory maps. */
  readonly planPins: Readonly<Record<string, MallMapPin>>;
}

export interface MergedLiveData {
  readonly catalogue: Catalogue;
  readonly placement: LivePlacement;
  /** Specs added on the site — no pre-built `/spec/:id` page unless built since. */
  readonly addedSpecIds: ReadonlySet<string>;
}

export function mergeLiveData(base: Catalogue, data: LiveDataResponse): MergedLiveData {
  const specifications: Record<string, Specification> = { ...base.specifications };
  const addedSpecIds = new Set<string>();
  const addedByMall: Record<string, string[]> = {};

  for (const record of data.specs) {
    specifications[record.id] = { ...record.data, id: record.id as SpecificationId };
    if (record.isNew) {
      addedSpecIds.add(record.id);
      if (record.mallId) (addedByMall[record.mallId] ??= []).push(record.id);
    }
  }

  const pins: Record<string, ScreenPin> = {};
  for (const pin of data.pins) {
    pins[pin.specId] = { lng: pin.lng, lat: pin.lat, source: 'confirmed', ...(pin.level ? { level: pin.level } : {}) };
  }

  // Uploaded files join the catalogue's assets, and each is listed on its
  // spec by role — so an upload shows up without re-saving the spec.
  const assets: Record<string, Asset> = { ...base.assets };
  const roleField = { media: 'mediaIds', download: 'downloadIds', attachment: 'attachmentIds' } as const;
  for (const { specId, ...asset } of data.assets ?? []) {
    const spec = specifications[specId];
    if (!spec) continue;
    assets[asset.id] = asset;
    const field = roleField[asset.role];
    if (!spec[field].includes(asset.id)) {
      specifications[specId] = { ...spec, [field]: [...spec[field], asset.id as AssetId] };
    }
  }

  const planPins: Record<string, MallMapPin> = {};
  for (const pin of data.planPins ?? []) planPins[pin.specId] = { x: pin.x, y: pin.y, source: 'confirmed' };

  return {
    catalogue: { ...base, specifications, assets },
    placement: { pins, addedSpecIds: addedByMall, planPins },
    addedSpecIds,
  };
}
