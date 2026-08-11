/**
 * Referential and lifecycle rules, checked before anything is persisted.
 *
 * These are the guarantees the UI relies on. Drawing a lifecycle in a design
 * document is not the same as enforcing it; this is where it is enforced.
 */
import type { Catalogue } from './catalogue';
import type { Specification } from './specification';
import type { ValidationError, Result } from './common';
import { ok, fail } from './common';
import { canTransition, STATUS_META } from './status';
import type { SpecStatus } from './status';

const err = (path: string, code: ValidationError['code'], message: string): ValidationError =>
  ({ path, code, message });

/** Rules that must hold for a single specification within its catalogue. */
export function validateSpecification(spec: Specification, cat: Catalogue): ValidationError[] {
  const e: ValidationError[] = [];

  if (!spec.title.trim()) {
    e.push(err('title', 'required', 'Title is required.'));
  }
  if (!spec.categoryId) {
    e.push(err('categoryId', 'required', 'A specification must belong to exactly one category.'));
  } else if (!cat.categories[spec.categoryId]) {
    e.push(err('categoryId', 'not_found', 'Referenced category does not exist.'));
  }

  if (spec.subGroupId) {
    const sg = cat.subGroups[spec.subGroupId];
    if (!sg) {
      e.push(err('subGroupId', 'not_found', 'Referenced sub-group does not exist.'));
    } else if (spec.categoryId && sg.categoryId !== spec.categoryId) {
      e.push(err('subGroupId', 'orphaned', 'Sub-group belongs to a different category.'));
    }
  }

  for (const t of spec.tagIds) {
    if (!cat.tags[t]) e.push(err(`tagIds.${t}`, 'not_found', 'Referenced tag does not exist.'));
  }

  if (STATUS_META[spec.status].requiresReplacement && !spec.supersededById) {
    e.push(err('supersededById', 'missing_replacement',
      'A superseded specification must name the specification that replaces it.'));
  }
  if (spec.supersededById) {
    if (spec.supersededById === spec.id) {
      e.push(err('supersededById', 'self_reference', 'A specification cannot supersede itself.'));
    } else if (!cat.specifications[spec.supersededById]) {
      e.push(err('supersededById', 'not_found', 'Replacement specification does not exist.'));
    }
  }

  if (spec.relatedIds.includes(spec.id)) {
    e.push(err('relatedIds', 'self_reference', 'A specification cannot relate to itself.'));
  }
  for (const r of spec.relatedIds) {
    if (r !== spec.id && !cat.specifications[r]) {
      e.push(err(`relatedIds.${r}`, 'not_found', 'Related specification does not exist.'));
    }
  }

  for (const group of ['mediaIds', 'downloadIds', 'attachmentIds'] as const) {
    for (const a of spec[group]) {
      if (!cat.assets[a]) e.push(err(`${group}.${a}`, 'not_found', 'Referenced asset does not exist.'));
    }
  }

  const keys = new Set<string>();
  for (const f of spec.metadata) {
    if (keys.has(f.key)) e.push(err(`metadata.${f.key}`, 'duplicate', 'Duplicate metadata key.'));
    keys.add(f.key);
  }

  if (spec.version < 0) e.push(err('version', 'out_of_range', 'Version cannot be negative.'));

  return e;
}

export function validateTransition(from: SpecStatus, to: SpecStatus): Result<SpecStatus> {
  if (from === to) return ok(to);
  if (!canTransition(from, to)) {
    return fail([err('status', 'illegal_transition',
      `${STATUS_META[from].label} cannot move to ${STATUS_META[to].label}.`)]);
  }
  return ok(to);
}

/** Whole-catalogue check. Run on load and before export. */
export function validateCatalogue(cat: Catalogue): ValidationError[] {
  const e: ValidationError[] = [];

  for (const sg of Object.values(cat.subGroups)) {
    if (!cat.categories[sg.categoryId]) {
      e.push(err(`subGroups.${sg.id}.categoryId`, 'orphaned', 'Sub-group has no parent category.'));
    }
  }
  for (const spec of Object.values(cat.specifications)) {
    e.push(...validateSpecification(spec, cat));
  }
  for (const rev of Object.values(cat.revisions)) {
    if (!cat.specifications[rev.specificationId]) {
      e.push(err(`revisions.${rev.id}`, 'orphaned', 'Revision has no specification.'));
    }
  }
  const slugs = new Map<string, string>();
  for (const s of Object.values(cat.specifications)) {
    if (!s.slug) continue;
    const seen = slugs.get(s.slug);
    if (seen) e.push(err(`specifications.${s.id}.slug`, 'duplicate', `Slug collides with ${seen}.`));
    else slugs.set(s.slug, s.id);
  }
  return e;
}

/** Deleting a category that still holds specifications must reassign, never cascade. */
export function categoryDeletionBlockers(categoryId: string, cat: Catalogue): string[] {
  return Object.values(cat.specifications)
    .filter(s => s.categoryId === categoryId)
    .map(s => s.id);
}
