import type { MallLocation, ScreenPin } from '@/lib/malls';

/**
 * A mall's real OpenStreetMap outline as a small inline SVG, with its placed
 * screens as dots — a recognisable "shape" for each card on the index, drawn
 * without loading a map. Uses a flat projection scaled by cos(latitude),
 * which is accurate enough at the scale of a single building.
 */

const SIZE = { w: 320, h: 200 };
const PADDING = 22;

type Ring = readonly (readonly [number, number])[];

function ringsOf(location: MallLocation): Ring[] {
  const outline = location.outline;
  if (!outline) return [];
  const polygons = (outline.type === 'Polygon' ? [outline.coordinates] : outline.coordinates) as Ring[][];
  // Outer rings only; courtyards and holes add noise at thumbnail size.
  return polygons.map((polygon) => polygon[0]).filter((ring) => ring && ring.length > 2);
}

export interface ProjectedOutline {
  readonly path: string;
  readonly center: readonly [number, number];
  readonly pins: readonly (readonly [number, number])[];
}

/** Projects a mall's outline and pins into a `width × height` box. */
export function projectOutline(
  location: MallLocation,
  pins: readonly ScreenPin[],
  width: number,
  height: number,
  padding: number,
): ProjectedOutline {
  const rings = ringsOf(location);
  const scaleX = Math.cos((location.center[1] * Math.PI) / 180);
  const points = [...rings.flat(), ...pins.map((pin) => [pin.lng, pin.lat] as const), location.center];
  const xs = points.map(([lng]) => lng * scaleX);
  const ys = points.map(([, lat]) => -lat);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(Math.max(...xs) - minX, 1e-6);
  const spanY = Math.max(Math.max(...ys) - minY, 1e-6);
  const scale = Math.min((width - padding * 2) / spanX, (height - padding * 2) / spanY);
  const offsetX = (width - spanX * scale) / 2;
  const offsetY = (height - spanY * scale) / 2;
  // Rounded: Node and the browser disagree on Math.cos in the last few
  // digits, which would otherwise make server and client HTML differ.
  const round = (value: number) => Math.round(value * 10) / 10;
  const project = (lng: number, lat: number) =>
    [round(offsetX + (lng * scaleX - minX) * scale), round(offsetY + (-lat - minY) * scale)] as const;

  const path = rings
    .map(
      (ring) =>
        ring
          .map(([lng, lat], index) => {
            const [x, y] = project(lng, lat);
            return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
          })
          .join('') + 'Z',
    )
    .join('');

  return {
    path,
    center: project(location.center[0], location.center[1]),
    pins: pins.map((pin) => project(pin.lng, pin.lat)),
  };
}

export function MallOutlinePreview({
  location,
  pins,
}: {
  location: MallLocation;
  pins: readonly ScreenPin[];
}) {
  const projected = projectOutline(location, pins, SIZE.w, SIZE.h, PADDING);
  const { path } = projected;
  const [cx, cy] = projected.center;

  return (
    <svg viewBox={`0 0 ${SIZE.w} ${SIZE.h}`} className="h-full w-full" aria-hidden="true">
      {path ? (
        <path
          d={path}
          pathLength={1}
          className="mall-outline fill-accent stroke-accent transition-[fill-opacity] duration-slow ease-standard [fill-opacity:0.12] group-hover:[fill-opacity:0.22]"
          strokeWidth={1.5}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ) : (
        // OpenStreetMap only has this mall as a point.
        <g className="text-accent">
          <circle cx={cx} cy={cy} r={34} className="fill-accent stroke-accent" fillOpacity={0.12} strokeDasharray="4 5" />
          <circle cx={cx} cy={cy} r={5} className="fill-accent" />
        </g>
      )}
      {projected.pins.map(([x, y], index) => {
        return (
          <g key={index}>
            <circle
              cx={x}
              cy={y}
              r={9}
              fillOpacity={0.3}
              className="fill-accent [transform-box:fill-box] [transform-origin:center] motion-safe:group-hover:animate-ping"
            />
            <circle cx={x} cy={y} r={4.5} className="fill-accent stroke-bg" strokeWidth={2} />
          </g>
        );
      })}
    </svg>
  );
}
