'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { api, ApiError } from '@/lib/api';
import { useAdminSession } from './AdminSession';

export const authInput =
  'h-11 w-full rounded-xl border border-border-strong bg-bg px-3 text-body-md text-fg outline-none transition-colors duration-fast ease-standard placeholder:text-fg-subtle focus-visible:border-border-focus disabled:opacity-60';
export const authLabel = 'text-label-md font-semibold uppercase text-fg-muted';
export const authPrimary =
  'inline-flex h-11 items-center justify-center rounded-full bg-accent px-5 text-body-sm font-semibold text-fg-on-accent hover:bg-accent-hover disabled:opacity-50';

const MIN = 10;

/**
 * Change your password: the current (or temporary) one, then a new one twice.
 * Signs out every other device. `currentLabel` reads "Temporary password"
 * on first sign-in; `knownCurrent` fills it in when we already have it.
 */
export function PasswordForm({
  currentLabel = 'Current password',
  knownCurrent = '',
  submitLabel = 'Change password',
  onDone,
}: {
  currentLabel?: string;
  knownCurrent?: string;
  submitLabel?: string;
  onDone?: () => void;
}) {
  const { account, setAccount, sessionExpired } = useAdminSession();
  const [current, setCurrent] = useState(knownCurrent);
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (next.length < MIN) return setError(`Use at least ${MIN} characters.`);
    if (next !== confirm) return setError('The new passwords don’t match.');
    if (next === current) return setError('Choose a password different from the current one.');
    setSaving(true);
    try {
      await api.changePassword(current, next);
      if (account) setAccount({ ...account, mustChangePassword: false });
      setCurrent('');
      setNext('');
      setConfirm('');
      setDone(true);
      onDone?.();
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) sessionExpired();
      setError(caught instanceof Error ? caught.message : 'Couldn’t change the password.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
      {!knownCurrent ? (
        <label className="flex flex-col gap-1.5">
          <span className={authLabel}>{currentLabel}</span>
          <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className={authInput} />
        </label>
      ) : null}
      <label className="flex flex-col gap-1.5">
        <span className={authLabel}>New password <span className="normal-case tracking-normal text-fg-subtle">({MIN}+ characters)</span></span>
        <input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className={authInput} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={authLabel}>New password again</span>
        <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={authInput} />
      </label>
      {error ? (
        <p role="alert" className="rounded-xl border border-danger-border bg-danger-bg px-3 py-2 text-body-sm text-danger-fg">{error}</p>
      ) : done ? (
        <p role="status" className="text-body-sm text-success-fg">Password changed. Other devices signed in to your account have been signed out.</p>
      ) : null}
      <button type="submit" disabled={saving || !current || !next || !confirm} className={`${authPrimary} self-start`}>
        {saving ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}
