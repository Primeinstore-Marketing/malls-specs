'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { withBasePath } from '@/lib/basePath';
import type { AccountRole, ManagedAccount } from '@/lib/api';
import { useAdminSession } from '@/components/auth/AdminSession';
import { AdminGate, field, fieldLabel, primaryBtn, quietBtn } from './AdminGate';

/** A temporary password that is easy to read out or paste: no look-alike characters. */
function temporaryPassword(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(14));
  const raw = [...bytes].map((b) => chars[b % chars.length]).join('');
  return `${raw.slice(0, 4)}-${raw.slice(4, 9)}-${raw.slice(9)}`;
}

/** Shown once after creating an account or resetting a password, to pass on. */
function Handover({ email, password, onDone }: { email: string; password: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  const text = `Sign in to Primedia Malls: ${typeof window !== 'undefined' ? window.location.origin : ''}${withBasePath('/sign-in')}\nEmail: ${email}\nTemporary password: ${password}\nYou'll choose your own password when you sign in.`;
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-success-border bg-success-bg p-4 text-body-sm text-success-fg sm:col-span-full">
      <strong>Give {email} this temporary password. It won’t be shown again.</strong>
      <code className="select-all rounded-lg bg-bg px-3 py-2 font-mono text-body-md text-fg">{password}</code>
      <span>They choose their own password when they first sign in. Share it in person or by phone rather than in the same email as the address.</span>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={quietBtn}
          onClick={() => {
            void navigator.clipboard?.writeText(text).then(() => setCopied(true));
          }}
        >
          {copied ? 'Copied' : 'Copy sign-in details'}
        </button>
        <button type="button" className={quietBtn} onClick={onDone}>Done</button>
      </div>
    </div>
  );
}

function Row({ a, me, onChanged }: { a: ManagedAccount; me: boolean; onChanged: () => void }) {
  const [name, setName] = useState(a.name);
  const [title, setTitle] = useState(a.title);
  const [role, setRole] = useState<AccountRole>(a.role);
  const [state, setState] = useState<'idle' | 'saving' | string>('idle');
  const [handover, setHandover] = useState<string | null>(null);
  const dirty = name !== a.name || title !== a.title || role !== a.role;

  async function run(fields: Parameters<typeof api.updateAccount>[1], then?: () => void) {
    setState('saving');
    try {
      await api.updateAccount(a.id, fields);
      setState('idle');
      then?.();
      onChanged();
    } catch (e) {
      setState(e instanceof Error ? e.message : 'Couldn’t save.');
    }
  }

  return (
    <li className={`grid gap-3 rounded-2xl border border-border bg-bg p-4 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1.2fr)_9rem_auto] sm:items-end ${a.disabled ? 'opacity-60' : ''}`}>
      <label className="flex flex-col gap-1.5">
        <span className={fieldLabel}>Name</span>
        <input className={field} value={name} onChange={(e) => setName(e.target.value)} />
        <span className="truncate text-body-sm text-fg-muted">{a.email}{me ? ' (you)' : ''}</span>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={fieldLabel}>Job title</span>
        <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} />
        <span className="text-body-sm text-fg-subtle">
          {a.disabled ? 'Switched off' : a.mustChangePassword ? 'Waiting for first sign-in' : 'Active'}
        </span>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={fieldLabel}>Role</span>
        <select className={field} value={role} disabled={me} onChange={(e) => setRole(e.target.value as AccountRole)}>
          <option value="sales">Sales</option>
          <option value="admin">Admin</option>
        </select>
        <span className="text-body-sm text-fg-subtle">&nbsp;</span>
      </label>
      <div className="flex flex-wrap items-center gap-1 sm:pb-7">
        <button type="button" className={primaryBtn} disabled={!dirty || state === 'saving'} onClick={() => void run({ name, title, role })}>Save</button>
        {!a.disabled ? (
          <button
            type="button"
            className={quietBtn}
            disabled={state === 'saving'}
            onClick={() => {
              if (!window.confirm(`Reset ${a.name || a.email}'s password? They'll be signed out and need the new temporary password.`)) return;
              const pw = temporaryPassword();
              void run({ password: pw }, () => setHandover(pw));
            }}
          >
            Reset password
          </button>
        ) : null}
        {!me ? (
          <button
            type="button"
            className={quietBtn}
            disabled={state === 'saving'}
            onClick={() => {
              if (!a.disabled && !window.confirm(`Switch off ${a.name || a.email}'s account? They'll be signed out and can't sign in until you switch it back on.`)) return;
              void run({ disabled: !a.disabled });
            }}
          >
            {a.disabled ? 'Switch on' : 'Switch off'}
          </button>
        ) : null}
      </div>
      {state !== 'idle' && state !== 'saving' ? <p className="text-body-sm text-danger-fg sm:col-span-full">{state}</p> : null}
      {handover ? <Handover email={a.email} password={handover} onDone={() => setHandover(null)} /> : null}
    </li>
  );
}

function NewAccount({ onCreated }: { onCreated: () => void }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [role, setRole] = useState<AccountRole>('sales');
  const [state, setState] = useState<'idle' | 'saving' | string>('idle');
  const [handover, setHandover] = useState<{ email: string; password: string } | null>(null);

  async function create() {
    const password = temporaryPassword();
    setState('saving');
    try {
      await api.createAccount({ email: email.trim(), name: name.trim(), title: title.trim(), role, password });
      setHandover({ email: email.trim().toLowerCase(), password });
      setEmail('');
      setName('');
      setTitle('');
      setRole('sales');
      setState('idle');
      onCreated();
    } catch (e) {
      setState(e instanceof Error ? e.message : 'Couldn’t create the account.');
    }
  }

  return (
    <section aria-labelledby="new-account" className="flex flex-col gap-3 rounded-2xl bg-bg-subtle p-4">
      <h2 id="new-account" className="text-body-lg font-semibold text-fg">Add a person</h2>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.2fr)_9rem_auto] sm:items-end">
        <label className="flex flex-col gap-1.5"><span className={fieldLabel}>Work email</span><input type="email" className={field} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@primedia.co.za" /></label>
        <label className="flex flex-col gap-1.5"><span className={fieldLabel}>Name</span><input className={field} value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className="flex flex-col gap-1.5"><span className={fieldLabel}>Job title</span><input className={field} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Account Manager, Primedia Malls" /></label>
        <label className="flex flex-col gap-1.5">
          <span className={fieldLabel}>Role</span>
          <select className={field} value={role} onChange={(e) => setRole(e.target.value as AccountRole)}>
            <option value="sales">Sales</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <button type="button" className={primaryBtn} disabled={!email.trim() || !name.trim() || state === 'saving'} onClick={() => void create()}>
          {state === 'saving' ? 'Adding…' : 'Add'}
        </button>
      </div>
      <p className="text-body-sm text-fg-muted">Sales can build and send proposals and keep client contacts up to date. Admins can also edit malls, screens, photos and accounts. A temporary password is made for them to change when they first sign in.</p>
      {state !== 'idle' && state !== 'saving' ? <p className="text-body-sm text-danger-fg">{state}</p> : null}
      {handover ? <Handover {...handover} onDone={() => setHandover(null)} /> : null}
    </section>
  );
}

function List() {
  const { account } = useAdminSession();
  const [accounts, setAccounts] = useState<ManagedAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    api
      .accounts()
      .then(({ accounts: list }) => setAccounts(list))
      .catch((e) => setError(e instanceof Error ? e.message : 'Couldn’t load the accounts.'));
  }, []);
  useEffect(load, [load]);

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-prose text-body-md text-fg-muted">Everyone who can sign in. There’s no public sign-up: add people here, and reset a password when someone forgets theirs.</p>
      <NewAccount onCreated={load} />
      {error ? <p className="text-body-sm text-danger-fg">{error}</p> : null}
      {accounts === null && !error ? <div className="h-32 animate-pulse rounded-2xl bg-bg-subtle" /> : null}
      {accounts ? (
        <ul className="flex flex-col gap-3">
          {accounts.map((a) => (
            <Row key={a.id} a={a} me={a.id === account?.id} onChanged={load} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function AccountsAdmin() {
  return <AdminGate><List /></AdminGate>;
}
