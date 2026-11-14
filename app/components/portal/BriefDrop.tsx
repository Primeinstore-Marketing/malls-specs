'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import type { BriefDraft } from '@/lib/api';
import { BRIEF_ACCEPT, MAX_BRIEF_MB, readBrief } from '@/lib/portal/briefReader';

type State = { step: 'idle' } | { step: 'reading' | 'drafting'; file: string } | { step: 'error'; text: string };

/**
 * "Start from the client's brief": drop or choose a PDF, Word, PowerPoint,
 * Excel or image file, and the AI drafts the whole proposal from it.
 */
export function BriefDrop({ inventory, onDraft, pims = false, compact = false }: { inventory: () => string; onDraft: (draft: BriefDraft, filename: string, truncated: boolean) => void; /** Making a site list: ask for the PIMS export. */ pims?: boolean; /** A slim bar, and a file dropped anywhere on the page is read. */ compact?: boolean }) {
  const [state, setState] = useState<State>({ step: 'idle' });
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const busy = state.step === 'reading' || state.step === 'drafting';

  async function handle(file: File | undefined) {
    if (!file || busy) return;
    setState({ step: 'reading', file: file.name });
    try {
      const payload = await readBrief(file);
      setState({ step: 'drafting', file: file.name });
      const { draft, truncated } = await api.briefDraft({
        filename: file.name,
        ...(payload.kind === 'file' ? { file: payload.file } : { text: payload.text }),
        inventory: inventory(),
        today: new Date().toISOString().slice(0, 10),
      });
      setState({ step: 'idle' });
      onDraft(draft, file.name, truncated);
    } catch (e) {
      setState({ step: 'error', text: e instanceof Error ? e.message : 'That didn’t work. Try again.' });
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
      void handleRef.current(e.dataTransfer?.files?.[0]);
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
      <section aria-labelledby="brief-title" className="flex flex-col gap-1.5">
        {pageOver ? (
          <div className="pointer-events-none fixed inset-0 z-modal flex items-center justify-center bg-[rgba(6,12,28,0.55)] p-6 backdrop-blur-sm">
            <div className="rounded-3xl border-2 border-dashed border-white bg-accent px-10 py-8 text-center text-fg-on-accent shadow-4">
              <div className="text-display-sm">Drop it here</div>
              <div className="text-body-md">A brief, booking sheet or PIMS site list fills in the proposal.</div>
            </div>
          </div>
        ) : null}
        <div className={`flex flex-wrap items-center gap-3 rounded-2xl border border-dashed px-4 py-3 ${busy ? 'border-accent bg-accent-subtle' : 'border-border-strong bg-bg-subtle'}`}>
          <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-body-md text-fg-on-accent">✦</span>
          <p id="brief-title" className="min-w-0 flex-1 text-body-sm text-fg" role="status">
            {status ?? (
              <>
                <strong>Have the client’s brief, booking sheet or PIMS site list?</strong>{' '}
                <span className="text-fg-muted">Drop it anywhere on this page and the AI fills everything in. PDF, Word, PowerPoint, Excel or image, up to {MAX_BRIEF_MB} MB.</span>
              </>
            )}
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => input.current?.click()}
            className="inline-flex h-10 shrink-0 items-center rounded-full border border-border-strong bg-bg px-4 text-body-sm font-semibold text-fg hover:border-fg disabled:opacity-60"
          >
            {busy ? <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-accent/30 border-t-accent" aria-hidden="true" /> : null}
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
