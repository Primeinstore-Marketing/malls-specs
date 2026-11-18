'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api';
import { refreshLiveData } from '@/lib/liveData';
import { ALL_MALLS, deckMallForApp, semShare } from '@/lib/insights';
import type { MallContent } from '@/lib/insights';
import { readMallDeck, sameMall } from '@/lib/insights/deckReader';
import type { DeckRead } from '@/lib/insights/deckReader';
import { mallAt, outlineById, searchPlaces } from '@/lib/osm';
import { allSites, pointLocation, SA_PROVINCES, siteById, slugifySite } from '@/lib/sites';
import type { SiteRecord } from '@/lib/sites';
import { AdminGate, field, primaryBtn, quietBtn } from './AdminGate';

type Target = string; // a site id, 'new' or 'skip'

interface Row {
  readonly file: string;
  readonly read: DeckRead | null;
  readonly error: string | null;
  target: Target;
  /** For a new mall: its name and, if the map search can't tell, its province. */
  name: string;
  province: string;
  status?: string;
}

const malls = () => allSites().filter((s) => s.group !== 'formats' && !s.deletedAt);

/** The mall a deck is for: by the slide's title, then the file name. */
function matchSite(read: DeckRead, fileName: string): string | null {
  const names = (s: SiteRecord) => [s.name, s.place?.name ?? '', deckMallForApp(s.id)?.name ?? ''].filter(Boolean);
  for (const label of [read.title, fileName]) {
    const hit = malls().find((s) => names(s).some((n) => sameMall(label, n)));
    if (hit) return hit.id;
  }
  return null;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The mall's proposal data with the deck's shopper profile in place of the old one. */
function withProfile(base: MallContent, read: DeckRead): MallContent {
  const old = base.profile;
  return {
    ...base,
    annualFootcount: null,
    profile: { ...read.profile, monthlyFootcount: read.profile.monthlyFootcount ?? old?.monthlyFootcount ?? null },
  };
}

/**
 * Site admin → Malls → Update from mall decks. Drop the malls' PowerPoint
 * decks: each one's "Shopper Profile" slide is read in the browser, matched
 * to its mall, and saved over the old shopper numbers. A deck for a mall the
 * site doesn't have yet adds that mall, placed on the map by its name.
 */
function Import() {
  const [rows, setRows] = useState<Row[]>([]);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  async function add(files: FileList | null) {
    if (!files?.length) return;
    setReading(true);
    setDone(null);
    const next: Row[] = [];
    for (const f of Array.from(files)) {
      try {
        const read = await readMallDeck(f);
        const site = matchSite(read, f.name);
        next.push({ file: f.name, read, error: null, target: site ?? 'new', name: read.title || f.name.replace(/\.pptx$/i, ''), province: '' });
      } catch (e) {
        next.push({ file: f.name, read: null, error: e instanceof Error ? e.message : 'Couldn’t read this file.', target: 'skip', name: '', province: '' });
      }
    }
    setRows((cur) => [...cur.filter((r) => !next.some((n) => n.file === r.file)), ...next].sort((a, b) => a.file.localeCompare(b.file)));
    setReading(false);
  }

  const update = (file: string, patch: Partial<Row>) => setRows((cur) => cur.map((r) => (r.file === file ? { ...r, ...patch } : r)));

  async function save() {
    setSaving(true);
    let ok = 0;
    let n = 0;
    const total = rows.filter((r) => r.read && r.target !== 'skip').length;
    let added = 0;
    for (const row of rows) {
      if (!row.read || row.target === 'skip') continue;
      n += 1;
      setDone(`Saving ${n} of ${total}…`);
      try {
        let siteId = row.target;
        let newProvince = row.province;
        if (row.target === 'new') {
          const name = row.name.trim();
          siteId = slugifySite(name);
          if (!siteId) throw new Error('Give the new mall a name.');
          if (!siteById(siteId)) {
            update(row.file, { status: 'Finding it on the map…' });
            const hits = await searchPlaces(name).catch(() => []);
            // Prefer a result with the mall's own name; another place nearby is only a starting point.
            const hit = hits.find((h) => sameMall(h.name, name)) ?? hits[0];
            const exact = Boolean(hit && sameMall(hit.name, name));
            await wait(1100); // OpenStreetMap's search allows one request a second.
            const location = hit ? ((/^[WR]\d+$/.test(hit.osm) ? await outlineById(hit.osm).catch(() => null) : null) ?? (await mallAt(hit.lat, hit.lng).catch(() => null)) ?? pointLocation(Number(hit.lng.toFixed(6)), Number(hit.lat.toFixed(6)))) : null;
            const province = (hit?.place.province && SA_PROVINCES.includes(hit.place.province) ? hit.place.province : '') || row.province;
            if (!province) throw new Error('Not found on the map: choose its province.');
            newProvince = province;
            const site: SiteRecord = {
              id: siteId,
              name,
              group: 'malls',
              place: { name, area: hit?.place.area ?? '', city: hit?.place.city ?? '', province, note: !location ? undefined : exact ? 'Placed automatically from the mall deck. Check the pin, then publish.' : `Not found by name on the map; placed at “${hit?.name}”. Move the pin to the mall, then publish.` },
              location,
              subGroupId: null,
              specIds: [],
              // A draft until an admin has checked the pin. Its shopper data shows in Insights straight away.
              published: false,
              deletedAt: null,
            };
            await api.putContent(`site:${siteId}`, site);
            added += 1;
          }
        }
        const site = siteById(siteId);
        const deck = deckMallForApp(siteId) ?? ALL_MALLS.find((m) => (m.appMallId || m.id) === siteId);
        const base: MallContent = deck ?? {
          id: siteId, name: row.target === 'new' ? row.name.trim() : site?.place?.name || site?.name || row.name, appMallId: siteId,
          province: site?.place?.province || newProvince, address: null, annualFootcount: null, gla: null, profile: null, media: null, packages: [],
        };
        await api.putContent(`mall:${base.id}`, { ...withProfile(base, row.read), appMallId: siteId });
        ok += 1;
        update(row.file, { status: 'Saved' });
      } catch (e) {
        update(row.file, { status: e instanceof Error ? e.message : 'Couldn’t save.' });
      }
    }
    await refreshLiveData();
    setSaving(false);
    setDone(`Saved ${ok} ${ok === 1 ? 'mall' : 'malls'}${added ? `, ${added} of them new: they’re drafts in Malls until you check their pins and publish them` : ''}.`);
  }

  const toSave = rows.filter((r) => r.read && r.target !== 'skip').length;
  const options = malls().sort((a, b) => (a.place?.name || a.name).localeCompare(b.place?.name || b.name));

  return (
    <div className="flex flex-col gap-5">
      <Link href="/admin/malls" className="self-start text-body-sm font-semibold text-fg-muted hover:text-fg">← Malls</Link>
      <div className="flex flex-col gap-2">
        <h2 className="text-display-sm text-fg">Update shopper data from mall decks</h2>
        <p className="max-w-3xl text-body-md text-fg-muted">
          Drop one or more mall decks (PowerPoint). We read each one’s Shopper Profile slide (shoppers a month, women and men, age, income, SEM, languages and more), match it to its mall and show what we found. Check the list, then save. A deck for a mall the site doesn’t have yet adds that mall as a draft, placed on the map by its name (about half a minute each): check its pin, then publish it. Most decks label the shopper count “annual”, but the figures are a month’s, so they’re saved as shoppers a month.
        </p>
      </div>
      <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-3xl border-2 border-dashed border-border-strong bg-bg-subtle px-6 py-10 text-center hover:border-accent">
        <span className="text-body-md font-semibold text-fg">{reading ? 'Reading the decks…' : 'Choose mall decks (.pptx)'}</span>
        <span className="text-body-sm text-fg-muted">You can pick many at once. Nothing is saved until you press Save.</span>
        <input type="file" accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation" multiple className="sr-only" aria-label="Choose mall decks" disabled={reading} onChange={(e) => { void add(e.target.files); e.target.value = ''; }} />
      </label>

      {rows.length ? (
        <>
          <ul className="flex flex-col gap-2">
            {rows.map((r) => {
              const p = r.read?.profile;
              const sem = p ? semShare({ profile: p } as MallContent, 'upper') : null;
              return (
                <li key={r.file} className="grid gap-3 rounded-2xl border border-border bg-bg p-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.3fr)] md:items-start">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <strong className="truncate text-body-md text-fg">{r.read?.title || r.file}</strong>
                    <span className="truncate text-body-sm text-fg-subtle">{r.file}</span>
                    {p ? (
                      <span className="text-body-sm text-fg-muted">
                        {[p.monthlyFootcount ? `${p.monthlyFootcount.toLocaleString('en-ZA')} shoppers a month` : null, p.female != null ? `${p.female}% women` : null, sem != null ? `${sem}% SEM 8–10` : null].filter(Boolean).join(' · ')}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-2">
                    <select className={field} aria-label={`Mall for ${r.file}`} value={r.target} disabled={!r.read || saving} onChange={(e) => update(r.file, { target: e.target.value, status: undefined })}>
                      {options.map((s) => <option key={s.id} value={s.id}>{s.place?.name || s.name}</option>)}
                      <option value="new">Add as a new mall</option>
                      <option value="skip">Skip this deck</option>
                    </select>
                    {r.target === 'new' && r.read ? (
                      <div className="flex gap-2">
                        <input className={field} value={r.name} aria-label="New mall’s name" onChange={(e) => update(r.file, { name: e.target.value })} />
                        <select className={`${field} w-40`} value={r.province} aria-label="Province (if the map can’t find it)" onChange={(e) => update(r.file, { province: e.target.value })}>
                          <option value="">Province…</option>
                          {SA_PROVINCES.map((x) => <option key={x}>{x}</option>)}
                        </select>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-1 text-body-sm">
                    {r.error ? <span className="text-danger-fg">{r.error}</span> : null}
                    {r.target === 'new' && r.read ? <span className="text-fg-muted">New mall: we’ll place it on the map by its name. Check the pin afterwards.</span> : null}
                    {r.read?.checks.map((c) => <span key={c} className="text-warning-fg">{c}</span>)}
                    {r.status ? <span className={r.status === 'Saved' ? 'font-semibold text-success-fg' : 'text-fg-muted'}>{r.status}</span> : null}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className={primaryBtn} disabled={!toSave || saving} onClick={() => void save()}>
              {saving ? 'Saving…' : `Save ${toSave} ${toSave === 1 ? 'mall' : 'malls'}`}
            </button>
            <button type="button" className={quietBtn} disabled={saving} onClick={() => { setRows([]); setDone(null); }}>Clear the list</button>
            {done ? <span role="status" className={`text-body-sm font-semibold ${saving ? 'text-fg-muted' : 'text-success-fg'}`}>{done}</span> : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

export function MallDeckImport() {
  return <AdminGate><Import /></AdminGate>;
}
