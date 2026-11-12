'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import type { Map as MapLibreMap, Marker } from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';
import { pointLocation, SA_PROVINCES } from '@/lib/sites';
import { mallAt, outlineById } from '@/lib/osm';
import type { SiteLocation, SitePlace } from '@/lib/sites';
import { field, quietBtn } from './AdminGate';

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
/** South Africa, for a mall not placed yet. */
const SA_BOUNDS: [[number, number], [number, number]] = [[16.3, -35.0], [33.0, -22.0]];

interface Hit {
  readonly name: string;
  readonly label: string;
  readonly lat: number;
  readonly lng: number;
  readonly osm: string;
  readonly place: Partial<SitePlace>;
}

/** Finds places on OpenStreetMap (Nominatim), in South Africa. */
async function search(q: string): Promise<Hit[]> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&countrycodes=za&q=${encodeURIComponent(q)}`;
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error('The map search isn’t answering. Try again, or drop the pin by clicking the map.');
  const list = (await r.json()) as {
    name: string; display_name: string; lat: string; lon: string; osm_type: string; osm_id: number;
    address?: Record<string, string>;
  }[];
  return list.map((x) => {
    const a = x.address ?? {};
    const province = SA_PROVINCES.find((p) => (a.state ?? '').toLowerCase().includes(p.toLowerCase().split('-')[0])) ?? a.state ?? '';
    return {
      name: x.name || x.display_name.split(',')[0],
      label: x.display_name.split(',').slice(0, 4).join(','),
      lat: Number(x.lat),
      lng: Number(x.lon),
      osm: `${x.osm_type[0]?.toUpperCase() ?? ''}${x.osm_id}`,
      place: { area: a.suburb ?? a.neighbourhood ?? a.town ?? a.village ?? '', city: a.city ?? a.town ?? a.municipality ?? '', province },
    };
  });
}

/**
 * Where a mall is: search OpenStreetMap by name or address, pick the right
 * result, then drag the pin (or click the map) to fine-tune. The same street
 * map (OpenFreeMap) the screen map uses.
 */
export function LocationPicker({
  value,
  suggestion,
  onChange,
}: {
  value: SiteLocation | null;
  /** What to search for first, e.g. the mall's name. */
  suggestion: string;
  /** A new position; `place` when it came from a search result (area, city, province, public name). */
  onChange: (location: SiteLocation, place?: Partial<SitePlace> & { name?: string }) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const markerClass = useRef<typeof Marker | null>(null);
  const latest = useRef(onChange);
  latest.current = onChange;
  const current = useRef(value);
  current.current = value;
  const [q, setQ] = useState(suggestion);
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [looking, setLooking] = useState(false);

  /** Places the mall from OpenStreetMap: its building outline by id, or the mall building at the point. */
  async function placeFromOsm(lat: number, lng: number, osm?: string, place?: Partial<SitePlace> & { name?: string }) {
    setLooking(true);
    setError(null);
    try {
      const loc = (osm && /^[WR]\d+$/.test(osm) ? await outlineById(osm) : null) ?? (await mallAt(lat, lng));
      if (loc) {
        latest.current(loc, place);
        map.current?.fitBounds(loc.bounds as [[number, number], [number, number]], { padding: 40, maxZoom: 18, duration: 600 });
      } else {
        latest.current(pointLocation(Number(lng.toFixed(6)), Number(lat.toFixed(6))), place);
      }
    } catch (e) {
      latest.current(pointLocation(Number(lng.toFixed(6)), Number(lat.toFixed(6))), place);
      setError(e instanceof Error ? e.message : 'OpenStreetMap isn’t answering just now.');
    } finally {
      setLooking(false);
    }
  }
  const placeRef = useRef(placeFromOsm);
  placeRef.current = placeFromOsm;

  // The map, once.
  useEffect(() => {
    let cancelled = false;
    import('maplibre-gl').then(({ default: maplibre }) => {
      if (cancelled || !box.current) return;
      markerClass.current = maplibre.Marker;
      const m = new maplibre.Map({
        container: box.current,
        style: STYLE_URL,
        ...(current.current ? { center: current.current.center as [number, number], zoom: 15 } : { bounds: SA_BOUNDS }),
        dragRotate: false,
        attributionControl: { compact: true },
      });
      m.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');
      m.on('click', (e) => void placeRef.current(e.lngLat.lat, e.lngLat.lng));
      m.on('load', () => {
        m.addSource('mall-outline', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        m.addLayer({ id: 'mall-outline-fill', type: 'fill', source: 'mall-outline', paint: { 'fill-color': '#2861FD', 'fill-opacity': 0.18 } });
        m.addLayer({ id: 'mall-outline-line', type: 'line', source: 'mall-outline', paint: { 'line-color': '#2861FD', 'line-width': 2.5 } });
        setReady(false);
        setReady(true);
      });
      map.current = m;
      setReady(true);
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // The pin follows the value.
  useEffect(() => {
    const m = map.current;
    const M = markerClass.current;
    if (!m || !M) return;
    if (!value) {
      marker.current?.remove();
      marker.current = null;
      return;
    }
    const at = value.center as [number, number];
    if (!marker.current) {
      marker.current = new M({ color: '#2861FD', draggable: true }).setLngLat(at).addTo(m);
      marker.current.on('dragend', () => {
        const p = marker.current!.getLngLat();
        void placeRef.current(p.lat, p.lng);
      });
    } else marker.current.setLngLat(at);
  }, [value, ready]);

  // The building outline from OpenStreetMap, drawn on the map.
  useEffect(() => {
    const src = map.current?.getSource('mall-outline') as { setData?: (d: unknown) => void } | undefined;
    if (!src?.setData) return;
    src.setData(value?.outline ? { type: 'Feature', properties: {}, geometry: value.outline } : { type: 'FeatureCollection', features: [] });
  }, [value, ready]);

  async function find() {
    if (!q.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const list = await search(q.trim());
      setHits(list);
      if (!list.length) setError('Nothing found. Try the street address, or click the map where the mall is.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed.');
    } finally {
      setBusy(false);
    }
  }

  function choose(h: Hit) {
    setHits(null);
    map.current?.flyTo({ center: [h.lng, h.lat], zoom: 16 });
    void placeFromOsm(h.lat, h.lng, h.osm, { ...h.place, name: h.name });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <input
          className={`${field} min-w-0 flex-1`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void find();
            }
          }}
          placeholder="Mall name or street address"
          aria-label="Find the mall on the map"
        />
        <button type="button" className="inline-flex h-11 items-center rounded-full bg-accent px-5 text-body-sm font-semibold text-fg-on-accent hover:bg-accent-hover disabled:opacity-50" disabled={busy || !q.trim()} onClick={() => void find()}>
          {busy ? 'Finding…' : 'Find on map'}
        </button>
      </div>
      {error ? <p className="text-body-sm text-warning-fg">{error}</p> : null}
      {hits?.length ? (
        <ul className="flex flex-col overflow-hidden rounded-2xl border border-border" aria-label="Places found">
          {hits.map((h) => (
            <li key={h.osm + h.lat} className="border-t border-border first:border-t-0">
              <button type="button" onClick={() => choose(h)} className="flex w-full flex-col items-start px-4 py-2.5 text-left hover:bg-accent-subtle">
                <span className="text-body-sm font-semibold text-fg">{h.name}</span>
                <span className="text-[12px] text-fg-muted">{h.label}</span>
              </button>
            </li>
          ))}
          <li className="border-t border-border"><button type="button" className={`${quietBtn} h-9 w-full`} onClick={() => setHits(null)}>None of these</button></li>
        </ul>
      ) : null}
      <div ref={box} className="h-80 w-full overflow-hidden rounded-2xl border border-border bg-bg-subtle" />
      <p className="text-body-sm text-fg-muted">
        {looking
          ? 'Looking up the mall on OpenStreetMap…'
          : value?.outline
            ? <span className="text-success-fg">Placed from OpenStreetMap{value.osmName ? `: ${value.osmName}` : ''}, with its building outline. Wrong building? Click the right one on the map.</span>
            : value
              ? <span className="font-semibold text-warning-fg">OpenStreetMap has no mall building here. Click on the mall’s building on the map, or search for it by name.</span>
              : 'Search for the mall above, or click its building on the map. The location and outline come from OpenStreetMap.'}
      </p>
    </div>
  );
}
