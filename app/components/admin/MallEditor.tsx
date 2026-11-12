'use client';

import { Zoomable } from '@/components/ui/ImageViewer';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRef, useState } from 'react';
import { api, fileUrl } from '@/lib/api';
import { deckMallForApp, deckPhoto, packagePhotos } from '@/lib/insights';
import type { MallContent, MediaPackage, UploadedPhoto } from '@/lib/insights';
import type { ShopperProfile } from '@/lib/insights/types';
import { contentUpdatedAt } from '@/lib/content';
import { refreshLiveData, useLiveData } from '@/lib/liveData';
import { NETWORK_SPEC_IDS, resolvePackageSpec, sheetHref } from '@/lib/portal/screens';
import { getAssets } from '@/lib/catalogue';
import { getAllMallsForAdmin, getMalls, getScreenSize } from '@/lib/malls';
import { allSites, placeLine, pointLocation, SA_PROVINCES, siteById, slugifySite } from '@/lib/sites';
import type { SiteGroup, SiteRecord } from '@/lib/sites';
import { newScreenSpec } from '@/lib/newScreen';
import { specHref } from '@/lib/liveData';
import { useAdminSession } from '@/components/auth/AdminSession';
import { LocationPicker } from './LocationPicker';
import { getCatalogue } from '@/lib/catalogue';
import { AdminGate, field, fieldLabel, primaryBtn, quietBtn, uploadPhoto } from './AdminGate';

/**
 * One mall, everything about it on one page:
 *  - name, place and map position, and whether it's published (content
 *    "site:<id>", see lib/sites.ts) — what puts it in the left-hand list,
 *    on the map and in the Media Explorer;
 *  - its screens, added here with a name and size;
 *  - optional proposal data: photo, shoppers, recall and media packages
 *    (content "mall:<id>").
 * Delete hides the mall and archives its screens; Restore brings both back.
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
          <Zoomable src={p.src} title={label.replace(/^\+ /, '')} className="h-20 w-28 rounded-xl" />
          <span className="pointer-events-none absolute bottom-1 left-1 rounded-full bg-[rgba(6,12,28,0.65)] px-2 py-0.5 text-[10px] font-semibold text-white">{p.uploaded ? 'Uploaded' : 'From deck'}</span>
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

/**
 * Which screen spec a package uses — this sets the artwork size and the
 * After Effects template clients get. Automatic matches the package's site
 * list to the mall's screens; an admin can choose the exact one instead.
 */
function PackageScreen({ pkg, appMallId, onChange }: { pkg: MediaPackage; appMallId: string | null; onChange: (specId: string | null) => void }) {
  const { catalogue } = useLiveData();
  const auto = resolvePackageSpec({ ...pkg, specId: null }, appMallId, catalogue);
  const now = resolvePackageSpec(pkg, appMallId, catalogue);
  const appMall = appMallId ? getMalls(catalogue).find((x) => x.id === appMallId) : undefined;
  const own = (appMall?.specIds ?? []).map((id) => catalogue.specifications[id]).filter((x) => x && !x.archivedAt);
  const network = NETWORK_SPEC_IDS.map((id) => catalogue.specifications[id]).filter(Boolean);
  const label = (x: { title: string } & Parameters<typeof getScreenSize>[0]) => {
    const size = getScreenSize(x);
    return `${x.title}${size ? ` · ${size.width}×${size.height}` : ''}`;
  };
  const template = now.spec ? getAssets([...now.spec.downloadIds, ...now.spec.attachmentIds], catalogue).find((a) => /\.aep$/i.test(a.filename)) : undefined;
  const why = { chosen: 'Chosen by an admin', matched: 'Matched to this mall’s screen from the sites', network: 'Network-wide size — check this is right', none: 'No spec — size to be confirmed' }[now.source];
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex flex-col gap-1.5">
        <span className={fieldLabel}>Screen (sets the artwork size and template)</span>
        <select className={field} value={pkg.specId ?? ''} onChange={(e) => onChange(e.target.value || null)}>
          <option value="">Automatic — {auto.spec ? label(auto.spec) : 'none found'}{auto.source === 'network' ? ' (network)' : ''}</option>
          {own.length ? (
            <optgroup label="This mall’s screens">
              {own.map((x) => <option key={x!.id} value={x!.id}>{label(x!)}</option>)}
            </optgroup>
          ) : null}
          <optgroup label="Network-wide">
            {network.map((x) => <option key={x!.id} value={x!.id}>{label(x!)}</option>)}
          </optgroup>
        </select>
      </label>
      <p className={`text-body-sm ${now.source === 'network' || now.source === 'none' ? 'text-warning-fg' : 'text-fg-muted'}`}>
        {why}.{template ? <> Template: <a href={sheetHref(template)} download={template.filename} className="font-semibold text-accent hover:underline">{template.filename}</a></> : ' No After Effects template on this spec.'}
      </p>
    </div>
  );
}

const EMPTY_DECK = (id: string, name: string, province: string): MallContent => ({
  id, name, appMallId: id, province, address: null, annualFootcount: null, gla: null, profile: null, media: null, packages: [],
});

const hasProposalData = (m: MallContent) =>
  Boolean(m.packages.length || m.profile || m.media || m.annualFootcount || m.gla || m.photo || m.address);

/** The mall's screens: what's there, and a quick way to add more. */
function Screens({ site }: { site: SiteRecord }) {
  const { catalogue } = useLiveData();
  const { account } = useAdminSession();
  const mall = getAllMallsForAdmin(catalogue).find((x) => x.site.id === site.id)?.mall;
  const specs = (mall?.specIds ?? []).map((id) => catalogue.specifications[id]).filter(Boolean);
  const [title, setTitle] = useState('');
  const [w, setW] = useState('');
  const [h, setH] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const px = (v: string) => (v.trim() ? Number(v) : null);

  async function add() {
    const width = px(w);
    const height = px(h);
    if (!title.trim()) return setMsg({ ok: false, text: 'Give the screen a name, e.g. “Food Court”.' });
    if ([width, height].some((v) => v != null && !(Number.isInteger(v) && v > 0 && v <= 20000)) || (width == null) !== (height == null)) {
      return setMsg({ ok: false, text: 'Width and height are whole numbers of pixels (or leave both empty).' });
    }
    setBusy(true);
    setMsg(null);
    try {
      const spec = newScreenSpec({ mallId: site.id, mallName: site.name, title: title.trim(), width, height, takenIds: new Set(Object.keys(catalogue.specifications)), by: account?.email ?? 'admin' });
      await api.putSpec(spec, { mallId: site.id, isNew: true });
      await refreshLiveData();
      setTitle('');
      setW('');
      setH('');
      setMsg({ ok: true, text: `Added “${spec.title}”. Add pictures, files and its artwork guide with Edit.` });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Couldn’t add the screen.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {specs.length ? (
        <ul className="overflow-hidden rounded-2xl border border-border">
          {specs.map((x) => {
            const size = getScreenSize(x!);
            const pics = x!.mediaIds.filter((id) => catalogue.assets[id]).length;
            const href = specHref(x!.id);
            return (
              <li key={x!.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-4 py-3 first:border-t-0">
                <span className="min-w-0 flex-1 truncate text-body-md font-medium text-fg">{x!.title}</span>
                <span className="w-28 font-mono text-body-sm tabular-nums text-fg-muted">{size ? `${size.width}×${size.height}` : 'No size'}</span>
                <span className={`w-24 text-body-sm ${pics ? 'text-fg-muted' : 'text-warning-fg'}`}>{pics ? `${pics} ${pics === 1 ? 'picture' : 'pictures'}` : 'No pictures'}</span>
                <Link href={`${href}${href.includes('?') ? '&' : '?'}edit=1`} className="inline-flex h-9 items-center rounded-full border border-border-strong px-4 text-body-sm font-semibold text-fg hover:bg-bg-subtle">Edit</Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-2xl bg-bg-subtle px-4 py-3 text-body-sm text-fg-muted">No screens yet. Add the first one below.</p>
      )}
      <div className="grid gap-3 rounded-2xl bg-bg-subtle p-4 sm:grid-cols-[minmax(0,1fr)_8rem_8rem_auto] sm:items-end">
        <Text label="New screen" value={title} placeholder="e.g. Food Court" onChange={setTitle} />
        <Text label="Width (px)" value={w} placeholder="1920" onChange={setW} />
        <Text label="Height (px)" value={h} placeholder="1080" onChange={setH} />
        <button type="button" disabled={busy} className={primaryBtn} onClick={() => void add()}>{busy ? 'Adding…' : '+ Add screen'}</button>
      </div>
      {msg ? <p role="status" className={`text-body-sm ${msg.ok ? 'text-success-fg' : 'text-danger-fg'}`}>{msg.text}</p> : null}
      <p className="text-body-sm text-fg-muted">
        To place screens inside the mall, open it on the{' '}
        <Link href={`/?mall=${site.id}&edit=1`} className="font-semibold text-accent hover:underline">screen map</Link>.
      </p>
    </div>
  );
}

function Editor({ start, deckStart, isNew }: { start: SiteRecord; deckStart: MallContent | null; isNew: boolean }) {
  const router = useRouter();
  const { catalogue } = useLiveData();
  const { account } = useAdminSession();
  const [site, setSite] = useState<SiteRecord>(start);
  const [m, setM] = useState<MallContent>(deckStart ?? EMPTY_DECK(start.id, start.name, start.place?.province ?? 'Gauteng'));
  const [showProposal, setShowProposal] = useState(Boolean(deckStart));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const p = m.profile ?? EMPTY_PROFILE;
  const saved = Boolean(siteById(site.id)) && !isNew;
  const place = site.place ?? { name: '', area: '', city: '', province: 'Gauteng' };

  const setS = (patch: Partial<SiteRecord>) => setSite((cur) => ({ ...cur, ...patch }));
  const setPlace = (patch: Partial<typeof place>) => setSite((cur) => ({ ...cur, place: { ...(cur.place ?? place), ...patch } }));
  const set = (patch: Partial<MallContent>) => setM((cur) => ({ ...cur, ...patch }));
  const setProfile = (patch: Partial<ShopperProfile>) => setM((cur) => ({ ...cur, profile: { ...(cur.profile ?? EMPTY_PROFILE), ...patch } }));
  const setMedia = (key: keyof NonNullable<MallContent['media']>, v: string) => setM((cur) => ({ ...cur, media: { ...(cur.media ?? {}), [key]: num(v) ?? undefined } }));
  const setPkg = (i: number, patch: Partial<MediaPackage>) => setM((cur) => ({ ...cur, packages: cur.packages.map((x, n) => (n === i ? { ...x, ...patch } : x)) }));

  async function upload(owner: string, f: File, apply: (photo: UploadedPhoto) => void) {
    setUploading(owner);
    setMessage(null);
    try {
      apply(await uploadPhoto(owner, f));
      setMessage({ ok: true, text: 'Photo uploaded. Save to keep it.' });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : 'Upload failed.' });
    } finally {
      setUploading(null);
    }
  }

  /** Saves the mall (and its proposal data, if it has any). `published` changes whether everyone sees it. */
  async function save(published = site.published, extra: Partial<SiteRecord> = {}) {
    const name = site.name.trim();
    const id = isNew ? slugifySite(name) : site.id;
    if (!name || !id) return setMessage({ ok: false, text: 'Give the mall a name.' });
    if (isNew && allSites().some((x) => x.id === id)) return setMessage({ ok: false, text: `There’s already a mall called “${siteById(id)?.name}”. Open it from the list instead.` });
    if (published && !site.location) return setMessage({ ok: false, text: 'Put the mall on the map before publishing it, so it shows in the right place.' });
    setSaving(true);
    setMessage(null);
    try {
      const next: SiteRecord = { ...site, ...extra, id, name, place: { ...place, name: place.name.trim() || name }, published };
      await api.putContent(`site:${id}`, next);
      if (showProposal && (hasProposalData(m) || deckStart)) {
        await api.putContent(`mall:${m.id || id}`, { ...m, id: m.id || id, name: m.name || place.name || name, province: place.province, appMallId: id, hidden: Boolean(next.deletedAt) });
      }
      await refreshLiveData();
      setSite(next);
      setMessage({ ok: true, text: next.deletedAt ? 'Deleted.' : published ? 'Saved and published: everyone can see it.' : 'Saved as a draft: only admins can see it.' });
      if (isNew) router.replace(`/admin/malls/edit?id=${id}`);
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : 'Couldn’t save.' });
    } finally {
      setSaving(false);
    }
  }

  /** Delete: hide the mall and archive its screens (both come back with Restore). */
  async function remove() {
    const mall = getAllMallsForAdmin(catalogue).find((x) => x.site.id === site.id)?.mall;
    const specs = (mall?.specIds ?? []).map((id) => catalogue.specifications[id]).filter((x) => x && !x.archivedAt);
    if (!window.confirm(`Delete ${site.name}${specs.length ? ` and its ${specs.length} ${specs.length === 1 ? 'screen' : 'screens'}` : ''}? It disappears for everyone. You can restore it from Site admin → Malls → Deleted.`)) return;
    setSaving(true);
    try {
      const at = new Date().toISOString();
      for (const x of specs) await api.putSpec({ ...x!, archivedAt: at, archivedBy: (account?.email ?? 'admin') as never }, { mallId: site.id });
      setSaving(false);
      await save(false, { deletedAt: at, archivedSpecIds: specs.map((x) => x!.id) } as Partial<SiteRecord>);
    } catch (e) {
      setSaving(false);
      setMessage({ ok: false, text: e instanceof Error ? e.message : 'Couldn’t delete.' });
    }
  }

  async function restore() {
    setSaving(true);
    try {
      const ids = ((site as SiteRecord & { archivedSpecIds?: string[] }).archivedSpecIds ?? []);
      for (const id of ids) {
        const x = catalogue.specifications[id];
        if (x) await api.putSpec({ ...x, archivedAt: null, archivedBy: null }, { mallId: site.id });
      }
      setSaving(false);
      await save(false, { deletedAt: null, archivedSpecIds: [] } as Partial<SiteRecord>);
    } catch (e) {
      setSaving(false);
      setMessage({ ok: false, text: e instanceof Error ? e.message : 'Couldn’t restore.' });
    }
  }

  const mallPhotos = [
    ...(m.photo ? [{ src: fileUrl(m.photo.storageKey), uploaded: true, key: m.photo.storageKey }] : []),
    ...(!m.photo && deckPhoto(m.id) ? [{ src: deckPhoto(m.id)!.src, uploaded: false }] : []),
  ];
  const status = site.deletedAt ? { text: 'Deleted', cls: 'bg-danger-bg text-danger-fg' } : site.published ? { text: 'Published', cls: 'bg-success-bg text-success-fg' } : { text: 'Draft · only admins see it', cls: 'bg-warning-bg text-warning-fg' };

  return (
    <div className="flex flex-col gap-6 pb-28">
      <div className="flex flex-col gap-1">
        <Link href="/admin/malls" className="text-body-sm font-semibold text-fg-muted hover:text-fg">← All malls</Link>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-display-md text-fg">{isNew ? 'Add a mall' : site.name}</h2>
          {!isNew ? <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${status.cls}`}>{status.text}</span> : null}
        </div>
        <p className="text-body-sm text-fg-muted">
          {isNew ? 'Three steps: name and place, then the map, then its screens. Save as a draft at any point; publish when it’s ready.' : site.place ? placeLine(site.place) : ''}
          {saved && site.published && !site.deletedAt ? <> · <Link href={`/?mall=${site.id}`} className="font-semibold text-accent hover:underline">See it on the map</Link></> : null}
        </p>
        {site.place?.note ? <p className="text-body-sm font-semibold text-warning-fg">{site.place.note}</p> : null}
      </div>

      <Group title="1 · Name and place">
        <div className="grid gap-4 sm:grid-cols-2">
          <Text label="Name in lists" value={site.name} placeholder="e.g. Cresta" onChange={(v) => setS({ name: v })} />
          <Text label="Full public name" value={place.name} placeholder="e.g. Cresta Shopping Centre" onChange={(v) => setPlace({ name: v })} />
          <label className="flex flex-col gap-1.5">
            <span className={fieldLabel}>Network</span>
            <select className={field} value={site.group} onChange={(e) => setS({ group: e.target.value as SiteGroup })}>
              <option value="malls">Primedia Malls</option>
              <option value="hyprop">Hyprop Malls</option>
              <option value="formats">Generic specs (not a mall)</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={fieldLabel}>Province</span>
            <select className={field} value={place.province} onChange={(e) => setPlace({ province: e.target.value })}>
              {[...new Set([...SA_PROVINCES, place.province].filter(Boolean))].map((x) => <option key={x}>{x}</option>)}
            </select>
          </label>
          <Text label="Suburb or area" value={place.area} placeholder="e.g. Randburg" onChange={(v) => setPlace({ area: v })} />
          <Text label="City" value={place.city} placeholder="e.g. Johannesburg" onChange={(v) => setPlace({ city: v })} />
        </div>
      </Group>

      {site.group !== 'formats' ? (
        <Group title="2 · On the map" note="Where the mall is, on the same street map everyone sees.">
          <LocationPicker
            value={site.location}
            suggestion={place.name || site.name}
            onChange={(location, hint) => {
              setSite((cur) => {
                const cp = cur.place ?? place;
                return {
                  ...cur,
                  location,
                  place: hint
                    ? { ...cp, name: cp.name || hint.name || cur.name, area: hint.area || cp.area, city: hint.city || cp.city, province: hint.province || cp.province, note: undefined }
                    : { ...cp, note: undefined },
                };
              });
            }}
          />
        </Group>
      ) : null}

      <span id="screens" className="-mb-6 scroll-mt-24" />
      <Group title="3 · Screens" note={saved ? 'Each screen gets its own spec page, where you add pictures, the spec sheet and the After Effects template.' : 'Save the mall first (as a draft is fine), then add its screens here.'}>
        {saved ? <Screens site={site} /> : (
          <button type="button" disabled={saving} className={`${primaryBtn} self-start`} onClick={() => void save(false)}>Save draft and add screens</button>
        )}
      </Group>

      {showProposal ? (
        <>
          <h3 className="pt-2 text-display-sm text-fg">Proposal data</h3>
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
          <Text label="Visits a year" value={m.annualFootcount} placeholder={p.monthlyFootcount ? `${(p.monthlyFootcount * 12).toLocaleString('en-ZA')} (month × 12)` : 'e.g. 12 000 000'} onChange={(v) => set({ annualFootcount: num(v) })} />
          <Text label="Visits a month" value={p.monthlyFootcount} onChange={(v) => setProfile({ monthlyFootcount: num(v) })} />
          <Text label="Household income (R / month)" value={p.householdIncome} onChange={(v) => setProfile({ householdIncome: num(v) })} />
          <Text label="LSM affinity" value={p.lsm} placeholder="e.g. A or C&A" onChange={(v) => setProfile({ lsm: v || null })} />
          <Text label="Women %" value={p.female} onChange={(v) => setProfile({ female: num(v) })} />
          <Text label="Men %" value={p.male} onChange={(v) => setProfile({ male: num(v) })} />
          <Text label="Working %" value={p.working} onChange={(v) => setProfile({ working: num(v) })} />
          <Text label="Married / living together %" value={p.married} onChange={(v) => setProfile({ married: num(v) })} />
          <Text label="Higher affinity" value={p.affinity} placeholder="e.g. White & Coloured" onChange={(v) => setProfile({ affinity: v || null })} wide />
        </div>
        <p className="text-body-sm text-fg-muted">
          {m.annualFootcount
            ? `The site uses ${m.annualFootcount.toLocaleString('en-ZA')} visits a year (Insights, reach estimates, proposals and the PowerPoint).`
            : p.monthlyFootcount
              ? `No yearly figure: the site uses visits a month × 12 = ${(p.monthlyFootcount * 12).toLocaleString('en-ZA')} a year.`
              : 'Add visits a year (or a month) so this mall shows its reach.'}
        </p>
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
                <PackageScreen pkg={pkg} appMallId={m.appMallId} onChange={(specId) => setPkg(i, { specId })} />
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

        </>
      ) : (
        <button type="button" className={`${quietBtn} self-start text-accent`} onClick={() => setShowProposal(true)}>
          + Add proposal data (shoppers, packages, mall photo)
        </button>
      )}

      <div className="fixed inset-x-0 bottom-0 z-sticky border-t border-border bg-bg/95 backdrop-blur lg:left-[var(--sidebar-width)]">
        <div className="mx-auto flex max-w-admin flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <p className={`text-body-sm ${message ? (message.ok ? 'text-success-fg' : 'text-danger-fg') : 'text-fg-muted'}`} role="status">
            {message?.text ?? (site.published ? 'Changes go live for everyone when you save.' : 'A draft: only admins see it until you publish.')}
          </p>
          <div className="flex flex-wrap gap-2">
            {saved && !site.deletedAt ? <button type="button" disabled={saving} className={`${quietBtn} text-danger-fg`} onClick={() => void remove()}>Delete mall</button> : null}
            {site.deletedAt ? (
              <button type="button" disabled={saving} className={primaryBtn} onClick={() => void restore()}>Restore mall</button>
            ) : site.published ? (
              <>
                <button type="button" disabled={saving} className={quietBtn} onClick={() => void save(false)}>Unpublish</button>
                <button type="button" disabled={saving || Boolean(uploading)} className={primaryBtn} onClick={() => void save(true)}>{saving ? 'Saving…' : 'Save'}</button>
              </>
            ) : (
              <>
                <button type="button" disabled={saving || Boolean(uploading)} className={quietBtn} onClick={() => void save(false)}>Save draft</button>
                <button type="button" disabled={saving || Boolean(uploading)} className={primaryBtn} onClick={() => void save(true)}>{saving ? 'Saving…' : 'Publish'}</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Load() {
  const params = useSearchParams();
  useLiveData(); // malls arrive with the live data
  const id = params.get('id') ?? '';
  if (params.get('new') === '1') {
    return (
      <Editor
        isNew
        deckStart={null}
        start={{ id: '', name: '', group: 'malls', place: { name: '', area: '', city: '', province: 'Gauteng' }, location: null, subGroupId: null, specIds: [], published: false, deletedAt: null }}
      />
    );
  }
  const site = siteById(id);
  if (!site) return <p className="text-body-md text-fg-muted">No mall with that id. <Link href="/admin/malls" className="font-semibold text-accent">Back to malls</Link></p>;
  return <Editor key={site.id} start={site} deckStart={deckMallForApp(site.id) ?? null} isNew={false} />;
}

export function MallEditor() {
  return <AdminGate><Load /></AdminGate>;
}
