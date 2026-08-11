import type { BlockId, MetadataFieldId } from './ids';
import type { SortOrder } from './common';

/**
 * Specification body content.
 *
 * The reference system stores technical, artwork and printing specifications as
 * arrays of strings, parsed one item per line, with a leading double asterisk
 * marking a sub-heading. That convention works and authors are used to it, so it
 * is preserved — but it is modelled explicitly here rather than left implicit in
 * a parser, so the structure survives round-tripping.
 */

export type BlockLineKind = 'item' | 'subheading';

export interface BlockLine {
  readonly kind: BlockLineKind;
  readonly text: string;
  /**
   * An inline reference callout, rendered in the accent colour.
   * The reference system writes these as *[CODE] inside the line.
   */
  readonly reference: string | null;
}

/**
 * A titled run of lines. Blocks are ordered and their labels are authored, so a
 * category can carry whatever block set its domain needs — "Technical
 * specifications", "Requirements", "Notes" are conventions, not schema.
 */
export interface SpecBlock {
  readonly id: BlockId;
  readonly label: string;
  readonly lines: readonly BlockLine[];
  /** Renders as two columns, as in the reference system's toggle. */
  readonly twoColumn: boolean;
  readonly order: SortOrder;
  /** Anchor target for the rail. Derived from the label. */
  readonly anchorId: string;
}

export const emptyBlock = (id: BlockId, label: string, order: SortOrder): SpecBlock => ({
  id, label, lines: [], twoColumn: false, order, anchorId: '',
});

/**
 * Dynamic metadata — the confirmed structure.
 *
 * Fields are key/value pairs authored per specification, or inherited from the
 * category's template. Adding a field never requires a code change or a
 * migration, which is the whole point of the reusable platform.
 */
export type MetadataValueType =
  | 'text'
  | 'number'
  | 'date'
  | 'boolean'
  | 'dimension'
  | 'url'
  | 'user';

export interface MetadataField {
  readonly id: MetadataFieldId;
  /** Stable machine key. Survives a label rename. */
  readonly key: string;
  readonly label: string;
  readonly type: MetadataValueType;
  /** Null means empty. Every field ships null. */
  readonly value: string | null;
  /** For dimension and number types. */
  readonly unit: string | null;
  readonly order: SortOrder;
  /** Inherited from the category template rather than authored on the record. */
  readonly inherited: boolean;
  /** Surfaced in list columns and search facets. */
  readonly indexed: boolean;
}

export const emptyMetadataField = (
  id: MetadataFieldId, key: string, label: string, order: SortOrder,
): MetadataField => ({
  id, key, label, type: 'text', value: null, unit: null,
  order, inherited: false, indexed: false,
});

/** A category's metadata template. New specifications inherit a copy. */
export interface MetadataTemplate {
  readonly fields: readonly Omit<MetadataField, 'value'>[];
}

export const emptyMetadataTemplate = (): MetadataTemplate => ({ fields: [] });
