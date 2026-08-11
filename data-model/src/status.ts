/**
 * Specification lifecycle.
 *
 * The reference system has no status concept at all — a specification simply
 * exists, or it has been archived. These five states are the confirmed
 * vocabulary, and the transition map below is what makes the lifecycle
 * enforced rather than merely drawn.
 */

export const SPEC_STATUSES = [
  'draft',
  'in_review',
  'published',
  'deprecated',
  'superseded',
] as const;

export type SpecStatus = (typeof SPEC_STATUSES)[number];

export interface StatusMeta {
  readonly id: SpecStatus;
  readonly label: string;
  /** Maps to the semantic token set in the design system. */
  readonly tone: 'neutral' | 'warning' | 'success' | 'danger' | 'info';
  /** Terminal states cannot transition onward except by forking a new revision. */
  readonly terminal: boolean;
  /** Whether a record in this state is offered to unauthenticated readers. */
  readonly publiclyVisible: boolean;
  /** Whether this state requires a link to the replacing specification. */
  readonly requiresReplacement: boolean;
}

export const STATUS_META: Readonly<Record<SpecStatus, StatusMeta>> = {
  draft:      { id: 'draft',      label: 'Draft',      tone: 'neutral', terminal: false, publiclyVisible: false, requiresReplacement: false },
  in_review:  { id: 'in_review',  label: 'In review',  tone: 'warning', terminal: false, publiclyVisible: false, requiresReplacement: false },
  published:  { id: 'published',  label: 'Published',  tone: 'success', terminal: false, publiclyVisible: true,  requiresReplacement: false },
  deprecated: { id: 'deprecated', label: 'Deprecated', tone: 'danger',  terminal: false, publiclyVisible: true,  requiresReplacement: false },
  superseded: { id: 'superseded', label: 'Superseded', tone: 'info',    terminal: true,  publiclyVisible: true,  requiresReplacement: true },
};

/**
 * Permitted transitions. Anything not listed here is rejected by the
 * invariant checker, so an illegal state change cannot be persisted.
 *
 * Note that nothing returns to draft. Once published, a specification is a
 * document other people rely on; correcting it means a new revision, not a
 * silent regression to an unpublished state.
 */
export const STATUS_TRANSITIONS: Readonly<Record<SpecStatus, readonly SpecStatus[]>> = {
  draft:      ['in_review', 'published'],
  in_review:  ['draft', 'published'],
  published:  ['deprecated', 'superseded'],
  deprecated: ['published'],
  superseded: [],
};

export const canTransition = (from: SpecStatus, to: SpecStatus): boolean =>
  STATUS_TRANSITIONS[from].includes(to);

/** The state every new specification starts in. */
export const DEFAULT_STATUS: SpecStatus = 'draft';
