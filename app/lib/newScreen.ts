import {
  asCategoryId,
  asMetadataFieldId,
  asSpecificationId,
  asSubGroupId,
  emptyMetadataField,
  emptySpecification,
  slugify,
} from '@data-model';
import type { MetadataField, Specification } from '@data-model';
import { getMallFiling } from './malls';

/**
 * A new screen for a mall, as a complete spec record: a title and its size
 * in pixels. Pictures, files and the artwork guide are added afterwards in
 * the screen's editor. Saved with api.putSpec(spec, { mallId, isNew: true }).
 */
export function newScreenSpec({
  mallId,
  mallName,
  title,
  width,
  height,
  takenIds,
  by,
}: {
  mallId: string;
  mallName: string;
  title: string;
  width: number | null;
  height: number | null;
  takenIds: ReadonlySet<string>;
  by: string;
}): Specification {
  const stem = `spec-${slugify(`${mallName} ${title}`)}`.slice(0, 90).replace(/-+$/, '');
  let id = stem;
  for (let n = 2; takenIds.has(id); n += 1) id = `${stem}-${n}`;
  const key = id.replace(/^spec-/, '');
  const filing = getMallFiling(mallId);
  const now = new Date().toISOString();
  const dim = (k: 'width' | 'height', value: number | null, order: number): MetadataField => ({
    ...emptyMetadataField(asMetadataFieldId(`field-${key}-${k}`), k, k === 'width' ? 'Width' : 'Height', order),
    type: 'dimension',
    unit: 'px',
    indexed: true,
    value: value != null ? String(value) : null,
  });
  return {
    ...emptySpecification(asSpecificationId(id)),
    slug: slugify(`${mallName} ${title}`),
    title,
    categoryId: filing ? asCategoryId(filing.categoryId) : null,
    subGroupId: filing?.subGroupId ? asSubGroupId(filing.subGroupId) : null,
    metadata: [dim('width', width, 0), dim('height', height, 1)],
    searchText: `${mallName} ${title}`,
    status: 'published',
    version: 1,
    publishedAt: now,
    createdAt: now,
    updatedAt: now,
    createdBy: by as Specification['createdBy'],
    updatedBy: by as Specification['updatedBy'],
  };
}
