'use client';

import { useRef, useState } from 'react';
import { api } from '@/lib/api';
import type { BriefDraft } from '@/lib/api';
import { BRIEF_ACCEPT, MAX_BRIEF_MB, readBrief } from '@/lib/portal/briefReader';

type State = { step: 'idle' } | { step: 'reading' | 'drafting'; file: string } | { step: 'error'; text: string };

/**
 * "Start from the client's brief": drop or choose a PDF, Word, PowerPoint,
 * Excel or image file, and the AI drafts the whole proposal from it.
 */
export function BriefDrop({ inventory, onDraft }: { inventory: () => string; onDraft: (draft: BriefDraft, filename: string, truncated: boolean) => void }) {
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
          <h2 id="brief-title" className="text-body-lg font-semibold text-fg">Start from the client’s brief</h2>
          <p className="text-body-sm text-fg-muted" role="status">
            {state.step === 'reading'
              ? `Opening ${state.file}…`
              : state.step === 'drafting'
                ? `The AI is reading ${state.file} and choosing screens. This takes about half a minute…`
                : `Drop a PDF, Word, PowerPoint, Excel or image file (up to ${MAX_BRIEF_MB} MB). The AI fills in the proposal; you check it and send.`}
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
