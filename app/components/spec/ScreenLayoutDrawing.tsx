import type { ScreenLayout } from '@/lib/screenLayouts';

/**
 * A multi-panel screen drawn to scale: each panel where it sits in the
 * artwork canvas, its safe margin, and the band all panels share (where
 * titles must go). Drawn in artwork pixels, so it's exact at any size.
 */
export function ScreenLayoutDrawing({
  layout,
  width,
  height,
  className = '',
}: {
  layout: ScreenLayout;
  width: number;
  height: number;
  className?: string;
}) {
  // A small visual gap so the panels read as separate. Not the real gap —
  // the spec says that's built into the template.
  const gap = width * 0.014;
  const label = width * 0.032;
  const stroke = width * 0.0025;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role="img"
      aria-label={`${layout.summary}: ${layout.arrangement}`}
      overflow="visible"
    >
      <defs>
        <linearGradient id="panel-fill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3d6fff" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#2861fd" stopOpacity="0.18" />
        </linearGradient>
      </defs>

      {/* The canvas envelope. */}
      <rect x={0} y={0} width={width} height={height} fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth={stroke} strokeDasharray={`${stroke * 6} ${stroke * 4}`} />

      {layout.panels.map((panel) => (
        <g key={panel.label}>
          <rect
            x={panel.x + gap / 2}
            y={panel.y}
            width={panel.width - gap}
            height={panel.height}
            rx={width * 0.004}
            fill="url(#panel-fill)"
            stroke="#7f9cff"
            strokeWidth={stroke * 1.6}
          />
          {layout.safeMargin ? (
            <rect
              x={panel.x + gap / 2 + layout.safeMargin}
              y={panel.y + layout.safeMargin}
              width={panel.width - gap - layout.safeMargin * 2}
              height={panel.height - layout.safeMargin * 2}
              fill="none"
              stroke="rgba(255,255,255,0.22)"
              strokeWidth={stroke}
              strokeDasharray={`${stroke * 3} ${stroke * 3}`}
            />
          ) : null}
          <text
            x={panel.x + panel.width / 2}
            y={panel.y + label * 1.9}
            textAnchor="middle"
            fill="#ffffff"
            fontSize={label}
            fontWeight={700}
            fontFamily="var(--font-mono)"
          >
            {panel.label}
          </text>
        </g>
      ))}

      {layout.commonBand ? (
        <g>
          {[layout.commonBand.top, layout.commonBand.bottom].map((y) => (
            <line
              key={y}
              x1={-width * 0.02}
              x2={width * 1.02}
              y1={y}
              y2={y}
              stroke="#ff5a6e"
              strokeWidth={stroke * 1.4}
              strokeDasharray={`${stroke * 8} ${stroke * 5}`}
            />
          ))}
          <text
            x={width / 2}
            y={(layout.commonBand.top + layout.commonBand.bottom) / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="rgba(255,255,255,0.75)"
            fontSize={label * 0.85}
            fontWeight={600}
            fontFamily="var(--font-body)"
            letterSpacing={label * 0.08}
          >
            TITLE-SAFE BAND
          </text>
        </g>
      ) : null}
    </svg>
  );
}
