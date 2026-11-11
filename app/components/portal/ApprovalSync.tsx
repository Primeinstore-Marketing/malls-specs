'use client';

import { useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { refreshCampaigns, usePortalState, usePortalUser } from '@/lib/portal/store';
import { ui } from '@/lib/portal/ui-state';

/**
 * Sales: notices approvals clients gave on their booking page. The server
 * marks the campaign approved itself; this reloads the campaigns to show it
 * and says so. Checks when the workspace opens and every minute after.
 * Silent if the API isn't reachable.
 */
export function ApprovalSync() {
  const { user } = usePortalUser();
  const state = usePortalState();
  const waiting = user ? state.campaigns.filter((c) => c.status === 'sent') : [];
  const key = waiting.map((c) => c.id).join(',');
  const latest = useRef(state.campaigns);
  latest.current = state.campaigns;

  useEffect(() => {
    if (!key) return;
    let stop = false;
    const check = async () => {
      try {
        const { approvals } = await api.approvals(key.split(','));
        if (stop) return;
        const fresh = approvals.filter((a) => {
          const c = latest.current.find((x) => x.id === a.campaignId);
          // Only approvals given after the proposal was last sent.
          const sentAt = [...(c?.events ?? [])].reverse().find((e) => e.kind === 'status' && e.text === 'Sent the proposal to the client')?.at ?? '';
          return c && c.status === 'sent' && a.at >= sentAt;
        });
        if (!fresh.length) return;
        await refreshCampaigns();
        for (const a of fresh) {
          const c = latest.current.find((x) => x.id === a.campaignId);
          ui.toast({ text: `${a.name || 'The client'} approved ${c?.name ?? 'a proposal'}`, href: `/portal/campaign?id=${a.campaignId}` });
        }
      } catch {
        /* API not reachable: approvals still arrive by email */
      }
    };
    void check();
    const t = setInterval(check, 60_000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [key]);

  return null;
}
