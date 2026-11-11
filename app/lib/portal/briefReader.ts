/**
 * Turns a client's brief into something the AI can read, in the browser:
 *  - PDF and images are sent as they are (the AI reads them directly);
 *  - Word (.docx), PowerPoint (.pptx) and Excel (.xlsx) are opened here —
 *    they're zip files of XML — and their text is sent;
 *  - CSV, text and Markdown are sent as text.
 * Old binary formats (.doc, .ppt, .xls) can't be read: save as the newer
 * format or PDF first.
 */

export type BriefPayload =
  | { readonly kind: 'pdf'; readonly pdf: string }
  | { readonly kind: 'image'; readonly image: { data: string; mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif' } }
  | { readonly kind: 'text'; readonly text: string };

export const BRIEF_ACCEPT = '.pdf,.docx,.pptx,.xlsx,.csv,.txt,.md,.png,.jpg,.jpeg,.webp';
export const MAX_BRIEF_MB = 8;

async function base64(file: Blob): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** The files inside a zip, by name, unpacked on demand (stored or deflated entries). */
async function unzip(buf: ArrayBuffer): Promise<Map<string, () => Promise<string>>> {
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);
  // End of central directory: last 0x06054b50 signature.
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65_557); i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('This file looks damaged. Save it again, or as a PDF, and try again.');
  const count = view.getUint16(eocd + 10, true);
  let at = view.getUint32(eocd + 16, true);
  const files = new Map<string, () => Promise<string>>();
  const decoder = new TextDecoder();
  for (let n = 0; n < count; n += 1) {
    if (view.getUint32(at, true) !== 0x02014b50) break;
    const method = view.getUint16(at + 10, true);
    const size = view.getUint32(at + 20, true);
    const nameLen = view.getUint16(at + 28, true);
    const extraLen = view.getUint16(at + 30, true);
    const commentLen = view.getUint16(at + 32, true);
    const local = view.getUint32(at + 42, true);
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLen));
    at += 46 + nameLen + extraLen + commentLen;
    files.set(name, async () => {
      const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
      const data = bytes.subarray(start, start + size);
      if (method === 0) return decoder.decode(data);
      if (method !== 8) throw new Error('This file uses a format we can’t open. Save it as a PDF and try again.');
      const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return decoder.decode(await new Response(stream).arrayBuffer());
    });
  }
  return files;
}

const unescape = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d))).replace(/&amp;/g, '&');

/** Text runs inside each paragraph element, one paragraph per line. */
function paragraphs(xml: string, para: string, run: string): string {
  const out: string[] = [];
  for (const p of xml.split(new RegExp(`<${para}[ >]`))) {
    const text = [...p.matchAll(new RegExp(`<${run}(?: [^>]*)?>([^<]*)</${run}>`, 'g'))].map((m) => unescape(m[1])).join('');
    if (text.trim()) out.push(text.trim());
  }
  return out.join('\n');
}

const byNumber = (a: string, b: string) => Number(a.match(/(\d+)\.xml$/)?.[1] ?? 0) - Number(b.match(/(\d+)\.xml$/)?.[1] ?? 0);

async function docx(files: Map<string, () => Promise<string>>): Promise<string> {
  const doc = files.get('word/document.xml');
  if (!doc) throw new Error('This doesn’t look like a Word document.');
  return paragraphs(await doc(), 'w:p', 'w:t');
}

async function pptx(files: Map<string, () => Promise<string>>): Promise<string> {
  const slides = [...files.keys()].filter((k) => /^ppt\/slides\/slide\d+\.xml$/.test(k)).sort(byNumber);
  if (!slides.length) throw new Error('This doesn’t look like a PowerPoint file.');
  const parts: string[] = [];
  for (const [i, name] of slides.entries()) {
    parts.push(`--- Slide ${i + 1} ---\n${paragraphs(await files.get(name)!(), 'a:p', 'a:t')}`);
    const notes = files.get(name.replace('slides/slide', 'notesSlides/notesSlide'));
    if (notes) {
      const t = paragraphs(await notes(), 'a:p', 'a:t');
      if (t) parts.push(`(Notes: ${t})`);
    }
  }
  return parts.join('\n');
}

async function xlsx(files: Map<string, () => Promise<string>>): Promise<string> {
  const sharedXml = files.get('xl/sharedStrings.xml');
  const shared = sharedXml ? (await sharedXml()).split('<si>').slice(1).map((si) => [...si.matchAll(/<t(?: [^>]*)?>([^<]*)<\/t>/g)].map((m) => unescape(m[1])).join('')) : [];
  const sheets = [...files.keys()].filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort(byNumber);
  if (!sheets.length) throw new Error('This doesn’t look like an Excel file.');
  const parts: string[] = [];
  for (const [i, name] of sheets.entries()) {
    const xml = await files.get(name)!();
    const rows = [...xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map((row) =>
      [...row[1].matchAll(/<c([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)]
        .map((c) => {
          const attrs = c[1] ?? '';
          const inner = c[2] ?? '';
          const v = inner.match(/<v>([^<]*)<\/v>/)?.[1] ?? inner.match(/<t(?: [^>]*)?>([^<]*)<\/t>/)?.[1] ?? '';
          return /t="s"/.test(attrs) ? shared[Number(v)] ?? '' : unescape(v);
        })
        .join('\t')
        .trim(),
    );
    parts.push(`--- Sheet ${i + 1} ---\n${rows.filter(Boolean).join('\n')}`);
  }
  return parts.join('\n');
}

export async function readBrief(file: File): Promise<BriefPayload> {
  if (file.size > MAX_BRIEF_MB * 1024 * 1024) throw new Error(`That file is over ${MAX_BRIEF_MB} MB. Save a smaller copy (or a PDF) and try again.`);
  const ext = file.name.toLowerCase().split('.').pop() ?? '';
  if (ext === 'pdf' || file.type === 'application/pdf') return { kind: 'pdf', pdf: await base64(file) };
  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) {
    const mediaType = (ext === 'jpg' ? 'image/jpeg' : `image/${ext}`) as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';
    return { kind: 'image', image: { data: await base64(file), mediaType } };
  }
  if (['csv', 'txt', 'md', 'tsv'].includes(ext)) return { kind: 'text', text: await file.text() };
  if (['doc', 'ppt', 'xls'].includes(ext)) throw new Error(`.${ext} is an old Office format we can’t open. Save it as .${ext}x or PDF and try again.`);
  if (['docx', 'pptx', 'xlsx'].includes(ext)) {
    if (typeof DecompressionStream === 'undefined') throw new Error('This browser can’t open Office files. Save the brief as a PDF, or use Chrome, Edge or Safari.');
    const files = await unzip(await file.arrayBuffer());
    const text = ext === 'docx' ? await docx(files) : ext === 'pptx' ? await pptx(files) : await xlsx(files);
    if (!text.trim()) throw new Error('We couldn’t find any text in that file. If it’s mostly pictures, save it as a PDF and try again.');
    return { kind: 'text', text };
  }
  throw new Error('Drop a PDF, Word, PowerPoint, Excel, CSV or image file.');
}
