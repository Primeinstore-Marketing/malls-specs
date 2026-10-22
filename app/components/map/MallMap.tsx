'use client';

import { useEffect, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { GeoJSONSource, LngLatBoundsLike, Map as MapLibreMap, Marker } from 'maplibre-gl';
import type { Specification } from '@data-model';
import { withBasePath } from '@/lib/basePath';
import { getScreenSize } from '@/lib/malls';
import type { Mall, MallLocation, PinSource, ScreenPin } from '@/lib/malls';
import { Stepper, ZoomControls } from './MapControls';

/**
 * The street-map view of one mall: OpenStreetMap tiles (served by
 * OpenFreeMap, which needs no API key and allows production use), the
 * mall's outline, an optional floor-plan image laid over it, and a marker
 * per placed screen. Moving between screens uses MapLibre's `flyTo`, which
 * zooms out and back in along a curve — the same move Prezi makes between
 * frames, and it works just as well from Menlyn to Canal Walk.
 */

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const OUTLINE_SOURCE = 'mall-outline';
const PLAN_SOURCE = 'floor-plan';
const SCREEN_ZOOM = 18;
/** Mall-to-mall flights can span the country; keep them brisk. */
const MALL_SWITCH_MS = 2500;
const MAX_FIT_ZOOM = 18;
const FIT_PADDING = { top: 64, bottom: 96, left: 48, right: 48 };

function boundsOf(location: MallLocation): LngLatBoundsLike {
  const [[west, south], [east, north]] = location.bounds;
  return [west, south, east, north];
}

function outlineData(location: MallLocation | null): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: location?.outline
      ? [{ type: 'Feature', properties: {}, geometry: location.outline as GeoJSON.Geometry }]
      : [],
  };
}

function readToken(name: string, fallback: string) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

/**
 * Builds a marker: the screen drawn at its real aspect ratio, captioned.
 * A placeholder position is drawn hollow and dashed with a "?", so it can't
 * be mistaken for a known location.
 */
function createMarkerElement(spec: Specification, source: PinSource, onClick: () => void): HTMLButtonElement {
  const size = getScreenSize(spec);
  const ratio = size ? size.width / size.height : 16 / 9;
  const width = ratio >= 40 / 26 ? 40 : Math.max(10, 26 * ratio);
  const height = ratio >= 40 / 26 ? Math.max(8, 40 / ratio) : 26;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'mall-screen-marker group relative flex flex-col items-center outline-none';
  button.setAttribute('aria-label', `${spec.title}${size ? `, ${size.width} × ${size.height}` : ''}`);
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    onClick();
  });

  const screen = document.createElement('span');
  const placeholder = source === 'placeholder';
  screen.className = `flex items-center justify-center rounded-[3px] shadow-2 ring-2 ring-white transition-transform duration-normal ease-expressive ${
    placeholder
      ? 'rounded-full border-2 border-dashed border-fg-subtle bg-bg text-[12px] font-bold text-fg-muted'
      : size
        ? 'bg-brand'
        : 'border border-dashed border-border-control bg-bg-muted'
  }`;
  if (placeholder) screen.textContent = '?';
  // A placeholder's shape would suggest more than we know, so it's a plain badge.
  screen.style.width = `${placeholder ? 22 : width}px`;
  screen.style.height = `${placeholder ? 22 : height}px`;
  button.appendChild(screen);

  const label = document.createElement('span');
  // Placeholders cluster near the mall centre, so their names only show on
  // hover or when selected — otherwise the labels pile into an unreadable knot.
  label.className = `pointer-events-none absolute top-full mt-1 whitespace-nowrap rounded-full bg-bg px-2 py-0.5 text-label-sm text-fg shadow-1 ${
    placeholder ? 'opacity-0 transition-opacity duration-fast group-hover:opacity-100 group-focus-visible:opacity-100' : ''
  }`;
  label.textContent = spec.title;
  button.appendChild(label);

  return button;
}

export interface MallMapProps {
  readonly mall: Mall;
  readonly location: MallLocation;
  readonly specs: readonly Specification[];
  readonly pins: Readonly<Record<string, ScreenPin>>;
  readonly focusedId: string | null;
  readonly onFocus: (specId: string | null) => void;
  readonly onStep: (direction: 1 | -1) => void;
  readonly editMode: boolean;
  readonly onPinMove: (specId: string, lng: number, lat: number) => void;
  readonly onStartPlacing: () => void;
}

export function MallMap({
  mall,
  location,
  specs,
  pins,
  focusedId,
  onFocus,
  onStep,
  editMode,
  onPinMove,
  onStartPlacing,
}: MallMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const markerClassRef = useRef<typeof Marker | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [cursor, setCursor] = useState<{ lng: number; lat: number } | null>(null);

  // Latest callbacks, read from inside MapLibre event handlers.
  const onFocusRef = useRef(onFocus);
  onFocusRef.current = onFocus;
  const onPinMoveRef = useRef(onPinMove);
  onPinMoveRef.current = onPinMove;
  // In edit mode, a click on the map places the focused screen if it has no
  // position yet; otherwise a click on empty map returns to the overview.
  const placingRef = useRef<string | null>(null);
  const needsPlacing = (specId: string | null) =>
    specId != null && (!pins[specId] || pins[specId].source === 'placeholder');
  placingRef.current = editMode && needsPlacing(focusedId) ? focusedId : null;

  // Create the map once. MapLibre touches `window` at import time, so it's
  // loaded here rather than at the top of the module (static export / SSR).
  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | null = null;

    import('maplibre-gl')
      .then(({ default: maplibre }) => {
        if (cancelled || !containerRef.current) return;
        markerClassRef.current = maplibre.Marker;
        const map = new maplibre.Map({
          container: containerRef.current,
          style: STYLE_URL,
          bounds: boundsOf(location),
          fitBoundsOptions: { padding: FIT_PADDING, maxZoom: MAX_FIT_ZOOM },
          maxZoom: 21,
          // Arrow keys step between screens instead of panning the map.
          keyboard: false,
          dragRotate: false,
          pitchWithRotate: false,
          attributionControl: { compact: true },
        });
        map.touchZoomRotate.disableRotation();
        mapRef.current = map;

        map.on('load', () => {
          if (cancelled) return;
          const accent = readToken('--color-accent', '#2861fd');
          map.addSource(OUTLINE_SOURCE, { type: 'geojson', data: outlineData(location) });
          map.addLayer({
            id: 'mall-outline-fill',
            type: 'fill',
            source: OUTLINE_SOURCE,
            paint: { 'fill-color': accent, 'fill-opacity': 0.08 },
          });
          map.addLayer({
            id: 'mall-outline-line',
            type: 'line',
            source: OUTLINE_SOURCE,
            paint: { 'line-color': accent, 'line-width': 2, 'line-opacity': 0.8 },
          });
          setReady(true);
        });
        map.on('error', (event) => {
          // Tile hiccups are routine; only a style failure leaves the map blank.
          if (!map.isStyleLoaded() && !map.loaded()) setFailed(true);
          console.warn('[map]', event.error?.message ?? event);
        });
        map.on('click', (event) => {
          if (placingRef.current) onPinMoveRef.current(placingRef.current, event.lngLat.lng, event.lngLat.lat);
          else onFocusRef.current(null);
        });
        map.on('mousemove', (event) => setCursor({ lng: event.lngLat.lng, lat: event.lngLat.lat }));
        map.on('mouseout', () => setCursor(null));

        observer = new ResizeObserver(() => map.resize());
        observer.observe(containerRef.current);
      })
      .catch(() => setFailed(true));

    return () => {
      cancelled = true;
      observer?.disconnect();
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current.clear();
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // The map is created once; mall changes are handled by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mall outline and floor-plan overlay follow the selected mall.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    (map.getSource(OUTLINE_SOURCE) as GeoJSONSource | undefined)?.setData(outlineData(location));

    if (map.getLayer('floor-plan')) map.removeLayer('floor-plan');
    if (map.getSource(PLAN_SOURCE)) map.removeSource(PLAN_SOURCE);
    if (mall.floorPlan) {
      const corners = mall.floorPlan.corners.map(([lng, lat]) => [lng, lat] as [number, number]);
      map.addSource(PLAN_SOURCE, {
        type: 'image',
        url: withBasePath(mall.floorPlan.src),
        coordinates: [corners[0], corners[1], corners[2], corners[3]],
      });
      map.addLayer(
        {
          id: 'floor-plan',
          type: 'raster',
          source: PLAN_SOURCE,
          paint: { 'raster-opacity': mall.floorPlan.opacity ?? 0.85, 'raster-fade-duration': 0 },
        },
        'mall-outline-line',
      );
    }
  }, [ready, mall, location]);

  // One marker per placed screen.
  useEffect(() => {
    const map = mapRef.current;
    const MarkerClass = markerClassRef.current;
    if (!map || !ready || !MarkerClass) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current.clear();

    for (const spec of specs) {
      const pin = pins[spec.id];
      if (!pin) continue;
      const element = createMarkerElement(spec, pin.source, () => onFocusRef.current(spec.id));
      const label = element.getAttribute('aria-label') ?? spec.title;
      const marker = new MarkerClass({ element, anchor: 'center', draggable: editMode })
        .setLngLat([pin.lng, pin.lat])
        .addTo(map);
      // `addTo` overwrites the element's aria-label with a generic "Map marker".
      element.setAttribute('aria-label', label);
      marker.on('dragend', () => {
        const { lng, lat } = marker.getLngLat();
        onPinMoveRef.current(spec.id, lng, lat);
      });
      markersRef.current.set(spec.id, marker);
    }
  }, [ready, specs, pins, editMode]);

  // Highlight the focused marker.
  useEffect(() => {
    markersRef.current.forEach((marker, specId) => {
      const element = marker.getElement();
      const isFocused = specId === focusedId;
      element.style.zIndex = isFocused ? '2' : '1';
      const label = element.lastElementChild as HTMLElement | null;
      if (label) label.style.opacity = isFocused ? '1' : '';
      const screen = element.firstElementChild as HTMLElement | null;
      if (screen) {
        screen.style.transform = isFocused ? 'scale(1.5)' : '';
        screen.classList.toggle('ring-accent', isFocused);
        screen.classList.toggle('ring-white', !isFocused);
      }
      element.setAttribute('aria-pressed', String(isFocused));
    });
  }, [focusedId, pins, ready, specs, editMode]);

  // Camera: fly to the focused screen, or frame the whole mall.
  const focusedPin = focusedId ? pins[focusedId] : undefined;
  const lastMallId = useRef(mall.id);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const switchingMall = lastMallId.current !== mall.id;
    lastMallId.current = mall.id;
    const pace = switchingMall ? { duration: MALL_SWITCH_MS } : { speed: 1.1 };
    if (focusedPin) {
      map.flyTo({
        center: [focusedPin.lng, focusedPin.lat],
        zoom: Math.max(map.getZoom(), SCREEN_ZOOM),
        padding: FIT_PADDING,
        curve: 1.6,
        ...pace,
      });
    } else {
      map.fitBounds(boundsOf(location), { padding: FIT_PADDING, maxZoom: MAX_FIT_ZOOM, curve: 1.6, ...pace });
    }
  }, [ready, mall.id, location, focusedId, focusedPin]);

  const fitMall = () => {
    mapRef.current?.fitBounds(boundsOf(location), { padding: FIT_PADDING, maxZoom: MAX_FIT_ZOOM });
    onFocus(null);
  };

  const focusedIndex = specs.findIndex((spec) => spec.id === focusedId);
  const focusedSpec = focusedIndex >= 0 ? specs[focusedIndex] : null;
  // No position, or only a placeholder: offer to place it properly.
  const focusedUnplaced = focusedSpec != null && needsPlacing(focusedSpec.id);

  return (
    <div className="relative h-full w-full overflow-hidden bg-bg-subtle">
      <div
        ref={containerRef}
        role="region"
        aria-label={`${mall.name} map. Drag to pan, scroll to zoom, arrow keys to move between screens.`}
        // Explicit size, not `absolute inset-0`: MapLibre's stylesheet sets
        // `position: relative` on its container, which would collapse it.
        className={`h-full w-full ${focusedUnplaced && editMode ? '[&_canvas]:!cursor-crosshair' : ''}`}
      />

      {failed ? (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
          <p className="max-w-sm text-body-sm text-fg-muted">
            The map couldn&rsquo;t load — check your connection. The screen list alongside still works.
          </p>
        </div>
      ) : null}

      <ZoomControls
        onZoomIn={() => mapRef.current?.zoomIn()}
        onZoomOut={() => mapRef.current?.zoomOut()}
        onFit={fitMall}
      />

      {focusedUnplaced ? (
        <div className="pointer-events-none absolute inset-x-3 top-3 z-raised flex justify-start pr-32">
          <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-lg border border-warning-border bg-warning-bg px-3 py-2 text-body-sm text-warning-fg shadow-2">
            <span>
              {editMode ? (
                <>
                  Click the map where <span className="font-semibold">{focusedSpec.title}</span> is
                </>
              ) : (
                <>
                  <span className="font-semibold">{focusedSpec.title}</span>{' '}
                  {focusedPin ? 'is at a placeholder position.' : 'isn’t placed on the map yet.'}
                </>
              )}
            </span>
            {editMode ? (
              <button
                type="button"
                onClick={() => {
                  const center = mapRef.current?.getCenter();
                  if (center) onPinMove(focusedSpec.id, center.lng, center.lat);
                }}
                className="rounded-md border border-warning-border bg-bg px-2 py-0.5 font-semibold text-fg hover:bg-bg-subtle"
              >
                Place at map centre
              </button>
            ) : (
              <button
                type="button"
                onClick={onStartPlacing}
                className="rounded-md border border-warning-border bg-bg px-2 py-0.5 font-semibold text-fg hover:bg-bg-subtle"
              >
                Place it
              </button>
            )}
          </div>
        </div>
      ) : null}

      {editMode ? (
        <div className="pointer-events-none absolute bottom-24 left-3 z-raised rounded-md border border-border bg-bg px-2 py-1 font-mono text-mono-md text-fg-muted shadow-1">
          Placing screens · drag a screen to move it
          {cursor ? (
            <span className="block text-fg">
              [{cursor.lng.toFixed(6)}, {cursor.lat.toFixed(6)}]
            </span>
          ) : null}
        </div>
      ) : null}

      <Stepper
        focusedTitle={focusedSpec?.title ?? null}
        index={focusedIndex}
        total={specs.length}
        onStep={onStep}
        onOverview={fitMall}
      />
    </div>
  );
}
