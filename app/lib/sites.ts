/**
 * Every mall on the site — the left-hand list, the screen map, the Media
 * Explorer, proposals — comes from here, and here from the API: one content
 * record per mall, "site:<id>". Nothing about which malls exist is in the
 * code. Admins add, edit, publish and delete malls in Site admin → Malls.
 *
 * A mall's screens are specs: built-in ones by `subGroupId` / `specIds`
 * (from the original catalogue), and ones added on the site by their
 * `mallId` (see mergeLive.ts).
 */

export type SiteGroup = 'malls' | 'hyprop' | 'formats';

/** Where a mall is on the map. Null when it hasn't been placed yet. */
export interface SiteLocation {
  /** OpenStreetMap element, e.g. "W147206297", when the location came from there. */
  readonly osm: string;
  readonly osmName: string;
  /** [longitude, latitude] */
  readonly center: readonly [number, number];
  /** [[west, south], [east, north]] */
  readonly bounds: readonly [readonly [number, number], readonly [number, number]];
  /** The building's outline, when OpenStreetMap has one. */
  readonly outline: { readonly type: 'Polygon' | 'MultiPolygon'; readonly coordinates: unknown } | null;
}

/** Where a mall is, in words. */
export interface SitePlace {
  /** The centre's public name, e.g. "Cresta Shopping Centre". */
  readonly name: string;
  readonly area: string;
  readonly city: string;
  readonly province: string;
  readonly note?: string;
}

export interface SiteRecord {
  readonly id: string;
  /** Short name used in lists, e.g. "Cresta". */
  readonly name: string;
  readonly group: SiteGroup;
  readonly place: SitePlace | null;
  readonly location: SiteLocation | null;
  /** Built-in screens filed under a catalogue sub-group. */
  readonly subGroupId?: string | null;
  /** Built-in screens listed one by one. */
  readonly specIds?: readonly string[];
  /** Shown to everyone. Drafts are only in Site admin. */
  readonly published: boolean;
  /** Set when an admin deleted the mall; it can be restored. */
  readonly deletedAt?: string | null;
  /** Screens archived when the mall was deleted, brought back by Restore. */
  readonly archivedSpecIds?: readonly string[];
}

let SITES: readonly SiteRecord[] = [];
let BY_ID = new Map<string, SiteRecord>();

/** Sets the malls from the API's content (records keyed "site:<id>"). */
export function applySites(records: readonly { key: string; data: unknown }[]) {
  SITES = records
    .filter((r) => r.key.startsWith('site:') && r.data && typeof r.data === 'object')
    .map((r) => r.data as SiteRecord)
    .filter((s) => typeof s.id === 'string' && typeof s.name === 'string');
  BY_ID = new Map(SITES.map((s) => [s.id, s]));
}

/** Every mall record, including drafts and deleted ones (for Site admin). */
export const allSites = (): readonly SiteRecord[] => SITES;

/** Malls everyone sees: published and not deleted. */
export const liveSites = (): readonly SiteRecord[] => SITES.filter((s) => s.published && !s.deletedAt);

export const siteById = (id: string): SiteRecord | undefined => BY_ID.get(id);

/** Where a mall is, in words (its public name, area, city and province). */
export const mallPlace = (id: string | null | undefined): SitePlace | undefined => (id ? BY_ID.get(id)?.place ?? undefined : undefined);

/** A point location with a small box around it, for a mall placed by hand or by a search. */
export function pointLocation(lng: number, lat: number, osm = '', osmName = ''): SiteLocation {
  const d = 0.0025;
  return { osm, osmName, center: [lng, lat], bounds: [[lng - d, lat - d], [lng + d, lat + d]], outline: null };
}

export const slugifySite = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

/** Provinces in the order lists show them; any others follow alphabetically. */
export const PROVINCE_ORDER: readonly string[] = ['Gauteng', 'Western Cape', 'KwaZulu-Natal', 'Free State', 'Eastern Cape', 'North West', 'Limpopo', 'Mpumalanga', 'Northern Cape'];

export const SA_PROVINCES: readonly string[] = PROVINCE_ORDER;

/** "Randburg, Johannesburg · Gauteng" */
export function placeLine(p: SitePlace): string {
  const where = !p.area || p.area === p.city ? p.city : p.city ? `${p.area}, ${p.city}` : p.area;
  return [where, p.province].filter(Boolean).join(' · ');
}
