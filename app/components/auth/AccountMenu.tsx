'use client';

import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Portal } from '@/components/ui/Portal';
import { useAdminSession } from './AdminSession';
import { useAuthDialog } from './AuthDialogContext';

function UserIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}

function ChangePasswordDialog({ onClose }: { onClose: () => void }) {
  const { sessionExpired } = useAdminSession();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (next !== confirm) {
      setError('The new passwords don’t match.');
      return;
    }
    setSubmitting(true);
    try {
      await api.changePassword(current, next);
      setDone(true);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) sessionExpired();
      setError(caught instanceof Error ? caught.message : 'Couldn’t change the password.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'h-10 rounded-md border border-border-strong bg-bg px-3 text-body-md text-fg outline-none focus-visible:border-border-focus';

  return (
    <Portal>
      <div className="fixed inset-0 z-modal flex items-center justify-center bg-[rgba(6,12,28,0.55)] backdrop-blur-md px-4" onClick={onClose}>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="change-password-title"
          onClick={(event) => event.stopPropagation()}
          className="w-full max-w-sm rounded-xl border border-border bg-bg p-6 shadow-4"
        >
          <h2 id="change-password-title" className="text-display-sm text-fg">
            Change password
          </h2>
          {done ? (
            <div className="mt-4 flex flex-col gap-4">
              <p className="text-body-md text-fg-muted">
                Password changed. Any other devices signed in to your account have been signed out.
              </p>
              <Button variant="primary" className="h-10 justify-center" onClick={onClose}>
                Done
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-label-md uppercase text-fg-subtle">Current password</span>
                <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className={inputClass} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-label-md uppercase text-fg-subtle">New password (10+ characters)</span>
                <input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className={inputClass} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-label-md uppercase text-fg-subtle">New password again</span>
                <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} />
              </label>
              {error ? (
                <p role="alert" className="rounded-md border border-danger-border bg-danger-bg px-3 py-2 text-body-sm text-danger-fg">
                  {error}
                </p>
              ) : null}
              <div className="mt-1 flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={submitting || !current || next.length < 10}>
                  {submitting ? 'Saving…' : 'Change password'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </Portal>
  );
}

export function AccountMenu() {
  const { status, admin, signOut } = useAdminSession();
  const { setOpen: setAuthOpen } = useAuthDialog();
  const [menuOpen, setMenuOpen] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  if (status !== 'signed-in' || !admin) {
    return (
      <Button variant="ghost" onClick={() => setAuthOpen(true)} disabled={status === 'checking'} aria-label="Admin sign in">
        <UserIcon />
        <span className="hidden sm:inline">Sign in</span>
      </Button>
    );
  }

  const displayName = admin.name || admin.email;

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        className="inline-flex h-8 items-center gap-2 rounded-full border border-accent-border bg-accent-subtle pl-1 pr-3 text-body-sm font-medium text-accent-fg transition-colors duration-fast ease-standard hover:border-accent"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-[11px] font-bold uppercase text-fg-on-accent">
          {displayName.slice(0, 1)}
        </span>
        <span className="hidden max-w-[10rem] truncate sm:inline">{displayName}</span>
        <span className="rounded-full bg-accent px-1.5 text-[10px] font-bold uppercase tracking-wide text-fg-on-accent">Admin</span>
      </button>

      {menuOpen ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-popover mt-2 w-60 overflow-hidden rounded-lg border border-border bg-bg shadow-3"
        >
          <div className="border-b border-border px-3 py-2.5">
            <p className="truncate text-body-sm font-semibold text-fg">{displayName}</p>
            <p className="truncate text-body-sm text-fg-subtle">{admin.email}</p>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              setChangingPassword(true);
            }}
            className="block w-full px-3 py-2 text-left text-body-sm text-fg hover:bg-bg-subtle"
          >
            Change password
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              void signOut();
            }}
            className="block w-full px-3 py-2 text-left text-body-sm text-fg hover:bg-bg-subtle"
          >
            Sign out
          </button>
        </div>
      ) : null}

      {changingPassword ? <ChangePasswordDialog onClose={() => setChangingPassword(false)} /> : null}
    </div>
  );
}
