'use client';

import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuthDialog } from './AuthDialogContext';
import { useAdminSession } from './AdminSession';
import { Button } from '@/components/ui/Button';

export function SignInDialog() {
  const { open, setOpen } = useAuthDialog();
  const { signIn, available } = useAdminSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    emailRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, setOpen]);

  if (!open) return null;

  const close = () => {
    setOpen(false);
    setError(null);
    setPassword('');
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
      setEmail('');
      close();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Sign-in failed. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'h-10 rounded-md border border-border-strong bg-bg px-3 text-body-md text-fg outline-none transition-colors duration-fast ease-standard placeholder:text-fg-subtle focus-visible:border-border-focus disabled:opacity-60';

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-[rgba(6,12,28,0.55)] backdrop-blur-md px-4" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sign-in-title"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-sm overflow-hidden rounded-xl border border-border bg-bg shadow-4"
      >
        <div className="flex items-start justify-between gap-4 bg-brand-surface px-6 py-5">
          <div className="flex flex-col gap-1">
            <span id="sign-in-title" className="text-display-sm text-brand-on-surface">
              Admin sign in
            </span>
            <span className="text-body-sm text-brand-on-surface-muted">
              For editing specs and screen positions. Browsing doesn&rsquo;t need an account.
            </span>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-brand-on-surface-muted transition-colors duration-fast ease-standard hover:text-brand-on-surface"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-6 py-6" noValidate>
          {!available ? (
            <p className="rounded-md border border-warning-border bg-warning-bg px-3 py-2 text-body-sm text-warning-fg">
              This copy of the site isn&rsquo;t connected to the admin server, so signing in isn&rsquo;t possible here.
            </p>
          ) : null}

          <label className="flex flex-col gap-1.5">
            <span className="text-label-md uppercase text-fg-subtle">Email</span>
            <input
              ref={emailRef}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              autoComplete="username"
              required
              disabled={submitting || !available}
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-label-md uppercase text-fg-subtle">Password</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete="current-password"
              required
              disabled={submitting || !available}
              className={inputClass}
            />
          </label>

          {error ? (
            <p role="alert" className="rounded-md border border-danger-border bg-danger-bg px-3 py-2 text-body-sm text-danger-fg">
              {error}
            </p>
          ) : null}

          <Button
            type="submit"
            variant="primary"
            className="mt-1 h-10 justify-center"
            disabled={submitting || !available || !email.trim() || !password}
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
          <p className="text-center text-body-sm text-fg-subtle">
            Need an account or forgot your password? Ask an existing admin.
          </p>
        </form>
      </div>
    </div>
  );
}
