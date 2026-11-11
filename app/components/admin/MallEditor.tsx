'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRef, useState } from 'react';
import { api, fileUrl } from '@/lib/api';
import { baseMall, deckMall, deckPhoto, mallName, packagePhotos } from '@/lib/insights';
import type { MallContent, MediaPackage, UploadedPhoto } from '@/lib/insights';
import type { ShopperProfile } from '@/lib/insights/types';
import { contentUpdatedAt } from '@/lib/content';
import { refreshLiveData } from '@/lib/liveData';
import { getMalls } from '@/lib/malls';
import { getCatalogue } from '@/lib/catalogue';
import { AdminGate, field, fieldLabel, primaryBtn, quietBtn, uploadPhoto } from './AdminGate';

/**
 * Edit one mall: its details, shopper profile, advertising recall, media
 * packages and photos. Saving stores the whole mall as content "mall:<id>",
 * which replaces the deck's version on the site; "Reset" goes back to it.
 */

const FORMATS = ['Digi Nav', 'Digital Impact', 'Digi Icon TV'];
const EMPTY_PROFILE: ShopperProfile = {
  monthlyFootcount: null, householdIncome: null, ageBands: [], female: null, male: null,
  married: null, working: null, lsm: null, affinity: null, race: [], education: [],
};

const num = (v: string): number | null => (v.trim() === '' ? null : Number(v.replace(/[\s,]/g, '')));
const slug = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

function Group({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-3xl border border-border bg-bg p-5 sm:p-6">
      <div>
        <h2 className="text-body-lg font-semibold text-fg">{title}</h2>
        {note ? <p className="text-body-sm text-fg-muted">{note}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Text({ label, value, onChange, placeholder, wide = false }: { label: string; value: string | number | null | undefined; onChange: (v: string) => void; placeholder?: string; wide?: boolean }) {
  return (
    <label className={`flex flex-col gap-1.5 ${wide ? 'sm:col-span-2' : ''}`}>
      <span className={fieldLabel}>{label}</span>
      <input className={field} value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function PhotoPicker({ label, photos, onUpload, onRemove, onMove, busy }: { label: string; photos: { src: string; uploaded: boolean; key?: string }[]; onUpload: (f: File) => void; onRemove: (key: string) => void; onMove?: (key: string, by: -1 | 1) => void; busy: boolean }) {
  const uploadedKeys = photos.filter((p) => p.uploaded && p.key).map((p) => p.key as string);
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      {photos.map((p) => (
        <span key={p.src} className="relative">
          <img src={p.src} alt="" className="h-20 w-28 rounded-xl object-cover" />
          <span className="absolute bottom-1 left-1 rounded-full bg-[rgba(6,12,28,0.65)] px-2 py-0.5 text-[10px] font-semibold text-white">{p.uploaded ? 'Uploaded' : 'From deck'}</span>
          {p.uploaded && p.key ? (
            <button type="button" onClick={() => onRemove(p.key as string)} aria-label="Remove photo" className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-fg text-[12px] font-bold text-bg">×</button>
          ) : null}
          {onMove && p.uploaded && p.key && uploadedKeys.length > 1 ? (
            <span className="absolute bottom-1 right-1 flex gap-1">
              {(
                [
                  [-1, '←', 'earlier'],
                  [1, '→', 'later'],
                ] as const
              ).map(([by, glyph, word]) => {
                const at = uploadedKeys.indexOf(p.key as string);
                const off = (by === -1 && at === 0) || (by === 1 && at === uploadedKeys.length - 1);
                return (
                  <button key={by} type="button" disabled={off} onClick={() => onMove(p.key as string, by)} aria-label={`Move photo ${word}`} className="flex h-6 w-6 items-center justify-center rounded-full bg-[rgba(6,12,28,0.65)] text-[12px] font-bold text-white disabled:opacity-30">
                    {glyph}
                  </button>
                );
              })}
            </span>
          ) : null}
        </span>
      ))}
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ''; }} />
      <button type="button" disabled={busy} onClick={() => input.current?.click()} className="flex h-20 w-28 items-center justify-center rounded-xl border border-dashed border-border-strong text-body-sm font-semibold text-accent hover:border-accent disabled:opacity-50">
        {busy ? 'Uploading…' : `+ ${label}`}
      </button>
    </div>
  );
}

function Editor({ start, isNew }: { start: MallContent; isNew: boolean }) {
  const router = useRouter();
  const [m, setM] = useState<MallContent>(start);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const p = m.profile ?? EMPTY_PROFILE;
  const appMalls = getMalls(getCatalogue()).filter((x) => x.group !== 'formats');
  const edited = contentUpdatedAt(`mall:${m.id}`);
  const fromDeck = Boolean(baseMall(m.id));

  const set = (patch: Partial<MallContent>) => setM((cur) => ({ ...cur, ...patch }));
  const setProfile = (patch: Partial<ShopperProfile>) => setM((cur) => ({ ...cur, profile: { ...(cur.profile ?? EMPTY_PROFILE), ...patch } }));
  const setMedia = (key: keyof NonNullable<MallContent['media']>, v: string) => setM((cur) => ({ ...cur, media: { ...(cur.media ?? {}), [key]: num(v) ?? undefined } }));
  const setPkg = (i: number, patch: Partial<MediaPackage>) => setM((cur) => ({ ...cur, packages: cur.packages.map((x, n) => (n === i ? { ...x, ...patch } : x)) }));

  async function upload(owner: string, f: File, apply: (photo: UploadedPhoto) => void) {
    setUploading(owner);
    setMessage(null);
    try {
      apply(await uploadPhoto(owner, f));
      setMessage({ ok: true, text: 'Photo uploaded. Save to publish it.' });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : 'Upload failed.' });
    } finally {
      setUploading(null);
    }
  }

  async function save() {
    if (!m.name.trim() || !m.id) return setMessage({ ok: false, text: 'Give the mall a name.' });
    setSaving(true);
    setMessage(null);
    try {
      await api.putContent(`mall:${m.id}`, m);
      await refreshLiveData();
      setMessage({ ok: true, text: 'Saved — it’s live on the site.' });
      if (isNew) router.replace(`/admin/malls/edit?id=${m.id}`);
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : 'Couldn’t save.' });
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    setSaving(true);
    try {
      await api.deleteContent(`mall:${m.id}`);
      await refreshLiveData();
      const base = baseMall(m.id);
      if (base) setM(base);
      else router.push('/admin/malls');
      setMessage({ ok: true, text: fromDeck ? 'Back to the deck’s data.' : 'Mall removed.' });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : 'Couldn’t reset.' });
    } finally {
      setSaving(false);
    }
  }

  const mallPhotos = [
    ...(m.photo ? [{ src: fileUrl(m.photo.storageKey), uploaded: true, key: m.photo.storageKey }] : []),
    ...(!m.photo && deckPhoto(m.id) ? [{ src: deckPhoto(m.id)!.src, uploaded: false }] : []),
  ];

  return (
    <div className="flex flex-col gap-6 pb-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Link href="/admin/malls" className="text-body-sm font-semibold text-fg-muted hover:text-fg">← All malls</Link>
          <h2 className="text-display-md text-fg">{isNew ? 'New mall' : mallName(m)}</h2>
          <p className="text-body-sm text-fg-muted">{edited ? `Edited ${new Date(edited).toLocaleString('en-ZA')}` : fromDeck ? 'From the proposal deck, not edited yet' : 'Not saved yet'}</p>
        </div>
      </div>

      <Group title="Details">
        <div className="grid gap-4 sm:grid-cols-2">
          <Text label="Name" value={m.name} onChange={(v) => set(isNew ? { name: v, id: slug(v) } : { name: v })} />
          <Text label="Province" value={m.province} onChange={(v) => set({ province: v })} />
          <Text label="Address" value={m.address} onChange={(v) => set({ address: v || null })} wide />
          <Text label="Visits a year" value={m.annualFootcount} onChange={(v) => set({ annualFootcount: num(v) })} />
          <Text label="Shop floor area (m²)" value={m.gla} onChange={(v) => set({ gla: num(v) })} />
          <label className="flex flex-col gap-1.5">
            <span className={fieldLabel}>Screens on this site</span>
            <select className={field} value={m.appMallId ?? ''} onChange={(e) => set({ appMallId: e.target.value || null })}>
              <option value="">None — audience data only</option>
              {appMalls.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-3 self-end pb-2.5">
            <input type="checkbox" checked={Boolean(m.hidden)} onChange={(e) => set({ hidden: e.target.checked })} className="h-5 w-5" />
            <span className="text-body-md text-fg">Hide from the site</span>
          </label>
        </div>
      </Group>

      <Group title="Mall photo" note="Shown on the mall’s insights page and in campaigns. Photos you upload count as cleared for clients.">
        <PhotoPicker
          label="Upload photo"
          photos={mallPhotos}
          busy={uploading === `mallphoto-${m.id}`}
          onUpload={(f) => void upload(`mallphoto-${m.id}`, f, (photo) => set({ photo }))}
          onRemove={() => set({ photo: null })}
        />
      </Group>

      <Group title="Shoppers">
        <div className="grid gap-4 sm:grid-cols-3">
          <Text label="Visits a month" value={p.monthlyFootcount} onChange={(v) => setProfile({ monthlyFootcount: num(v) })} />
          <Text label="Household income (R / month)" value={p.householdIncome} onChange={(v) => setProfile({ householdIncome: num(v) })} />
          <Text label="LSM affinity" value={p.lsm} placeholder="e.g. A or C&A" onChange={(v) => setProfile({ lsm: v || null })} />
          <Text label="Women %" value={p.female} onChange={(v) => setProfile({ female: num(v) })} />
          <Text label="Men %" value={p.male} onChange={(v) => setProfile({ male: num(v) })} />
          <Text label="Working %" value={p.working} onChange={(v) => setProfile({ working: num(v) })} />
          <Text label="Married / living together %" value={p.married} onChange={(v) => setProfile({ married: num(v) })} />
          <Text label="Higher affinity" value={p.affinity} placeholder="e.g. White & Coloured" onChange={(v) => setProfile({ affinity: v || null })} wide />
        </div>
        <div className="flex flex-col gap-2">
          <span className={fieldLabel}>Age groups</span>
          {p.ageBands.map((b, i) => (
            <div key={i} className="flex items-center gap-2">
              <input className={`${field} w-32`} value={b.band} aria-label="Age group" onChange={(e) => setProfile({ ageBands: p.ageBands.map((x, n) => (n === i ? { ...x, band: e.target.value } : x)) })} />
              <input className={`${field} w-24`} value={b.pct} aria-label="Percent" onChange={(e) => setProfile({ ageBands: p.ageBands.map((x, n) => (n === i ? { ...x, pct: num(e.target.value) ?? 0 } : x)) })} />
              <span className="text-body-sm text-fg-muted">%</span>
              <button type="button" className={quietBtn} onClick={() => setProfile({ ageBands: p.ageBands.filter((_, n) => n !== i) })}>Remove</button>
            </div>
          ))}
          <button type="button" className={`${quietBtn} self-start text-accent`} onClick={() => setProfile({ ageBands: [...p.ageBands, { band: '25-34', pct: 0 }] })}>+ Add age group</button>
        </div>
      </Group>

      <Group title="Advertising recall" note="Share of recent mall visitors, %.">
        <div className="grid gap-4 sm:grid-cols-4">
          <Text label="Notice mall ads" value={m.media?.noticeMallAds} onChange={(v) => setMedia('noticeMallAds', v)} />
          <Text label="Notice indoor ads" value={m.media?.noticeIndoorAds} onChange={(v) => setMedia('noticeIndoorAds', v)} />
          <Text label="Seen large screens" value={m.media?.seenLargeScreens} onChange={(v) => setMedia('seenLargeScreens', v)} />
          <Text label="Seen digital screens" value={m.media?.seenDigitalScreens} onChange={(v) => setMedia('seenDigitalScreens', v)} />
        </div>
      </Group>

      <Group title="Media packages" note="What sales can add to a campaign. The format sets the screen size clients see.">
        <ul className="flex flex-col gap-4">
          {m.packages.map((pkg, i) => {
            const own = m.packagePhotos?.[pkg.code] ?? [];
            const deckPhotos = packagePhotos(pkg.code).filter((x) => !x.uploaded);
            return (
              <li key={i} className="flex flex-col gap-3 rounded-2xl bg-bg-subtle p-4">
                <div className="grid gap-3 sm:grid-cols-[8rem_minmax(0,1fr)_12rem_6rem]">
                  <Text label="Code" value={pkg.code} onChange={(v) => setPkg(i, { code: v.toUpperCase() })} />
                  <Text label="Name" value={pkg.name} onChange={(v) => setPkg(i, { name: v })} />
                  <label className="flex flex-col gap-1.5">
                    <span className={fieldLabel}>Format</span>
                    <select className={field} value={FORMATS.includes(pkg.format) ? pkg.format : ''} onChange={(e) => setPkg(i, { format: e.target.value })}>
                      {FORMATS.map((f) => <option key={f}>{f}</option>)}
                      {!FORMATS.includes(pkg.format) ? <option value="">{pkg.format || 'Other'}</option> : null}
                    </select>
                  </label>
                  <Text label="Screens" value={pkg.units} onChange={(v) => setPkg(i, { units: num(v) })} />
                </div>
                <Text label="Sites" value={pkg.sites} onChange={(v) => setPkg(i, { sites: v })} wide />
                <PhotoPicker
                  label="Add photo"
                  photos={[...own.map((x) => ({ src: fileUrl(x.storageKey), uploaded: true, key: x.storageKey })), ...deckPhotos.map((x) => ({ src: x.src, uploaded: false }))]}
                  busy={uploading === `pkgphoto-${pkg.code}`}
                  onUpload={(f) => void upload(`pkgphoto-${pkg.code}`, f, (photo) => setM((cur) => ({ ...cur, packagePhotos: { ...(cur.packagePhotos ?? {}), [pkg.code]: [...(cur.packagePhotos?.[pkg.code] ?? []), photo] } })))}
                  onRemove={(key) => setM((cur) => ({ ...cur, packagePhotos: { ...(cur.packagePhotos ?? {}), [pkg.code]: (cur.packagePhotos?.[pkg.code] ?? []).filter((x) => x.storageKey !== key) } }))}
                  onMove={(key, by) =>
                    setM((cur) => {
                      const list = [...(cur.packagePhotos?.[pkg.code] ?? [])];
                      const at = list.findIndex((x) => x.storageKey === key);
                      const to = at + by;
                      if (at < 0 || to < 0 || to >= list.length) return cur;
                      [list[at], list[to]] = [list[to], list[at]];
                      return { ...cur, packagePhotos: { ...(cur.packagePhotos ?? {}), [pkg.code]: list } };
                    })
                  }
                />
                <button type="button" className={`${quietBtn} self-start`} onClick={() => setM((cur) => ({ ...cur, packages: cur.packages.filter((_, n) => n !== i) }))}>Remove package</button>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          className={`${quietBtn} self-start text-accent`}
          onClick={() => setM((cur) => ({ ...cur, packages: [...cur.packages, { code: '', name: '', format: 'Digi Nav', units: 1, sites: '', slide: 0 }] }))}
        >
          + Add package
        </button>
      </Group>

      <div className="fixed inset-x-0 bottom-0 z-sticky border-t border-border bg-bg/95 backdrop-blur lg:left-[var(--sidebar-width)]">
        <div className="mx-auto flex max-w-admin flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <p className={`text-body-sm ${message ? (message.ok ? 'text-success-fg' : 'text-danger-fg') : 'text-fg-muted'}`} role="status">
            {message?.text ?? 'Changes go live for everyone when you save.'}
          </p>
          <div className="flex gap-2">
            {edited ? (
              <button type="button" disabled={saving} className={quietBtn} onClick={() => void reset()}>
                {fromDeck ? 'Reset to deck data' : 'Delete mall'}
              </button>
            ) : null}
            <button type="button" disabled={saving || Boolean(uploading)} className={primaryBtn} onClick={() => void save()}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Load() {
  const params = useSearchParams();
  const id = params.get('id') ?? '';
  const isNew = params.get('new') === '1';
  if (isNew) {
    return (
      <Editor
        isNew
        start={{ id: '', name: '', appMallId: null, province: 'Gauteng', address: null, annualFootcount: null, gla: null, profile: null, media: null, packages: [] }}
      />
    );
  }
  const m = deckMall(id);
  if (!m) return <p className="text-body-md text-fg-muted">No mall with that id. <Link href="/admin/malls" className="font-semibold text-accent">Back to malls</Link></p>;
  return <Editor key={m.id} start={m} isNew={false} />;
}

export function MallEditor() {
  return <AdminGate><Load /></AdminGate>;
}
