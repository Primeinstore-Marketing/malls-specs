'use client';

/**
 * Floating controls shared by the street map and the grid canvas, so both
 * views look and behave the same: zoom buttons top-right, and the Prezi-style
 * stepper (prev · current · next) along the bottom.
 */

function MinusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <path d="M5 12h14" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function FitIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
      <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
    </svg>
  );
}

function ArrowIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      {direction === 'left' ? <polyline points="15 18 9 12 15 6" /> : <polyline points="9 18 15 12 9 6" />}
    </svg>
  );
}

const CONTROL =
  'inline-flex h-8 w-8 items-center justify-center rounded-md text-fg-muted transition-colors duration-fast ease-standard hover:bg-bg-subtle hover:text-fg disabled:cursor-not-allowed disabled:opacity-40';

export function ZoomControls({
  onZoomIn,
  onZoomOut,
  onFit,
}: {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-3 top-3 z-raised flex justify-end">
      <div className="pointer-events-auto flex items-center gap-0.5 rounded-lg border border-border bg-bg p-0.5 shadow-2">
        <button type="button" className={CONTROL} onClick={onZoomOut} aria-label="Zoom out">
          <MinusIcon />
        </button>
        <button type="button" className={CONTROL} onClick={onFit} aria-label="Show whole mall">
          <FitIcon />
        </button>
        <button type="button" className={CONTROL} onClick={onZoomIn} aria-label="Zoom in">
          <PlusIcon />
        </button>
      </div>
    </div>
  );
}

export function Stepper({
  focusedTitle,
  index,
  total,
  onStep,
  onOverview,
}: {
  focusedTitle: string | null;
  index: number;
  total: number;
  onStep: (direction: 1 | -1) => void;
  onOverview: () => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-3 bottom-10 z-raised flex justify-center">
      <div className="pointer-events-auto flex max-w-full items-center gap-1 rounded-full border border-border bg-bg p-1 shadow-2">
        <button type="button" className={`${CONTROL} rounded-full`} onClick={() => onStep(-1)} aria-label="Previous screen">
          <ArrowIcon direction="left" />
        </button>
        <button
          type="button"
          onClick={onOverview}
          className="min-w-0 truncate rounded-full px-3 py-1 text-body-sm text-fg transition-colors duration-fast ease-standard hover:bg-bg-subtle"
          aria-live="polite"
        >
          {focusedTitle != null ? (
            <>
              <span className="font-mono text-fg-subtle">
                {index + 1}/{total}
              </span>{' '}
              <span className="font-semibold">{focusedTitle}</span>
            </>
          ) : (
            <>
              <span className="font-semibold">Overview</span>{' '}
              <span className="text-fg-subtle">
                · {total} {total === 1 ? 'screen' : 'screens'}
              </span>
            </>
          )}
        </button>
        <button type="button" className={`${CONTROL} rounded-full`} onClick={() => onStep(1)} aria-label="Next screen">
          <ArrowIcon direction="right" />
        </button>
      </div>
    </div>
  );
}
