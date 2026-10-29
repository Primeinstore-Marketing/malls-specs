import type {
  SpecificationId, CategoryId, SubGroupId, TagId, AssetId, RevisionId,
} from './ids';
import type { Audited, Archivable, Slug } from './common';
import type { SpecStatus } from './status';
import type { SpecBlock, MetadataField } from './content';

/** One physical panel of a multi-panel screen, in artwork pixels from the canvas's top-left. */
export interface ScreenPanel {
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * How a screen that isn't one plain rectangle is built: several panels in
 * one artwork canvas (e.g. five stepped portrait panels), and/or marked
 * content zones within a panel. Part of the spec record, so it's edited as
 * data like everything else — not kept in code.
 */
export interface ScreenLayout {
  readonly panels: readonly ScreenPanel[];
  /** Areas within the panels that content must stay inside, drawn dashed. */
  readonly zones?: readonly ScreenPanel[];
  /** A short description for the size chips, e.g. "5 portrait panels". */
  readonly summary: string;
  /** Size of each panel, when they're all the same. */
  readonly panelSize: { readonly width: number; readonly height: number } | null;
  /** The vertical band every panel covers — keep titles inside it. */
  readonly commonBand: { readonly top: number; readonly bottom: number } | null;
  /** Safe margin inside each panel, in px. */
  readonly safeMargin: number | null;
  /** One line on how the panels are arranged. */
  readonly arrangement: string;
}

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
  /** Panel layout, for screens made of several panels or zones. Absent for a plain rectangle. */
  readonly screenLayout?: ScreenLayout | null;

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
