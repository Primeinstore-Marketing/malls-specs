'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuthDialog } from './AuthDialogContext';
import { Button } from '@/components/ui/Button';

export function SignInDialog() {
  const { open, setOpen } = useAuthDialog();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!open) return null;

  const close = () => {
    setOpen(false);
    setSubmitted(false);
    setUsername('');
    setPassword('');
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-fg/40 px-4" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Sign in"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-sm overflow-hidden rounded-xl border border-border bg-bg shadow-4"
      >
        <div className="flex items-center justify-between bg-brand-surface px-6 py-5">
          <span className="text-display-sm text-brand-on-surface">Sign in</span>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-full text-brand-on-surface-muted transition-colors duration-fast ease-standard hover:text-brand-on-surface"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-6 py-6">
          <label className="flex flex-col gap-1.5">
            <span className="text-label-md uppercase text-fg-subtle">Username</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              type="text"
              autoComplete="username"
              className="h-10 rounded-md border border-border-strong bg-bg px-3 text-body-md text-fg outline-none focus-visible:border-border-focus"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-label-md uppercase text-fg-subtle">Password</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete="current-password"
              className="h-10 rounded-md border border-border-strong bg-bg px-3 text-body-md text-fg outline-none focus-visible:border-border-focus"
            />
          </label>

          {submitted ? (
            <p className="rounded-md border border-warning-border bg-warning-bg px-3 py-2 text-body-sm text-warning-fg">
              Sign-in isn&apos;t connected to a backend yet — there&apos;s nothing to authenticate against. This
              dialog is a placeholder for the real auth service.
            </p>
          ) : null}

          <Button type="submit" variant="primary" className="mt-1 h-10 justify-center">
            Sign in
          </Button>
        </form>
      </div>
    </div>
  );
}
