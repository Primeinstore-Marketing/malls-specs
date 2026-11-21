/**
 * Reads the rows of a site list or booking sheet exactly, without AI, so a
 * proposal lists every site the client's document lists:
 *  - tables (from Excel or CSV, as tab- or comma-separated text): found by a
 *    heading row with site / location / package columns;
 *  - printed site lists (PDFs such as "Client Site List" reports): found by
 *    site codes like "MEN/MAPP/001/06" followed by flight dates.
 * The AI then only matches each mall and location to a screen on the site.
 */

export interface SiteRow {
  readonly no: number;
  /** The document's own reference: site number, package code. */
  readonly siteNo: string;
  readonly town: string;
  readonly mall: string;
  readonly location: string;
  readonly size: string;
  /** YYYY-MM-DD, or null. */
  readonly start: string | null;
  readonly end: string | null;
}

const MONTHS: Record<string, string> = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };

/** "04 Feb 2026", "2026-02-04", "4/2/2026" (day first) → "2026-02-04". */
export function isoDate(raw: string): string | null {
  const s = raw.trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[ -]([A-Za-z]{3})[a-z]*[ -](\d{4})$/);
  if (m && MONTHS[m[2].toLowerCase()]) return `${m[3]}-${MONTHS[m[2].toLowerCase()]}-${m[1].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

const tidy = (s: string) => s.replace(/\s+/g, ' ').replace(/^[\s.,;:-]+|[\s.,;:-]+$/g, '');

/** "Walmer Park, LL Entrance 3 …" → mall "Walmer Park", location "LL Entrance 3 …". */
function splitMall(text: string): { mall: string; location: string } {
  const t = tidy(text);
  const at = t.search(/[,;]| - |\s-\s|\s–\s/);
  if (at < 0) return { mall: t, location: '' };
  return { mall: tidy(t.slice(0, at)), location: tidy(t.slice(at + 1)) };
}

/* ---------- Tables (Excel, CSV) ---------- */

function cellsOf(line: string): string[] {
  if (line.includes('\t')) return line.split('\t').map((c) => c.trim());
  // CSV: commas outside quotes.
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === ',' && !quoted) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

type Column = keyof Omit<SiteRow, 'no'> | 'package' | 'format' | 'pixelWidth' | 'pixelHeight';

/** Heading names per column. The first heading that fits a column takes it. */
const COLUMNS: Partial<Record<Column, RegExp>> = {
  siteNo: /^(site ?(no|num|number|code|id|ref)|code|ref(erence)?|panel ?(no|id))\b/i,
  // A package name ("Cape Gate - Digi Impact Package 01 {CA02}"): the reference only when there's no site code.
  package: /^package\b/i,
  location: /^(location|site ?name|description|desc|screen|position)\b/i,
  mall: /^(area|mall|centre|center|venue|property)\b/i,
  town: /^(town|city|region|province|suburb)\b/i,
  // Pixels, never millimetres: PIMS also lists "Display Height (mm)" and "Display Width (mm)", which aren't the artwork size.
  pixelWidth: /^(pix(c)?els? ?width|width ?\(?(px|pixels?)\)?|res(olution)? ?width)\b/i,
  pixelHeight: /^(pix(c)?els? ?height|height ?\(?(px|pixels?)\)?|res(olution)? ?height)\b/i,
  size: /^(size|dimensions?|resolution|pix(c)?els?)\b(?! ?(width|height|pitch))(?!.*\b(mm|sqr|m2|metres?|meters?)\b)/i,
  format: /^(media ?(format|type)|format)\b/i,
  start: /^(start|from|flt ?from|flight ?from|start ?date|on ?air)\b/i,
  end: /^(end|to|flt ?to|flight ?to|end ?date|off ?air)\b/i,
};

/** A pixel count from a cell: "1920", "1 920", "1920px". */
const px = (v: string) => {
  const n = Number(v.replace(/[\s,]|px$/gi, ''));
  return Number.isInteger(n) && n >= 16 && n <= 20000 ? n : null;
};

/** "1920 x 1080", "1920×1080px" → "1920x1080"; anything else as written. */
const sizeText = (v: string, heightFirst = false) => {
  const m = v.match(/^\s*(\d[\d ]{1,5})\s*(?:px)?\s*[x×*]\s*(\d[\d ]{1,5})\s*(?:px)?\s*$/i);
  if (!m) return v; // "Various", "1.92m X 1.08m", "3840m X 2160m": not a pixel size.
  const [a, b] = [m[1].replace(/ /g, ''), m[2].replace(/ /g, '')];
  return heightFirst ? `${b}x${a}` : `${a}x${b}`;
};

/** "Cape Gate - Digital Impact Checkers Court - Package 01  {CH20}" → "Digital Impact Checkers Court". */
function packagePlace(name: string, mall: string): string {
  let t = tidy(name.replace(/\{[^}]*\}/g, ''));
  const first = mall.toLowerCase().replace(/\s+mall$/, '').split(' ')[0];
  const dash = t.search(/\s*-\s*/);
  if (first && dash > 0 && t.slice(0, dash).toLowerCase().includes(first)) t = t.slice(dash).replace(/^\s*-\s*/, '');
  return tidy(t.replace(/\s*-?\s*package\s*\d+\s*$/i, ''));
}

function fromTable(text: string): SiteRow[] {
  const lines = text.split('\n');
  for (let h = 0; h < lines.length; h += 1) {
    const head = cellsOf(lines[h]);
    if (head.filter(Boolean).length < 2) continue;
    const col: Partial<Record<Column, number>> = {};
    head.forEach((name, i) => {
      for (const [key, re] of Object.entries(COLUMNS) as [Column, RegExp][]) {
        if (col[key] === undefined && re.test(name)) {
          col[key] = i;
          break;
        }
      }
    });
    const ref = col.siteNo ?? col.package;
    if (col.location === undefined && ref === undefined) continue;
    if (col.location === undefined && col.mall === undefined && col.format === undefined && col.pixelWidth === undefined) continue;
    // "Size(HxW)": height first, so turned round to width × height.
    const heightFirst = col.size !== undefined && /\bh\s*[x×]\s*w\b/i.test(head[col.size] ?? '');
    const rows: SiteRow[] = [];
    // PIMS reports put each mall on a row of its own above its sites, and name a package only on its first site.
    let section = '';
    let pkg = '';
    for (const line of lines.slice(h + 1)) {
      const c = cellsOf(line);
      const get = (k: Column) => (col[k] === undefined ? '' : tidy(c[col[k]!] ?? ''));
      if (/^(total|sub ?total|grand total)\b/i.test(c.find(Boolean) ?? '') || /^---/.test(line)) break;
      const filled = c.filter(Boolean);
      const reference = col.siteNo !== undefined ? get('siteNo') : '';
      if (filled.length === 1 && !reference && !get('location') && !get('mall')) {
        section = tidy(filled[0]);
        pkg = '';
        continue;
      }
      if (!get('location') && !reference && !get('package') && !get('mall')) continue;
      if (get('package')) pkg = get('package');
      const split = splitMall(get('location'));
      const mall = get('mall') || section || split.mall;
      const place = get('mall') || section ? get('location') : split.location || get('location');
      const w = px(get('pixelWidth'));
      const hgt = px(get('pixelHeight'));
      rows.push({
        no: rows.length + 1,
        siteNo: (reference || get('package')).replace(/^package[\s-]*/i, ''),
        town: get('town'),
        mall,
        location: place || (pkg ? packagePlace(pkg, mall) : '') || get('format'),
        size: w && hgt ? `${w}x${hgt}` : sizeText(get('size'), heightFirst),
        start: isoDate(get('start')),
        end: isoDate(get('end')),
      });
    }
    if (rows.length) return rows;
  }
  return [];
}

/* ---------- Printed site lists (PDF) ---------- */

const DATE = String.raw`\d{1,2} [A-Z][a-z]{2} \d{4}`;
/** "… Port Elizabeth (Malls) WAL/MAPP/001/02 Walmer Park, LL Entrance 3 … .04 Feb 2026 28 Feb 2026" */
const PRINTED = new RegExp(
  String.raw`(?:^|\d|\s)\s*([A-Z][A-Za-z .'&()-]{1,60}?)\s+([A-Z]{2,5}/[A-Z0-9]{2,6}/[A-Z0-9]{1,5}/[A-Z0-9]{1,5})\s+(.+?)\s*\.?\s*(${DATE})\s+(${DATE})`,
  'g',
);

function fromPrinted(text: string): SiteRow[] {
  const flat = text.replace(/\s+/g, ' ');
  const rows: SiteRow[] = [];
  for (const m of flat.matchAll(PRINTED)) {
    const split = splitMall(m[3]);
    rows.push({
      no: rows.length + 1,
      siteNo: m[2],
      town: tidy(m[1].replace(/\b(Daily|Plays|Client|Poster|Post Date|Flt (To|From))\b/g, '')),
      mall: split.mall,
      location: split.location,
      size: '',
      // "Flt To" may be printed before "Flt From": the earlier date is the start.
      start: [isoDate(m[4]), isoDate(m[5])].sort()[0] ?? null,
      end: [isoDate(m[4]), isoDate(m[5])].sort()[1] ?? null,
    });
  }
  return withoutComment(rows, /\bcomment\b/i.test(flat));
}

/**
 * Reports with a Comment column print it straight after the location
 * ("…Hi Fi Corp,Edgars Cell c"): the same words at the end of every row are
 * the comment, not part of the place. Never strips a whole location.
 */
function withoutComment<T extends { location: string }>(rows: T[], hasComment: boolean): T[] {
  if (!hasComment || rows.length < 2) return rows;
  let tail = rows[0].location;
  for (const r of rows) {
    let n = 0;
    while (n < tail.length && n < r.location.length && tail[tail.length - 1 - n].toLowerCase() === r.location[r.location.length - 1 - n].toLowerCase()) n += 1;
    tail = tail.slice(tail.length - n);
  }
  const cut = tail.trim();
  if (cut.length < 3 || !/[a-z]/i.test(cut) || rows.some((r) => tidy(r.location).length <= cut.length)) return rows;
  return rows.map((r) => ({ ...r, location: tidy(r.location.slice(0, r.location.length - tail.length)) }));
}

/** Every site the document lists, in order; empty when it isn't a site list. */
export function parseSiteRows(text: string): SiteRow[] {
  const table = fromTable(text);
  if (table.length >= 1) return table;
  const printed = fromPrinted(text);
  return printed.length >= 2 ? printed : [];
}

/** Sites grouped by mall and the first part of their location, for matching to screens. */
export function siteGroups(rows: readonly SiteRow[]): { key: string; mall: string; location: string; size: string; count: number }[] {
  const groups = new Map<string, { key: string; mall: string; location: string; size: string; count: number }>();
  for (const r of rows) {
    const head = r.location.split(/[,;:]/)[0]?.trim() ?? '';
    const key = `${r.mall.toLowerCase()}|${head.toLowerCase()}`;
    const g = groups.get(key);
    if (g) g.count += 1;
    else groups.set(key, { key, mall: r.mall, location: head, size: r.size, count: 1 });
  }
  return [...groups.values()];
}

export const groupKeyOf = (r: SiteRow) => `${r.mall.toLowerCase()}|${(r.location.split(/[,;:]/)[0]?.trim() ?? '').toLowerCase()}`;
