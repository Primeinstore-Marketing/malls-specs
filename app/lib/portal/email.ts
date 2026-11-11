import type { Catalogue } from '@data-model';
import { formatDate, formatRange } from './logic';
import { artworkSizes, campaignScreens, sheetHref } from './screens';
import { campaignContact, shareUrl } from './share';
import type { Campaign, PortalUser } from './types';

export type EmailKind = 'proposal' | 'reminder' | 'booked';

/** A ready-to-send email (mailto link) to the client: what's booked, the artwork sizes, the templates and the link. */
export function clientEmail(c: Campaign, user: PortalUser, catalogue: Catalogue, kind: EmailKind, note = ''): string {
  const to = campaignContact(c);
  {
    const screens = campaignScreens(c.items, catalogue);
    const { sizes, unknown } = artworkSizes(screens);
    const total = screens.reduce((n, x) => n + x.qty, 0);
    const first = to?.name.split(' ')[0] ?? 'there';
    const subject = { proposal: `Your Primedia Malls proposal: ${c.name}`, reminder: `Reminder: ${c.name} is waiting for your approval`, booked: `Booking confirmed: ${c.name}` }[kind];
    const opener = {
      proposal: `Here's the proposal for ${c.name}: ${total} screens in ${new Set(screens.map((x) => x.mallName)).size} malls, ${formatRange(c.start, c.end)}.`,
      reminder: `A quick reminder that the proposal for ${c.name} (${formatRange(c.start, c.end)}) is waiting for your approval.`,
      booked: `${c.name} is booked: ${total} screens, ${formatRange(c.start, c.end)}.`,
    }[kind];
    const artLines = (withTemplates: boolean) =>
      sizes
        .map((z) => {
          const head = `- ${z.width} × ${z.height} px (${z.orientation?.toLowerCase()}) for ${z.screens} ${z.screens === 1 ? 'screen' : 'screens'}`;
          const files = withTemplates ? z.files.flatMap((f) => (f.template ? [`    After Effects template${z.files.length > 1 ? ` (${f.label})` : ''}: ${sheetHref(f.template)}`] : [])) : [];
          return [head, ...files].join('\n');
        })
        .join('\n');
    const hasTemplates = sizes.some((z) => z.files.some((f) => f.template));
    const build = (withTemplates: boolean) => [
      `Hi ${first},`,
      '',
      opener,
      note ? `\n${note}` : '',
      '',
      `Artwork sizes${c.start ? ` (needed before ${formatDate(c.start)})` : ''}:`,
      artLines(withTemplates) + (unknown ? `\n- ${unknown} screens: size to follow` : ''),
      '',
      `Every screen, with spec sheets${hasTemplates ? ', After Effects templates' : ''}${kind === 'booked' ? '' : ' and a button to approve'}:`,
      shareUrl(c, user.id),
      '',
      'Regards,',
      user.name,
      user.title,
    ].join('\n');
    // Very long mailto links can be cut off; past that, leave the template links to the linked page (it lists them all).
    const mailto = (body: string) => `mailto:${to?.email ?? ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    const full = mailto(build(true));
    return full.length <= 6000 || !hasTemplates ? full : mailto(build(false));
  };
}

