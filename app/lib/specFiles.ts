import type { Asset, Catalogue, Specification } from '@data-model';
import { getAssets } from '@/lib/catalogue';
import { getMalls, getScreenSize } from '@/lib/malls';

/**
 * A screen's spec sheet (PDF) and After Effects template. Many mall screens
 * share a network format (Digi Engage, Digital Impact, Digi Icon TV) and have
 * no files of their own: those borrow the network format's files, when it is
 * the same size (a name match, e.g. "Digi Engage", wins between equals). A
 * screen with no files and no same-size format has none.
 */
export interface SpecFiles {
  readonly sheet: Asset | null;
  readonly template: Asset | null;
  /** The network format the files came from, when they aren't the screen's own. */
  readonly from: Specification | null;
}

const isSheet = (a: Asset) => a.mimeType === 'application/pdf';
const isTemplate = (a: Asset) => /aftereffects/i.test(a.mimeType) || /\.aep$/i.test(a.filename);
const words = (s: string) => s.toLowerCase().replace(/[^a-z]+/g, ' ').replace(/\b(hd|4k|uhd|screen|screens|the)\b/g, ' ').trim().split(/\s+/).filter(Boolean);

function own(spec: Specification, catalogue: Catalogue) {
  const files = getAssets([...spec.downloadIds, ...spec.attachmentIds], catalogue);
  return { sheet: getAssets(spec.downloadIds, catalogue).find(isSheet) ?? null, template: files.find(isTemplate) ?? null };
}

export function specFiles(spec: Specification, catalogue: Catalogue): SpecFiles {
  const mine = own(spec, catalogue);
  if (mine.sheet || mine.template) return { ...mine, from: null };
  const size = getScreenSize(spec);
  if (!size) return { ...mine, from: null };
  const formats = getMalls(catalogue)
    .filter((m) => m.group === 'formats')
    .flatMap((m) => m.specIds)
    .map((id) => catalogue.specifications[id])
    .filter((f): f is Specification => Boolean(f) && f.id !== spec.id)
    .filter((f) => {
      const s = getScreenSize(f);
      return s?.width === size.width && s?.height === size.height;
    });
  const title = words(spec.title);
  const score = (f: Specification) => words(f.title).filter((w) => title.includes(w)).length;
  const best = [...formats].sort((a, b) => score(b) - score(a)).find((f) => own(f, catalogue).sheet || own(f, catalogue).template);
  return best ? { ...own(best, catalogue), from: best } : { ...mine, from: null };
}
