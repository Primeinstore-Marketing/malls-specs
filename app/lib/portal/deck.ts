'use client';

/**
 * A PowerPoint presentation of a proposal (or site list), made in the
 * browser with pptxgenjs, in Primedia Malls branding: the real logo, the
 * brand navy and blue, Arial.
 *
 * Every deck is laid out afresh: the cover, the summary, each mall slide and
 * the closing slide pick from several designs, and the colour that leads
 * (navy, blue or white) changes too, so no two decks look the same. The
 * content is always the same: cover, campaign at a glance, one slide per
 * mall (photo, audience, screens), the creatives to supply, and next steps
 * with the approval link and the salesperson's details.
 *
 * Only photos cleared for use outside Primedia go in (a deck is sent to
 * clients), the same rule as the client's proposal page.
 */
import type { Catalogue } from '@data-model';
import { getAssets } from '@/lib/catalogue';
import { withBasePath } from '@/lib/basePath';
import { fileUrl } from '@/lib/api';
import { annualVisits, compact, isCleared, mallArea, mallName, mallPhoto, networkStats, screenPhotos } from '@/lib/insights';
import type { DeckMall } from '@/lib/insights';
import { docWords, formatDate, formatRange, itemMall, days, reach, campaignClientName } from './logic';
import { mallFacts } from './mallScreens';
import { campaignScreens, creativeGroups, creativeLabel } from './screens';
import type { BookedScreen, CreativeGroup } from './screens';
import { shareUrl } from './share';
import type { Campaign, PortalUser } from './types';
import { hasRates, PERIOD_LABEL, pricedLines, rand, rateTotals, VAT_RATE } from './rates';
import { itemDetail, itemLabel } from './logic';

/* ---------- Brand ---------- */

const BRAND = { navy: '1B3769', blue: '2861FD', sky: '5B8CFF', ink: '0D1E3F', muted: '4B5870', soft: 'F5F7FC', line: 'E7E8EC', white: 'FFFFFF' } as const;
const FONT = 'Arial';
const W = 13.333;
const H = 7.5;

/** A deck's look, chosen at random each time. */
interface Look {
  /** The colour that leads: dark slides use it, light slides use it for accents. */
  readonly lead: string;
  readonly accent: string;
  readonly cover: 0 | 1 | 2 | 3;
  readonly summary: 0 | 1 | 2;
  readonly mallOffset: number;
  readonly closing: 0 | 1 | 2;
  /** Light content slides, or tinted. */
  readonly paper: string;
  readonly rounded: boolean;
}

const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)];

function chooseLook(): Look {
  const lead = pick([BRAND.navy, BRAND.blue, BRAND.navy]);
  return {
    lead,
    accent: lead === BRAND.blue ? BRAND.navy : pick([BRAND.blue, BRAND.sky]),
    cover: pick([0, 1, 2, 3] as const),
    summary: pick([0, 1, 2] as const),
    mallOffset: Math.floor(Math.random() * 3),
    closing: pick([0, 1, 2] as const),
    paper: pick([BRAND.white, BRAND.white, BRAND.soft]),
    // Square corners only: Mac and iPhone previews (Quick Look, Mail) can't draw rounded shapes or circles.
    rounded: false,
  };
}

/* ---------- Pictures ---------- */

interface Pic {
  readonly data: string;
}

/** Fetches a picture and crops it to the shape it will fill (so it never stretches), as a JPEG. */
async function picture(url: string, w: number, h: number): Promise<Pic | null> {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    const bitmap = await createImageBitmap(await res.blob());
    const target = w / h;
    const own = bitmap.width / bitmap.height;
    const sw = own > target ? bitmap.height * target : bitmap.width;
    const sh = own > target ? bitmap.height : bitmap.width / target;
    const sx = (bitmap.width - sw) / 2;
    const sy = (bitmap.height - sh) / 2;
    const outW = Math.min(1600, Math.round(sw));
    const outH = Math.round(outW / target);
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, outW, outH);
    bitmap.close();
    return { data: canvas.toDataURL('image/jpeg', 0.84).replace(/^data:/, '') };
  } catch {
    return null;
  }
}

/** The first of these photos that loads, cropped to the shape it fills. */
async function firstPicture(urls: readonly string[], w: number, h: number): Promise<Pic | null> {
  for (const url of urls.slice(0, 4)) {
    const pic = await picture(url, w, h);
    if (pic) return pic;
  }
  return null;
}

/** A logo PNG as data, kept to its own shape. */
async function logo(path: string): Promise<string | null> {
  try {
    const res = await fetch(withBasePath(path));
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    let s = '';
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return `image/png;base64,${btoa(s)}`;
  } catch {
    return null;
  }
}
const LOGO_RATIO = 1307.8 / 274.8;

/* ---------- The proposal, as the deck needs it ---------- */

interface MallBlock {
  readonly name: string;
  readonly area: string;
  readonly deck: DeckMall | undefined;
  readonly facts: string[];
  readonly screens: BookedScreen[];
  readonly photoUrls: string[];
}

function mallsOf(c: Campaign, screens: readonly BookedScreen[], catalogue: Catalogue): MallBlock[] {
  const byName = new Map<string, MallBlock>();
  for (const s of screens) {
    const item = c.items.find((i) => i.id === s.itemId);
    const deck = item ? itemMall(item) : undefined;
    const cur = byName.get(s.mallName) ?? { name: deck ? mallName(deck) : s.mallName, area: deck ? mallArea(deck) : '', deck, facts: mallFacts(deck), screens: [], photoUrls: [] };
    cur.screens.push(s);
    // Cleared photos only: the screen's own uploads, then cleared deck photos of it.
    if (s.specId) {
      const spec = catalogue.specifications[s.specId];
      const own = spec ? getAssets(spec.mediaIds, catalogue).filter((a) => a.kind === 'image').map((a) => fileUrl(a.storageKey)) : [];
      const deckShots = screenPhotos(s.specId).filter((p) => isCleared(p)).map((p) => p.src);
      for (const u of [...own, ...deckShots]) if (!cur.photoUrls.includes(u)) cur.photoUrls.push(u);
    }
    byName.set(s.mallName, cur);
  }
  // The mall's own photo goes first when it's cleared.
  return [...byName.values()].map((m) => {
    const hero = m.deck ? mallPhoto(m.deck.id) : null;
    return hero && isCleared(hero) && !m.photoUrls.includes(hero.src) ? { ...m, photoUrls: [hero.src, ...m.photoUrls] } : m;
  });
}

/* ---------- Building blocks ---------- */

type Pptx = InstanceType<typeof import('pptxgenjs').default>;
type Slide = ReturnType<Pptx['addSlide']>;

const text = (slide: Slide, t: string | { text: string; options?: Record<string, unknown> }[], o: Record<string, unknown>) =>
  slide.addText(t as never, { fontFace: FONT, margin: 0, isTextBox: true, valign: 'top', ...o });

function box(pptx: Pptx, slide: Slide, look: Look, o: { x: number; y: number; w: number; h: number; fill: string; line?: string; transparency?: number }) {
  const shape = look.rounded ? pptx.ShapeType.roundRect : pptx.ShapeType.rect;
  slide.addShape(shape, {
    x: o.x, y: o.y, w: o.w, h: o.h,
    fill: { color: o.fill, ...(o.transparency != null ? { transparency: o.transparency } : {}) },
    line: o.line ? { color: o.line, width: 1 } : { type: 'none' },
    ...(look.rounded ? { rectRadius: 0.12 } : {}),
  } as never);
}

function footer(slide: Slide, dark: boolean, label: string, logos: { white: string | null; navy: string | null }, n: number) {
  const l = dark ? logos.white : logos.navy;
  if (l) slide.addImage({ data: l, x: 0.55, y: H - 0.52, w: 0.24 * LOGO_RATIO, h: 0.24 });
  text(slide, label, { x: 2.4, y: H - 0.5, w: 8.5, h: 0.25, fontSize: 9, color: dark ? 'C9D3EA' : BRAND.muted, align: 'center' });
  text(slide, String(n), { x: W - 1.1, y: H - 0.5, w: 0.55, h: 0.25, fontSize: 9, color: dark ? 'C9D3EA' : BRAND.muted, align: 'right' });
}

function stat(slide: Slide, x: number, y: number, w: number, value: string, label: string, color: string, sub: string) {
  text(slide, value, { x, y, w, h: 0.8, fontSize: 36, bold: true, color });
  text(slide, label, { x, y: y + 0.82, w, h: 0.5, fontSize: 12, color: sub });
}

/* ---------- Audience across the proposal's malls ---------- */

interface Audience {
  readonly malls: number;
  readonly ages: readonly [string, number][];
  readonly women: number | null;
  readonly income: number | null;
  readonly married: number | null;
  readonly working: number | null;
  readonly lsm: string[];
  readonly notice: number | null;
  readonly digital: number | null;
}

/** The shoppers of the proposal's malls together, each mall weighted by its footfall. */
function audienceOf(decks: readonly DeckMall[]): Audience {
  const weight = (m: DeckMall) => annualVisits(m) ?? 1;
  const avg = (get: (m: DeckMall) => number | null | undefined) => {
    let sum = 0;
    let wsum = 0;
    for (const m of decks) {
      const v = get(m);
      if (v == null) continue;
      sum += v * weight(m);
      wsum += weight(m);
    }
    return wsum ? sum / wsum : null;
  };
  const bands = new Map<string, { sum: number; w: number }>();
  for (const m of decks) {
    for (const b of m.profile?.ageBands ?? []) {
      const cur = bands.get(b.band) ?? { sum: 0, w: 0 };
      bands.set(b.band, { sum: cur.sum + b.pct * weight(m), w: cur.w + weight(m) });
    }
  }
  const ages = [...bands.entries()].map(([band, v]) => [band, v.sum / v.w] as [string, number]).sort((a, b) => a[0].localeCompare(b[0], 'en', { numeric: true }));
  return {
    malls: decks.length,
    ages,
    women: avg((m) => m.profile?.female),
    income: avg((m) => m.profile?.householdIncome),
    married: avg((m) => m.profile?.married),
    working: avg((m) => m.profile?.working),
    lsm: [...new Set(decks.map((m) => m.profile?.lsm).filter((x): x is string => Boolean(x)))],
    notice: avg((m) => m.media?.noticeMallAds),
    digital: avg((m) => m.media?.seenDigitalScreens),
  };
}

/** Labelled horizontal bars, drawn with plain rectangles so every viewer shows them. */
function hbars(pptx: Pptx, slide: Slide, o: { x: number; y: number; w: number; rows: readonly [string, number, string][]; max: number; color: string; alt?: string; ink: string; sub: string; rowH?: number }) {
  const rowH = o.rowH ?? 0.46;
  const labelW = Math.min(2.4, o.w * 0.34);
  const valueW = 1.0;
  const barW = o.w - labelW - valueW - 0.2;
  o.rows.forEach(([label, v, shown], k) => {
    const y = o.y + k * rowH;
    text(slide, label, { x: o.x, y: y + 0.04, w: labelW - 0.1, h: rowH - 0.1, fontSize: 12, color: o.ink, fit: 'shrink' });
    const len = Math.max(0.04, (barW * v) / (o.max || 1));
    slide.addShape(pptx.ShapeType.rect, { x: o.x + labelW, y: y + 0.08, w: len, h: rowH - 0.2, fill: { color: k === 0 && o.alt ? o.alt : o.color }, line: { type: 'none' } } as never);
    text(slide, shown, { x: o.x + labelW + len + 0.1, y: y + 0.04, w: valueW, h: rowH - 0.1, fontSize: 12, bold: true, color: o.ink });
  });
}

/* ---------- The deck ---------- */

export async function downloadDeck(c: Campaign, user: PortalUser, catalogue: Catalogue): Promise<string> {
  const { default: PptxGenJS } = await import('pptxgenjs');
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = user.name;
  pptx.company = 'Primedia Malls';
  pptx.title = c.name;
  pptx.theme = { headFontFace: FONT, bodyFontFace: FONT };

  const look = chooseLook();
  const w = docWords(c);
  const client = campaignClientName(c);
  const forClient = client && client !== 'No client yet' ? client : '';
  const screens = campaignScreens(c.items, catalogue);
  const groups = creativeGroups(c.items, screens);
  const malls = mallsOf(c, screens, catalogue);
  const r = reach(c);
  const total = screens.reduce((n, s) => n + s.qty, 0);
  const flight = days(c.start, c.end);
  const link = shareUrl(c, user.id);
  const logos = { white: await logo('/brand/logo-white-deck.png'), navy: await logo('/brand/logo-navy-deck.png') };
  const label = `Primedia Malls · ${w.Noun}${forClient ? ` for ${forClient}` : ''} · ${c.name}`;
  let n = 1;

  /* Cover */
  {
    const slide = pptx.addSlide();
    const coverUrls = malls.flatMap((m) => m.photoUrls);
    const coverSize: Record<number, [number, number]> = { 0: [W, H], 1: [W * 0.48, H], 2: [3.45, 2.6], 3: [W, H * 0.56] };
    const coverPic = coverUrls.length ? await firstPicture(coverUrls, ...coverSize[look.cover]) : null;
    const title = c.name;
    const kicker = `${w.Noun}${forClient ? ` for ${forClient}` : ''}`;
    const when = c.start || c.end ? formatRange(c.start, c.end) : '';
    const by = `${user.name}${user.title ? `, ${user.title}` : ''}`;
    // No photo would load: the light cover, which works without one.
    const variant = coverPic ? look.cover : 2;
    if (variant === 0) {
      // Full-bleed photo, a brand panel over it.
      const pic = coverPic;
      slide.background = { color: look.lead };
      if (pic) slide.addImage({ data: pic.data, x: 0, y: 0, w: W, h: H });
      box(pptx, slide, look, { x: 0.6, y: 1.5, w: 6.4, h: 4.5, fill: look.lead, transparency: 8 });
      if (logos.white) slide.addImage({ data: logos.white, x: 1.0, y: 1.9, w: 0.4 * LOGO_RATIO, h: 0.4 });
      text(slide, kicker.toUpperCase(), { x: 1.0, y: 2.7, w: 5.6, h: 0.4, fontSize: 13, bold: true, color: 'C9D3EA', charSpacing: 2 });
      text(slide, title, { x: 1.0, y: 3.1, w: 5.6, h: 1.6, fontSize: 38, bold: true, color: BRAND.white, fit: 'shrink' });
      text(slide, [when, by].filter(Boolean).join('\n'), { x: 1.0, y: 4.9, w: 5.6, h: 0.9, fontSize: 14, color: BRAND.white });
    } else if (variant === 1) {
      // Split: brand colour left, photo right.
      slide.background = { color: look.lead };
      const pic = coverPic;
      if (pic) slide.addImage({ data: pic.data, x: W * 0.52, y: 0, w: W * 0.48, h: H });
      if (logos.white) slide.addImage({ data: logos.white, x: 0.8, y: 0.8, w: 0.42 * LOGO_RATIO, h: 0.42 });
      text(slide, kicker.toUpperCase(), { x: 0.8, y: 2.5, w: 5.8, h: 0.4, fontSize: 13, bold: true, color: 'C9D3EA', charSpacing: 2 });
      text(slide, title, { x: 0.8, y: 2.95, w: 5.8, h: 2.0, fontSize: 44, bold: true, color: BRAND.white, fit: 'shrink' });
      text(slide, [when, by].filter(Boolean).join('\n'), { x: 0.8, y: 5.4, w: 5.8, h: 1.0, fontSize: 15, color: BRAND.white });
    } else if (variant === 2) {
      // Light: white page, big type, a brand block with the numbers.
      slide.background = { color: BRAND.white };
      if (logos.navy) slide.addImage({ data: logos.navy, x: 0.8, y: 0.7, w: 0.4 * LOGO_RATIO, h: 0.4 });
      text(slide, kicker.toUpperCase(), { x: 0.8, y: 2.0, w: 7.4, h: 0.4, fontSize: 13, bold: true, color: look.accent, charSpacing: 2 });
      text(slide, title, { x: 0.8, y: 2.45, w: 7.4, h: 2.2, fontSize: 48, bold: true, color: BRAND.ink, fit: 'shrink' });
      text(slide, [when, by].filter(Boolean).join('\n'), { x: 0.8, y: 5.0, w: 7.0, h: 1.0, fontSize: 15, color: BRAND.muted });
      box(pptx, slide, look, { x: 8.8, y: 0.7, w: 3.85, h: 6.1, fill: look.lead });
      const pic = coverPic;
      if (pic) slide.addImage({ data: pic.data, x: 9.0, y: 0.9, w: 3.45, h: 2.6 });
      const top = pic ? 3.8 : 1.3;
      stat(slide, 9.15, top, 3.3, String(r.malls || malls.length), r.malls === 1 || malls.length === 1 ? 'mall' : 'malls', BRAND.white, 'C9D3EA');
      stat(slide, 9.15, top + 1.45, 3.3, String(total), total === 1 ? w.unit : `${w.unit}s`, BRAND.white, 'C9D3EA');
    } else {
      // Photo top, brand band below with the title.
      slide.background = { color: BRAND.white };
      const pic = coverPic;
      if (pic) slide.addImage({ data: pic.data, x: 0, y: 0, w: W, h: H * 0.56 });
      slide.addShape(pptx.ShapeType.rect, { x: 0, y: H * 0.56, w: W, h: H * 0.44, fill: { color: look.lead }, line: { type: 'none' } } as never);
      if (logos.white) slide.addImage({ data: logos.white, x: W - 0.8 - 0.36 * LOGO_RATIO, y: H * 0.56 + 0.45, w: 0.36 * LOGO_RATIO, h: 0.36 });
      text(slide, kicker.toUpperCase(), { x: 0.8, y: H * 0.56 + 0.45, w: 7.5, h: 0.4, fontSize: 13, bold: true, color: 'C9D3EA', charSpacing: 2 });
      text(slide, title, { x: 0.8, y: H * 0.56 + 0.9, w: 8.5, h: 1.2, fontSize: 40, bold: true, color: BRAND.white, fit: 'shrink' });
      text(slide, [when, by].filter(Boolean).join('  ·  '), { x: 0.8, y: H - 0.85, w: 11, h: 0.4, fontSize: 14, color: BRAND.white });
    }
    slide.addNotes(`${w.Noun} for ${forClient || 'the client'}: ${c.name}. Approve it here: ${link}`);
  }

  /* Campaign at a glance */
  {
    n += 1;
    const slide = pptx.addSlide();
    const dark = look.summary === 2;
    slide.background = { color: dark ? look.lead : look.paper };
    const ink = dark ? BRAND.white : BRAND.ink;
    const sub = dark ? 'C9D3EA' : BRAND.muted;
    text(slide, 'The campaign at a glance', { x: 0.8, y: 0.6, w: 11.5, h: 0.7, fontSize: 30, bold: true, color: ink });
    const stats: [string, string][] = [
      [String(r.malls || malls.length), (r.malls || malls.length) === 1 ? 'mall' : 'malls'],
      [String(total), total === 1 ? w.unit : `${w.unit}s`],
      [flight ? String(flight) : '—', flight === 1 ? 'day on air' : 'days on air'],
      [r.visits ? compact(r.visits) : '—', 'mall visits during the flight (estimate)'],
    ];
    const objective = c.objective?.trim() || `Digital screens in ${malls.map((m) => m.name).slice(0, 4).join(', ')}${malls.length > 4 ? ' and more' : ''}.`;
    if (look.summary === 0) {
      // Four tiles in a row, objective underneath.
      stats.forEach(([v, l], i) => {
        const x = 0.8 + i * 3.0;
        box(pptx, slide, look, { x, y: 1.7, w: 2.75, h: 2.0, fill: i === 0 ? look.lead : BRAND.white, line: i === 0 ? undefined : BRAND.line });
        stat(slide, x + 0.3, 1.95, 2.2, v, l, i === 0 ? BRAND.white : look.accent, i === 0 ? 'C9D3EA' : BRAND.muted);
      });
      text(slide, 'What it’s for', { x: 0.8, y: 4.2, w: 11.5, h: 0.4, fontSize: 14, bold: true, color: ink });
      text(slide, objective, { x: 0.8, y: 4.65, w: 11.5, h: 1.6, fontSize: 18, color: sub, fit: 'shrink' });
    } else {
      // Objective large on the left, numbers stacked on the right.
      text(slide, objective, { x: 0.8, y: 1.7, w: 6.6, h: 3.6, fontSize: 22, color: ink, fit: 'shrink' });
      text(slide, c.start || c.end ? formatRange(c.start, c.end) : '', { x: 0.8, y: 5.4, w: 6.6, h: 0.5, fontSize: 15, color: sub });
      stats.forEach(([v, l], i) => {
        const y = 1.6 + i * 1.3;
        if (!dark) slide.addShape(pptx.ShapeType.rect, { x: 8.2, y: y + 0.2, w: 0.42, h: 0.42, fill: { color: i % 2 ? look.accent : look.lead }, line: { type: 'none' } } as never);
        text(slide, v, { x: 8.9, y, w: 3.8, h: 0.6, fontSize: 30, bold: true, color: dark ? BRAND.white : look.accent });
        text(slide, l, { x: 8.9, y: y + 0.62, w: 3.8, h: 0.4, fontSize: 12, color: sub });
      });
    }
    footer(slide, dark, label, logos, n);
  }

  /* Why mall media: the network */
  {
    n += 1;
    const slide = pptx.addSlide();
    const net = networkStats();
    const dark = look.summary !== 2;
    slide.background = { color: dark ? look.lead : look.paper };
    const ink = dark ? BRAND.white : BRAND.ink;
    const sub = dark ? 'C9D3EA' : BRAND.muted;
    text(slide, 'Why malls', { x: 0.8, y: 0.6, w: 11.5, h: 0.7, fontSize: 30, bold: true, color: ink });
    text(slide, 'Shoppers in a mall are out to buy: digital screens meet them on the way to the till, where decisions are made.', { x: 0.8, y: 1.35, w: 11.0, h: 0.6, fontSize: 16, color: sub });
    const big: [string, string][] = [
      [compact(net.annualVisits), 'mall visits a year across the network'],
      [`${net.noticeMallAds}%`, 'of shoppers notice mall advertising'],
      [`${net.seenDigitalScreens}%`, 'have seen the digital screens'],
      [String(net.provinces), 'provinces covered'],
    ];
    big.forEach(([v, l], k) => {
      const x = 0.8 + k * 3.0;
      text(slide, v, { x, y: 2.6, w: 2.8, h: 1.1, fontSize: 48, bold: true, color: dark ? BRAND.white : look.accent });
      text(slide, l, { x, y: 3.75, w: 2.6, h: 0.9, fontSize: 14, color: sub });
      slide.addShape(pptx.ShapeType.rect, { x, y: 2.45, w: 0.6, h: 0.07, fill: { color: dark ? BRAND.sky : look.lead }, line: { type: 'none' } } as never);
    });
    text(slide, 'Source: Primedia Malls shopper research, as in the malls proposal deck.', { x: 0.8, y: H - 1.05, w: 9, h: 0.3, fontSize: 9, color: sub });
    footer(slide, dark, label, logos, n);
  }

  /* Who you'll reach: the shoppers of these malls together */
  const decks = [...new Map(malls.filter((m) => m.deck).map((m) => [m.deck!.id, m.deck!])).values()];
  const aud = audienceOf(decks);
  if (decks.length && (aud.ages.length || aud.women != null)) {
    n += 1;
    const slide = pptx.addSlide();
    slide.background = { color: look.paper };
    text(slide, 'Who you’ll reach', { x: 0.8, y: 0.6, w: 11.5, h: 0.7, fontSize: 30, bold: true, color: BRAND.ink });
    text(slide, `The shoppers of ${decks.length === 1 ? decks[0] ? mallName(decks[0]) : 'this mall' : `these ${decks.length} malls`}, weighted by how many people visit each.`, { x: 0.8, y: 1.3, w: 11.5, h: 0.4, fontSize: 14, color: BRAND.muted });
    const flip = look.mallOffset % 2 === 1;
    const chartX = flip ? 7.0 : 0.8;
    const statsX = flip ? 0.8 : 7.6;
    if (aud.ages.length) {
      text(slide, 'Age', { x: chartX, y: 2.0, w: 5.5, h: 0.4, fontSize: 14, bold: true, color: BRAND.ink });
      const top = Math.max(...aud.ages.map((a) => a[1]));
      const rows = aud.ages.map(([b, v]) => [b, v, `${Math.round(v)}%`] as [string, string | number, string]) as [string, number, string][];
      // The biggest age group stands out in the accent colour.
      const sorted = [...rows];
      hbars(pptx, slide, { x: chartX, y: 2.5, w: 5.6, rows: sorted, max: top, color: look.lead, ink: BRAND.ink, sub: BRAND.muted });
      const peak = rows.reduce((a, b) => (b[1] > a[1] ? b : a));
      text(slide, `Most shoppers are aged ${peak[0]}.`, { x: chartX, y: 2.5 + rows.length * 0.46 + 0.15, w: 5.6, h: 0.4, fontSize: 12, italic: true, color: BRAND.muted });
    }
    let sy = 2.0;
    if (aud.women != null) {
      text(slide, 'Women and men', { x: statsX, y: sy, w: 5.0, h: 0.4, fontSize: 14, bold: true, color: BRAND.ink });
      const wW = 4.8 * (aud.women / 100);
      slide.addShape(pptx.ShapeType.rect, { x: statsX, y: sy + 0.5, w: wW, h: 0.5, fill: { color: look.accent }, line: { type: 'none' } } as never);
      slide.addShape(pptx.ShapeType.rect, { x: statsX + wW, y: sy + 0.5, w: 4.8 - wW, h: 0.5, fill: { color: look.lead }, line: { type: 'none' } } as never);
      text(slide, `${Math.round(aud.women)}% women`, { x: statsX, y: sy + 1.1, w: 2.4, h: 0.35, fontSize: 12, bold: true, color: BRAND.ink });
      text(slide, `${100 - Math.round(aud.women)}% men`, { x: statsX + 2.4, y: sy + 1.1, w: 2.4, h: 0.35, fontSize: 12, bold: true, color: BRAND.ink, align: 'right' });
      sy += 1.8;
    }
    const tiles: [string, string][] = [
      ...(aud.income != null ? [[`R${compact(aud.income)}`, 'average monthly household income'] as [string, string]] : []),
      ...(aud.lsm.length ? [[`LSM ${aud.lsm.slice(0, 2).join(', ')}`, 'strongest living-standard groups'] as [string, string]] : []),
      ...(aud.working != null ? [[`${Math.round(aud.working)}%`, 'working'] as [string, string]] : []),
      ...(aud.digital != null ? [[`${Math.round(aud.digital)}%`, 'have seen the digital screens'] as [string, string]] : []),
    ].slice(0, 4);
    tiles.forEach(([v, l], k) => {
      const tx = statsX + (k % 2) * 2.5;
      const ty = sy + Math.floor(k / 2) * 1.25;
      box(pptx, slide, look, { x: tx, y: ty, w: 2.35, h: 1.1, fill: look.paper === BRAND.white ? BRAND.soft : BRAND.white });
      text(slide, v, { x: tx + 0.15, y: ty + 0.12, w: 2.1, h: 0.5, fontSize: 20, bold: true, color: look.accent, fit: 'shrink' });
      text(slide, l, { x: tx + 0.15, y: ty + 0.62, w: 2.1, h: 0.42, fontSize: 10, color: BRAND.muted, fit: 'shrink' });
    });
    if (r.digitalViewers) {
      text(slide, `During this campaign: about ${compact(r.visits)} mall visits, ${compact(r.digitalViewers)} of them by people who notice digital screens.`, { x: 0.8, y: H - 1.15, w: 11.7, h: 0.4, fontSize: 13, bold: true, color: look.lead });
    }
    footer(slide, false, label, logos, n);
  }

  /* The malls compared, by footfall */
  const footfall = decks.map((d) => [mallName(d), annualVisits(d) ?? 0] as [string, number]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  if (footfall.length >= 2) {
    n += 1;
    const slide = pptx.addSlide();
    const dark = look.closing === 0;
    slide.background = { color: dark ? look.lead : look.paper };
    const ink = dark ? BRAND.white : BRAND.ink;
    text(slide, 'Footfall in your malls', { x: 0.8, y: 0.6, w: 11.5, h: 0.7, fontSize: 30, bold: true, color: ink });
    text(slide, `Visits a year: ${compact(footfall.reduce((s, [, v]) => s + v, 0))} across the ${footfall.length} malls.`, { x: 0.8, y: 1.3, w: 11.5, h: 0.4, fontSize: 14, color: dark ? 'C9D3EA' : BRAND.muted });
    const shown = footfall.slice(0, 9);
    const rowH = Math.min(0.55, 4.6 / shown.length);
    hbars(pptx, slide, { x: 0.8, y: 2.0, w: 11.7, rows: shown.map(([nm, v]) => [nm, v, compact(v)] as [string, number, string]), max: shown[0][1], color: dark ? BRAND.sky : look.lead, alt: dark ? BRAND.white : look.accent, ink, sub: ink, rowH });
    footer(slide, dark, label, logos, n);
  }

  /* One slide per mall */
  for (const [i, m] of malls.entries()) {
    n += 1;
    const slide = pptx.addSlide();
    slide.background = { color: look.paper };
    const variant = (i + look.mallOffset) % 3;
    const rows = m.screens.map((s) => [
      { text: s.title + (s.qty > 1 ? ` × ${s.qty}` : ''), options: { bold: true, color: BRAND.ink } },
      { text: s.width && s.height ? `${s.width} × ${s.height} px` : 'Size to confirm', options: { color: BRAND.muted } },
      { text: s.orientation ?? '', options: { color: BRAND.muted } },
    ]);
    const table = (x: number, y: number, wd: number) =>
      slide.addTable(rows.slice(0, 9) as never, {
        x, y, w: wd, colW: [wd * 0.5, wd * 0.3, wd * 0.2], fontFace: FONT, fontSize: 12, color: BRAND.ink, margin: 0.06,
        border: { type: 'solid', pt: 0.75, color: BRAND.line }, rowH: 0.36,
      } as never);
    const facts = m.facts.slice(0, 4);
    const heading = (x: number, y: number, wd: number, color: string = BRAND.ink) => {
      text(slide, m.name, { x, y, w: wd, h: 0.7, fontSize: 30, bold: true, color, fit: 'shrink' });
      if (m.area) text(slide, m.area, { x, y: y + 0.72, w: wd, h: 0.4, fontSize: 14, color: color === BRAND.white ? 'C9D3EA' : BRAND.muted });
    };
    const factChips = (x: number, y: number, wd: number) =>
      facts.forEach((f, k) => {
        const cx = x + (k % 2) * (wd / 2);
        const cy = y + Math.floor(k / 2) * 0.62;
        box(pptx, slide, look, { x: cx, y: cy, w: wd / 2 - 0.15, h: 0.5, fill: BRAND.soft === look.paper ? BRAND.white : BRAND.soft });
        text(slide, f, { x: cx + 0.15, y: cy + 0.12, w: wd / 2 - 0.45, h: 0.3, fontSize: 11, color: BRAND.ink, fit: 'shrink' });
      });
    // Only lay a slide out around a photo that actually loads.
    const mallSize: Record<number, [number, number]> = { 0: [5.6, H], 1: [5.4, 4.6], 2: [W, 2.9] };
    const pic = m.photoUrls.length ? await firstPicture(m.photoUrls, ...mallSize[variant]) : null;
    const photo = Boolean(pic);
    if (photo && variant === 0) {
      if (pic) slide.addImage({ data: pic.data, x: 0, y: 0, w: 5.6, h: H });
      heading(6.2, 0.6, 6.4);
      factChips(6.2, 1.85, 6.4);
      table(6.2, facts.length ? 3.25 : 1.9, 6.4);
    } else if (photo && variant === 1) {
      heading(0.8, 0.6, 6.2);
      factChips(0.8, 1.85, 6.2);
      table(0.8, facts.length ? 3.25 : 1.9, 6.2);
      box(pptx, slide, look, { x: 7.35, y: 0.6, w: 5.4, h: 5.8, fill: look.lead });
      if (pic) slide.addImage({ data: pic.data, x: 7.35, y: 0.6, w: 5.4, h: 4.6 });
      const count = m.screens.reduce((s, x) => s + x.qty, 0);
      text(slide, `${count} ${count === 1 ? w.unit : `${w.unit}s`} in this ${w.noun}`, { x: 7.65, y: 5.4, w: 4.8, h: 0.6, fontSize: 16, bold: true, color: BRAND.white });
    } else if (photo) {
      if (pic) slide.addImage({ data: pic.data, x: 0, y: 0, w: W, h: 2.9 });
      slide.addShape(pptx.ShapeType.rect, { x: 0, y: 2.9, w: W, h: 0.08, fill: { color: look.lead }, line: { type: 'none' } } as never);
      heading(0.8, 3.25, 5.8);
      factChips(0.8, 4.5, 5.8);
      table(7.0, 3.3, 5.6);
    } else {
      // No cleared photo: a brand panel carries the mall's name (left or right, deck to deck),
      // and the screens are drawn to scale beside it.
      const left = (i + look.mallOffset) % 2 === 0;
      const px = left ? 0.6 : W - 0.6 - 4.6;
      const cx = left ? 5.8 : 0.8;
      box(pptx, slide, look, { x: px, y: 0.6, w: 4.6, h: 6.0, fill: look.lead });
      heading(px + 0.35, 1.0, 4.0, BRAND.white);
      facts.forEach((f, k) => text(slide, f, { x: px + 0.35, y: 2.5 + k * 0.55, w: 4.0, h: 0.45, fontSize: 13, color: BRAND.white }));
      text(slide, `${w.Noun === 'Site list' ? 'Sites' : 'Screens'} here`, { x: cx, y: 0.6, w: 6.9, h: 0.45, fontSize: 18, bold: true, color: BRAND.ink });
      table(cx, 1.2, 6.9);
      const drawn = m.screens.filter((x) => x.width && x.height).slice(0, 4);
      const top = 1.2 + Math.min(rows.length, 9) * 0.36 + 0.5;
      const slot = 6.9 / Math.max(drawn.length, 1);
      const room = Math.min(1.9, H - 1.0 - top - 0.5);
      if (room > 0.8) {
        drawn.forEach((x, k) => {
          const sc = Math.min((slot - 0.3) / x.width!, room / x.height!);
          const sw = x.width! * sc;
          const sh = x.height! * sc;
          const sx = cx + k * slot;
          slide.addShape(pptx.ShapeType.rect, { x: sx, y: top + (room - sh), w: sw, h: sh, fill: { color: k % 2 ? look.accent : look.lead }, line: { type: 'none' } } as never);
          text(slide, `${x.title}`, { x: sx, y: top + room + 0.08, w: slot - 0.2, h: 0.3, fontSize: 10, bold: true, color: BRAND.ink, fit: 'shrink' });
          text(slide, `${x.width} × ${x.height}`, { x: sx, y: top + room + 0.36, w: slot - 0.2, h: 0.25, fontSize: 9, color: BRAND.muted });
        });
      }
    }
    footer(slide, false, label, logos, n);
  }

  /* The creatives to supply */
  {
    n += 1;
    const slide = pptx.addSlide();
    slide.background = { color: look.paper };
    text(slide, `Creatives to supply: ${groups.length}`, { x: 0.8, y: 0.6, w: 11.5, h: 0.7, fontSize: 30, bold: true, color: BRAND.ink });
    text(slide, 'One video or still per artwork size, built in its After Effects template. The spec sheet has the file types and safe area.', {
      x: 0.8, y: 1.3, w: 11.5, h: 0.5, fontSize: 14, color: BRAND.muted,
    });
    const shown = groups.slice(0, 6);
    const cols = shown.length <= 3 ? shown.length : 3;
    const cw = cols ? (W - 1.6 - (cols - 1) * 0.3) / cols : 0;
    shown.forEach((g: CreativeGroup, k) => {
      const x = 0.8 + (k % cols) * (cw + 0.3);
      const y = 2.1 + Math.floor(k / cols) * 2.45;
      box(pptx, slide, look, { x, y, w: cw, h: 2.2, fill: BRAND.white, line: BRAND.line });
      // The artwork's shape, to scale.
      if (g.width && g.height) {
        const s = 1.3 / Math.max(g.width, g.height);
        slide.addShape(pptx.ShapeType.rect, { x: x + 0.3, y: y + 0.3 + (1.3 - g.height * s) / 2, w: g.width * s, h: g.height * s, fill: { color: k % 2 ? look.accent : look.lead }, line: { type: 'none' } } as never);
      } else {
        slide.addShape(pptx.ShapeType.rect, { x: x + 0.3, y: y + 0.45, w: 1.3, h: 0.9, fill: { color: BRAND.soft }, line: { color: BRAND.muted, width: 1, dashType: 'dash' } } as never);
      }
      text(slide, creativeLabel(g), { x: x + 1.85, y: y + 0.3, w: cw - 2.1, h: 0.8, fontSize: 15, bold: true, color: BRAND.ink, fit: 'shrink' });
      text(slide, `For ${g.count} ${g.count === 1 ? w.unit : `${w.unit}s`} in ${g.malls} ${g.malls === 1 ? 'mall' : 'malls'}`, { x: x + 1.85, y: y + 1.15, w: cw - 2.1, h: 0.4, fontSize: 12, color: BRAND.muted });
      if (!g.width) text(slide, 'Primedia confirms the size', { x: x + 1.85, y: y + 1.55, w: cw - 2.1, h: 0.35, fontSize: 11, color: BRAND.muted, italic: true });
    });
    if (groups.length > shown.length) text(slide, `…and ${groups.length - shown.length} more on the ${w.noun} page.`, { x: 0.8, y: H - 1.0, w: 11, h: 0.35, fontSize: 12, color: BRAND.muted });
    footer(slide, false, label, logos, n);
  }

  /* Investment: the rate card, when sales priced the proposal */
  if (hasRates(c)) {
    n += 1;
    const slide = pptx.addSlide();
    slide.background = { color: look.paper };
    const t = rateTotals(c);
    const card = c.rateCard!;
    text(slide, 'Investment', { x: 0.8, y: 0.6, w: 8, h: 0.7, fontSize: 30, bold: true, color: BRAND.ink });
    text(slide, `Rates ${PERIOD_LABEL[card.per]}, in rand, excluding VAT.`, { x: 0.8, y: 1.3, w: 8, h: 0.4, fontSize: 13, color: BRAND.muted });
    const lines = pricedLines(c).filter((p) => p.total != null).sort((a, b) => (b.total ?? 0) - (a.total ?? 0));
    const shown = lines.slice(0, 9);
    const left = look.mallOffset % 2 === 0;
    const tx = left ? 0.8 : 4.6;
    const px = left ? 9.1 : 0.8;
    const rows = [
      [
        { text: 'Line', options: { bold: true, color: BRAND.white, fill: { color: look.lead } } },
        { text: 'Rate card', options: { bold: true, color: BRAND.white, fill: { color: look.lead }, align: 'right' } },
        { text: 'Discount', options: { bold: true, color: BRAND.white, fill: { color: look.lead }, align: 'right' } },
        { text: 'Total', options: { bold: true, color: BRAND.white, fill: { color: look.lead }, align: 'right' } },
      ],
      ...shown.map((p) => [
        { text: `${itemLabel(p.item)}\n${itemDetail(p.item)}`, options: { color: BRAND.ink } },
        { text: p.line.rate != null ? rand(p.line.rate) : '—', options: { color: BRAND.muted, align: 'right' } },
        { text: `${p.line.discount ?? 0}%`, options: { color: BRAND.muted, align: 'right' } },
        { text: rand(p.total ?? 0), options: { bold: true, color: BRAND.ink, align: 'right' } },
      ]),
    ];
    slide.addTable(rows as never, { x: tx, y: 1.9, w: 7.9, colW: [3.9, 1.5, 1.0, 1.5], fontFace: FONT, fontSize: 11, margin: 0.06, border: { type: 'solid', pt: 0.75, color: BRAND.line } } as never);
    if (lines.length > shown.length) text(slide, `…and ${lines.length - shown.length} more lines in the Excel rate card.`, { x: tx, y: H - 1.15, w: 7.9, h: 0.3, fontSize: 11, italic: true, color: BRAND.muted });
    box(pptx, slide, look, { x: px, y: 1.9, w: 3.45, h: 4.6, fill: look.lead });
    const figures: [string, string][] = [
      ['Rate card value', rand(t.gross)],
      ['Your discount', t.discount > 0 ? `– ${rand(t.discount)}` : rand(0)],
      [card.vat ? 'Total excl. VAT' : 'Total investment (excl. VAT)', rand(t.net)],
      ...(card.vat ? ([[`VAT (${Math.round(VAT_RATE * 100)}%)`, rand(t.vat)], ['Total incl. VAT', rand(t.total)]] as [string, string][]) : []),
    ];
    const step = figures.length > 3 ? 0.76 : 0.9;
    figures.forEach(([k, v], i) => {
      const last = i === figures.length - 1;
      text(slide, k, { x: px + 0.3, y: 2.1 + i * step, w: 2.9, h: 0.28, fontSize: 11, color: 'C9D3EA' });
      text(slide, v, { x: px + 0.3, y: 2.38 + i * step, w: 2.9, h: 0.42, fontSize: last ? 19 : 15, bold: true, color: BRAND.white, fit: 'shrink' });
    });
    // Under the last figure, never on top of it.
    const saveY = 2.38 + (figures.length - 1) * step + 0.62;
    if (t.discount > 0 && t.gross > 0) text(slide, `You save ${Math.round((t.discount / t.gross) * 100)}% on the rate card.`, { x: px + 0.3, y: saveY, w: 2.9, h: 0.32, fontSize: 11, bold: true, color: BRAND.white });
    if (card.note.trim()) text(slide, card.note.trim(), { x: tx, y: H - 0.85, w: 7.9, h: 0.3, fontSize: 9, color: BRAND.muted, fit: 'shrink' });
    footer(slide, false, label, logos, n);
  }

  /* Next steps */
  {
    n += 1;
    const slide = pptx.addSlide();
    const dark = look.closing !== 1;
    slide.background = { color: dark ? look.lead : BRAND.white };
    const ink = dark ? BRAND.white : BRAND.ink;
    const sub = dark ? 'C9D3EA' : BRAND.muted;
    text(slide, 'Next steps', { x: 0.8, y: 0.7, w: 11, h: 0.8, fontSize: 34, bold: true, color: ink });
    const steps: [string, string][] = [
      [`Approve the ${w.noun}`, 'Open the link below: it lists every screen and the creatives to supply. Approve in one click, or tell us what to change.'],
      ['Send the artwork', `One file per creative, built in its After Effects template${c.start ? `, by ${formatDate(c.start)}` : ''}.`],
      ['Go live', c.start || c.end ? `On air ${formatRange(c.start, c.end)}.` : 'On the dates we agree.'],
    ];
    steps.forEach(([t, d], k) => {
      const x = 0.8 + k * 4.0;
      if (look.closing === 2) {
        slide.addShape(pptx.ShapeType.rect, { x, y: 1.9, w: 0.7, h: 0.7, fill: { color: dark ? BRAND.white : look.lead }, line: { type: 'none' } } as never);
        text(slide, String(k + 1), { x, y: 1.9, w: 0.7, h: 0.7, fontSize: 20, bold: true, color: dark ? look.lead : BRAND.white, align: 'center', valign: 'middle' });
      } else {
        text(slide, String(k + 1).padStart(2, '0'), { x, y: 1.8, w: 1.2, h: 0.8, fontSize: 34, bold: true, color: dark ? 'C9D3EA' : look.accent });
      }
      text(slide, t, { x, y: 2.85, w: 3.6, h: 0.5, fontSize: 18, bold: true, color: ink });
      text(slide, d, { x, y: 3.4, w: 3.6, h: 1.4, fontSize: 13, color: sub, fit: 'shrink' });
    });
    text(slide, [{ text: link, options: { hyperlink: { url: link }, color: dark ? BRAND.white : BRAND.blue, underline: { style: 'sng' } } }], { x: 0.8, y: 5.1, w: 11.5, h: 0.4, fontSize: 14 });
    text(slide, `${user.name}${user.title ? ` · ${user.title}` : ''}${user.email ? ` · ${user.email}` : ''}`, { x: 0.8, y: 5.65, w: 11.5, h: 0.4, fontSize: 14, bold: true, color: ink });
    const l = dark ? logos.white : logos.navy;
    if (l) slide.addImage({ data: l, x: W - 0.8 - 0.42 * LOGO_RATIO, y: H - 1.05, w: 0.42 * LOGO_RATIO, h: 0.42 });
    text(slide, 'Media is subject to availability. Visits are estimates from each mall’s annual foot count over the flight.', { x: 0.8, y: H - 0.95, w: 7.5, h: 0.4, fontSize: 9, color: sub });
  }

  const fileName = `${c.name.replace(/[\\/:*?"<>|]+/g, '').trim() || 'Proposal'} — Primedia Malls ${w.noun}.pptx`;
  // pptxgenjs writes folder entries into the zip; OneDrive and SharePoint can refuse
  // such files, so they're taken out before the download.
  const raw = (await pptx.write({ outputType: 'arraybuffer' })) as ArrayBuffer;
  const { default: JSZip } = await import('jszip');
  const src = await JSZip.loadAsync(raw);
  // A fresh zip with the files only (removing a folder from JSZip removes its files too).
  const zip = new JSZip();
  for (const [name, entry] of Object.entries(src.files)) {
    if (!entry.dir) zip.file(name, await entry.async('uint8array'), { createFolders: false });
  }
  const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', compression: 'DEFLATE' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  return fileName;
}
