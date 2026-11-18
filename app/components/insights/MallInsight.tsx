'use client';

import { useDocumentTitle } from '@/lib/useDocumentTitle';
import Link from 'next/link';
import { Zoomable } from '@/components/ui/ImageViewer';
import { useSearchParams } from 'next/navigation';
import { getMall } from '@/lib/malls';
import { DECK_MALLS, annualVisits, compact, deckMall, earnsAtLeast, incomeBands, isCleared, mallArea, mallName, mallPhoto, packagePhotos, profileSource, semShare, thousands, mapIdOf } from '@/lib/insights';
import { mallPlace } from '@/lib/sites';
import { AddToProposal, Bar, Page, RequireSignIn, Section } from '@/components/portal/ui';
import { EmptyState } from '@/components/ui/EmptyState';

function Mall({ id }: { id: string }) {
  const m = deckMall(id);
  useDocumentTitle(m ? `${mallName(m)} · Who shops here` : null);
  if (!m) return <Page><EmptyState page title="We don’t have insights for that mall." description="Pick one from the list of malls." /></Page>;
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
          {earnsAtLeast(m) != null ? (
            <div><dt className="text-body-sm text-fg-muted">Earn R30k+ a month</dt><dd className="text-display-md text-fg">{earnsAtLeast(m)}%</dd></div>
          ) : (
            <div><dt className="text-body-sm text-fg-muted">Household income</dt><dd className="text-display-md text-fg">{p?.householdIncome ? `R${compact(p.householdIncome)}` : '—'}</dd></div>
          )}
          {semShare(m, 'upper') != null ? (
            <div><dt className="text-body-sm text-fg-muted">SEM 8–10</dt><dd className="text-display-md text-fg">{semShare(m, 'upper')}%</dd></div>
          ) : (
            <div><dt className="text-body-sm text-fg-muted">LSM affinity</dt><dd className="text-display-md text-fg">{p?.lsm?.replace('&', ' & ') ?? '—'}</dd></div>
          )}
        </dl>
        {getMall(mapIdOf(m)) ? (
          <Link href={`/explorer?mall=${mapIdOf(m)}`} className="inline-flex h-11 items-center justify-center rounded-full border border-border-strong px-5 text-body-sm font-semibold text-fg hover:border-fg">
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
              {p?.parents != null ? <div><div className="text-display-sm text-fg">{p.parents}%</div><div className="text-fg-muted">Parents</div></div> : null}
              {p?.working != null ? <div><div className="text-display-sm text-fg">{p.working}%</div><div className="text-fg-muted">Working (full or part time)</div></div> : null}
              {p?.education.map((r) => <div key={r.level}><div className="text-display-sm text-fg">{r.pct}%</div><div className="text-fg-muted">{r.level} education</div></div>)}
            </div>
            {p?.race.length ? (
              <div className="flex flex-col gap-2">
                <span className="text-label-md font-semibold uppercase text-fg-muted">Population group</span>
                {[...p.race].sort((a, b) => b.pct - a.pct).map((r) => <Bar key={r.group} label={r.group} pct={r.pct} />)}
              </div>
            ) : null}
            {p?.generations?.length ? (
              <div className="flex flex-col gap-2">
                <span className="text-label-md font-semibold uppercase text-fg-muted">Generation</span>
                {p.generations.map((g) => <Bar key={g.label} label={g.label} pct={Math.round(g.pct)} max={60} />)}
              </div>
            ) : null}
          </div>
        </Section>

        <div className="flex flex-col gap-4">
          {p?.income?.length || p?.sem?.length ? (
            <Section title="Income and living standard" id="income">
              <div className="flex flex-col gap-5 rounded-3xl bg-bg-subtle p-5 sm:p-6">
                {p?.income?.length ? (
                  <div className="flex flex-col gap-2">
                    <span className="text-label-md font-semibold uppercase text-fg-muted">Own income a month</span>
                    {incomeBands(m).map((b) => <Bar key={b.label} label={b.label.replace(/ - /g, '–')} pct={Math.round(b.pct)} max={70} />)}
                  </div>
                ) : null}
                {p?.sem?.length ? (
                  <div className="flex flex-col gap-2">
                    <span className="text-label-md font-semibold uppercase text-fg-muted">Socio-economic measure (SEM)</span>
                    <div className="flex h-24 items-end gap-1" role="img" aria-label={p.sem.map((b) => `${b.label} ${Math.round(b.pct)}%`).join(', ')}>
                      {p.sem.map((b) => (
                        <span key={b.label} className="flex flex-1 flex-col items-center justify-end gap-1 self-stretch">
                          <span className="w-full rounded-t-[4px] bg-accent" style={{ height: `${Math.max(2, (b.pct / Math.max(...p.sem!.map((x) => x.pct))) * 100)}%` }} />
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-1 text-[11px] text-fg-muted">{p.sem.map((b) => <span key={b.label} className="flex-1 text-center">{b.label.replace('SEM ', '')}</span>)}</div>
                    <p className="text-body-sm text-fg-muted">1 is the lowest living standard, 10 the highest. {semShare(m, 'upper')}% of shoppers are in SEM 8–10.</p>
                  </div>
                ) : null}
              </div>
            </Section>
          ) : null}
          {p?.languages?.length ? (
            <Section title="Home language" id="language">
              <div className="flex flex-col gap-2 rounded-3xl bg-bg-subtle p-5 sm:p-6">
                {p.languages.filter((l) => l.pct >= 1).slice(0, 5).map((l) => <Bar key={l.label} label={l.label} pct={Math.round(l.pct)} />)}
              </div>
            </Section>
          ) : null}
          <Section title="Advertising recall" id="recall">
            <div className="flex flex-col gap-3 rounded-3xl bg-bg-subtle p-5 sm:p-6">
              <p className="text-body-sm text-fg-muted">People who visited a mall in the past 3 months (TGISA, April 2022).</p>
              {m.media ? media.map(([label, v]) => (v != null ? <Bar key={label} label={label} pct={v} /> : null)) : <p className="text-body-sm text-fg-muted">No recall figures for this mall.</p>}
            </div>
          </Section>
        </div>
      </div>

      <Section title="Media packages" id="packages">
        <div className="grid gap-3 md:grid-cols-2">
          {m.packages.map((pkg) => (
            <article key={pkg.code} className="flex flex-col gap-2 rounded-xl border border-border bg-bg p-4">
              {packagePhotos(pkg.code).length ? (
                <div className="-mx-4 -mt-4 mb-2 flex gap-[2px] overflow-hidden rounded-t-xl">
                  {packagePhotos(pkg.code).map((img) => (
                    <Zoomable key={img.src} src={img.src} title={`${mallName(m)} · ${pkg.format}${pkg.units ? ` × ${pkg.units}` : ''}`} packageCode={pkg.code} note={pkg.sites} className="aspect-[16/9] min-w-0 flex-1" />
                  ))}
                </div>
              ) : null}
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-body-md font-semibold text-fg">{pkg.name}</h3>
                  <span className="font-mono text-body-sm text-fg-muted">{pkg.code} · {pkg.format}{pkg.units ? ` × ${pkg.units}` : ''}</span>
                </div>
                <AddToProposal item={{ kind: 'package', code: pkg.code }} />
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
                <span className="text-body-sm text-fg-muted">{mallPlace(mapIdOf(x))?.area ?? ''}{annualVisits(x) ? `${mallPlace(mapIdOf(x))?.area ? ' · ' : ''}${compact(annualVisits(x) as number)} visits/yr` : ''}</span>
              </Link>
            ))}
          </div>
        </Section>
      ) : null}
      <p className="text-body-sm text-fg-subtle">Shoppers: {profileSource(m)}.{m.media ? ' Advertising recall: TGISA 18B/19A and 15C/16C, April 2022.' : ''}</p>
    </Page>
  );
}

export function MallInsight() {
  const params = useSearchParams();
  const id = params.get('id') ?? '';
  return <RequireSignIn what="audience insights">{() => <Mall id={id} />}</RequireSignIn>;
}
