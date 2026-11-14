import type { Catalogue } from '@data-model';
import { withBasePath } from '@/lib/basePath';
import { docWords, formatDate, formatRange } from './logic';
import { campaignScreens, creativeGroups, creativeLabel, sheetHref } from './screens';
import { campaignContact, shareUrl } from './share';
import type { Campaign, PortalUser } from './types';

export type EmailKind = 'proposal' | 'reminder' | 'booked';

/**
 * The email sales send a client: a designed version (HTML, pasted into any
 * mail app with its formatting) and a plain-text version, plus who it goes
 * to and the subject. Built from the latest version of the campaign.
 *
 * Email-safe HTML: tables, inline styles, no images or web fonts, so it
 * looks the same in Outlook (Windows and Mac), Apple Mail and Gmail.
 */
export interface ClientEmail {
  readonly to: string;
  readonly toName: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
  readonly link: string;
}

/**
 * The Primedia Malls logo for email: a PNG (Gmail and Outlook don't show SVG),
 * white on the navy band, served by the site itself so it's always the current one.
 */
const LOGO_PATH = withBasePath('/brand/logo-white-email.png');
const logoUrl = () => (typeof window === 'undefined' ? LOGO_PATH : `${window.location.origin}${LOGO_PATH}`);

const C = { navy: '#1B3769', blue: '#2861FD', ink: '#0D1E3F', muted: '#4B5870', line: '#E7E8EC', soft: '#F5F7FC' };
const FONT = "font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;";

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function buildClientEmail(c: Campaign, user: PortalUser, catalogue: Catalogue, kind: EmailKind, note = ''): ClientEmail {
  const to = campaignContact(c);
  const screens = campaignScreens(c.items, catalogue);
  // The creative to supply: one per artwork size, or per kind of site while its size isn't known.
  const groups = creativeGroups(c.items, screens);
  const unitOf = (n: number) => `${n} ${c.items.some((i) => i.kind === 'site') ? (n === 1 ? 'site' : 'sites') : n === 1 ? 'screen' : 'screens'}`;
  const total = screens.reduce((n, x) => n + x.qty, 0);
  const malls = new Set(screens.map((x) => x.mallName)).size;
  const first = to?.name.split(' ')[0] || 'there';
  const link = shareUrl(c, user.id);
  const dates = formatRange(c.start, c.end);
  const deadline = c.start ? formatDate(c.start) : null;

  const w = docWords(c);
  const unit = (n: number) => `${n} ${n === 1 ? w.unit : `${w.unit}s`}`;
  const subject = {
    proposal: w.noun === 'proposal' ? `Proposal: ${c.name}` : `Site list for approval: ${c.name}`,
    reminder: `Reminder: the ${w.noun} for ${c.name} is waiting for your approval`,
    booked: `Booking confirmed: ${c.name}`,
  }[kind];
  const heading = { proposal: w.noun === 'proposal' ? 'Your proposal is ready' : 'Your site list is ready for approval', reminder: `Your ${w.noun} is waiting for approval`, booked: 'Your booking is confirmed' }[kind];
  const opener = {
    proposal:
      w.noun === 'proposal'
        ? `Here’s our proposal for ${c.name}: ${unit(total)} in ${malls} ${malls === 1 ? 'mall' : 'malls'}, ${dates}. The link below opens the site list: approve it in one click, or tell me what to change.`
        : `Here’s the site list for ${c.name}, from our booking system: ${unit(total)} in ${malls} ${malls === 1 ? 'mall' : 'malls'}, ${dates}. Please check the screens and approve it in one click, or tell me what to change. It also shows how many files to make and the template for each.`,
    reminder: `A quick reminder that the ${w.noun} for ${c.name} (${dates}) is waiting for your approval. It takes one click.`,
    booked: `${c.name} is booked: ${unit(total)} in ${malls} ${malls === 1 ? 'mall' : 'malls'}, ${dates}. Here’s the artwork to supply.`,
  }[kind];
  // The link opens the site list (screens and files to supply), whichever document this is.
  const cta = kind === 'booked' ? 'View your booking' : 'Review and approve the site list';
  const hasTemplates = groups.some((z) => z.files.some((f) => f.template));

  /* ---- Plain text ---- */
  const text = [
    `Hi ${first},`,
    '',
    opener,
    note ? `\n${note}` : '',
    '',
    `${cta}:`,
    link,
    '',
    `Creative to supply${deadline ? ` (needed before ${deadline})` : ''}: ${groups.length} ${groups.length === 1 ? 'creative' : 'creatives'}`,
    ...groups.map((z, i) => `- Creative ${i + 1}: ${creativeLabel(z)}, for ${unitOf(z.count)} in ${z.malls} ${z.malls === 1 ? 'mall' : 'malls'}`),
    hasTemplates ? '\nThe After Effects templates and spec sheets for each size are on the page above.' : '',
    '',
    'Regards,',
    user.name,
    user.title,
    user.email,
  ]
    .filter((l, i, a) => !(l === '' && a[i - 1] === ''))
    .join('\n');

  /* ---- Designed (HTML) ---- */
  const fact = (label: string, value: string) =>
    `<td style="${FONT}padding:12px 16px;border-right:1px solid ${C.line};"><div style="font-size:12px;color:${C.muted};">${esc(label)}</div><div style="font-size:16px;font-weight:bold;color:${C.ink};">${esc(value)}</div></td>`;
  const fileLinks = (z: (typeof groups)[number]) =>
    z.files
      .flatMap((f) => [
        f.template ? `<a href="${esc(sheetHref(f.template))}" style="color:${C.blue};text-decoration:none;">After Effects template${z.files.length > 1 ? ` (${esc(f.label)})` : ''}</a>` : '',
        f.sheet ? `<a href="${esc(sheetHref(f.sheet))}" style="color:${C.blue};text-decoration:none;">Spec sheet${z.files.length > 1 ? ` (${esc(f.label)})` : ''}</a>` : '',
      ])
      .filter(Boolean)
      .join(' &nbsp;·&nbsp; ');
  const sizeRows = groups
    .map(
      (z, i) => `<tr>
        <td style="${FONT}padding:10px 0;border-top:1px solid ${C.line};font-size:15px;color:${C.ink};"><span style="color:${C.muted};font-size:12px;">CREATIVE ${i + 1}</span><br><strong>${esc(creativeLabel(z))}</strong></td>
        <td style="${FONT}padding:10px 0;border-top:1px solid ${C.line};font-size:14px;color:${C.muted};text-align:right;white-space:nowrap;">${esc(unitOf(z.count))} · ${z.malls} ${z.malls === 1 ? 'mall' : 'malls'}</td>
      </tr>${fileLinks(z) ? `<tr><td colspan="2" style="${FONT}padding:0 0 10px;font-size:13px;">${fileLinks(z)}</td></tr>` : ''}`,
    )
    .join('');

  const html = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.soft};"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;background:#ffffff;border:1px solid ${C.line};">
  <tr><td style="${FONT}background:${C.navy};padding:18px 28px;color:#ffffff;font-size:16px;font-weight:bold;"><img src="${logoUrl()}" width="180" height="38" alt="Primedia Malls" style="display:block;width:180px;height:38px;border:0;outline:none;text-decoration:none;color:#ffffff;font-size:16px;font-weight:bold;"></td></tr>
  <tr><td style="${FONT}padding:28px 28px 8px;">
    <div style="font-size:22px;font-weight:bold;color:${C.ink};">${esc(heading)}</div>
    <p style="margin:16px 0 0;font-size:15px;line-height:22px;color:${C.ink};">Hi ${esc(first)},</p>
    <p style="margin:12px 0 0;font-size:15px;line-height:22px;color:${C.ink};">${esc(opener)}</p>
    ${note ? `<p style="margin:16px 0 0;padding:12px 16px;background:${C.soft};border-left:3px solid ${C.blue};font-size:15px;line-height:22px;color:${C.ink};">${esc(note).replace(/\n/g, '<br>')}</p>` : ''}
  </td></tr>
  <tr><td style="padding:16px 28px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${C.line};"><tr>
    ${fact('Campaign', c.name)}${fact('Dates', dates)}${fact(w.unit === 'site' ? 'Sites' : 'Screens', `${total} in ${malls} ${malls === 1 ? 'mall' : 'malls'}`)}
  </tr></table></td></tr>
  <tr><td align="left" style="padding:24px 28px 4px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:${C.blue};border-radius:24px;">
      <a href="${esc(link)}" style="${FONT}display:inline-block;padding:13px 26px;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;">${esc(cta)} &rarr;</a>
    </td></tr></table>
    <p style="${FONT}margin:10px 0 0;font-size:12px;color:${C.muted};">Or open <a href="${esc(link)}" style="color:${C.blue};">${esc(link.replace(/^https?:\/\//, ''))}</a></p>
  </td></tr>
  ${groups.length ? `<tr><td style="${FONT}padding:24px 28px 4px;">
    <div style="font-size:16px;font-weight:bold;color:${C.ink};">Creative to supply: ${groups.length} ${groups.length === 1 ? 'creative' : 'creatives'}</div>
    <div style="margin-top:4px;font-size:13px;color:${C.muted};">One video or still per creative${deadline ? `, before ${esc(deadline)}` : ''}.${hasTemplates ? ' Build it in the After Effects template; the spec sheet has the file types and safe areas.' : ''} Where the size is still to be confirmed, Primedia will send it. The page lists every site in each group.</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;">${sizeRows}</table>
  </td></tr>` : ''}
  <tr><td style="${FONT}padding:24px 28px 28px;font-size:15px;line-height:22px;color:${C.ink};">
    Regards,<br><strong>${esc(user.name)}</strong>${user.title ? `<br><span style="color:${C.muted};">${esc(user.title)}</span>` : ''}${user.email ? `<br><a href="mailto:${esc(user.email)}" style="color:${C.blue};text-decoration:none;">${esc(user.email)}</a>` : ''}
  </td></tr>
  <tr><td style="${FONT}padding:14px 28px;background:${C.soft};font-size:12px;color:${C.muted};">Primedia Malls · Digital screens in malls across South Africa. Screens are subject to availability until the booking is confirmed.</td></tr>
</table></td></tr></table>`;

  return { to: to?.email ?? '', toName: to?.name ?? '', subject, text, html, link };
}

/** The same email as a mailto: link (plain text), for the builder's one-step send. */
export function clientEmail(c: Campaign, user: PortalUser, catalogue: Catalogue, kind: EmailKind, note = ''): string {
  const e = buildClientEmail(c, user, catalogue, kind, note);
  return `mailto:${e.to}?subject=${encodeURIComponent(e.subject)}&body=${encodeURIComponent(e.text)}`;
}
