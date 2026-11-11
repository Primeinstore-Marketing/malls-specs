'use client';

import { useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { portal, usePortalState, usePortalUser } from '@/lib/portal/store';
import { ui } from '@/lib/portal/ui-state';

/**
 * Sales: picks up approvals clients gave on their booking page and moves
 * those campaigns to "Client approved". Checks when the workspace opens and
 * every minute after. Silent if the API isn't reachable.
 */
export function ApprovalSync() {
  const { user } = usePortalUser();
  const state = usePortalState();
  const waiting = user?.role === 'sales' ? state.campaigns.filter((c) => c.status === 'sent') : [];
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
        for (const a of approvals) {
          const c = latest.current.find((x) => x.id === a.campaignId);
          // Only approvals given after the proposal was last sent.
          const sentAt = [...(c?.events ?? [])].reverse().find((e) => e.kind === 'status' && e.text === 'Sent the proposal to the client')?.at ?? '';
          if (!c || c.status !== 'sent' || a.at < sentAt) continue;
          const who = a.name || 'The client';
          portal.move(c.id, 'approved', `${who} approved on the booking page${a.note ? `: “${a.note}”` : '.'}`);
          ui.toast({ text: `${who} approved ${c.name}`, href: `/portal/campaign?id=${c.id}` });
        }
      } catch {
        /* API not reachable or not updated yet: approvals still arrive by email */
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
