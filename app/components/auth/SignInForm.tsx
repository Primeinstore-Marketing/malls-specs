'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '@/lib/api';
import type { AdminProfile } from '@/lib/api';
import { useAdminSession } from './AdminSession';
import { authInput, authLabel, authPrimary } from './PasswordForm';
import { rememberTemporaryPassword } from './SetPasswordGate';

type Mode = 'signin' | 'signup' | 'forgot';

/**
 * Signing in for Primedia staff, with the two ways in for someone new or
 * stuck: create your own account (with your own password; an admin approves
 * it), and ask for a password reset (an admin gives a temporary one, and you
 * choose a new password when you sign in with it).
 */
export function SignInForm({ onSignedIn, autoFocus = false }: { onSignedIn?: (account: AdminProfile) => void; autoFocus?: boolean }) {
  const { signIn, available } = useAdminSession();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const go = (next: Mode) => {
    setMode(next);
    setError(null);
    setDone(null);
    setPassword('');
    setConfirm('');
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'signin') {
        const account = await signIn(email.trim(), password);
        if (account.mustChangePassword) rememberTemporaryPassword(password);
        setPassword('');
        onSignedIn?.(account);
      } else if (mode === 'signup') {
        if (password.length < 10) throw new Error('Use at least 10 characters for your password.');
        if (password !== confirm) throw new Error('The passwords don’t match.');
        await api.signup({ email: email.trim(), name: name.trim(), title: title.trim(), password });
        setDone('Thanks — your account is set up and waiting for an admin to approve it. Once it is, sign in here with your email and the password you just chose.');
        setPassword('');
        setConfirm('');
      } else {
        await api.forgotPassword(email.trim());
        setDone('Done. If there’s an account for that email, an admin has been asked to reset your password. They’ll give you a temporary password; sign in with it and you’ll choose a new one.');
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'That didn’t work. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const link = 'text-body-sm font-semibold text-accent hover:underline';
  const disabled = busy || !available;
  const canSubmit =
    mode === 'signin' ? email.trim() && password : mode === 'signup' ? email.trim() && name.trim() && password && confirm : email.trim();

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {!available ? (
        <p className="rounded-xl border border-warning-border bg-warning-bg px-3 py-2 text-body-sm text-warning-fg">
          This copy of the site isn’t connected to the server, so signing in isn’t possible here.
        </p>
      ) : null}
      {mode !== 'signin' ? (
        <div className="flex flex-col gap-1">
          <strong className="text-body-lg text-fg">{mode === 'signup' ? 'Create your account' : 'Forgot your password?'}</strong>
          <span className="text-body-sm text-fg-muted">
            {mode === 'signup' ? 'Choose your own password. Every new account waits for a Primedia Malls admin to approve it before you can sign in.' : 'Enter your work email and we’ll ask an admin to reset it.'}
          </span>
        </div>
      ) : null}

      {done ? (
        <p role="status" className="rounded-xl border border-success-border bg-success-bg px-3 py-3 text-body-sm text-success-fg">{done}</p>
      ) : (
        <>
          <label className="flex flex-col gap-1.5">
            <span className={authLabel}>Work email</span>
            <input type="email" autoComplete="username" autoFocus={autoFocus} value={email} onChange={(e) => setEmail(e.target.value)} disabled={disabled} className={authInput} />
          </label>
          {mode === 'signup' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className={authLabel}>Your name</span>
                <input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} disabled={disabled} className={authInput} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={authLabel}>Job title <span className="normal-case tracking-normal text-fg-subtle">(optional)</span></span>
                <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={disabled} placeholder="Account Manager" className={authInput} />
              </label>
            </div>
          ) : null}
          {mode !== 'forgot' ? (
            <div className="flex flex-col gap-1.5">
              <label className="flex flex-col gap-1.5">
                <span className={authLabel}>{mode === 'signup' ? 'Choose a password' : 'Password'}{mode === 'signup' ? <span className="normal-case tracking-normal text-fg-subtle"> (10+ characters)</span> : null}</span>
                <input type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} disabled={disabled} className={authInput} />
              </label>
              {mode === 'signin' ? <button type="button" onClick={() => go('forgot')} className="self-end text-body-sm text-fg-muted hover:text-fg hover:underline">Forgot your password?</button> : null}
            </div>
          ) : null}
          {mode === 'signup' ? (
            <label className="flex flex-col gap-1.5">
              <span className={authLabel}>Password again</span>
              <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={disabled} className={authInput} />
            </label>
          ) : null}
          {error ? (
            <p role="alert" className="rounded-xl border border-danger-border bg-danger-bg px-3 py-2 text-body-sm text-danger-fg">{error}</p>
          ) : null}
          <button type="submit" disabled={disabled || !canSubmit} className={authPrimary}>
            {busy ? 'One moment…' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Ask for a reset'}
          </button>
        </>
      )}

      {mode === 'signin' ? (
        <p className="text-body-sm text-fg-muted">
          New to Primedia Malls? <button type="button" onClick={() => go('signup')} className={link}>Create your account</button>
        </p>
      ) : (
        <button type="button" onClick={() => go('signin')} className={`${link} self-start`}>← Back to sign in</button>
      )}
    </form>
  );
}
