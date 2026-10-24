import type { Specification } from '@data-model';
import { getArtworkGuide } from '@/lib/artwork';
import { formatAspectRatio, getScreenSize } from '@/lib/malls';
import { getScreenLayout } from '@/lib/screenLayouts';
import { ScreenLayoutDrawing } from './ScreenLayoutDrawing';

/**
 * The hero of the spec page: the screen size, drawn to scale and in big
 * numbers, with what to deliver underneath. It's the one thing every
 * designer and planner opening a spec needs first.
 */
export function ArtworkGuideCard({ spec }: { spec: Specification }) {
  const size = getScreenSize(spec);
  const guide = getArtworkGuide(spec);
  const layout = getScreenLayout(spec.id);
  // Size, ratio and orientation are shown large above; the rest is the delivery list.
  const delivery = [
    // Multi-panel screens: the panel geometry comes first — it's the size designers work to.
    ...(layout
      ? [
          ...(layout.panelSize
            ? [{ label: 'Each panel', value: `${layout.panelSize.width} × ${layout.panelSize.height} px`, suggested: false }]
            : []),
          { label: 'Layout', value: layout.arrangement, suggested: false },
          ...(layout.commonBand
            ? [{ label: 'Title-safe band', value: `${layout.commonBand.top}–${layout.commonBand.bottom} px from the top`, suggested: false }]
            : []),
          ...(layout.safeMargin ? [{ label: 'Safe area', value: `${layout.safeMargin} px inside each panel`, suggested: false }] : []),
        ]
      : []),
    ...guide.items.filter((item) => !['Artwork size', 'Aspect ratio', 'Orientation'].includes(item.label)),
  ];
  const anySuggested = delivery.some((item) => item.suggested);
  const ratio = size ? size.width / size.height : null;
  const orientation = size ? (size.width === size.height ? 'Square' : size.width > size.height ? 'Landscape' : 'Portrait') : null;

  return (
    <section id="artwork" aria-labelledby="artwork-title" className="overflow-hidden rounded-2xl border border-border">
      <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* The screen, to scale, on a dark stage. */}
        <div className="relative flex min-h-[220px] items-center justify-center bg-brand-surface p-8 md:min-h-[300px]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-50 [background-image:radial-gradient(rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:16px_16px]"
          />
          {layout && size ? (
            <div className="relative flex w-full flex-col items-center gap-2 px-6">
              <span className="font-mono text-[11px] text-white/60">{size.width} px</span>
              <div className="flex w-full items-center justify-center gap-3">
                <span className="whitespace-nowrap font-mono text-[11px] text-white/60 [writing-mode:vertical-rl] rotate-180">
                  {size.height} px
                </span>
                <ScreenLayoutDrawing layout={layout} width={size.width} height={size.height} className="h-auto w-full max-w-[360px]" />
              </div>
            </div>
          ) : ratio ? (
            <div className="relative flex w-full items-center justify-center" style={{ height: 200 }}>
              <div
                className="relative flex items-center justify-center rounded-md border-2 border-accent bg-[linear-gradient(135deg,rgba(40,97,253,0.28),rgba(40,97,253,0.06))] shadow-[0_0_48px_rgba(40,97,253,0.35)]"
                style={ratio >= 200 / 200 ? { width: `min(100%, ${Math.round(200 * Math.min(ratio, 4.5))}px)`, aspectRatio: String(ratio) } : { height: 200, aspectRatio: String(ratio) }}
              >
                <span className="font-mono text-[11px] font-semibold text-white/80">{formatAspectRatio(size!)}</span>
                <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[11px] text-white/60">
                  {size!.width} px
                </span>
                <span className="absolute -left-3 top-1/2 -translate-x-full -translate-y-1/2 whitespace-nowrap font-mono text-[11px] text-white/60 [writing-mode:vertical-rl] rotate-180">
                  {size!.height} px
                </span>
              </div>
            </div>
          ) : (
            <span className="relative text-body-sm text-brand-on-surface-muted">Screen size not confirmed yet</span>
          )}
        </div>

        <div className="flex flex-col gap-5 bg-bg p-6 sm:p-7">
          <div className="flex flex-col gap-2">
            <span id="artwork-title" className="text-label-md uppercase text-fg-subtle">
              Artwork size
            </span>
            {size ? (
              <p className="font-display text-[2.25rem] font-black leading-none tracking-tight text-fg sm:text-[2.75rem]">
                {size.width} <span className="text-fg-subtle">×</span> {size.height}
                <span className="ml-2 text-body-lg font-semibold text-fg-subtle">px</span>
              </p>
            ) : (
              <p className="text-display-sm text-fg">To be confirmed — ask the mall</p>
            )}
            {size ? (
              <div className="flex flex-wrap gap-2 pt-1">
                <span className="rounded-full bg-accent-subtle px-2.5 py-0.5 text-body-sm font-semibold text-accent-fg">
                  {formatAspectRatio(size)}
                </span>
                {layout ? (
                  <span className="rounded-full bg-bg-muted px-2.5 py-0.5 text-body-sm font-medium text-fg-muted">{layout.summary}</span>
                ) : (
                  <span className="rounded-full bg-bg-muted px-2.5 py-0.5 text-body-sm font-medium text-fg-muted">{orientation}</span>
                )}
                <span className="rounded-full bg-bg-muted px-2.5 py-0.5 text-body-sm font-medium text-fg-muted">Exact size</span>
              </div>
            ) : null}
          </div>

          <dl className="flex flex-col divide-y divide-border border-t border-border">
            {delivery.map((item) => (
              <div key={item.label} className="flex items-baseline justify-between gap-4 py-2.5">
                <dt className="shrink-0 text-body-sm text-fg-subtle">{item.label}</dt>
                <dd className="text-right text-body-sm font-medium text-fg">
                  {item.value}
                  {item.suggested ? <span className="ml-0.5 text-fg-subtle">*</span> : null}
                </dd>
              </div>
            ))}
          </dl>

          {anySuggested ? (
            <p className="-mt-2 text-[11px] leading-snug text-fg-subtle">
              * Suggested. Confirm with the mall before final delivery.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
