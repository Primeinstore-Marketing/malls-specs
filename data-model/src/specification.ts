import type {
  SpecificationId, CategoryId, SubGroupId, TagId, AssetId, RevisionId,
} from './ids';
import type { Audited, Archivable, Slug } from './common';
import type { SpecStatus } from './status';
import type { SpecBlock, MetadataField } from './content';

/**
 * The leaf record. Everything else in the model exists to organise, describe
 * or version one of these.
 *
 * Twelve sections, matching the Phase 1 information architecture and the
 * Phase 2 wireframes. Every field ships empty.
 */
export interface Specification extends Audited, Archivable {
  readonly id: SpecificationId;

  // ── identity ────────────────────────────────────────────────────────
  readonly title: string;
  readonly slug: Slug;
  /**
   * Reference code. Free text, optional, no enforced format — confirmed.
   * Displayed as the code chip. Uniqueness is advisory, not enforced,
   * so an existing external numbering scheme can be entered as-is.
   */
  readonly code: string;
  readonly description: string;

  // ── classification ──────────────────────────────────────────────────
  /** Exclusive — a specification belongs to exactly one category. Confirmed. */
  readonly categoryId: CategoryId | null;
  /** The nullable middle tier. */
  readonly subGroupId: SubGroupId | null;
  readonly tagIds: readonly TagId[];

  // ── lifecycle ───────────────────────────────────────────────────────
  readonly status: SpecStatus;
  /** Required when status is 'superseded'. Enforced by the invariant checker. */
  readonly supersededById: SpecificationId | null;
  /** Monotonic. Incremented on every published revision. */
  readonly version: number;
  readonly publishedAt: string | null;

  // ── body ────────────────────────────────────────────────────────────
  /** Technical specifications, requirements, notes and anything else the
   *  category template defines. Ordered, labelled, anchor-addressable. */
  readonly blocks: readonly SpecBlock[];
  /** Dynamic key/value pairs — confirmed structure. */
  readonly metadata: readonly MetadataField[];

  // ── files ───────────────────────────────────────────────────────────
  readonly mediaIds: readonly AssetId[];
  readonly downloadIds: readonly AssetId[];
  readonly attachmentIds: readonly AssetId[];

  // ── relationships ───────────────────────────────────────────────────
  readonly relatedIds: readonly SpecificationId[];

  // ── history ─────────────────────────────────────────────────────────
  readonly revisionIds: readonly RevisionId[];
  readonly currentRevisionId: RevisionId | null;

  // ── search ──────────────────────────────────────────────────────────
  /** Derived. Recomputed on save, never authored. */
  readonly searchText: string;
}

export const emptySpecification = (id: SpecificationId): Specification => ({
  id,
  title: '', slug: '', code: '', description: '',
  categoryId: null, subGroupId: null, tagIds: [],
  status: 'draft', supersededById: null, version: 0, publishedAt: null,
  blocks: [], metadata: [],
  mediaIds: [], downloadIds: [], attachmentIds: [],
  relatedIds: [],
  revisionIds: [], currentRevisionId: null,
  searchText: '',
  createdAt: null, createdBy: null, updatedAt: null, updatedBy: null,
  archivedAt: null, archivedBy: null,
});

/** The shape a list row needs. Avoids loading blocks and assets to draw a table. */
export interface SpecificationSummary {
  readonly id: SpecificationId;
  readonly title: string;
  readonly code: string;
  readonly description: string;
  readonly categoryId: CategoryId | null;
  readonly subGroupId: SubGroupId | null;
  readonly tagIds: readonly TagId[];
  readonly status: SpecStatus;
  readonly version: number;
  readonly thumbnailId: AssetId | null;
  readonly updatedAt: string | null;
}

export const toSummary = (s: Specification): SpecificationSummary => ({
  id: s.id, title: s.title, code: s.code, description: s.description,
  categoryId: s.categoryId, subGroupId: s.subGroupId, tagIds: s.tagIds,
  status: s.status, version: s.version,
  thumbnailId: s.mediaIds[0] ?? null, updatedAt: s.updatedAt,
});
