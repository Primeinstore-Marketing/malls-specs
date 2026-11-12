'use client';

import { useMemo } from 'react';
import { getMalls, getScreenSize } from '@/lib/malls';
import { useLiveData } from '@/lib/liveData';
import type { SiteItem } from '@/lib/portal/types';
import { findMall, siteStatus, statusText } from '@/lib/portal/siteStatus';

interface ScreenOption {
  readonly specId: string;
  readonly appMallId: string;
  readonly label: string;
}

/**
 * Site-list lines that aren't matched to a screen on the site ("check"),
 * grouped by mall and location so 20 identical poster sites are one choice.
 * Sales match each group to a screen (which brings its size, spec sheet and
 * template), or leave it for Primedia to confirm the size.
 */
export function SiteMatch({
  lines,
  onMatch,
  tone = 'light',
}: {
  lines: readonly SiteItem[];
  onMatch: (itemIds: readonly string[], specId: string, appMallId: string) => void;
  tone?: 'light' | 'dark';
}) {
  const { catalogue } = useLiveData();
  const malls = useMemo(() => getMalls(catalogue).filter((m) => m.group !== 'formats'), [catalogue]);

  const groups = useMemo(() => {
    const byKey = new Map<string, { mall: string; location: string; size: string; why: string; noMall: boolean; ids: string[] }>();
    for (const l of lines) {
      if (l.specId) continue;
      const key = `${l.mall.toLowerCase()}|${l.location.toLowerCase()}`;
      const st = siteStatus(l, malls);
      const g = byKey.get(key) ?? { mall: l.mall, location: l.location, size: l.size, why: statusText(st), noMall: st.kind === 'no-mall', ids: [] };
      g.ids.push(l.id);
      byKey.set(key, g);
    }
    return [...byKey.entries()].map(([key, g]) => ({ key, ...g }));
  }, [lines, malls]);

  if (!groups.length) return null;

  const optionsFor = (mallName: string): { here: ScreenOption[]; mallLabel: string | null } => {
    const mall = findMall(mallName, malls);
    if (!mall) return { here: [], mallLabel: null };
    return {
      mallLabel: mall.name,
      here: mall.specIds.flatMap((id) => {
        const spec = catalogue.specifications[id];
        if (!spec) return [];
        const size = getScreenSize(spec);
        return [{ specId: id, appMallId: mall.id, label: `${spec.title}${size ? ` · ${size.width} × ${size.height}` : ''}` }];
      }),
    };
  };

  const dark = tone === 'dark';
  return (
    <div className={`flex flex-col gap-2 rounded-xl p-3 ${dark ? 'bg-white/5' : 'bg-warning-bg'}`}>
      <div className="flex flex-col gap-0.5">
        <strong className={`text-body-sm ${dark ? 'text-brand-on-surface' : 'text-warning-fg'}`}>
          Match the sites marked “check” ({lines.filter((l) => !l.specId).length})
        </strong>
        <span className={`text-[12px] ${dark ? 'text-brand-on-surface-muted' : 'text-fg-muted'}`}>
          Pick the screen each one is, and it gets that screen’s size, spec sheet and template. No screen for it on the site (e.g. a poster)? Leave it: the client is told Primedia will confirm the size, and an admin can add the format in Site admin.
        </span>
      </div>
      <ul className="flex flex-col gap-2">
        {groups.map((g) => {
          const { here, mallLabel } = optionsFor(g.mall);
          const all = malls.flatMap((m) =>
            m.specIds.flatMap((id) => {
              const spec = catalogue.specifications[id];
              return spec ? [{ specId: id, appMallId: m.id, label: `${m.name} · ${spec.title}` }] : [];
            }),
          );
          return (
            <li key={g.key} className="flex flex-col gap-1">
              <span className={`text-[12px] ${dark ? 'text-brand-on-surface' : 'text-fg'}`}>
                <strong>{g.mall || 'Unknown mall'}</strong>
                {g.location ? ` · ${g.location}` : ''} · {g.ids.length} {g.ids.length === 1 ? 'site' : 'sites'}
                {g.size ? ` · ${g.size}` : ''}
              </span>
              <span className={`text-[12px] font-semibold ${g.noMall ? (dark ? 'text-brand-on-surface-muted' : 'text-danger-fg') : dark ? 'text-brand-on-surface-muted' : 'text-warning-fg'}`}>{g.why}</span>
              <select
                aria-label={`Match ${g.mall} ${g.location} to a screen`}
                defaultValue=""
                onChange={(e) => {
                  const [specId, appMallId] = e.target.value.split('|');
                  if (specId) onMatch(g.ids, specId, appMallId);
                }}
                className="h-10 w-full rounded-lg border border-border-strong bg-bg px-2 text-body-sm text-fg"
              >
                <option value="">Leave as “check” (Primedia confirms the size)</option>
                {here.length ? (
                  <optgroup label={`Screens at ${mallLabel}`}>
                    {here.map((o) => <option key={o.specId} value={`${o.specId}|${o.appMallId}`}>{o.label}</option>)}
                  </optgroup>
                ) : null}
                <optgroup label="All screens">
                  {all.map((o) => <option key={`all-${o.specId}`} value={`${o.specId}|${o.appMallId}`}>{o.label}</option>)}
                </optgroup>
              </select>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
