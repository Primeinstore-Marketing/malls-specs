/**
 * Model verification.
 *
 * Asserts the two properties this phase promises: the model type-checks, and
 * the catalogue it ships with is verifiably empty. Run with `npm run verify`.
 *
 * This exists because "every field ships empty" is easy to claim and easy to
 * break — one default string, one seeded category, and the promise is gone.
 */
import { emptyCatalogue, isEmpty, SCHEMA_VERSION } from './src/catalogue';
import type { Catalogue } from './src/catalogue';
import { validateCatalogue, validateTransition } from './src/invariants';
import {
  createSpecification, createCategory, createSubGroup, createTag,
  createAsset, createUser, createSpecificationInCategory,
} from './src/factories';
import { SPEC_STATUSES, STATUS_TRANSITIONS, STATUS_META, canTransition } from './src/status';
import { catalogue } from './data/catalogue.empty';

let failures = 0;

function check(label: string, condition: boolean, detail = ''): void {
  const mark = condition ? 'PASS' : 'FAIL';
  if (!condition) failures++;
  console.log(`  ${mark}  ${label}${detail ? '  —  ' + detail : ''}`);
}

/** A value counts as populated if it carries authored content, at any depth. */
function isPopulated(v: unknown): boolean {
  if (typeof v === 'string') return v !== '';
  if (typeof v === 'number') return v !== 0;
  if (Array.isArray(v)) return v.length > 0;
  if (v && typeof v === 'object') return Object.values(v).some(isPopulated);
  return false;
}

function populatedKeys(record: Record<string, unknown>, ignore: string[] = []): string[] {
  return Object.entries(record)
    .filter(([k, v]) => !ignore.includes(k) && isPopulated(v))
    .map(([k]) => k);
}

console.log('\nSCHEMA');
check('Schema version is declared', SCHEMA_VERSION >= 1, `v${SCHEMA_VERSION}`);

console.log('\nEMPTINESS');
const fresh: Catalogue = emptyCatalogue();
check('A fresh catalogue is empty', isEmpty(fresh));
check('The shipping seed is empty', isEmpty(catalogue));
check('Seed holds no assets', Object.keys(catalogue.assets).length === 0);
check('Seed holds no revisions', Object.keys(catalogue.revisions).length === 0);
check('Seed holds no users', Object.keys(catalogue.users).length === 0);
check('Seed search index is unbuilt', catalogue.index.entries.length === 0);

const IGNORE = ['id', 'status', 'tone', 'role', 'kind', 'schemaVersion'];
for (const [name, record] of [
  ['Specification', createSpecification()],
  ['Category', createCategory()],
  ['SubGroup', createSubGroup(createCategory().id)],
  ['Tag', createTag()],
  ['Asset', createAsset('media')],
  ['User', createUser()],
] as const) {
  const populated = populatedKeys(record as unknown as Record<string, unknown>, [...IGNORE, 'categoryId']);
  check(`New ${name} carries no content`, populated.length === 0, populated.join(', '));
}

const inherited = createSpecificationInCategory(createCategory());
check('Category inheritance adds no values',
  inherited.blocks.length === 0 && inherited.metadata.length === 0);

console.log('\nINVARIANTS');
check('Empty catalogue validates clean', validateCatalogue(catalogue).length === 0);

const orphan = { ...createSpecification(), title: 'x' };
check('A specification without a category is rejected',
  validateCatalogue({ ...fresh, specifications: { [orphan.id]: orphan } })
    .some(e => e.code === 'required' && e.path === 'categoryId'));

const selfRef = { ...createSpecification() };
const selfRelated = { ...selfRef, relatedIds: [selfRef.id] };
check('Self-relation is rejected',
  validateCatalogue({ ...fresh, specifications: { [selfRelated.id]: selfRelated } })
    .some(e => e.code === 'self_reference'));

const superseded = { ...createSpecification(), status: 'superseded' as const };
check('Superseded without a replacement is rejected',
  validateCatalogue({ ...fresh, specifications: { [superseded.id]: superseded } })
    .some(e => e.code === 'missing_replacement'));

console.log('\nLIFECYCLE');
let legal = 0, blocked = 0;
for (const from of SPEC_STATUSES) {
  for (const to of SPEC_STATUSES) {
    if (from === to) continue;
    canTransition(from, to) ? legal++ : blocked++;
  }
}
check('Transition map is restrictive', blocked > legal, `${legal} permitted, ${blocked} blocked`);
check('Nothing returns to draft from published',
  !canTransition('published', 'draft'));
check('Superseded is terminal', STATUS_TRANSITIONS.superseded.length === 0);
check('Terminal flags match the transition map',
  SPEC_STATUSES.every(s => STATUS_META[s].terminal === (STATUS_TRANSITIONS[s].length === 0)));
check('An illegal transition returns an error',
  validateTransition('published', 'draft').ok === false);
check('A legal transition succeeds',
  validateTransition('draft', 'in_review').ok === true);

console.log(`\n${failures === 0 ? 'All checks passed.' : failures + ' check(s) failed.'}\n`);
process.exit(failures === 0 ? 0 : 1);
