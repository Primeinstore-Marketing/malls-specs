import type { Specification } from '@data-model';
import { formatAspectRatio, getScreenSize } from './malls';

/**
 * What artwork to supply for a screen. The dimensions come straight from the
 * screen's resolution — artwork must match it pixel for pixel. Formats, file
 * size and duration are suggested defaults until an admin sets them on the
 * spec (as metadata fields `fileFormats`, `maxFileSize`, `videoFormats`,
 * `duration`), and are marked as suggestions when they're defaults.
 */

export interface ArtworkGuideItem {
  readonly label: string;
  readonly value: string;
  /** True when this is our default, not something set on the spec. */
  readonly suggested: boolean;
}

export interface ArtworkGuide {
  readonly width: number | null;
  readonly height: number | null;
  readonly items: readonly ArtworkGuideItem[];
}

function field(spec: Specification, key: string): string | null {
  const value = spec.metadata.find((candidate) => candidate.key === key)?.value;
  return value && value.trim() ? value.trim() : null;
}

/**
 * A comfortable ceiling for a high-quality JPEG at this resolution
 * (about 0.75 bytes per pixel), rounded up to a whole MB.
 */
export function suggestedMaxFileSizeMb(width: number, height: number): number {
  return Math.max(1, Math.ceil((width * height * 0.75) / 1_000_000));
}

export function getArtworkGuide(spec: Specification): ArtworkGuide {
  const size = getScreenSize(spec);
  const items: ArtworkGuideItem[] = [];

  if (size) {
    items.push({ label: 'Artwork size', value: `${size.width} × ${size.height} px`, suggested: false });
    items.push({ label: 'Aspect ratio', value: formatAspectRatio(size), suggested: false });
    items.push({
      label: 'Orientation',
      value: size.width === size.height ? 'Square' : size.width > size.height ? 'Landscape' : 'Portrait',
      suggested: false,
    });
  } else {
    items.push({ label: 'Artwork size', value: 'To be confirmed — ask the mall', suggested: false });
  }

  const formats = field(spec, 'fileFormats');
  items.push({ label: 'Still formats', value: formats ?? 'JPG or PNG, RGB, 72 ppi', suggested: !formats });

  const video = field(spec, 'videoFormats');
  items.push({ label: 'Motion formats', value: video ?? 'MP4 (H.264), no audio', suggested: !video });

  const maxSize = field(spec, 'maxFileSize');
  if (maxSize) items.push({ label: 'Max file size', value: maxSize, suggested: false });
  else if (size) items.push({ label: 'Max file size', value: `${suggestedMaxFileSizeMb(size.width, size.height)} MB for stills`, suggested: true });

  const duration = field(spec, 'duration');
  if (duration) items.push({ label: 'Duration', value: duration, suggested: false });

  return { width: size?.width ?? null, height: size?.height ?? null, items };
}

/** Whether an uploaded image matches the screen, for the editor's check. */
export function matchesScreen(spec: Specification, width: number | null, height: number | null): boolean | null {
  const size = getScreenSize(spec);
  if (!size || width == null || height == null) return null;
  return size.width === width && size.height === height;
}
