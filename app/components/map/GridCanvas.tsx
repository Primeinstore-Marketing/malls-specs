'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Specification } from '@data-model';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { computeGridLayout, GRID_HEADER, unionRect } from './layout';
import type { FramePlacement, Rect } from './layout';
import { Stepper, ZoomControls } from './MapControls';

/**
 * The fallback view for screens with no map location: a Prezi-style
 * zoomable canvas with the screens laid out as a grid of frames. Focusing a
 * screen zooms the camera to it; moving between two screens pulls back to
 * show both before zooming in again.
 */

interface Camera {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
}

const MIN_SCALE = 0.02;
const MAX_SCALE = 12;
const FIT_PADDING = 48;
const FLIGHT_MS = 700;
const PULLBACK_MS = 460;
const DRAG_THRESHOLD = 4;

function clampScale(scale: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

function fitCamera(rect: Rect, viewport: { w: number; h: number }): Camera {
  const availW = Math.max(1, viewport.w - FIT_PADDING * 2);
  const availH = Math.max(1, viewport.h - FIT_PADDING * 2 - 56);
  const scale = clampScale(Math.min(availW / rect.w, availH / rect.h));
  return {
    scale,
    x: viewport.w / 2 - (rect.x + rect.w / 2) * scale,
    // Nudge up a little to leave room for the stepper along the bottom edge.
    y: (viewport.h - 56) / 2 - (rect.y + rect.h / 2) * scale,
  };
}

function Frame({
  frame,
  index,
  focused,
  onSelect,
}: {
  frame: FramePlacement;
  index: number;
  focused: boolean;
  onSelect: (specId: string) => void;
}) {
  const { spec, screen, bounds, labelSize, sizeUnknown } = frame;
  const size = spec.metadata;
  const width = size.find((field) => field.key === 'width')?.value;
  const height = size.find((field) => field.key === 'height')?.value;
  const resolution = width && height ? `${width} × ${height}` : 'Resolution TBC';
  const dimSize = Math.max(labelSize * 0.8, Math.min(screen.w * 0.075, screen.h * 0.22));

  return (
    <button
      type="button"
      onClick={() => onSelect(spec.id)}
      aria-label={`${spec.title}, ${resolution}`}
      aria-pressed={focused}
      className="group absolute outline-none"
      style={{ left: bounds.x, top: bounds.y, width: bounds.w, height: bounds.h }}
    >
      <span
        className={`absolute flex items-center justify-center rounded-[2%] transition-[box-shadow,background-color] duration-normal ease-standard ${
          sizeUnknown ? 'border-dashed bg-bg-muted text-fg-subtle' : 'bg-brand text-brand-on-surface'
        } ${
          focused
            ? 'ring-accent'
            : 'ring-transparent group-hover:ring-accent/60 group-focus-visible:ring-border-focus'
        }`}
        style={{
          left: screen.x - bounds.x,
          top: screen.y - bounds.y,
          width: screen.w,
          height: screen.h,
          borderWidth: sizeUnknown ? Math.max(2, labelSize * 0.12) : 0,
          borderColor: 'var(--color-border-control)',
          boxShadow: `0 0 0 ${Math.max(2, labelSize * 0.22)}px var(--tw-ring-color)`,
        }}
      >
        <span
          aria-hidden="true"
          className="absolute left-[4%] top-[6%] font-display font-extrabold opacity-40"
          style={{ fontSize: dimSize * 0.7 }}
        >
          {String(index + 1).padStart(2, '0')}
        </span>
        <span className="font-mono font-medium tracking-tight" style={{ fontSize: dimSize }}>
          {resolution}
        </span>
      </span>
      <span
        className="absolute inset-x-0 truncate text-center font-display font-bold text-fg"
        style={{ top: screen.y - bounds.y + screen.h + labelSize * 0.5, fontSize: labelSize, lineHeight: 1.2 }}
      >
        {spec.title}
      </span>
    </button>
  );
}

export interface GridCanvasProps {
  readonly viewId: string;
  readonly title: string;
  readonly subtitle: string;
  readonly specs: readonly Specification[];
  readonly focusedId: string | null;
  readonly onFocus: (specId: string | null) => void;
  readonly onStep: (direction: 1 | -1) => void;
}

export function GridCanvas({ viewId, title, subtitle, specs, focusedId, onFocus, onStep }: GridCanvasProps) {
  const layout = useMemo(() => computeGridLayout(specs), [specs]);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<{ w: number; h: number } | null>(null);
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, scale: 0.2 });
  const [animated, setAnimated] = useState(false);
  const [flightMs, setFlightMs] = useState(FLIGHT_MS);
  const cameraRef = useRef(camera);
  cameraRef.current = camera;
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  const targetRect = useCallback(
    (specId: string | null): Rect => layout.frames.find((frame) => frame.spec.id === specId)?.bounds ?? layout.world,
    [layout],
  );

  useLayoutEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setViewport({ w: width, h: height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Fly the camera whenever the focus target changes. A resize or a mall
  // switch re-frames instantly instead, so the world never animates in from
  // a stale position.
  const lastFocus = useRef<{ viewId: string; specId: string | null } | null>(null);
  const timers = useRef<number[]>([]);
  useEffect(() => {
    if (!viewport) return;
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];

    const previous = lastFocus.current;
    lastFocus.current = { viewId, specId: focusedId };
    const target = fitCamera(targetRect(focusedId), viewport);
    const isFlight = previous != null && previous.viewId === viewId && previous.specId !== focusedId;

    if (!isFlight || prefersReducedMotion) {
      setAnimated(false);
      setCamera(target);
      return;
    }

    setAnimated(true);
    if (previous.specId != null && focusedId != null) {
      setFlightMs(PULLBACK_MS);
      setCamera(fitCamera(unionRect(targetRect(previous.specId), targetRect(focusedId)), viewport));
      timers.current.push(
        window.setTimeout(() => {
          setFlightMs(FLIGHT_MS);
          setCamera(target);
        }, PULLBACK_MS),
      );
    } else {
      setFlightMs(FLIGHT_MS);
      setCamera(target);
    }
  }, [viewId, focusedId, viewport, targetRect, prefersReducedMotion]);

  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), []);

  const zoomAt = useCallback((factor: number, point: { x: number; y: number }, smooth: boolean) => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    setAnimated(smooth);
    setFlightMs(240);
    setCamera((current) => {
      const scale = clampScale(current.scale * factor);
      const ratio = scale / current.scale;
      return { scale, x: point.x - (point.x - current.x) * ratio, y: point.y - (point.y - current.y) * ratio };
    });
  }, []);

  // Wheel / trackpad-pinch zoom around the cursor. Registered natively so it
  // can be non-passive and stop the page from scrolling underneath.
  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const box = element.getBoundingClientRect();
      const point = { x: event.clientX - box.left, y: event.clientY - box.top };
      if (event.ctrlKey || event.metaKey || Math.abs(event.deltaY) >= Math.abs(event.deltaX) * 1.5) {
        const intensity = event.ctrlKey ? 0.012 : 0.0018;
        zoomAt(Math.exp(-event.deltaY * intensity), point, false);
      } else {
        timers.current.forEach((timer) => window.clearTimeout(timer));
        setAnimated(false);
        setCamera((current) => ({ ...current, x: current.x - event.deltaX, y: current.y - event.deltaY }));
      }
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  // Drag to pan. A press only becomes a drag past a small threshold, so a
  // plain click on a frame still selects it.
  const drag = useRef<{ startX: number; startY: number; camX: number; camY: number; active: boolean } | null>(null);
  const suppressClick = useRef(false);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    drag.current = {
      startX: event.clientX,
      startY: event.clientY,
      camX: cameraRef.current.x,
      camY: cameraRef.current.y,
      active: false,
    };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state) return;
    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    if (!state.active) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      state.active = true;
      timers.current.forEach((timer) => window.clearTimeout(timer));
      setAnimated(false);
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    setCamera((current) => ({ ...current, x: state.camX + dx, y: state.camY + dy }));
  };

  const endDrag = () => {
    suppressClick.current = drag.current?.active ?? false;
    drag.current = null;
  };

  const zoomButton = (factor: number) => {
    if (!viewport) return;
    zoomAt(factor, { x: viewport.w / 2, y: viewport.h / 2 }, !prefersReducedMotion);
  };

  const overview = () => {
    if (focusedId === null && viewport) {
      // Already at overview but panned/zoomed away — re-frame in place.
      setAnimated(!prefersReducedMotion);
      setFlightMs(FLIGHT_MS);
      setCamera(fitCamera(layout.world, viewport));
    }
    onFocus(null);
  };

  const focusedIndex = specs.findIndex((spec) => spec.id === focusedId);

  return (
    <div className="relative h-full w-full overflow-hidden bg-bg-subtle">
      <div
        ref={viewportRef}
        role="region"
        aria-label={`${title} screens. Drag to pan, scroll to zoom, arrow keys to move between screens.`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={(event) => {
          if (suppressClick.current) {
            event.stopPropagation();
            event.preventDefault();
            suppressClick.current = false;
          }
        }}
        className="absolute inset-0 cursor-grab touch-none select-none active:cursor-grabbing"
        style={{
          backgroundImage: 'radial-gradient(var(--color-border) 1px, transparent 1px)',
          backgroundSize: `${Math.max(8, 24 * camera.scale * 4)}px ${Math.max(8, 24 * camera.scale * 4)}px`,
          backgroundPosition: `${camera.x}px ${camera.y}px`,
        }}
      >
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{
            width: layout.world.w,
            height: layout.world.h,
            transform: `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.scale})`,
            transition: animated ? `transform ${flightMs}ms var(--ease-expressive)` : 'none',
            visibility: viewport ? 'visible' : 'hidden',
          }}
        >
          <div
            className="absolute rounded-[28px] border-dashed border-border-control bg-bg"
            style={{ left: 0, top: 0, width: layout.world.w, height: layout.world.h, borderWidth: 4 }}
          >
            <div className="absolute flex flex-col gap-3" style={{ left: GRID_HEADER.x, top: GRID_HEADER.y }}>
              <span className="font-display font-black tracking-tight text-fg" style={{ fontSize: 72, lineHeight: 1 }}>
                {title}
              </span>
              <span className="font-body font-bold uppercase text-fg-subtle" style={{ fontSize: 22, letterSpacing: '0.12em' }}>
                {subtitle}
              </span>
            </div>
          </div>

          {layout.frames.map((frame, index) => (
            <Frame
              key={frame.spec.id}
              frame={frame}
              index={index}
              focused={frame.spec.id === focusedId}
              onSelect={(specId) => onFocus(specId === focusedId ? null : specId)}
            />
          ))}
        </div>
      </div>

      <ZoomControls
        onZoomIn={() => zoomButton(1.4)}
        onZoomOut={() => zoomButton(1 / 1.4)}
        onFit={overview}
      />
      <Stepper
        focusedTitle={focusedIndex >= 0 ? specs[focusedIndex].title : null}
        index={focusedIndex}
        total={specs.length}
        onStep={onStep}
        onOverview={overview}
      />
    </div>
  );
}
