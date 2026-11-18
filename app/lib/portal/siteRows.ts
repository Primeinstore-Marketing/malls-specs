/**
 * Reads the rows of a site list, booking sheet or price list in the browser,
 * without AI. The same rules as the API's reader (api/src/siteList.ts), plus
 * a price column, so:
 *  - a site list still becomes a site list when the AI can't be reached
 *    (every row kept; rows the site can match by code get their screen);
 *  - prices in the document (rate, price, cost or amount) fill the rate card.
 * Tables come from Excel or CSV as tab- or comma-separated text; printed
 * site lists (PDF reports) by their site codes and flight dates.
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
  /** The document's price for the row, in rand, when it has one. */
  readonly rate: number | null;
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

/** "R 4 650,00", "4650.00", "R4,650", "4 650" → 4650. Not a price → null. */
export function readPrice(raw: string): number | null {
  let t = raw.replace(/\s|R|ZAR/gi, '');
  if (!t || !/\d/.test(t)) return null;
  // A comma before the last two digits is a decimal comma; other commas group thousands.
  t = t.replace(/,(\d{1,2})$/, '.$1').replace(/,/g, '');
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

const tidy = (s: string) => s.replace(/\s+/g, ' ').replace(/^[\s.,;:-]+|[\s.,;:-]+$/g, '');

/** "Walmer Park, LL Entrance 3 …" → mall "Walmer Park", location "LL Entrance 3 …". */
function splitMall(text: string): { mall: string; location: string } {
  const t = tidy(text);
  const at = t.search(/[,;]| - |\s-\s|\s–\s/);
  if (at < 0) return { mall: t, location: '' };
  return { mall: tidy(t.slice(0, at)), location: tidy(t.slice(at + 1)) };
}

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

const COLUMNS: Record<keyof Omit<SiteRow, 'no'>, RegExp> = {
  siteNo: /^(site ?(no|num|number|code|id|ref)|package|code|ref(erence)?|panel ?(no|id))\b/i,
  location: /^(location|site ?name|description|desc|screen|position)\b/i,
  mall: /^(area|mall|centre|center|venue|property)\b/i,
  town: /^(town|city|region|province|suburb)\b/i,
  size: /^(size|dimensions?|format|resolution)\b/i,
  start: /^(start|from|flt ?from|flight ?from|start ?date|on ?air)\b/i,
  end: /^(end|to|flt ?to|flight ?to|end ?date|off ?air)\b/i,
  // The price before discount: "Rate", "Rate card", "Price", "Cost", "Amount", "Gross"; not "Net" or "Total".
  rate: /^(rate( ?card)?|price|cost|amount|gross|media ?(rate|cost))\b/i,
};

function fromTable(text: string): SiteRow[] {
  const lines = text.split('\n');
  for (let h = 0; h < lines.length; h += 1) {
    const head = cellsOf(lines[h]);
    if (head.length < 2) continue;
    const col: Partial<Record<keyof typeof COLUMNS, number>> = {};
    head.forEach((name, i) => {
      for (const [key, re] of Object.entries(COLUMNS) as [keyof typeof COLUMNS, RegExp][]) {
        if (col[key] === undefined && re.test(name)) {
          col[key] = i;
          break;
        }
      }
    });
    if (col.location === undefined && col.siteNo === undefined) continue;
    if (col.location === undefined && col.mall === undefined && col.rate === undefined) continue;
    const rows: SiteRow[] = [];
    for (const line of lines.slice(h + 1)) {
      const c = cellsOf(line);
      const get = (k: keyof typeof COLUMNS) => (col[k] === undefined ? '' : tidy(c[col[k]!] ?? ''));
      if (/^(total|sub ?total|grand total)\b/i.test(c[0] ?? '') || /^---/.test(line)) break;
      if (!get('location') && !get('siteNo') && !get('mall')) {
        if (rows.length) break;
        continue;
      }
      const split = splitMall(get('location'));
      rows.push({
        no: rows.length + 1,
        siteNo: get('siteNo').replace(/^package[\s-]*/i, ''),
        town: get('town'),
        mall: get('mall') || split.mall,
        location: get('mall') ? get('location') : split.location || get('location'),
        size: get('size'),
        start: isoDate(get('start')),
        end: isoDate(get('end')),
        rate: col.rate === undefined ? null : readPrice(c[col.rate] ?? ''),
      });
    }
    if (rows.length) return rows;
  }
  return [];
}

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
      start: isoDate(m[4]),
      end: isoDate(m[5]),
      rate: null,
    });
  }
  return rows;
}

/** Every site the document lists, in order; empty when it isn't a site list. */
export function parseSiteRows(text: string): SiteRow[] {
  const table = fromTable(text);
  if (table.length >= 1) return table;
  const printed = fromPrinted(text);
  return printed.length >= 2 ? printed : [];
}

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9/]+/g, ' ').trim();

/**
 * The price for a campaign line from a priced document's rows: by site
 * number first, then by mall and location, then by screen name.
 */
export function priceFor(
  line: { readonly siteNo?: string; readonly mall?: string; readonly location?: string; readonly title?: string },
  rows: readonly SiteRow[],
): number | null {
  const priced = rows.filter((r) => r.rate != null);
  if (!priced.length) return null;
  const no = norm(line.siteNo ?? '');
  if (no) {
    const hit = priced.find((r) => norm(r.siteNo) === no);
    if (hit) return hit.rate;
  }
  const mall = norm(line.mall ?? '');
  const loc = norm(line.location ?? line.title ?? '');
  if (mall && loc) {
    const hit = priced.find((r) => {
      const where = norm(r.location);
      return norm(r.mall).includes(mall.split(' ')[0]) && (where.includes(loc) || (where.length > 2 && loc.includes(where)));
    });
    if (hit) return hit.rate;
  }
  const title = norm(line.title ?? '');
  if (title) {
    const hit = priced.find((r) => {
      const where = norm(`${r.mall} ${r.location}`);
      return where.includes(title) && (!mall || where.includes(mall.split(' ')[0]));
    });
    if (hit) return hit.rate;
  }
  return null;
}
