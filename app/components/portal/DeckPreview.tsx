'use client';

import { useEffect, useRef, useState } from 'react';
import type { PreviewSlide } from '@/lib/portal/deck';

const SLIDE_W = 13.333;
const SLIDE_H = 7.5;

/**
 * The presentation's slides drawn from the same objects that go into the
 * .pptx file (boxes, text, pictures, tables), to scale, so what you see is
 * what you download.
 */
export function DeckPreview({ slides }: { slides: readonly PreviewSlide[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(880);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(Math.min(960, el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const k = width / SLIDE_W; // px per inch
  const pt = (n: number) => (n / 72) * k; // points to px
  const hex = (c: string | null) => (c ? `#${c.replace('#', '')}` : 'transparent');

  return (
    <div ref={box} className="mx-auto flex w-full max-w-[960px] flex-col gap-5">
      {slides.map((s, i) => (
        <figure key={i} className="flex flex-col gap-1.5">
          <div
            className="relative overflow-hidden rounded-lg shadow-2 ring-1 ring-black/5"
            style={{ width, height: (width * SLIDE_H) / SLIDE_W, background: hex(s.background), fontFamily: 'Arial, Helvetica, sans-serif' }}
          >
            {s.pieces.map((p, j) => {
              const pos = { position: 'absolute' as const, left: p.x * k, top: p.y * k, width: p.w * k };
              if (p.kind === 'box') {
                return <div key={j} style={{ ...pos, height: p.h * k, background: hex(p.fill), opacity: p.fill ? p.alpha : 1, border: p.line ? `1px ${p.dash ? 'dashed' : 'solid'} ${hex(p.line)}` : undefined }} />;
              }
              if (p.kind === 'image') {
                // eslint-disable-next-line @next/next/no-img-element
                return <img key={j} src={p.src} alt="" style={{ ...pos, height: p.h * k, objectFit: 'cover' }} />;
              }
              if (p.kind === 'text') {
                return (
                  <div
                    key={j}
                    style={{
                      ...pos,
                      height: p.h * k,
                      background: hex(p.fill),
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: p.valign === 'middle' ? 'center' : p.valign === 'bottom' ? 'flex-end' : 'flex-start',
                      textAlign: p.align as 'left' | 'center' | 'right',
                      overflow: 'hidden',
                      lineHeight: 1.18,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    <span>
                      {p.runs.map((r, n) => (
                        <span key={n} style={{ color: hex(r.color), fontSize: pt(r.size), fontWeight: r.bold ? 700 : 400, fontStyle: r.italic ? 'italic' : undefined, textDecoration: r.underline ? 'underline' : undefined }}>
                          {r.text}
                        </span>
                      ))}
                    </span>
                  </div>
                );
              }
              const total = p.colW.reduce((a, b) => a + b, 0) || p.w;
              return (
                <table key={j} style={{ ...pos, borderCollapse: 'collapse', fontSize: pt(p.size), tableLayout: 'fixed' }}>
                  <colgroup>{p.colW.map((c, n) => <col key={n} style={{ width: `${(c / total) * 100}%` }} />)}</colgroup>
                  <tbody>
                    {p.rows.map((row, r) => (
                      <tr key={r}>
                        {row.map((cell, n) => (
                          <td key={n} style={{ border: '1px solid #E7E8EC', padding: `${0.05 * k}px ${0.08 * k}px`, color: hex(cell.color), background: hex(cell.fill), fontWeight: cell.bold ? 700 : 400, textAlign: cell.align as 'left' | 'right', whiteSpace: 'pre-wrap', verticalAlign: 'top' }}>
                            {cell.text}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              );
            })}
          </div>
          <figcaption className="text-[12px] text-fg-muted">Slide {i + 1}</figcaption>
        </figure>
      ))}
    </div>
  );
}
