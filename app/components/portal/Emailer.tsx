'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ClientEmail } from '@/lib/portal/email';

/**
 * Sending an email to a client, on any computer: see the email as the client
 * will, copy it (with its design), open a new email in Outlook, Gmail or the
 * mail app with the address and subject filled in, and paste. Works the same
 * on Mac and Windows, in the browser or the desktop apps.
 */
export function Emailer({
  email,
  title = 'Email the client',
  doneLabel = 'I’ve sent it',
  onSent,
  onClose,
}: {
  email: ClientEmail;
  title?: string;
  doneLabel?: string;
  onSent?: () => void;
  onClose: () => void;
}) {
  const [to, setTo] = useState(email.to);
  const [copied, setCopied] = useState<'email' | 'subject' | 'link' | null>(null);
  const [opened, setOpened] = useState(false);
  const hidden = useRef<HTMLDivElement>(null);
  const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const paste = mac ? '⌘V' : 'Ctrl+V';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const flash = (what: 'email' | 'subject' | 'link') => {
    setCopied(what);
    setTimeout(() => setCopied((c) => (c === what ? null : c)), 2500);
  };

  /** Copies the designed email. Rich copy where the browser allows; otherwise copies the rendered email. */
  async function copyEmail() {
    try {
      if (typeof ClipboardItem === 'undefined') throw new Error('no rich clipboard');
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([email.html], { type: 'text/html' }),
          'text/plain': new Blob([email.text], { type: 'text/plain' }),
        }),
      ]);
    } catch {
      const node = hidden.current;
      if (node) {
        node.innerHTML = email.html;
        const range = document.createRange();
        range.selectNodeContents(node);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
        document.execCommand('copy');
        sel?.removeAllRanges();
      }
    }
    flash('email');
  }

  async function copyText(text: string, what: 'subject' | 'link') {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      window.prompt('Copy this:', text);
    }
    flash(what);
  }

  const q = (o: Record<string, string>) => Object.entries(o).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  const apps = [
    { label: 'Outlook', note: 'Work email in the browser', href: `https://outlook.office.com/mail/deeplink/compose?${q({ to, subject: email.subject })}`, newTab: true },
    { label: 'Gmail', note: 'In the browser', href: `https://mail.google.com/mail/?${q({ view: 'cm', fs: '1', to, su: email.subject })}`, newTab: true },
    { label: 'Mail app', note: mac ? 'Outlook or Apple Mail on this Mac' : 'Outlook on this PC', href: `mailto:${to}?${q({ subject: email.subject })}`, newTab: false },
  ];
  const step = 'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-body-sm font-bold';
  const appBtn =
    'flex min-w-0 flex-1 flex-col items-start rounded-xl border border-border-strong px-3 py-2 text-left hover:border-accent hover:bg-accent-subtle';

  return createPortal(
    <div className="fixed inset-0 z-modal flex items-end justify-center bg-[rgba(6,12,28,0.6)] sm:items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="emailer-title"
        className="flex max-h-[100dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-3xl bg-bg shadow-3 sm:max-h-[92vh] sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <h2 id="emailer-title" className="text-display-sm text-fg">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full text-fg-muted hover:bg-bg-subtle hover:text-fg">✕</button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_340px] lg:overflow-hidden">
          {/* The email, as the client sees it. */}
          <div className="flex min-h-0 flex-col bg-bg-subtle lg:overflow-hidden">
            <div className="flex flex-col gap-1 border-b border-border bg-bg px-5 py-3 text-body-sm">
              <label className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-fg-muted">To</span>
                <input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="client@company.com" className="h-9 min-w-0 flex-1 rounded-lg border border-border-strong bg-bg px-2.5 text-body-sm text-fg outline-none focus:border-border-focus" />
              </label>
              <div className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-fg-muted">Subject</span>
                <span className="min-w-0 flex-1 truncate font-semibold text-fg">{email.subject}</span>
                <button type="button" onClick={() => void copyText(email.subject, 'subject')} className="shrink-0 text-body-sm font-semibold text-accent hover:underline">
                  {copied === 'subject' ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
            <iframe title="The email as the client will see it" srcDoc={`<!doctype html><html><body style="margin:0">${email.html}</body></html>`} className="h-[55vh] w-full flex-1 border-0 bg-white lg:h-auto" sandbox="allow-popups allow-popups-to-escape-sandbox" />
          </div>

          {/* How to send it. */}
          <div className="flex flex-col gap-5 border-t border-border p-5 lg:overflow-y-auto lg:border-l lg:border-t-0">
            <div className="flex gap-3">
              <span className={`${step} ${copied === 'email' ? 'bg-success-fg text-bg' : 'bg-accent text-fg-on-accent'}`}>{copied === 'email' ? '✓' : '1'}</span>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <strong className="text-body-md text-fg">Copy the email</strong>
                <button type="button" onClick={() => void copyEmail()} className="inline-flex h-11 items-center justify-center rounded-full bg-accent px-5 text-body-sm font-semibold text-fg-on-accent hover:bg-accent-hover">
                  {copied === 'email' ? 'Copied ✓' : 'Copy email'}
                </button>
              </div>
            </div>
            <div className="flex gap-3">
              <span className={`${step} ${opened ? 'bg-success-fg text-bg' : 'bg-bg-muted text-fg'}`}>{opened ? '✓' : '2'}</span>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <strong className="text-body-md text-fg">Open a new email</strong>
                <span className="text-body-sm text-fg-muted">The address and subject are filled in.</span>
                <div className="flex flex-col gap-2">
                  {apps.map((a) => (
                    <a key={a.label} href={a.href} target={a.newTab ? '_blank' : undefined} rel="noopener" onClick={() => setOpened(true)} className={appBtn}>
                      <span className="text-body-sm font-semibold text-fg">{a.label}</span>
                      <span className="text-[12px] text-fg-subtle">{a.note}</span>
                    </a>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <span className={`${step} bg-bg-muted text-fg`}>3</span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <strong className="text-body-md text-fg">Paste and send</strong>
                <span className="text-body-sm text-fg-muted">Click in the message and press <kbd className="rounded border border-border-strong px-1.5 font-mono text-[12px]">{paste}</kbd>. The email keeps its design.</span>
              </div>
            </div>
            <div className="mt-auto flex flex-col gap-2 border-t border-border pt-4">
              {onSent ? (
                <button type="button" onClick={() => { onSent(); onClose(); }} className="inline-flex h-11 items-center justify-center rounded-full border border-border-strong px-5 text-body-sm font-semibold text-fg hover:border-fg">
                  {doneLabel}
                </button>
              ) : null}
              <button type="button" onClick={() => void copyText(email.link, 'link')} className="text-body-sm font-semibold text-fg-muted hover:text-fg">
                {copied === 'link' ? 'Link copied' : 'Just copy the client’s link'}
              </button>
              <a href={`mailto:${to}?${q({ subject: email.subject, body: email.text })}`} className="text-center text-body-sm text-fg-subtle hover:text-fg hover:underline">
                Or open it as plain text
              </a>
            </div>
          </div>
        </div>
        <div ref={hidden} aria-hidden="true" className="pointer-events-none fixed -left-[9999px] top-0 bg-white" />
      </div>
    </div>,
    document.body,
  );
}
