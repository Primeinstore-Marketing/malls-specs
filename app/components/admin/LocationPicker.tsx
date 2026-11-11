'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import type { Map as MapLibreMap, Marker } from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';
import { pointLocation, SA_PROVINCES } from '@/lib/sites';
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
      m.on('click', (e) => {
        const loc = pointLocation(+e.lngLat.lng.toFixed(6), +e.lngLat.lat.toFixed(6), current.current?.osm ?? '', current.current?.osmName ?? '');
        latest.current(loc);
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
        const was = current.current;
        latest.current(pointLocation(+p.lng.toFixed(6), +p.lat.toFixed(6), was?.osm ?? '', was?.osmName ?? ''));
      });
    } else marker.current.setLngLat(at);
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
    latest.current(pointLocation(h.lng, h.lat, h.osm, h.name), { ...h.place, name: h.name });
    setHits(null);
    map.current?.flyTo({ center: [h.lng, h.lat], zoom: 16 });
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
        {value
          ? `Pin at ${value.center[1].toFixed(5)}, ${value.center[0].toFixed(5)}. Drag it, or click the map, to move it onto the mall.`
          : 'Find the mall above, or click the map where it is.'}{' '}
        Search by OpenStreetMap.
      </p>
    </div>
  );
}
