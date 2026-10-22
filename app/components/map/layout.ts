import type { Specification } from '@data-model';
import { getScreenSize } from '@/lib/malls';

/**
 * World-space layout for the grid canvas — the fallback view for a "mall"
 * with no map location (Loch Logan, the network-wide formats). Units are
 * world pixels; the camera scales the whole world, so everything here —
 * including label font sizes — is authored at the world's own scale.
 */

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface FramePlacement {
  readonly spec: Specification;
  /** The screen rectangle itself, at the format's true aspect ratio. */
  readonly screen: Rect;
  /** Screen plus its caption — the clickable area, and what the camera fits. */
  readonly bounds: Rect;
  readonly labelSize: number;
  /** Resolution unknown in the source data — drawn 16:9 and dashed. */
  readonly sizeUnknown: boolean;
}

export interface GridLayout {
  readonly world: Rect;
  readonly frames: readonly FramePlacement[];
}

const FALLBACK_RATIO = 16 / 9;
const CELL = { w: 480, h: 380, gap: 120, label: 26 };
const PADDING = 140;
const HEADER = 150;
export const GRID_HEADER = { x: PADDING, y: 100 };

function fitBox(ratio: number, maxW: number, maxH: number) {
  return ratio >= maxW / maxH ? { w: maxW, h: maxW / ratio } : { w: maxH * ratio, h: maxH };
}

export function computeGridLayout(specs: readonly Specification[]): GridLayout {
  const columns = Math.max(1, Math.min(specs.length, Math.ceil(Math.sqrt(specs.length * 1.6))));
  const rows = Math.ceil(specs.length / columns);
  const gridW = columns * CELL.w + (columns - 1) * CELL.gap;
  const gridH = rows * CELL.h + (rows - 1) * CELL.gap;
  const captionSpace = CELL.label * 2.4;

  const frames = specs.map((spec, index) => {
    const cellX = PADDING + (index % columns) * (CELL.w + CELL.gap);
    const cellY = PADDING + HEADER + Math.floor(index / columns) * (CELL.h + CELL.gap);
    const size = getScreenSize(spec);
    const box = fitBox(size ? size.width / size.height : FALLBACK_RATIO, CELL.w, CELL.h - captionSpace);
    return {
      spec,
      screen: {
        x: cellX + (CELL.w - box.w) / 2,
        y: cellY + (CELL.h - captionSpace - box.h) / 2,
        w: box.w,
        h: box.h,
      },
      bounds: { x: cellX, y: cellY, w: CELL.w, h: CELL.h },
      labelSize: CELL.label,
      sizeUnknown: size == null,
    };
  });

  return {
    world: { x: 0, y: 0, w: gridW + PADDING * 2, h: gridH + PADDING * 2 + HEADER },
    frames,
  };
}

export function unionRect(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}
