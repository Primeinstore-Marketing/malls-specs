'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { refreshLiveData } from '@/lib/liveData';
import { CLIENTS } from '@/lib/portal/seed';
import type { Client } from '@/lib/portal/types';
import { AdminGate, field, fieldLabel, primaryBtn, quietBtn } from './AdminGate';

/** Clients and who receives their booking emails. Saved as content "client:<id>". */
function Row({ start, isNew, onDone }: { start: Client; isNew?: boolean; onDone?: () => void }) {
  const [c, setC] = useState(start);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | string>('idle');
  const dirty = JSON.stringify(c) !== JSON.stringify(start);
  const id = isNew ? c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : c.id;

  async function save(remove = false) {
    if (!id) return setState('Give the client a name.');
    setState('saving');
    try {
      await api.putContent(`client:${id}`, remove ? { ...c, id, hidden: true } : { ...c, id });
      await refreshLiveData();
      setState('saved');
      onDone?.();
    } catch (e) {
      setState(e instanceof Error ? e.message : 'Couldn’t save.');
    }
  }

  return (
    <li className="grid gap-3 rounded-2xl border border-border bg-bg p-4 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)_auto] sm:items-end">
      <label className="flex flex-col gap-1.5"><span className={fieldLabel}>Client</span><input className={field} value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} /></label>
      <label className="flex flex-col gap-1.5"><span className={fieldLabel}>Industry</span><input className={field} value={c.industry} onChange={(e) => setC({ ...c, industry: e.target.value })} /></label>
      <label className="flex flex-col gap-1.5"><span className={fieldLabel}>Contact</span><input className={field} value={c.contact.name} onChange={(e) => setC({ ...c, contact: { ...c.contact, name: e.target.value } })} /></label>
      <label className="flex flex-col gap-1.5"><span className={fieldLabel}>Email</span><input type="email" className={field} value={c.contact.email} onChange={(e) => setC({ ...c, contact: { ...c.contact, email: e.target.value } })} /></label>
      <div className="flex items-center gap-1">
        <button type="button" disabled={(!dirty && !isNew) || state === 'saving'} className={primaryBtn} onClick={() => void save()}>{state === 'saving' ? 'Saving…' : isNew ? 'Add' : 'Save'}</button>
        {!isNew ? <button type="button" className={quietBtn} onClick={() => void save(true)}>Remove</button> : null}
      </div>
      {state !== 'idle' && state !== 'saving' ? (
        <p className={`text-body-sm sm:col-span-5 ${state === 'saved' ? 'text-success-fg' : 'text-danger-fg'}`}>{state === 'saved' ? 'Saved.' : state}</p>
      ) : null}
    </li>
  );
}

/** Every client and their contact, editable. Used in Site admin and by sales (Client contacts). */
export function ClientContactsList() {
  const [adding, setAdding] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-body-md text-fg-muted">Proposal and booking emails go to each client’s contact. Contacts are private: only signed-in Primedia staff see them.</p>
      <ul className="flex flex-col gap-3">
        {CLIENTS.map((c) => <Row key={`${c.id}-${c.name}-${c.contact.email}`} start={c} />)}
        {adding ? <Row isNew start={{ id: '', name: '', industry: '', contact: { name: '', email: '' } }} onDone={() => setAdding(false)} /> : null}
      </ul>
      {!adding ? <button type="button" className={`${quietBtn} self-start text-accent`} onClick={() => setAdding(true)}>+ Add a client</button> : null}
    </div>
  );
}

export function ClientsAdmin() {
  return <AdminGate><ClientContactsList /></AdminGate>;
}
