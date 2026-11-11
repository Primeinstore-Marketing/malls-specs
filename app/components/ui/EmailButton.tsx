'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * An email button that always works. A plain mailto: link does nothing on a
 * computer without a mail app set up, so this offers the ready-written email
 * in Outlook or Gmail on the web, the mail app, or copied to paste anywhere.
 *
 * `href` is a mailto: link (to, subject and body). `onSent` runs once the
 * person has picked a way to send it.
 */
export function EmailButton({
  href,
  className,
  children,
  onSent,
  align = 'left',
  up = false,
}: {
  href: string | undefined;
  className: string;
  children: React.ReactNode;
  onSent?: () => void;
  align?: 'left' | 'right';
  /** Open the menu above the button (e.g. in a bar at the bottom of the screen). */
  up?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  if (!href) {
    return (
      <button type="button" disabled className={`${className} cursor-not-allowed opacity-50`}>
        {children}
      </button>
    );
  }

  const { to, subject, body } = parseMailto(href);
  const q = (o: Record<string, string>) => Object.entries(o).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  const outlook = `https://outlook.office.com/mail/deeplink/compose?${q({ to, subject, body })}`;
  const gmail = `https://mail.google.com/mail/?${q({ view: 'cm', fs: '1', to, su: subject, body })}`;

  const done = () => {
    setOpen(false);
    onSent?.();
  };
  const copy = async () => {
    const text = `To: ${to}\nSubject: ${subject}\n\n${body}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      window.prompt('Copy the email:', text);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    done();
  };

  const item = 'flex w-full flex-col items-start gap-0.5 rounded-xl px-3 py-2.5 text-left hover:bg-bg-subtle focus-visible:bg-bg-subtle focus-visible:outline-none';
  return (
    <div ref={box} className="relative inline-flex">
      <button type="button" aria-haspopup="menu" aria-expanded={open} className={className} onClick={() => setOpen((v) => !v)}>
        {copied ? 'Copied — paste it into your email' : children}
      </button>
      {open ? (
        <div role="menu" className={`absolute z-popover ${up ? 'bottom-full mb-2' : 'top-full mt-2'} flex w-72 flex-col gap-0.5 rounded-2xl border border-border bg-bg p-1.5 shadow-3 ${align === 'right' ? 'right-0' : 'left-0'}`}>
          <p className="px-3 pb-1 pt-2 text-body-sm text-fg-muted">
            The email is written for you{to ? <> to <strong className="text-fg">{to}</strong></> : ''}. Open it in:
          </p>
          <a role="menuitem" href={outlook} target="_blank" rel="noopener" className={item} onClick={done}>
            <span className="text-body-sm font-semibold text-fg">Outlook</span>
            <span className="text-[12px] text-fg-subtle">Work email (Microsoft 365) in the browser</span>
          </a>
          <a role="menuitem" href={gmail} target="_blank" rel="noopener" className={item} onClick={done}>
            <span className="text-body-sm font-semibold text-fg">Gmail</span>
          </a>
          <a role="menuitem" href={href} className={item} onClick={done}>
            <span className="text-body-sm font-semibold text-fg">Mail app on this computer</span>
            <span className="text-[12px] text-fg-subtle">Outlook, Apple Mail…</span>
          </a>
          <button type="button" role="menuitem" className={item} onClick={() => void copy()}>
            <span className="text-body-sm font-semibold text-fg">Copy the email</span>
            <span className="text-[12px] text-fg-subtle">Paste it into any email</span>
          </button>
          <p className="px-3 pb-2 pt-1 text-[12px] text-fg-subtle">Check it, then press Send.</p>
        </div>
      ) : null}
    </div>
  );
}

export function parseMailto(href: string): { to: string; subject: string; body: string } {
  const [head, query = ''] = href.replace(/^mailto:/i, '').split('?');
  const params = new URLSearchParams(query.replace(/\+/g, '%2B'));
  return { to: decodeURIComponent(head), subject: params.get('subject') ?? '', body: params.get('body') ?? '' };
}
