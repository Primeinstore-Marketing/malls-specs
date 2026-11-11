'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { DECK_MALLS, annualVisits, compact, deckMall, isCleared, mallArea, mallName, mallPhoto, packagePhotos, thousands } from '@/lib/insights';
import { MALL_PLACES } from '@/lib/mallPlaces';
import { AddToCampaign, Bar, Page, RequireSignIn, Section } from '@/components/portal/ui';
import { EmptyState } from '@/components/ui/EmptyState';

function Mall({ id }: { id: string }) {
  const m = deckMall(id);
  if (!m) return <Page><EmptyState title="We don’t have insights for that mall." description="Pick one from the list of malls." /></Page>;
  const p = m.profile;
  const visits = annualVisits(m);
  const same = DECK_MALLS.filter((x) => x.province === m.province && x.id !== m.id);
  const media = [
    ['Notice mall advertising', m.media?.noticeMallAds],
    ['Seen large-screen ads', m.media?.seenLargeScreens],
    ['Seen digital-screen ads', m.media?.seenDigitalScreens],
    ['Notice indoor advertising', m.media?.noticeIndoorAds],
  ] as const;

  const photo = mallPhoto(m.id);
  return (
    <Page>
      <Link href="/insights" className="-mb-4 self-start text-body-sm font-semibold text-fg-muted hover:text-fg">← All malls</Link>
      <header className="relative overflow-hidden rounded-3xl bg-brand-surface">
        {photo ? (
          <img src={photo.src} alt="" width={photo.width} height={photo.height} className="absolute inset-0 h-full w-full object-cover" />
        ) : null}
        {photo && !isCleared(photo) ? (
          <span className="absolute right-4 top-4 z-[1] rounded-full bg-[rgba(6,12,28,0.6)] px-2.5 py-1 text-[11px] font-semibold text-white" title="Internal use until rights are cleared">
            Rights pending
          </span>
        ) : null}
        <div className="relative flex min-h-[280px] flex-col justify-end gap-2 bg-gradient-to-t from-[rgba(6,12,28,0.85)] via-[rgba(6,12,28,0.35)] to-transparent p-6 text-white sm:min-h-[340px] sm:p-8">
          <span className="text-label-md font-semibold uppercase text-white/80">{m.province}</span>
          <h1 className="text-display-xl">{mallName(m)}</h1>
          <p className="text-body-md text-white/85">
            {m.address ?? mallArea(m)}
            {m.gla ? ` · ${thousands(m.gla)} m² of shops` : ''}
          </p>
        </div>
      </header>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <dl className="grid grid-cols-3 gap-6 sm:gap-10">
          <div><dt className="text-body-sm text-fg-muted">Visits a year</dt><dd className="text-display-md text-fg">{visits ? compact(visits) : '—'}</dd></div>
          <div><dt className="text-body-sm text-fg-muted">Household income</dt><dd className="text-display-md text-fg">{p?.householdIncome ? `R${compact(p.householdIncome)}` : '—'}</dd></div>
          <div><dt className="text-body-sm text-fg-muted">LSM affinity</dt><dd className="text-display-md text-fg">{p?.lsm?.replace('&', ' & ') ?? '—'}</dd></div>
        </dl>
        {m.appMallId ? (
          <Link href={`/explorer?mall=${m.appMallId}`} className="inline-flex h-11 items-center justify-center rounded-full border border-border-strong px-5 text-body-sm font-semibold text-fg hover:border-fg">
            Screens and specs →
          </Link>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Shoppers" id="shoppers">
          <div className="flex flex-col gap-5 rounded-3xl bg-bg-subtle p-5 sm:p-6">
            {p?.female != null && p.male != null ? (
              <div className="flex flex-col gap-2">
                <span className="text-label-md font-semibold uppercase text-fg-muted">Gender</span>
                <div className="flex h-3 gap-[2px] overflow-hidden rounded-full" role="img" aria-label={`${p.female}% women, ${p.male}% men`}>
                  <span className="rounded-l-full bg-accent" style={{ width: `${p.female}%` }} />
                  <span className="rounded-r-full bg-brand-surface" style={{ width: `${p.male}%` }} />
                </div>
                <div className="flex justify-between text-body-sm"><span className="font-semibold text-fg">Women {p.female}%</span><span className="font-semibold text-fg">Men {p.male}%</span></div>
              </div>
            ) : null}
            {p?.ageBands.length ? (
              <div className="flex flex-col gap-2">
                <span className="text-label-md font-semibold uppercase text-fg-muted">Age</span>
                {p.ageBands.map((b) => <Bar key={b.band} label={b.band.replace('-', '–')} pct={b.pct} max={50} />)}
              </div>
            ) : null}
            {p?.affinity ? <p className="text-body-sm text-fg-muted">Higher affinity: <span className="font-semibold text-fg">{p.affinity}</span></p> : null}
            <div className="grid grid-cols-2 gap-3 text-body-sm">
              {p?.married != null ? <div><div className="text-display-sm text-fg">{p.married}%</div><div className="text-fg-muted">Married or living together</div></div> : null}
              {p?.working != null ? <div><div className="text-display-sm text-fg">{p.working}%</div><div className="text-fg-muted">Working</div></div> : null}
              {p?.race.map((r) => <div key={r.group}><div className="text-display-sm text-fg">{r.pct}%</div><div className="text-fg-muted">{r.group}</div></div>)}
              {p?.education.map((r) => <div key={r.level}><div className="text-display-sm text-fg">{r.pct}%</div><div className="text-fg-muted">{r.level} education</div></div>)}
            </div>
          </div>
        </Section>

        <Section title="Advertising recall" id="recall">
          <div className="flex flex-col gap-3 rounded-3xl bg-bg-subtle p-5 sm:p-6">
            <p className="text-body-sm text-fg-muted">People who visited a mall in the past 3 months.</p>
            {m.media ? media.map(([label, v]) => (v != null ? <Bar key={label} label={label} pct={v} /> : null)) : <p className="text-body-sm text-fg-muted">Not in the proposal for this mall.</p>}
          </div>
        </Section>
      </div>

      <Section title="Media packages" id="packages">
        <div className="grid gap-3 md:grid-cols-2">
          {m.packages.map((pkg) => (
            <article key={pkg.code} className="flex flex-col gap-2 rounded-xl border border-border bg-bg p-4">
              {packagePhotos(pkg.code).length ? (
                <div className="-mx-4 -mt-4 mb-2 flex gap-[2px] overflow-hidden rounded-t-xl">
                  {packagePhotos(pkg.code).map((img) => (
                    <img key={img.src} src={img.src} alt={`${pkg.format} in place at ${mallName(m)}`} loading="lazy" width={img.width} height={img.height} className="aspect-[16/9] min-w-0 flex-1 object-cover" />
                  ))}
                </div>
              ) : null}
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-body-md font-semibold text-fg">{pkg.name}</h3>
                  <span className="font-mono text-body-sm text-fg-muted">{pkg.code} · {pkg.format}{pkg.units ? ` × ${pkg.units}` : ''}</span>
                </div>
                <AddToCampaign item={{ kind: 'package', code: pkg.code }} />
              </div>
              <p className="text-body-sm text-fg-muted">{pkg.sites}</p>
            </article>
          ))}
        </div>
        <p className="text-body-sm text-fg-subtle">Subject to availability. Sites may change; units are confirmed on booking.</p>
      </Section>

      {same.length ? (
        <Section title={`Other malls in ${m.province}`} id="near">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {same.map((x) => (
              <Link key={x.id} href={`/insights/mall?id=${x.id}`} className="flex flex-col rounded-lg border border-border bg-bg px-3.5 py-2.5 hover:border-accent">
                <strong className="text-body-md font-semibold text-fg">{mallName(x)}</strong>
                <span className="text-body-sm text-fg-muted">{x.appMallId ? MALL_PLACES[x.appMallId]?.area ?? '' : ''}{annualVisits(x) ? `${x.appMallId ? ' · ' : ''}${compact(annualVisits(x) as number)} visits/yr` : ''}</span>
              </Link>
            ))}
          </div>
        </Section>
      ) : null}
      <p className="text-body-sm text-fg-subtle">Source: Rialtofoods media proposal, April 2022 — TGISA 18B/19A and 15C/16C; Stats SA Community Survey, 5km catchment.</p>
    </Page>
  );
}

export function MallInsight() {
  const params = useSearchParams();
  const id = params.get('id') ?? '';
  return <RequireSignIn what="audience insights">{() => <Mall id={id} />}</RequireSignIn>;
}
