'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { Specification } from '@data-model';
import { api } from '@/lib/api';
import { formatAspectRatio, getMalls, getScreenSize } from '@/lib/malls';
import type { Mall } from '@/lib/malls';
import { mallPlace, PROVINCE_ORDER } from '@/lib/sites';
import { useLiveData } from '@/lib/liveData';
import { addDays, todayIso } from '@/lib/portal/logic';
import { usePortalUser } from '@/lib/portal/store';
import { draftCount, requestDraft, useRequestDraft } from '@/lib/requestDraft';
import { Page } from '@/components/portal/ui';

const field = 'h-11 w-full rounded-lg border border-border-strong bg-bg px-3 text-body-md text-fg outline-none focus:border-border-focus';
const label = 'text-label-md font-semibold uppercase text-fg-subtle';
const primary = 'inline-flex h-12 items-center justify-center rounded-full bg-accent px-6 text-body-md font-semibold text-fg-on-accent hover:bg-accent-hover disabled:opacity-50';
const quiet = 'inline-flex h-10 items-center rounded-full border border-border-strong px-4 text-body-sm font-semibold text-fg hover:border-fg';

function sizeLine(spec: Specification | undefined): string {
  if (!spec) return '';
  const size = getScreenSize(spec);
  return size ? `${size.width} × ${size.height} · ${formatAspectRatio(size)}` : '';
}

/**
 * Clients plan their own campaign: the malls and screens they want, when,
 * and what it's for. It goes to Primedia sales, who reply with a proposal
 * to approve. No account needed.
 */
export function RequestPage() {
  const live = useLiveData();
  const draft = useRequestDraft();
  const { user, ready } = usePortalUser();
  const malls = useMemo(() => getMalls(live.catalogue).filter((m) => m.group !== 'formats'), [live.catalogue]);
  const specs = live.catalogue.specifications;

  const [query, setQuery] = useState('');
  const [openMall, setOpenMall] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', start: '', end: '', budget: '', note: '', contactName: '', company: '', email: '', phone: '', salesEmail: '', website: '' });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ email: string } | null>(null);
  const setF = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? malls.filter((m) => {
          const p = mallPlace(m.id);
          return [m.name, p?.name, p?.area, p?.city, p?.province].some((v) => v?.toLowerCase().includes(q));
        })
      : malls;
    const province = (m: Mall) => mallPlace(m.id)?.province ?? '';
    return [...list].sort((a, b) => {
      const pa = PROVINCE_ORDER.indexOf(province(a));
      const pb = PROVINCE_ORDER.indexOf(province(b));
      return (pa < 0 ? 99 : pa) - (pb < 0 ? 99 : pb) || a.name.localeCompare(b.name);
    });
  }, [malls, query]);

  // What they've chosen, by mall: chosen screens, or "the whole mall".
  const chosen = useMemo(() => {
    const byMall = new Map<string, { id: string; name: string; whole: boolean; screens: typeof draft.screens }>();
    for (const m of draft.malls) byMall.set(m.id, { id: m.id, name: m.name, whole: true, screens: [] });
    for (const s of draft.screens) {
      const cur = byMall.get(s.appMallId) ?? { id: s.appMallId, name: s.mallName, whole: false, screens: [] };
      byMall.set(s.appMallId, { ...cur, screens: [...cur.screens, s] });
    }
    return [...byMall.values()];
  }, [draft]);

  const count = draftCount(draft);
  const canSend = (count > 0 || form.note.trim().length > 0) && form.contactName.trim() && form.company.trim() && /\S+@\S+\.\S+/.test(form.email);

  async function send() {
    setError(null);
    if (form.start && form.end && form.end < form.start) {
      setError('The end date is before the start date.');
      return;
    }
    setSending(true);
    try {
      await api.sendRequest({
        name: form.name.trim(),
        contact: { name: form.contactName.trim(), company: form.company.trim(), email: form.email.trim(), phone: form.phone.trim() },
        salesEmail: form.salesEmail.trim(),
        start: form.start || null,
        end: form.end || null,
        budget: form.budget.trim(),
        note: form.note.trim(),
        screens: draft.screens.map(({ specId, appMallId, title }) => ({ specId, appMallId, title })),
        malls: draft.malls,
        website: form.website,
      });
      requestDraft.clear();
      setSent({ email: form.email.trim() });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t send your request. Try again.');
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <Page>
        <div className="flex max-w-2xl flex-col gap-4 rounded-3xl bg-success-bg p-8 text-success-fg">
          <span className="text-label-md font-semibold uppercase">Request sent</span>
          <h1 className="text-display-lg">Thank you. Primedia sales have your campaign.</h1>
          <p className="text-body-lg">
            A salesperson will check availability and reply to <strong>{sent.email}</strong>, usually within one working day, with a proposal link. You approve the site list from that link, in one step.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Link href="/" className={quiet}>Back to the mall map</Link>
            <button type="button" className={quiet} onClick={() => setSent(null)}>Plan another campaign</button>
          </div>
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <div className="flex flex-col gap-3">
        <span className="text-label-md font-semibold uppercase text-accent">For brands and agencies</span>
        <h1 className="text-display-xl text-fg">Plan your campaign</h1>
        <p className="max-w-prose text-body-lg text-fg-muted">
          Choose the malls and screens you want, tell us when, and send it to Primedia sales. A salesperson replies with a proposal for you to approve. No account needed.
        </p>
        {ready && user ? (
          <p className="max-w-prose rounded-xl bg-warning-bg p-3 text-body-sm text-warning-fg">
            You’re signed in as Primedia staff. This page is for clients; to build a proposal yourself, use <Link href="/portal/new" className="font-semibold underline">New proposal</Link>.
          </p>
        ) : null}
      </div>

      <form
        className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <div className="flex min-w-0 flex-col gap-6">
          {/* 1 · Where */}
          <section className="flex flex-col gap-4 rounded-3xl border border-border bg-bg p-5" aria-labelledby="where">
            <div className="flex flex-col gap-1">
              <h2 id="where" className="text-display-sm text-fg">1 · Where</h2>
              <p className="text-body-sm text-fg-muted">Add a whole mall and sales suggest the screens, or open a mall and pick screens.</p>
            </div>
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a mall, suburb, city or province" aria-label="Find a mall" className={field} />
            <ul className="flex max-h-[34rem] flex-col divide-y divide-border overflow-y-auto rounded-2xl border border-border">
              {shown.map((m) => {
                const p = mallPlace(m.id);
                const whole = draft.malls.some((x) => x.id === m.id);
                const picked = draft.screens.filter((s) => s.appMallId === m.id).length;
                const open = openMall === m.id;
                return (
                  <li key={m.id} className="flex flex-col">
                    <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <div className="flex min-w-0 basis-full flex-col sm:basis-0 sm:flex-1">
                        <span className="text-body-md font-semibold text-fg">{m.name}</span>
                        <span className="text-body-sm text-fg-muted">
                          {[p?.area, p?.city, p?.province].filter(Boolean).join(' · ')} · {m.specIds.length} {m.specIds.length === 1 ? 'screen' : 'screens'}
                          {picked ? ` · ${picked} chosen` : ''}
                        </span>
                      </div>
                      {m.specIds.length ? (
                        <button type="button" aria-expanded={open} onClick={() => setOpenMall(open ? null : m.id)} className="h-10 rounded-full px-3 text-body-sm font-semibold text-accent hover:bg-accent-subtle">
                          {open ? 'Hide screens' : 'Pick screens'}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => (whole ? requestDraft.removeMall(m.id) : requestDraft.addMall({ id: m.id, name: m.name }))}
                        aria-pressed={whole}
                        className={`h-10 rounded-full px-4 text-body-sm font-semibold ${whole ? 'border border-success-border bg-success-bg text-success-fg' : 'bg-accent text-fg-on-accent hover:bg-accent-hover'}`}
                      >
                        {whole ? '✓ Whole mall' : '+ Whole mall'}
                      </button>
                    </div>
                    {open ? (
                      <ul className="flex flex-col gap-1 bg-bg-subtle px-4 py-3">
                        {m.specIds.map((id) => {
                          const spec = specs[id];
                          if (!spec) return null;
                          const on = draft.screens.some((s) => s.specId === id);
                          return (
                            <li key={id}>
                              <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-bg">
                                <input
                                  type="checkbox"
                                  checked={on}
                                  onChange={() => (on ? requestDraft.removeScreen(id) : requestDraft.addScreen({ specId: id, title: spec.title, appMallId: m.id, mallName: m.name }))}
                                  className="h-5 w-5"
                                />
                                <span className="flex min-w-0 flex-col">
                                  <span className="text-body-sm font-medium text-fg">{spec.title}</span>
                                  <span className="text-[12px] text-fg-muted">{sizeLine(spec)}</span>
                                </span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
              {!shown.length ? <li className="px-4 py-6 text-body-sm text-fg-muted">No mall matches “{query}”.</li> : null}
            </ul>
          </section>

          {/* 2 · When and what */}
          <section className="flex flex-col gap-4 rounded-3xl border border-border bg-bg p-5" aria-labelledby="when">
            <h2 id="when" className="text-display-sm text-fg">2 · When and what</h2>
            <label className="flex flex-col gap-1.5"><span className={label}>Campaign name (optional)</span><input className={field} value={form.name} onChange={setF('name')} placeholder="e.g. Winter launch" maxLength={120} /></label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5"><span className={label}>Start</span><input type="date" className={field} value={form.start} min={todayIso()} onChange={setF('start')} /></label>
              <label className="flex flex-col gap-1.5"><span className={label}>End</span><input type="date" className={field} value={form.end} min={form.start || addDays(todayIso(), 1)} onChange={setF('end')} /></label>
            </div>
            <label className="flex flex-col gap-1.5"><span className={label}>Budget (optional)</span><input className={field} value={form.budget} onChange={setF('budget')} placeholder="e.g. R250 000" maxLength={80} /></label>
            <label className="flex flex-col gap-1.5">
              <span className={label}>What should it achieve? Anything else?</span>
              <textarea className={`${field} h-32 py-2`} value={form.note} onChange={setF('note')} maxLength={4000} placeholder="Who you want to reach, the product, how many creatives you have, or paste your site list." />
            </label>
          </section>
        </div>

        {/* Summary and contact: stays in view on wide screens */}
        <div className="flex min-w-0 flex-col gap-6 lg:sticky lg:top-[calc(var(--topbar-height)+1rem)] lg:self-start">
          <section className="flex flex-col gap-3 rounded-3xl bg-bg-subtle p-5" aria-labelledby="chosen">
            <h2 id="chosen" className="text-body-lg font-semibold text-fg">Your campaign · {count ? `${chosen.length} ${chosen.length === 1 ? 'mall' : 'malls'}` : 'nothing chosen yet'}</h2>
            {chosen.length ? (
              <ul className="flex flex-col gap-3">
                {chosen.map((c) => (
                  <li key={c.id} className="flex flex-col gap-1 rounded-xl bg-bg p-3">
                    <div className="flex items-start justify-between gap-2">
                      <strong className="text-body-sm text-fg">{c.name}</strong>
                      {c.whole ? <button type="button" onClick={() => requestDraft.removeMall(c.id)} className="text-body-sm text-fg-muted hover:text-danger-fg" aria-label={`Remove ${c.name}`}>Remove</button> : null}
                    </div>
                    {c.whole ? <span className="text-[12px] text-fg-muted">Whole mall: sales suggest the screens</span> : null}
                    {c.screens.map((s) => (
                      <div key={s.specId} className="flex items-center justify-between gap-2 text-body-sm text-fg-muted">
                        <span className="min-w-0 truncate">{s.title}</span>
                        <button type="button" onClick={() => requestDraft.removeScreen(s.specId)} className="shrink-0 hover:text-danger-fg" aria-label={`Remove ${s.title}`}>×</button>
                      </div>
                    ))}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-body-sm text-fg-muted">Add malls or screens on the left, or from the <Link href="/" className="font-semibold text-accent hover:underline">mall map</Link>. Not sure? Just describe what you need below the list.</p>
            )}
          </section>

          <section className="flex flex-col gap-3 rounded-3xl border border-border bg-bg p-5" aria-labelledby="you">
            <h2 id="you" className="text-display-sm text-fg">3 · Your details</h2>
            <label className="flex flex-col gap-1.5"><span className={label}>Your name</span><input className={field} value={form.contactName} onChange={setF('contactName')} autoComplete="name" required maxLength={100} /></label>
            <label className="flex flex-col gap-1.5"><span className={label}>Company or brand</span><input className={field} value={form.company} onChange={setF('company')} autoComplete="organization" required maxLength={120} /></label>
            <label className="flex flex-col gap-1.5"><span className={label}>Email</span><input type="email" className={field} value={form.email} onChange={setF('email')} autoComplete="email" required maxLength={200} /></label>
            <label className="flex flex-col gap-1.5"><span className={label}>Phone (optional)</span><input type="tel" className={field} value={form.phone} onChange={setF('phone')} autoComplete="tel" maxLength={40} /></label>
            <label className="flex flex-col gap-1.5">
              <span className={label}>Your Primedia contact (optional)</span>
              <input type="email" className={field} value={form.salesEmail} onChange={setF('salesEmail')} placeholder="Their email, if you already work with someone" maxLength={200} />
            </label>
            {/* Hidden from people: only bots fill it in. */}
            <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
              <label>Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={setF('website')} /></label>
            </div>
            {error ? <p role="alert" className="rounded-lg bg-danger-bg p-3 text-body-sm text-danger-fg">{error}</p> : null}
            <button type="submit" disabled={!canSend || sending} className={primary}>
              {sending ? 'Sending…' : 'Send to Primedia sales'}
            </button>
            <p className="text-[12px] text-fg-muted">
              {canSend ? 'Sales see it straight away and reply by email.' : 'Choose a mall or screen (or describe what you need), and add your name, company and email.'}
            </p>
          </section>
        </div>
      </form>
    </Page>
  );
}
