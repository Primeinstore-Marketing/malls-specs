'use client';

import { useState } from 'react';
import { CLIENTS } from '@/lib/portal/seed';
import type { Prospect } from '@/lib/portal/types';

const NEW = '__new__';
const EMPTY: Prospect = { company: '', name: '', email: '' };

/**
 * Who a proposal is for. A client is optional: sales can start with
 * "No client yet", or type in someone who isn't a client on the site.
 */
export function ClientField({
  clientId,
  prospect,
  onChange,
  input,
  label,
  id,
  disabled = false,
}: {
  clientId: string | null;
  prospect: Prospect | null | undefined;
  onChange: (next: { clientId: string | null; prospect: Prospect | null }) => void;
  input: string;
  label: string;
  id?: string;
  disabled?: boolean;
}) {
  const [typing, setTyping] = useState(Boolean(prospect && !clientId));
  const value = clientId ?? (typing ? NEW : '');
  const p = prospect ?? EMPTY;
  const set = (k: keyof Prospect, v: string) => onChange({ clientId: null, prospect: { ...p, [k]: v } });

  return (
    <div className="flex flex-col gap-3 sm:col-span-2">
      <label className="flex flex-col gap-1.5 sm:max-w-[calc(50%-0.5rem)]">
        <span className={label}>Client <span className="normal-case tracking-normal text-fg-subtle">(optional)</span></span>
        <select
          id={id}
          className={input}
          disabled={disabled}
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            setTyping(v === NEW);
            onChange(v === NEW ? { clientId: null, prospect: prospect ?? EMPTY } : { clientId: v || null, prospect: null });
          }}
        >
          <option value="">No client yet</option>
          {CLIENTS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          <option value={NEW}>Someone new…</option>
        </select>
      </label>
      {value === NEW ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5">
            <span className={label}>Company</span>
            <input className={input} disabled={disabled} value={p.company} onChange={(e) => set('company', e.target.value)} placeholder="e.g. Sunrise Dairy" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={label}>Contact name</span>
            <input className={input} disabled={disabled} value={p.name} onChange={(e) => set('name', e.target.value)} placeholder="Who it goes to" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={label}>Email</span>
            <input type="email" className={input} disabled={disabled} value={p.email} onChange={(e) => set('email', e.target.value)} placeholder="name@company.co.za" />
          </label>
        </div>
      ) : null}
    </div>
  );
}
