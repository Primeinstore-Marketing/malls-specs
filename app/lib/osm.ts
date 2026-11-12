/**
 * Mall locations from OpenStreetMap, for Site admin: a mall's building
 * outline by its OpenStreetMap id (a search result), or the mall building
 * at a point on the map. Every mall is placed this way, so each one has the
 * same street-map outline as the rest. Uses the public Overpass API.
 */
import type { SiteLocation } from './sites';

const OVERPASS = 'https://overpass-api.de/api/interpreter';

interface Geo { lat: number; lon: number }
interface Element {
  type: 'way' | 'relation' | 'node';
  id: number;
  tags?: Record<string, string>;
  geometry?: Geo[];
  members?: { role: string; geometry?: Geo[] }[];
}

async function overpass(query: string): Promise<Element[]> {
  const r = await fetch(OVERPASS, { method: 'POST', body: new URLSearchParams({ data: `[out:json][timeout:25];${query}` }) });
  if (!r.ok) throw new Error('OpenStreetMap isn’t answering just now. Try again in a minute.');
  return ((await r.json()) as { elements?: Element[] }).elements ?? [];
}

type Ring = [number, number][];
const ringOf = (g: Geo[]): Ring => {
  const r: Ring = g.map((p) => [Number(p.lon.toFixed(6)), Number(p.lat.toFixed(6))]);
  if (r.length && (r[0][0] !== r[r.length - 1][0] || r[0][1] !== r[r.length - 1][1])) r.push(r[0]);
  return r;
};

function ringsOf(el: Element): Ring[] {
  if (el.type === 'way' && el.geometry && el.geometry.length > 3) return [ringOf(el.geometry)];
  if (el.type === 'relation') return (el.members ?? []).filter((m) => m.role === 'outer' && m.geometry && m.geometry.length > 3).map((m) => ringOf(m.geometry!));
  return [];
}

function inside([x, y]: [number, number], ring: Ring): boolean {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[j];
    if (y1 > y !== y2 > y && x < ((x2 - x1) * (y - y1)) / (y2 - y1) + x1) c = !c;
  }
  return c;
}

/** A SiteLocation from an OpenStreetMap way or relation with an outline. */
function toLocation(el: Element): SiteLocation | null {
  const rings = ringsOf(el);
  if (!rings.length) return null;
  const pts = rings.flat();
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const center: [number, number] = [Number((xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(6)), Number((ys.reduce((a, b) => a + b, 0) / ys.length).toFixed(6))];
  return {
    osm: `${el.type[0].toUpperCase()}${el.id}`,
    osmName: el.tags?.name ?? '',
    center,
    bounds: [[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]],
    outline: rings.length === 1 ? { type: 'Polygon', coordinates: [rings[0]] } : { type: 'MultiPolygon', coordinates: rings.map((r) => [r]) },
  };
}

/** The outline of an OpenStreetMap element, by id like "W147206297" or "R11617817". */
export async function outlineById(osm: string): Promise<SiteLocation | null> {
  const kind = osm[0] === 'W' ? 'way' : osm[0] === 'R' ? 'relation' : null;
  if (!kind) return null;
  const [el] = await overpass(`${kind}(${osm.slice(1)});out geom tags;`);
  return el ? toLocation(el) : null;
}

/**
 * The mall at a point: a shopping centre (shop=mall) containing it or close
 * by, else the retail building or area it's in. Null when there's nothing.
 */
export async function mallAt(lat: number, lng: number): Promise<SiteLocation | null> {
  const els = await overpass(
    `(way(around:300,${lat},${lng})[shop=mall];relation(around:300,${lat},${lng})[shop=mall];way(around:120,${lat},${lng})[building];way(around:200,${lat},${lng})[landuse=retail];);out geom tags;`,
  );
  let best: { score: number; loc: SiteLocation } | null = null;
  for (const el of els) {
    const loc = toLocation(el);
    if (!loc) continue;
    const contains = ringsOf(el).some((r) => inside([lng, lat], r));
    const isMall = el.tags?.shop === 'mall';
    const d = Math.hypot(loc.center[0] - lng, loc.center[1] - lat);
    // A mall that contains the point beats one nearby, which beats a building the point is in.
    const score = (isMall ? 2 : 0) + (contains ? 1 : 0) - d * 100;
    if (!isMall && !contains) continue;
    if (!best || score > best.score) best = { score, loc };
  }
  return best?.loc ?? null;
}
