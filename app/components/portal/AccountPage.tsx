'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { api, ApiError } from '@/lib/api';
import { useAdminSession } from '@/components/auth/AdminSession';
import { PasswordForm, authInput, authLabel, authPrimary } from '@/components/auth/PasswordForm';
import { ClientContactsList } from '@/components/admin/ClientsAdmin';
import { Page, RequireSignIn } from './ui';

/** Your name and job title, as clients see them on proposals and emails. */
function Details() {
  const { account, setAccount, sessionExpired } = useAdminSession();
  const [name, setName] = useState(account?.name ?? '');
  const [title, setTitle] = useState(account?.title ?? '');
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | string>('idle');
  if (!account) return null;
  const dirty = name.trim() !== account.name || title.trim() !== account.title;

  async function save(e: FormEvent) {
    e.preventDefault();
    setState('saving');
    try {
      const { account: next } = await api.updateMe({ name: name.trim(), title: title.trim() });
      setAccount(next);
      setState('saved');
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) sessionExpired();
      setState(caught instanceof Error ? caught.message : 'Couldn’t save.');
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className={authLabel}>Name</span>
          <input className={authInput} value={name} onChange={(e) => { setName(e.target.value); setState('idle'); }} autoComplete="name" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={authLabel}>Job title</span>
          <input className={authInput} value={title} onChange={(e) => { setTitle(e.target.value); setState('idle'); }} placeholder="e.g. Account Manager, Primedia Malls" />
        </label>
      </div>
      <p className="text-body-sm text-fg-muted">
        Email: <strong className="text-fg">{account.email}</strong> · {account.role === 'admin' ? 'Admin' : 'Sales'}. Clients see your name, title and email on proposals. To change your email, ask an admin.
      </p>
      {state !== 'idle' && state !== 'saving' ? (
        <p role="status" className={`text-body-sm ${state === 'saved' ? 'text-success-fg' : 'text-danger-fg'}`}>{state === 'saved' ? 'Saved.' : state}</p>
      ) : null}
      <button type="submit" disabled={!dirty || !name.trim() || state === 'saving'} className={`${authPrimary} self-start`}>
        {state === 'saving' ? 'Saving…' : 'Save details'}
      </button>
    </form>
  );
}

const card = 'flex flex-col gap-4 rounded-3xl border border-border bg-bg p-5 sm:p-6';

export function AccountPage() {
  const { isAdmin } = useAdminSession();
  return (
    <RequireSignIn what="your account">
      {() => (
        <Page>
          <header className="flex flex-col gap-2">
            <h1 className="text-display-xl text-fg">Your account</h1>
            <p className="max-w-prose text-body-lg text-fg-muted">Your details and password.{isAdmin ? <> To add people or reset someone’s password, go to <Link href="/admin/users" className="font-semibold text-accent hover:underline">Site admin → Accounts</Link>.</> : null}</p>
          </header>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
            <section aria-labelledby="details" className={card}>
              <h2 id="details" className="text-display-sm text-fg">Your details</h2>
              <Details />
            </section>
            <section aria-labelledby="password" className={card}>
              <h2 id="password" className="text-display-sm text-fg">Password</h2>
              <PasswordForm />
            </section>
          </div>
        </Page>
      )}
    </RequireSignIn>
  );
}

/** Sales and admins: the clients proposals go to, and who receives them. */
export function ClientContactsPage() {
  return (
    <RequireSignIn what="client contacts">
      {() => (
        <Page>
          <header className="flex flex-col gap-3">
            <Link href="/portal" className="text-body-sm font-semibold text-fg-muted hover:text-fg">← Workspace</Link>
            <h1 className="text-display-xl text-fg">Client contacts</h1>
          </header>
          <ClientContactsList />
        </Page>
      )}
    </RequireSignIn>
  );
}
