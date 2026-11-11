'use client';

import Link from 'next/link';
import { Zoomable } from '@/components/ui/ImageViewer';
import { useRouter } from 'next/navigation';
import { DECK_MALLS, annualVisits, compact, mallArea, mallName, mallPhoto, matchMalls } from '@/lib/insights';
import { addDays, campaignClientName, clientName, itemKey, itemLabel, itemMall, phase, progress, reach, todayIso, visibleTo } from '@/lib/portal/logic';
import { portal, usePortalState } from '@/lib/portal/store';
import type { Campaign, PortalUser } from '@/lib/portal/types';
import { AddToCampaign, Page, RequireSignIn } from './ui';
import { CampaignCard, countdown } from './CampaignCard';

/**
 * Home for each side. Each fact appears once: a one-line summary under the
 * greeting, then lists. Counts live in the section headings, not in tiles.
 */

function greeting(user: PortalUser) {
  const h = new Date().getHours();
  return `${h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'}, ${user.name.split(' ')[0]}`;
}

function Block({ title, count, note, children }: { title: string; count?: number; note?: string; children: React.ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="flex items-baseline gap-2 text-display-sm text-fg">
          {title}
          {count != null ? <span className="text-body-md font-medium text-fg-subtle">{count}</span> : null}
        </h2>
        {note ? <p className="text-body-sm text-fg-muted">{note}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{children}</div>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl bg-bg-subtle p-5 text-body-sm text-fg-muted">{children}</p>;
}

const primary = 'inline-flex h-11 items-center justify-center rounded-full bg-accent px-5 text-body-sm font-semibold text-fg-on-accent hover:bg-accent-hover';

/** A live campaign, big: photo, progress, visits so far. */
function LiveHero({ c, user }: { c: Campaign; user: PortalUser }) {
  const r = reach(c);
  const p = progress(c);
  const first = c.items.map(itemMall).find(Boolean);
  const photo = first ? mallPhoto(first.id) : null;
  return (
    <Link href={`/portal/campaign?id=${c.id}`} className="group grid overflow-hidden rounded-3xl bg-brand-surface text-brand-on-surface md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="relative min-h-[180px] bg-bg-muted">
        {photo ? <img src={photo.src} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-slow group-hover:scale-[1.02]" /> : null}
        <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-success-bg px-3 py-1 text-[12px] font-semibold text-success-fg">● Live now</span>
      </div>
      <div className="flex flex-col gap-4 p-6">
        <div>
          <h3 className="text-display-sm">{c.name}</h3>
          <p className="text-body-sm text-brand-on-surface-muted">
            {user.role === 'sales' ? `${campaignClientName(c)} · ` : ''}
            {r.malls} malls · {countdown(c)}
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-display-lg">~{compact(r.visits * p)}</span>
          <span className="text-body-sm text-brand-on-surface-muted">mall visits so far, of ~{compact(r.visits)}</span>
          <span className="h-1.5 overflow-hidden rounded-full bg-white/15" aria-hidden="true">
            <span className="block h-full rounded-full bg-success-fg" style={{ width: `${p * 100}%` }} />
          </span>
        </div>
      </div>
    </Link>
  );
}

/* ---------- Sales ---------- */

function SalesHome({ user, campaigns }: { user: PortalUser; campaigns: readonly Campaign[] }) {
  const mine = campaigns.filter((c) => visibleTo(c, user));
  const by = (...s: Campaign['status'][]) => mine.filter((c) => s.includes(c.status));
  const live = mine.filter((c) => phase(c) === 'live');
  const upcoming = mine.filter((c) => phase(c) === 'upcoming');
  const needs = by('proposed', 'changes', 'approved');
  const screensLive = live.reduce((s, c) => s + reach(c).units, 0);

  const today = todayIso();
  const horizon = addDays(today, 60);
  const busy = new Set(
    mine
      .filter((c) => c.status === 'booked' && c.start && c.end && c.start <= horizon && c.end >= today)
      .flatMap((c) => c.items.map((i) => itemMall(i)?.id).filter(Boolean) as string[]),
  );
  const quiet = DECK_MALLS.filter((m) => !busy.has(m.id) && m.packages.length)
    .sort((a, b) => (annualVisits(b) ?? 0) - (annualVisits(a) ?? 0))
    .slice(0, 4);

  const counts = new Map<string, { label: string; n: number }>();
  for (const c of by('booked', 'approved', 'sent')) for (const i of c.items) {
    const k = itemKey(i);
    counts.set(k, { label: itemLabel(i), n: (counts.get(k)?.n ?? 0) + 1 });
  }
  const popular = [...counts.values()].sort((a, b) => b.n - a.n).slice(0, 4);

  return (
    <Page>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-display-xl text-fg">{greeting(user)}</h1>
          <p className="text-body-lg text-fg-muted">{screensLive ? `${screensLive} screens live for ${live.length} ${live.length === 1 ? 'campaign' : 'campaigns'}` : 'Nothing live right now'} · {by('sent').length} with clients</p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Link href="/portal/clients" className="inline-flex h-11 items-center rounded-full px-4 text-body-sm font-semibold text-fg-muted hover:bg-bg-subtle hover:text-fg">Client contacts</Link>
          <Link href="/portal/new" className={primary}>New proposal</Link>
        </div>
      </header>

      <Block title="Needs you" count={needs.length}>
        {needs.length ? (
          <Grid>
            {needs.map((c) => (
              <CampaignCard key={c.id} c={c} user={user} highlight={c.status === 'approved' ? 'Confirm the booking' : c.status === 'changes' ? 'See what changed' : 'Turn into a proposal'} />
            ))}
          </Grid>
        ) : (
          <Empty>All caught up.</Empty>
        )}
      </Block>

      {live.length ? (
        <Block title="Live now" count={live.length}>
          <div className="flex flex-col gap-3">{live.map((c) => <LiveHero key={c.id} c={c} user={user} />)}</div>
        </Block>
      ) : null}

      <div className="grid gap-10 lg:grid-cols-3">
        {(
          [
            ['With clients', by('sent'), 'Nothing waiting on clients.'],
            ['Coming up', upcoming, 'Nothing booked ahead.'],
            ['Drafts', by('draft'), 'No drafts.'],
          ] as const
        ).map(([title, list, empty]) => (
          <Block key={title} title={title} count={list.length}>
            {list.length ? <div className="flex flex-col gap-3">{list.map((c) => <CampaignCard key={c.id} c={c} user={user} />)}</div> : <Empty>{empty}</Empty>}
          </Block>
        ))}
      </div>

      <div className="grid gap-10 lg:grid-cols-2">
        <Block title="Quiet malls" note="Big audiences with nothing booked in the next 60 days.">
          <ul className="flex flex-col gap-2">
            {quiet.map((m) => {
              const photo = mallPhoto(m.id);
              return (
                <li key={m.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-bg-subtle p-3">
                  {photo ? <Zoomable src={photo.src} title={mallName(m)} detail={`${compact(annualVisits(m) ?? 0)} visits a year · ${m.province}`} className="h-12 w-16 rounded-xl" /> : null}
                  <div className="flex min-w-0 flex-1 flex-col">
                    <Link href={`/insights/mall?id=${m.id}`} className="truncate text-body-md font-semibold text-fg hover:text-accent">{mallName(m)}</Link>
                    <span className="truncate text-body-sm text-fg-muted">{compact(annualVisits(m) ?? 0)} visits a year · {m.province}</span>
                  </div>
                  <AddToCampaign compact item={{ kind: 'package', code: m.packages[0].code }} />
                </li>
              );
            })}
          </ul>
        </Block>
        <Block title="Most requested" note="Packages in proposals and bookings.">
          {!popular.length ? <p className="rounded-2xl bg-bg-subtle px-4 py-3 text-body-sm text-fg-muted">Fills in as you make proposals.</p> : null}
          <ol className="flex flex-col gap-2">
            {popular.map((p, i) => (
              <li key={p.label} className="flex items-center gap-3 rounded-2xl bg-bg-subtle px-4 py-3 text-body-sm">
                <span className="w-5 text-body-md font-bold tabular-nums text-fg-subtle">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate font-medium text-fg">{p.label}</span>
                <span className="shrink-0 text-fg-muted">×{p.n}</span>
              </li>
            ))}
          </ol>
        </Block>
      </div>

    </Page>
  );
}

/* ---------- Client ---------- */

function ClientHome({ user, campaigns }: { user: PortalUser; campaigns: readonly Campaign[] }) {
  const router = useRouter();
  const mine = campaigns.filter((c) => visibleTo(c, user));
  const toReview = mine.filter((c) => c.status === 'sent');
  const live = mine.filter((c) => phase(c) === 'live');
  const upcoming = mine.filter((c) => phase(c) === 'upcoming');
  const past = mine.filter((c) => phase(c) === 'completed');
  const inProgress = mine.filter((c) => ['draft', 'proposed', 'changes', 'approved'].includes(c.status));
  const delivered = [...past, ...live].reduce((s, c) => s + reach(c).visits * progress(c), 0);
  const used = new Set(mine.filter((c) => c.status === 'booked').flatMap((c) => c.items.map((i) => itemMall(i)?.id)));
  const lastAudience = [...mine].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).find((c) => c.audience)?.audience;
  const ideas = lastAudience ? matchMalls(lastAudience).filter((m) => !used.has(m.mall.id) && m.mall.packages.length).slice(0, 3) : [];

  return (
    <Page>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-display-xl text-fg">{greeting(user)}</h1>
          <p className="text-body-lg text-fg-muted">
            {delivered ? `~${compact(delivered)} mall visits delivered across ${used.size} malls` : clientName(user.clientId ?? null)}
          </p>
        </div>
        <Link href="/portal/new" className={primary}>Propose a campaign</Link>
      </header>

      {toReview.map((c) => (
        <Link key={c.id} href={`/portal/campaign?id=${c.id}`} className="group flex flex-wrap items-center gap-4 rounded-3xl bg-accent-subtle p-5 sm:p-6">
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <strong className="text-body-lg font-semibold text-fg">{c.name}: your proposal is ready</strong>
            <span className="text-body-md text-fg-muted">Review the screens and dates.</span>
          </span>
          <span className="inline-flex h-11 items-center rounded-full bg-accent px-5 text-body-sm font-semibold text-fg-on-accent group-hover:bg-accent-hover">Review</span>
        </Link>
      ))}

      {live.length ? <div className="flex flex-col gap-3">{live.map((c) => <LiveHero key={c.id} c={c} user={user} />)}</div> : null}

      {upcoming.length || inProgress.length ? (
        <div className={`grid gap-10 ${upcoming.length && inProgress.length ? 'lg:grid-cols-2' : ''}`}>
          {upcoming.length ? (
            <Block title="Coming up" count={upcoming.length}>
              <div className="grid gap-3 md:grid-cols-2">{upcoming.map((c) => <CampaignCard key={c.id} c={c} user={user} />)}</div>
            </Block>
          ) : null}
          {inProgress.length ? (
            <Block title="In progress" count={inProgress.length}>
              <div className={`grid gap-3 ${upcoming.length ? '' : 'md:grid-cols-2 xl:grid-cols-3'}`}>{inProgress.map((c) => <CampaignCard key={c.id} c={c} user={user} />)}</div>
            </Block>
          ) : null}
        </div>
      ) : null}

      {ideas.length ? (
        <Block title="Malls you haven’t tried" note="Strong matches for your latest brief’s audience.">
          <div className="grid gap-3 md:grid-cols-3">
            {ideas.map((m) => {
              const photo = mallPhoto(m.mall.id);
              return (
                <div key={m.mall.id} className="flex flex-col overflow-hidden rounded-3xl bg-bg-subtle">
                  {photo ? <img src={photo.src} alt="" loading="lazy" className="aspect-[16/9] w-full object-cover" /> : null}
                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <div className="flex items-baseline justify-between gap-2">
                      <Link href={`/insights/mall?id=${m.mall.id}`} className="truncate text-body-md font-semibold text-fg hover:text-accent">{mallName(m.mall)}</Link>
                      <span className="text-body-md font-bold tabular-nums text-accent">{m.score}</span>
                    </div>
                    <span className="text-body-sm text-fg-muted">{mallArea(m.mall)}</span>
                    <div className="mt-auto pt-1"><AddToCampaign compact item={{ kind: 'package', code: m.mall.packages[0].code }} /></div>
                  </div>
                </div>
              );
            })}
          </div>
        </Block>
      ) : null}

      {past.length ? (
        <Block title="Finished" count={past.length}>
          <Grid>
            {past.map((c) => (
              <div key={c.id} className="flex flex-col gap-1">
                <CampaignCard c={c} user={user} />
                <button type="button" onClick={() => router.push(`/portal/campaign?id=${portal.duplicate(c.id)}`)} className="h-11 self-start rounded-full px-3 text-body-sm font-semibold text-accent hover:bg-accent-subtle">
                  Run it again
                </button>
              </div>
            ))}
          </Grid>
        </Block>
      ) : null}
    </Page>
  );
}

export function PortalHome() {
  const { campaigns } = usePortalState();
  return (
    <RequireSignIn what="your campaigns">
      {(user) => (user.role === 'sales' ? <SalesHome user={user} campaigns={campaigns} /> : <ClientHome user={user} campaigns={campaigns} />)}
    </RequireSignIn>
  );
}
