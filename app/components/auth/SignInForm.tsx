'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import type { AdminProfile } from '@/lib/api';
import { useAdminSession } from './AdminSession';
import { authInput, authLabel, authPrimary } from './PasswordForm';
import { rememberTemporaryPassword } from './SetPasswordGate';

/**
 * Email and password, for every Primedia account (sales and admins).
 * Someone on a temporary password is then asked to choose their own
 * (SetPasswordGate) before going on.
 */
export function SignInForm({ onSignedIn, autoFocus = false }: { onSignedIn?: (account: AdminProfile) => void; autoFocus?: boolean }) {
  const { signIn, available } = useAdminSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const account = await signIn(email.trim(), password);
      if (account.mustChangePassword) rememberTemporaryPassword(password);
      setPassword('');
      onSignedIn?.(account);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Sign-in failed. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {!available ? (
        <p className="rounded-xl border border-warning-border bg-warning-bg px-3 py-2 text-body-sm text-warning-fg">
          This copy of the site isn’t connected to the server, so signing in isn’t possible here.
        </p>
      ) : null}
      <label className="flex flex-col gap-1.5">
        <span className={authLabel}>Work email</span>
        <input
          type="email"
          autoComplete="username"
          autoFocus={autoFocus}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={submitting || !available}
          className={authInput}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={authLabel}>Password</span>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={submitting || !available}
          className={authInput}
        />
      </label>
      {error ? (
        <p role="alert" className="rounded-xl border border-danger-border bg-danger-bg px-3 py-2 text-body-sm text-danger-fg">{error}</p>
      ) : null}
      <button type="submit" disabled={submitting || !available || !email.trim() || !password} className={authPrimary}>
        {submitting ? 'Signing in…' : 'Sign in'}
      </button>
      <p className="text-body-sm text-fg-subtle">New here, or forgot your password? Ask a Primedia admin to set you up or reset it.</p>
    </form>
  );
}
