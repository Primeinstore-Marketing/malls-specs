import type { RevisionId, SpecificationId, UserId } from './ids';
import type { Timestamp } from './common';
import type { SpecStatus } from './status';

/**
 * Revision history with field-level diffs — confirmed.
 *
 * A revision is written automatically on every save. History that depends on
 * the author remembering to record it will not be maintained, so it is a
 * by-product of authoring rather than a separate chore.
 */

/** Dotted path into the specification, e.g. "blocks.2.lines.4.text". */
export type FieldPath = string;

export type ChangeKind = 'added' | 'removed' | 'changed';

export interface FieldChange {
  readonly path: FieldPath;
  /** Human label for the diff view, e.g. "Technical specifications · line 5". */
  readonly label: string;
  readonly kind: ChangeKind;
  /** Serialised previous and next values. Null on added / removed respectively. */
  readonly before: string | null;
  readonly after: string | null;
}

export interface Revision {
  readonly id: RevisionId;
  readonly specificationId: SpecificationId;
  /** Monotonic per specification, starting at 1. */
  readonly version: number;
  readonly createdAt: Timestamp | null;
  readonly createdBy: UserId | null;
  /** Author-supplied, optional. Falls back to a generated summary of changes. */
  readonly summary: string;
  /** Status at the time this revision was written. */
  readonly status: SpecStatus;
  /** Whether this revision was a publish event rather than a draft save. */
  readonly published: boolean;
  readonly changes: readonly FieldChange[];
  /**
   * Full snapshot, so a revision can be restored without replaying diffs.
   * Serialised to keep Revision free of a circular type reference.
   */
  readonly snapshot: string | null;
}

export const emptyRevision = (id: RevisionId, specificationId: SpecificationId): Revision => ({
  id, specificationId, version: 0,
  createdAt: null, createdBy: null,
  summary: '', status: 'draft', published: false,
  changes: [], snapshot: null,
});

/** Generated when the author supplies no summary. */
export function describeChanges(changes: readonly FieldChange[]): string {
  if (changes.length === 0) return 'No changes';
  const byKind = { added: 0, removed: 0, changed: 0 } as Record<ChangeKind, number>;
  for (const c of changes) byKind[c.kind]++;
  const parts: string[] = [];
  if (byKind.changed) parts.push(`${byKind.changed} changed`);
  if (byKind.added) parts.push(`${byKind.added} added`);
  if (byKind.removed) parts.push(`${byKind.removed} removed`);
  return parts.join(' · ');
}
