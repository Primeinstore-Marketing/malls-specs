'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, apiConfigured } from '@/lib/api';
import type { ClientRequest } from '@/lib/api';
import { formatRange } from '@/lib/portal/logic';
import { portal } from '@/lib/portal/store';
import type { CampaignItem, NewCampaignItem, PortalUser } from '@/lib/portal/types';

const accountId = (user: PortalUser) => Number(user.id.replace(/^a-/, ''));
const newCampaignId = () => `c-${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`;

/** What the client chose, as proposal lines: screens as they are, whole malls as a site for sales to fill in. */
function itemsFrom(r: ClientRequest): NewCampaignItem[] {
  const screens: NewCampaignItem[] = r.screens.map((s) => ({ kind: 'screen', specId: s.specId, appMallId: s.appMallId, title: s.title }));
  const malls: NewCampaignItem[] = r.malls
    .filter((m) => !r.screens.some((s) => s.appMallId === m.id))
    .map((m, i) => ({ kind: 'site', ref: `mall:${m.id}`, no: i + 1, siteNo: '', town: '', mall: m.name, location: 'Any screens: suggest the best ones', size: '', start: r.start, end: r.end, specId: null, appMallId: m.id }));
  return [...screens, ...malls];
}

function objectiveFrom(r: ClientRequest): string {
  return [r.note, r.budget ? `Budget: ${r.budget}` : '', r.contact.phone ? `Phone: ${r.contact.phone}` : ''].filter(Boolean).join('\n\n');
}

const when = (iso: string) => new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * Campaigns clients planned on the site and sent to sales (no account).
 * Whoever takes one first gets it as a proposal with the client's choices
 * in it; the client then gets the usual proposal link to approve.
 */
export function ClientRequests({ user }: { user: PortalUser }) {
  const router = useRouter();
  const [requests, setRequests] = useState<ClientRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const me = accountId(user);

  const load = useCallback(async () => {
    if (!apiConfigured) return setRequests([]);
    try {
      setRequests((await api.requests()).requests);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t load client requests.');
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 60_000);
    return () => clearInterval(t);
  }, [load]);

  async function take(r: ClientRequest) {
    setBusy(r.id);
    setError(null);
    const id = newCampaignId();
    try {
      // Claim it first, so two people can't both build it.
      await api.updateRequest(r.id, { action: 'take', campaignId: id });
      portal.create({
        id,
        name: r.name,
        prospect: { company: r.contact.company, name: r.contact.name, email: r.contact.email },
        objective: objectiveFrom(r),
        start: r.start,
        end: r.end,
        status: 'proposed',
        items: itemsFrom(r).map((item, i) => ({ ...item, id: `i-${id}-${i}` }) as CampaignItem),
        events: [
          { id: `e-${id}-1`, at: r.createdAt, by: 'client', text: `${r.contact.name} (${r.contact.company}) sent this request from the site.${r.note ? `\n\n“${r.note}”` : ''}`, kind: 'message' },
          { id: `e-${id}-2`, at: new Date().toISOString(), by: user.id, text: 'Took the client’s request', kind: 'status' },
        ],
      });
      router.push(`/portal/campaign?id=${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t take this request.');
      void load();
    } finally {
      setBusy(null);
    }
  }

  async function act(r: ClientRequest, action: 'dismiss' | 'reopen') {
    if (action === 'dismiss' && !window.confirm(`Close the request from ${r.contact.company}? Use this for spam or something Primedia can’t do. The client isn’t told.`)) return;
    setBusy(r.id);
    try {
      await api.updateRequest(r.id, { action });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t update this request.');
    } finally {
      setBusy(null);
    }
  }

  if (!requests) return null;
  const open = requests.filter((r) => r.status === 'new').sort((a, b) => Number(b.assignedTo === me) - Number(a.assignedTo === me));
  const handled = requests.filter((r) => r.status !== 'new').slice(0, 6);
  if (!open.length && !handled.length && !error) return null;

  return (
    <section className="flex min-w-0 flex-col gap-4" aria-labelledby="client-requests">
      <div className="flex flex-col gap-1">
        <h2 id="client-requests" className="flex items-baseline gap-2 text-display-sm text-fg">
          Client requests <span className="text-body-md font-medium text-fg-subtle">{open.length}</span>
        </h2>
        <p className="text-body-sm text-fg-muted">Campaigns clients planned on the site. Take one and it becomes your proposal, with their malls, screens and dates in it.</p>
      </div>
      {error ? <p role="alert" className="rounded-xl bg-danger-bg p-3 text-body-sm text-danger-fg">{error}</p> : null}
      {open.length ? (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {open.map((r) => {
            const malls = new Set([...r.screens.map((s) => s.appMallId), ...r.malls.map((m) => m.id)]).size;
            return (
              <li key={r.id} className={`flex flex-col gap-3 rounded-3xl border bg-bg p-5 ${r.assignedTo === me ? 'border-accent' : 'border-border'}`}>
                <div className="flex flex-col gap-1">
                  <span className="text-label-md font-semibold uppercase text-accent">{r.assignedTo === me ? 'Asked for you' : r.assignedName ? `Asked for ${r.assignedName}` : 'New request'} · {when(r.createdAt)}</span>
                  <strong className="text-body-lg text-fg">{r.contact.company}</strong>
                  <span className="text-body-sm text-fg-muted">{r.name}</span>
                </div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-body-sm">
                  <dt className="text-fg-subtle">Contact</dt>
                  <dd className="min-w-0 truncate text-fg">{r.contact.name} · <a className="text-accent hover:underline" href={`mailto:${r.contact.email}`}>{r.contact.email}</a></dd>
                  <dt className="text-fg-subtle">Wants</dt>
                  <dd className="text-fg">
                    {[r.screens.length ? `${r.screens.length} ${r.screens.length === 1 ? 'screen' : 'screens'}` : '', r.malls.length ? `${r.malls.length} whole ${r.malls.length === 1 ? 'mall' : 'malls'}` : ''].filter(Boolean).join(' + ') || 'Not chosen: see the note'}
                    {malls ? ` in ${malls} ${malls === 1 ? 'mall' : 'malls'}` : ''}
                  </dd>
                  <dt className="text-fg-subtle">When</dt>
                  <dd className="text-fg">{r.start || r.end ? formatRange(r.start, r.end) : 'No dates yet'}</dd>
                  {r.budget ? (<><dt className="text-fg-subtle">Budget</dt><dd className="text-fg">{r.budget}</dd></>) : null}
                </dl>
                {r.note ? <p className="line-clamp-4 whitespace-pre-line rounded-xl bg-bg-subtle p-3 text-body-sm text-fg-muted">{r.note}</p> : null}
                <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
                  <button type="button" disabled={busy === r.id} onClick={() => void take(r)} className="inline-flex h-11 items-center rounded-full bg-accent px-5 text-body-sm font-semibold text-fg-on-accent hover:bg-accent-hover disabled:opacity-50">
                    {busy === r.id ? 'Taking…' : 'Take it: build the proposal'}
                  </button>
                  <button type="button" disabled={busy === r.id} onClick={() => void act(r, 'dismiss')} className="h-11 rounded-full px-3 text-body-sm text-fg-muted hover:text-danger-fg">Close</button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-2xl bg-bg-subtle p-5 text-body-sm text-fg-muted">No new requests. Clients send them from “Plan your campaign” on the site.</p>
      )}
      {handled.length ? (
        <details className="text-body-sm">
          <summary className="cursor-pointer text-fg-muted hover:text-fg">Recently handled ({handled.length})</summary>
          <ul className="mt-2 flex flex-col divide-y divide-border rounded-2xl border border-border">
            {handled.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-2">
                <span className="min-w-0 flex-1 text-fg">{r.contact.company} · {r.name}</span>
                <span className="text-fg-muted">{r.status === 'taken' ? `Taken by ${r.takenName ?? 'someone'}` : `Closed by ${r.takenName ?? 'someone'}`}</span>
                {r.status === 'taken' && r.campaignId && r.takenBy === me ? <Link href={`/portal/campaign?id=${r.campaignId}`} className="font-semibold text-accent hover:underline">Open the proposal</Link> : null}
                {r.takenBy === me ? <button type="button" disabled={busy === r.id} onClick={() => void act(r, 'reopen')} className="text-fg-muted hover:text-fg">Reopen</button> : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
