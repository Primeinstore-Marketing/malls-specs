/**
 * Reads a mall's shopper profile from a Primedia Malls deck (.pptx), in the
 * browser: the "Shopper Profile" slide's charts (age, work, population group,
 * home language, generation, income, SEM) and its numbers (women and men,
 * parents, post-matric, shoppers a month). Nothing about any mall is in the
 * code; the admin drops the deck and saves what it read.
 */
import type { ShopperProfile, Share } from './types';

export interface DeckRead {
  /** The mall's name as the slide titles it, e.g. "Canal Walk". */
  readonly title: string;
  readonly fileName: string;
  readonly profile: ShopperProfile;
  /** Things to check against the slide before saving. */
  readonly checks: readonly string[];
}

const XML = (s: string) => new DOMParser().parseFromString(s, 'application/xml');
const all = (el: Document | Element, tag: string) => Array.from(el.getElementsByTagNameNS('*', tag));
const one = (el: Document | Element, tag: string) => el.getElementsByTagNameNS('*', tag)[0] ?? null;

interface TextBox { readonly text: string; readonly x: number; readonly y: number }
interface Shape { readonly name: string; readonly x: number; readonly y: number }

/** Centre of a shape from its a:off / a:ext. */
function centre(el: Element): { x: number; y: number } {
  const off = one(el, 'off');
  const ext = one(el, 'ext');
  const n = (e: Element | null, a: string) => Number(e?.getAttribute(a) ?? 0);
  return { x: n(off, 'x') + n(ext, 'cx') / 2, y: n(off, 'y') + n(ext, 'cy') / 2 };
}

function chartRows(doc: Document): [string, number][] {
  const ser = one(doc, 'ser');
  if (!ser) return [];
  const cat = one(ser, 'cat');
  const val = one(ser, 'val');
  if (!cat || !val) return [];
  const pts = (el: Element) => {
    const out = new Map<number, string>();
    for (const pt of all(el, 'pt')) out.set(Number(pt.getAttribute('idx')), one(pt, 'v')?.textContent ?? '');
    return out;
  };
  const cats = pts(cat);
  const vals = pts(val);
  return [...cats.entries()].sort((a, b) => a[0] - b[0]).map(([i, c]) => [c.trim(), Number(vals.get(i) ?? NaN)] as [string, number]).filter(([, v]) => Number.isFinite(v));
}

type Kind = 'age' | 'work' | 'race' | 'language' | 'generations' | 'income' | 'sem' | 'other';
function kindOf(rows: readonly [string, number][]): Kind {
  const cats = rows.map(([c]) => c.toLowerCase()).join(' ');
  if (/sem 10/.test(cats)) return 'sem';
  if (/millennial|boomer/.test(cats)) return 'generations';
  if (/<\s*r\s*6|r6 000/.test(cats)) return 'income';
  if (/black/.test(cats) && /white/.test(cats)) return 'race';
  if (/employed|retired/.test(cats)) return 'work';
  if (/english|afrikaans/.test(cats)) return 'language';
  if (rows.length && rows.every(([c]) => /^\d+\s*[-–]\s*\d+$|^\d+\s*\+$/.test(c))) return 'age';
  return 'other';
}

const LANG: Readonly<Record<string, string>> = {
  isizulu: 'isiZulu', isixhosa: 'isiXhosa', isindebele: 'isiNdebele', ndebele: 'isiNdebele', siswati: 'siSwati',
  xitsonga: 'Xitsonga', sepedi: 'Sepedi', sesotho: 'Sesotho', setswana: 'Setswana', tshivenda: 'Tshivenda', english: 'English', afrikaans: 'Afrikaans',
};
function genLabel(l: string): string {
  const k = l.toLowerCase();
  if (k.includes('pre')) return 'Pre-war (before 1946)';
  if (k.includes('boomer')) return 'Baby boomers (1946–1964)';
  if (/gen(eration)? x/.test(k)) return 'Gen X (1965–1980)';
  if (k.includes('millennial')) return 'Millennials (1981–1996)';
  if (/gen(eration)? z/.test(k)) return 'Gen Z (1997 on)';
  return l;
}
function workLabel(l: string): string {
  const k = l.toLowerCase();
  if (k.includes('full')) return 'Employed full-time';
  if (k.includes('part')) return 'Employed part-time';
  if (k.includes('unemployed')) return 'Unemployed';
  if (k.includes('retired/student') || k.includes('not working')) return 'Retired or studying';
  return l.charAt(0).toUpperCase() + l.slice(1).toLowerCase();
}
const incomeLabel = (l: string) => l.replace('R100 00+', 'R100 000+').replace(/\s+/g, ' ').replace(/\s*\+\s*$/, '+').trim();
const raceLabel = (l: string) => (/indian/i.test(l) ? 'Indian/Asian' : l.trim());

const shares = (rows: readonly [string, number][], fix: (s: string) => string = (s) => s): Share[] =>
  rows.filter(([, v]) => v > 0).map(([c, v]) => ({ label: fix(c.replace(/\s+/g, ' ').trim()), pct: Math.round(v * 1000) / 10 }));

/** Reads one deck. Throws with a plain message when it has no shopper profile. */
export async function readMallDeck(file: File): Promise<DeckRead> {
  const { default: JSZip } = await import('jszip');
  let zip: InstanceType<typeof JSZip>;
  try {
    zip = await JSZip.loadAsync(await file.arrayBuffer());
  } catch {
    throw new Error(`${file.name}: not a PowerPoint (.pptx) file.`);
  }
  const slides = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
  for (const path of slides) {
    const xml = await zip.file(path)!.async('string');
    if (!/Shopper Profile/i.test(xml)) continue;
    const doc = XML(xml);
    const rels = XML((await zip.file(path.replace('slides/', 'slides/_rels/') + '.rels')?.async('string')) ?? '<r/>');
    const target = new Map(all(rels, 'Relationship').map((r) => [r.getAttribute('Id') ?? '', r.getAttribute('Target') ?? '']));
    // Charts on this slide.
    const charts: [string, number][][] = [];
    for (const c of all(doc, 'chart')) {
      const id = c.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') ?? c.getAttribute('r:id');
      const t = id ? target.get(id) : null;
      if (!t) continue;
      const chartPath = `ppt/${t.replace(/^\.\.\//, '')}`;
      const cx = await zip.file(chartPath)?.async('string');
      if (cx) charts.push(chartRows(XML(cx)));
    }
    if (!charts.length) continue;
    // Text boxes and pictures, with where they sit.
    const texts: TextBox[] = [];
    const shapes: Shape[] = [];
    for (const sp of [...all(doc, 'sp'), ...all(doc, 'pic')]) {
      const pos = centre(sp);
      const nv = one(sp, 'cNvPr');
      shapes.push({ name: `${nv?.getAttribute('name') ?? ''} ${nv?.getAttribute('descr') ?? ''}`, ...pos });
      const paras = all(sp, 'p').filter((p) => p.namespaceURI?.includes('drawingml'));
      const text = paras.map((p) => all(p, 't').map((t) => t.textContent ?? '').join('')).filter(Boolean).join('\n').trim();
      if (text) texts.push({ text, ...pos });
    }
    return build(file.name, texts, shapes, charts);
  }
  throw new Error(`${file.name}: no “Shopper Profile” slide with charts.`);
}

function build(fileName: string, texts: readonly TextBox[], shapes: readonly Shape[], charts: readonly [string, number][][]): DeckRead {
  const checks: string[] = [];
  const by: Partial<Record<Kind, [string, number][]>> = {};
  for (const rows of charts) {
    const k = kindOf(rows);
    if (k !== 'other' && !by[k]) by[k] = rows;
  }
  const alltext = texts.map((t) => t.text).join('\n');
  const pctOf = (re: RegExp) => {
    const m = alltext.match(re);
    return m ? Math.round(Number(m[1])) : null;
  };
  const postMatric = pctOf(/(\d+(?:\.\d+)?)\s*%\s*have a Post Matric/i);
  const parents = pctOf(/(\d+(?:\.\d+)?)\s*%\s*are parents/i);
  // Shoppers: the number with "Average … shoppers", else the one figure like 1,234,567 on the slide.
  let shoppers: number | null = null;
  const label = texts.find((t) => /average\s+(annual|monthly)\s+shoppers/i.test(t.text));
  const num = (s: string) => {
    const m = s.match(/\d{1,3}(?:[ ,. ]\d{3})+|\d{5,}/);
    return m ? Number(m[0].replace(/\D/g, '')) : null;
  };
  if (label) shoppers = num(label.text);
  const lone = texts.filter((t) => /^\s*\d{1,3}(?:[ ,. ]\d{3})+\s*$/.test(t.text));
  if (shoppers == null && label && lone.length) {
    const near = [...lone].sort((a, b) => Math.hypot(a.x - label.x, a.y - label.y) - Math.hypot(b.x - label.x, b.y - label.y))[0];
    shoppers = num(near.text);
  }
  if (shoppers == null && lone.length === 1) shoppers = num(lone[0].text);
  if (shoppers == null) checks.push('No shopper count on the slide.');
  // Women and men: the two bare "NN%" boxes nearest the Woman and Man icons.
  const bare = texts.filter((t) => /^\d{1,3}(?:\.\d+)?\s*%$/.test(t.text)).map((t) => ({ ...t, n: Math.round(Number(t.text.replace('%', ''))) }));
  const icon = (word: string) => shapes.find((s) => new RegExp(`\\b${word}\\b`, 'i').test(s.name));
  const w = icon('Woman');
  const mIcon = icon('Man');
  let female: number | null = null;
  let male: number | null = null;
  if (w && mIcon && bare.length >= 2) {
    const d = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
    const fb = [...bare].sort((a, b) => d(w, a) - d(w, b))[0];
    const mb = bare.filter((b) => b !== fb).sort((a, b) => d(mIcon, a) - d(mIcon, b))[0];
    female = fb.n;
    male = mb.n;
    if (Math.abs(female + male - 100) > 1) checks.push(`Women ${female}% + men ${male}% = ${female + male}%. Check the slide and correct it in the mall’s page.`);
  } else checks.push('No women/men split found.');
  if (parents != null && parents < 20) checks.push(`Only ${parents}% are parents. Check the slide.`);

  const work = shares(by.work ?? [], workLabel);
  const employed = work.filter((x) => x.label.startsWith('Employed')).reduce((s, x) => s + x.pct, 0);
  const ages = (by.age ?? [])
    .map(([c, v]) => ({ band: c.replace(/\s+/g, '').replace('–', '-'), pct: Math.round(v * 100) }))
    .sort((a, b) => Number(a.band.match(/\d+/)![0]) - Number(b.band.match(/\d+/)![0]));
  if (!ages.length) checks.push('No age chart found.');
  const title = texts.find((t) => t.text && !/shopper profile/i.test(t.text) && !/^\d/.test(t.text))?.text.split('\n')[0].trim() ?? '';
  const profile: ShopperProfile = {
    monthlyFootcount: shoppers,
    householdIncome: null,
    ageBands: ages,
    female,
    male,
    married: null,
    working: work.length ? Math.round(employed) : null,
    lsm: null,
    affinity: null,
    race: shares(by.race ?? [], raceLabel).map((r) => ({ group: r.label, pct: Math.round(r.pct) })),
    education: postMatric != null ? [{ level: 'Post-matric', pct: postMatric }] : [],
    parents,
    postMatric,
    employment: work,
    languages: shares(by.language ?? [], (s) => LANG[s.toLowerCase()] ?? s).sort((a, b) => b.pct - a.pct),
    generations: shares(by.generations ?? [], genLabel),
    income: shares(by.income ?? [], incomeLabel),
    sem: shares(by.sem ?? []).sort((a, b) => Number(a.label.match(/\d+/)?.[0]) - Number(b.label.match(/\d+/)?.[0])),
    source: (alltext.match(/Source:\s*.*?TGI[^\n]*?(\d{4}[A-Z])/i)?.[1] ? `TGI South Africa ${alltext.match(/TGI\s+(\d{4}[A-Z])/i)?.[1] ?? ''}; SACSC` : 'Mall deck').trim(),
    updated: new Date().toISOString().slice(0, 7),
  };
  return { title, fileName, profile, checks };
}

/** A mall name reduced to what tells malls apart: "Primedia Malls - The Glen Shopping Centre NB.pptx" → "glen". */
export function nameKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/\.pptx$/, '')
    .replace(/primedia malls\s*-\s*/, '')
    .replace(/\b(nb|no data|theatre of shopping|shopping|centre|center|mall|the)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

/** Whether two mall names are the same mall: equal keys, or one starts with the other ("menlyn" / "menlynpark"). */
export function sameMall(a: string, b: string): boolean {
  const x = nameKey(a);
  const y = nameKey(b);
  if (!x || !y) return false;
  return x === y || (Math.min(x.length, y.length) >= 4 && (x.startsWith(y) || y.startsWith(x)));
}
