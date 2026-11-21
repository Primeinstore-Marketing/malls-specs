'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import type { BriefDraft } from '@/lib/api';
import { BRIEF_ACCEPT, MAX_BRIEF_MB, readBrief } from '@/lib/portal/briefReader';
import { parseSiteRows } from '@/lib/portal/siteRows';
import type { SiteRow } from '@/lib/portal/siteRows';

/** The AI couldn't be reached: a site list from the document's rows alone, matched later by site code where possible. */
function rowsDraft(rows: readonly SiteRow[], file: string): BriefDraft {
  const dates = (k: 'start' | 'end') => rows.map((r) => r[k]).filter((d): d is string => Boolean(d)).sort();
  const starts = dates('start');
  const ends = dates('end');
  return {
    summary: `Read ${rows.length} ${rows.length === 1 ? 'site' : 'sites'} from ${file}. The AI wasn’t available, so sites are matched to screens by their site code where possible; the rest are marked “check” for you to match.`,
    name: '',
    client: { company: '', contactName: '', email: '' },
    start: starts[0] ?? null,
    end: ends[ends.length - 1] ?? null,
    objective: '',
    items: [],
    noteForClient: '',
    missing: ['Add the client and check the name: the AI wasn’t available to read them from the document.'],
    sites: rows.map(({ rate: _rate, ...r }) => ({ ...r, match: null })),
  };
}

/** What an uploaded file is turned into. */
export type BriefMake = 'proposal' | 'sitelist';

type State = { step: 'idle' } | { step: 'reading' | 'drafting'; file: string } | { step: 'error'; text: string };

/**
 * "Start from the client's brief": drop or choose a PDF, Word, PowerPoint,
 * Excel or image file, and the AI drafts the whole proposal from it.
 */
export function BriefDrop({ inventory, onDraft, pims = false, compact = false }: { inventory: () => string; onDraft: (draft: BriefDraft, filename: string, truncated: boolean, rows: readonly SiteRow[], make?: BriefMake) => void; /** Making a site list: ask for the PIMS export. */ pims?: boolean; /** A slim bar, and a file dropped anywhere on the page is read. */ compact?: boolean }) {
  const [state, setState] = useState<State>({ step: 'idle' });
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const busy = state.step === 'reading' || state.step === 'drafting';
  // Compact: the button first asks what to make, then opens the file picker.
  const [menu, setMenu] = useState(false);
  const make = useRef<BriefMake | undefined>(undefined);
  const box = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !box.current?.contains(e.target as Node)) setMenu(false);
    };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', close);
    };
  }, [menu]);
  const choose = (m: BriefMake) => {
    make.current = m;
    setMenu(false);
    input.current?.click();
  };

  async function handle(file: File | undefined, as: BriefMake | undefined = make.current) {
    make.current = undefined;
    if (!file || busy) return;
    setState({ step: 'reading', file: file.name });
    // Rows (and any prices) read here, so a site list still works when the AI can't be reached.
    let rows: SiteRow[] = [];
    try {
      const payload = await readBrief(file);
      rows = payload.kind === 'text' ? parseSiteRows(payload.text) : [];
      setState({ step: 'drafting', file: file.name });
      const { draft, truncated } = await api.briefDraft({
        filename: file.name,
        ...(payload.kind === 'file' ? { file: payload.file } : { text: payload.text }),
        inventory: inventory(),
        today: new Date().toISOString().slice(0, 10),
      });
      setState({ step: 'idle' });
      onDraft(draft, file.name, truncated, rows, as);
    } catch (e) {
      const why = e instanceof Error ? e.message : 'That didn’t work. Try again.';
      if (rows.length && !/MB|old Office|damaged|can’t open|couldn’t find any text|Drop a PDF/i.test(why)) {
        setState({ step: 'idle' });
        onDraft(rowsDraft(rows, file.name), file.name, false, rows, as);
        return;
      }
      setState({ step: 'error', text: why });
    }
  }

  // Compact: the whole page takes a dropped file, with an overlay while a file is dragged over it.
  const [pageOver, setPageOver] = useState(false);
  const handleRef = useRef(handle);
  handleRef.current = handle;
  useEffect(() => {
    if (!compact) return;
    let depth = 0;
    const hasFile = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');
    const enter = (e: DragEvent) => {
      if (!hasFile(e)) return;
      depth += 1;
      setPageOver(true);
    };
    const leave = () => {
      depth = Math.max(0, depth - 1);
      if (!depth) setPageOver(false);
    };
    const over = (e: DragEvent) => {
      if (hasFile(e)) e.preventDefault();
    };
    const drop = (e: DragEvent) => {
      if (!hasFile(e)) return;
      e.preventDefault();
      depth = 0;
      setPageOver(false);
      void handleRef.current(e.dataTransfer?.files?.[0], undefined);
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragleave', leave);
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('dragover', over);
      window.removeEventListener('drop', drop);
    };
  }, [compact]);

  if (compact) {
    const status =
      state.step === 'reading' ? `Opening ${state.file}…` : state.step === 'drafting' ? `The AI is reading ${state.file}: about half a minute…` : null;
    return (
      <section ref={box} aria-labelledby="brief-title" className="relative flex flex-col gap-1.5">
        {pageOver ? (
          <div className="pointer-events-none fixed inset-0 z-modal flex items-center justify-center bg-[rgba(6,12,28,0.55)] p-6 backdrop-blur-sm">
            <div className="rounded-3xl border-2 border-dashed border-white bg-accent px-10 py-8 text-center text-fg-on-accent shadow-4">
              <div className="text-display-sm">Drop it here</div>
              <div className="text-body-md">A brief, booking sheet or PIMS site list fills in the page.</div>
            </div>
          </div>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => setMenu((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menu}
          title={`PDF, Word, PowerPoint, Excel or image, up to ${MAX_BRIEF_MB} MB. You can also drop it anywhere on this page.`}
          className={`flex w-full items-center justify-center gap-3 rounded-2xl border border-dashed px-4 py-3 text-body-md font-semibold transition-colors disabled:cursor-wait ${busy ? 'border-accent bg-accent-subtle text-fg' : 'border-border-strong bg-bg-subtle text-fg hover:border-accent hover:bg-accent-subtle'}`}
        >
          {busy ? (
            <span className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-accent/30 border-t-accent" aria-hidden="true" />
          ) : (
            <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-body-md text-fg-on-accent">✦</span>
          )}
          <span id="brief-title">{status ?? 'Upload a brief or site list'}</span>
        </button>
        <span role="status" className="sr-only">{status ?? ''}</span>
        {menu ? (
          <div role="menu" aria-labelledby="make-title" className="absolute inset-x-0 top-full z-popover mt-2 rounded-3xl border border-border bg-bg p-3 shadow-4 sm:p-4">
            <p id="make-title" className="px-1 pb-3 text-body-md font-semibold text-fg">What do you want to make from the file?</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {([
                ['proposal', 'Make a proposal', 'From a brief or booking sheet: the AI picks the screens, client and dates.', 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6'],
                ['sitelist', 'Make a site list', 'From a PIMS export or booking: every site, with its spec sheet and template.', 'M4 6h16M4 12h16M4 18h16M8 4v4M8 10v4M8 16v4'],
              ] as const).map(([m, label, hint, icon]) => (
                <button
                  key={m}
                  type="button"
                  role="menuitem"
                  autoFocus={m === (pims ? 'sitelist' : 'proposal')}
                  onClick={() => choose(m)}
                  className="group flex items-start gap-4 rounded-2xl border-2 border-border bg-bg-subtle p-5 text-left transition-colors hover:border-accent hover:bg-accent-subtle focus-visible:border-accent focus-visible:bg-accent-subtle focus-visible:outline-none"
                >
                  <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent text-fg-on-accent">
                    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={icon} /></svg>
                  </span>
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="text-body-lg font-semibold text-fg">{label}</span>
                    <span className="text-body-sm text-fg-muted">{hint}</span>
                    <span className="mt-2 text-body-sm font-semibold text-accent group-hover:underline">Choose file →</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <div className="hidden">
          <input
            ref={input}
            type="file"
            accept={BRIEF_ACCEPT}
            className="hidden"
            onChange={(e) => {
              void handle(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>
        {state.step === 'error' ? <p role="alert" className="text-body-sm text-danger-fg">{state.text}</p> : null}
      </section>
    );
  }

  return (
    <section aria-labelledby="brief-title" className="flex flex-col gap-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void handle(e.dataTransfer.files[0]);
        }}
        className={`flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-5 py-6 text-center transition-colors sm:flex-row sm:text-left ${
          over ? 'border-accent bg-accent-subtle' : 'border-border-strong bg-bg-subtle'
        }`}
      >
        <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-xl text-fg-on-accent">✦</span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 id="brief-title" className="text-body-lg font-semibold text-fg">{pims ? 'Drop the site list exported from PIMS' : 'Start from the client’s brief or booking sheet'}</h2>
          <p className="text-body-sm text-fg-muted" role="status">
            {state.step === 'reading'
              ? `Opening ${state.file}…`
              : state.step === 'drafting'
                ? `The AI is reading ${state.file} and choosing screens. This takes about half a minute…`
                : pims
                  ? `PDF or Excel (up to ${MAX_BRIEF_MB} MB). Every line is kept, matched to its screen, spec sheet and template, and grouped by the files to make. You check it and send.`
                  : `Drop a brief, booking sheet or site list: PDF, Word, PowerPoint, Excel or image (up to ${MAX_BRIEF_MB} MB). The AI fills in the proposal; you check it and send.`}
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
          className="inline-flex h-11 shrink-0 items-center rounded-full bg-accent px-5 text-body-sm font-semibold text-fg-on-accent hover:bg-accent-hover disabled:opacity-60"
        >
          {busy ? <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" /> : null}
          {busy ? 'Working…' : 'Choose a file'}
        </button>
        <input
          ref={input}
          type="file"
          accept={BRIEF_ACCEPT}
          className="hidden"
          onChange={(e) => {
            void handle(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
      {state.step === 'error' ? <p role="alert" className="text-body-sm text-danger-fg">{state.text}</p> : null}
    </section>
  );
}
