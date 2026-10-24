/**
 * Real screen-format data for the Primedia Malls and Hyprop Malls networks,
 * transcribed from the source spec sheet ("Malls specs.pdf", Table 1 + the
 * Hyprop Malls table). This is structured data, not markup — components read
 * it the same way they'd read any other catalogue.
 *
 * Deliberately separate from `catalogue.empty.ts`, which must stay empty
 * (enforced by `verify.ts`). This is the seed the live site actually reads.
 *
 * Fields absent from the source (description, code, media, files) are left
 * empty rather than invented. Two entries (Loch Logan, and the Mimosa /
 * Westgate "MTVs & Digi Engages" rows) had no resolution in the source —
 * their width/height metadata ships null rather than guessed.
 */
import { emptyCategory, emptySubGroup, emptyTag } from '../src/taxonomy';
import type { Category, SubGroup, Tag } from '../src/taxonomy';
import { emptySpecification } from '../src/specification';
import type { Specification } from '../src/specification';
import { emptyBlock, emptyMetadataField } from '../src/content';
import type { SpecBlock, MetadataField } from '../src/content';
import { asCategoryId, asSubGroupId, asTagId, asSpecificationId, asBlockId, asMetadataFieldId } from '../src/ids';
import type { CategoryId, SubGroupId, TagId } from '../src/ids';
import { slugify } from '../src/common';
import { emptyCatalogue } from '../src/catalogue';
import type { Catalogue } from '../src/catalogue';

const NOW = '2026-08-09T00:00:00.000Z';

const IDS = {
  categoryMalls: asCategoryId('category-malls'),
  categoryHyprop: asCategoryId('category-hyprop-malls'),
  subgroupCresta: asSubGroupId('subgroup-cresta'),
  subgroupMenlyn: asSubGroupId('subgroup-menlyn'),
  subgroupMonteCasino: asSubGroupId('subgroup-monte-casino'),
  subgroupPavilion: asSubGroupId('subgroup-pavilion'),
  subgroupSouthgate: asSubGroupId('subgroup-southgate'),
  subgroupTygervalley: asSubGroupId('subgroup-tygervalley'),
  subgroupCanalWalk: asSubGroupId('subgroup-canal-walk'),
  subgroupCapeGate: asSubGroupId('subgroup-cape-gate'),
  subgroupClearwater: asSubGroupId('subgroup-clearwater'),
  subgroupTableBay: asSubGroupId('subgroup-table-bay'),
} as const;

const TAG_APPROVAL: Tag = {
  ...emptyTag(asTagId('tag-approval-required')),
  name: 'Approval required',
  slug: 'approval-required',
  description: 'Send an email to the mall for approval before booking.',
  tone: 'warning',
};
const TAG_REVSHARE: Tag = {
  ...emptyTag(asTagId('tag-revenue-share')),
  name: 'Revenue share',
  slug: 'revenue-share',
  description: 'A revenue share applies at this location.',
  tone: 'info',
};
const TAG_SPECIAL: Tag = {
  ...emptyTag(asTagId('tag-special-spec')),
  name: 'Special spec',
  slug: 'special-spec',
  description: 'Non-standard format — confirm dimensions before artwork production.',
  tone: 'danger',
};

const categoryMalls: Category = {
  ...emptyCategory(IDS.categoryMalls, 0),
  name: 'Malls',
  slug: 'malls',
  description: 'Digital and static screen formats across the standard mall network.',
  subGroupIds: [
    IDS.subgroupCresta,
    IDS.subgroupMenlyn,
    IDS.subgroupMonteCasino,
    IDS.subgroupPavilion,
    IDS.subgroupSouthgate,
    IDS.subgroupTygervalley,
  ],
};

const categoryHyprop: Category = {
  ...emptyCategory(IDS.categoryHyprop, 1),
  name: 'Hyprop Malls',
  slug: 'hyprop-malls',
  description: 'Screen formats for the Hyprop-managed mall portfolio.',
  subGroupIds: [IDS.subgroupCanalWalk, IDS.subgroupCapeGate, IDS.subgroupClearwater, IDS.subgroupTableBay],
};

const subGroups: readonly SubGroup[] = [
  { ...emptySubGroup(IDS.subgroupCresta, IDS.categoryMalls, 0), name: 'Cresta', slug: 'cresta' },
  { ...emptySubGroup(IDS.subgroupMenlyn, IDS.categoryMalls, 1), name: 'Menlyn', slug: 'menlyn' },
  { ...emptySubGroup(IDS.subgroupMonteCasino, IDS.categoryMalls, 2), name: 'Monte Casino', slug: 'monte-casino' },
  { ...emptySubGroup(IDS.subgroupPavilion, IDS.categoryMalls, 3), name: 'Pavilion', slug: 'pavilion' },
  { ...emptySubGroup(IDS.subgroupSouthgate, IDS.categoryMalls, 4), name: 'Southgate', slug: 'southgate' },
  { ...emptySubGroup(IDS.subgroupTygervalley, IDS.categoryMalls, 5), name: 'Tygervalley', slug: 'tygervalley' },
  { ...emptySubGroup(IDS.subgroupCanalWalk, IDS.categoryHyprop, 0), name: 'Canal Walk', slug: 'canal-walk' },
  { ...emptySubGroup(IDS.subgroupCapeGate, IDS.categoryHyprop, 1), name: 'Cape Gate', slug: 'cape-gate' },
  { ...emptySubGroup(IDS.subgroupClearwater, IDS.categoryHyprop, 2), name: 'Clearwater', slug: 'clearwater' },
  { ...emptySubGroup(IDS.subgroupTableBay, IDS.categoryHyprop, 3), name: 'Table Bay', slug: 'table-bay' },
];

interface SeedSpec {
  readonly key: string;
  readonly title: string;
  readonly width?: number;
  readonly height?: number;
  readonly approval?: boolean;
  readonly revShare?: boolean;
  readonly special?: boolean;
}

function buildSpecification(
  seed: SeedSpec,
  categoryId: CategoryId,
  subGroupId: SubGroupId | null,
  contextLabel: string,
): Specification {
  const id = asSpecificationId(`spec-${seed.key}`);

  const tagIds: TagId[] = [
    ...(seed.approval ? [TAG_APPROVAL.id] : []),
    ...(seed.revShare ? [TAG_REVSHARE.id] : []),
    ...(seed.special ? [TAG_SPECIAL.id] : []),
  ];

  const metadata: MetadataField[] = [
    {
      ...emptyMetadataField(asMetadataFieldId(`field-${seed.key}-width`), 'width', 'Width', 0),
      type: 'dimension',
      value: seed.width != null ? String(seed.width) : null,
      unit: 'px',
      indexed: true,
    },
    {
      ...emptyMetadataField(asMetadataFieldId(`field-${seed.key}-height`), 'height', 'Height', 1),
      type: 'dimension',
      value: seed.height != null ? String(seed.height) : null,
      unit: 'px',
      indexed: true,
    },
  ];

  const requirementLines = [
    ...(seed.approval
      ? [{ kind: 'item' as const, text: 'Send email to the mall for approval.', reference: null }]
      : []),
    ...(seed.revShare ? [{ kind: 'item' as const, text: 'Revenue share applies.', reference: null }] : []),
  ];

  const blocks: SpecBlock[] =
    requirementLines.length > 0
      ? [
          {
            ...emptyBlock(asBlockId(`block-${seed.key}-requirements`), 'Requirements', 0),
            anchorId: 'requirements',
            lines: requirementLines,
          },
        ]
      : [];

  return {
    ...emptySpecification(id),
    title: seed.title,
    slug: slugify(`${contextLabel} ${seed.title}`),
    categoryId,
    subGroupId,
    tagIds,
    status: 'published',
    version: 1,
    publishedAt: NOW,
    blocks,
    metadata,
    searchText: [contextLabel, seed.title].filter(Boolean).join(' '),
    createdAt: NOW,
    updatedAt: NOW,
  };
}

const crestaSpecs: SeedSpec[] = [
  { key: 'cresta-food-court', title: 'Food Court', width: 1920, height: 1080, approval: true, revShare: true },
  {
    key: 'cresta-mugg-bean-impact',
    title: 'Mugg & Bean Impact',
    width: 1920,
    height: 1224,
    approval: true,
    revShare: true,
    special: true,
  },
  { key: 'cresta-woolworth-screen', title: 'Woolworth Screen', width: 2176, height: 1152 },
];

const menlynSpecs: SeedSpec[] = [
  { key: 'menlyn-cape-union-mart', title: 'Cape Union Mart', width: 3200, height: 768, approval: true },
  { key: 'menlyn-food-court', title: 'Food Court', width: 1408, height: 384, approval: true },
  { key: 'menlyn-earthchild', title: 'Earthchild', width: 3200, height: 768, approval: true },
  { key: 'menlyn-yuppie-chef', title: 'Yuppie Chef', width: 3200, height: 768, approval: true },
  { key: 'menlyn-cavendish-court', title: 'Cavendish Court', width: 2048, height: 384, approval: true },
  { key: 'menlyn-aviary-court', title: 'Aviary Court', width: 1920, height: 1080, approval: true },
  { key: 'menlyn-sky', title: 'Sky', width: 2340, height: 480, approval: true },
];

const monteCasinoSpecs: SeedSpec[] = [
  { key: 'monte-casino-exit-to-piazza', title: 'Exit to Piazza', width: 1920, height: 1080 },
  { key: 'monte-casino-fego', title: 'Fego', width: 1920, height: 1080 },
  { key: 'monte-casino-nikos', title: 'Nikos', width: 1920, height: 1080 },
  { key: 'monte-casino-grand-staircase', title: 'Grand Staircase', width: 2688, height: 768 },
  { key: 'monte-casino-piazza', title: 'Piazza', width: 1920, height: 1080 },
];

const pavilionSpecs: SeedSpec[] = [
  { key: 'pavilion-food-court', title: 'Food Court', width: 1920, height: 1080, approval: true },
  // 1920×1080 per the Oct 2026 "Updated Specs" PDF (the original sheet had it portrait, 1080×1920).
  { key: 'pavilion-fountain-court', title: 'Fountain Court', width: 1920, height: 1080, approval: true },
  { key: 'pavilion-full-pillar', title: 'Full Pillar', width: 1280, height: 1472, approval: true },
];

const southgateSpecs: SeedSpec[] = [
  {
    key: 'southgate-food-court-digi-impact',
    title: 'Food Court Digi Impact',
    width: 2304,
    height: 1280,
    approval: true,
    revShare: true,
  },
  {
    key: 'southgate-foschini-digi-impact',
    title: 'Foschini Digi Impact',
    width: 1536,
    height: 1152,
    approval: true,
    revShare: true,
  },
];

const tygervalleySpecs: SeedSpec[] = [
  { key: 'tygervalley-food-court', title: 'Food Court', width: 1280, height: 720, approval: true, revShare: true },
  {
    key: 'tygervalley-foschini',
    title: 'Foschini',
    width: 3840,
    height: 2160,
    approval: true,
    revShare: true,
    special: true,
  },
];

const mallsDirectSpecs: SeedSpec[] = [
  { key: 'bayside-digi-impact', title: 'Bayside Digi Impact', width: 1920, height: 1152 },
  { key: 'boardwalk', title: 'Boardwalk', width: 600, height: 720 },
  { key: 'brooklyn-mall', title: 'Brooklyn Mall', width: 1920, height: 1080 },
  { key: 'capegate-food-court', title: 'Capegate Food Court', width: 1920, height: 1080 },
  { key: 'fourways-food-court', title: 'Fourways Food Court', width: 1920, height: 1200 },
  { key: 'fourways-pillars', title: 'Fourways Pillars', width: 1536, height: 1088 },
  { key: 'fourways-promo-court', title: 'Fourways Promo Court', width: 1080, height: 1920 },
  { key: 'gardens-digi-impact', title: 'Gardens Digi Impact', width: 1920, height: 1080 },
  { key: 'gateway-digi-impact', title: 'Gateway Digi Impact', width: 3052, height: 640 },
  { key: 'golden-acre-impact', title: 'Golden Acre Impact', width: 864, height: 1344 },
  { key: 'landscape-digital-icon-mtv', title: 'Landscape (Digital Icon / MTV)', width: 1920, height: 1080 },
  { key: 'loch-logan', title: 'Loch Logan' },
  { key: 'n1-city', title: 'N1 City', width: 1920, height: 1080 },
  { key: 'paarl-mall-digi-impact', title: 'Paarl Mall Digi Impact', width: 1664, height: 896 },
  { key: 'portrait-digital-engage', title: 'Portrait (Digital Engage)', width: 1080, height: 1920 },
  { key: 'mimosa-mtvs-digi-engages', title: 'Mimosa — MTVs & Digi Engages', approval: true, revShare: true },
  { key: 'westgate-mtvs-digi-engages', title: 'Westgate — MTVs & Digi Engages', approval: true, revShare: true },
];

const canalWalkSpecs: SeedSpec[] = [
  { key: 'canal-walk-food-court', title: 'Food Court', width: 1920, height: 1080 },
  { key: 'canal-walk-centre-court', title: 'Centre Court', width: 1980, height: 1080 },
  { key: 'canal-walk-cube-court', title: 'Cube Court', width: 3040, height: 760 },
  { key: 'canal-walk-retail-right-packages', title: 'Retail Right Packages', width: 1280, height: 704 },
  { key: 'canal-walk-retail-left-packages', title: 'Retail Left Packages', width: 1280, height: 704 },
];

const capeGateSpecs: SeedSpec[] = [
  { key: 'cape-gate-clicks-woolworths', title: 'Clicks & Woolworths', width: 2000, height: 720 },
  { key: 'cape-gate-checkers', title: 'Checkers', width: 2000, height: 720 },
];

const clearwaterSpecs: SeedSpec[] = [
  { key: 'clearwater-pick-n-pay', title: 'Pick n Pay', width: 1920, height: 1080 },
  { key: 'clearwater-food-court', title: 'Food Court', width: 1920, height: 1080 },
  { key: 'clearwater-mugg-bean', title: 'Mugg & Bean', width: 1920, height: 1080 },
];

const tableBaySpecs: SeedSpec[] = [
  { key: 'table-bay-centre-court', title: 'Centre Court', width: 1920, height: 1080 },
  { key: 'table-bay-checkers-pick-n-pay', title: 'Checkers and Pick n Pay', width: 2880, height: 1728 },
];

const hypropDirectSpecs: SeedSpec[] = [
  { key: 'hype-park', title: 'Hype Park', width: 3520, height: 1920 },
  { key: 'rosebank-mall', title: 'Rosebank Mall', width: 1536, height: 896 },
  { key: 'somerset-mall', title: 'Somerset Mall', width: 1600, height: 2560 },
  { key: 'the-glen', title: 'The Glen', width: 1040, height: 600 },
  { key: 'woodlands', title: 'Woodlands', width: 1920, height: 1080 },
  { key: 'rosebank-fnb-pillar', title: 'Rosebank FNB Pillar', width: 448, height: 768 },
  { key: 'other-pillars', title: 'Other Pillars', width: 1088, height: 1536 },
];

const allSpecs: readonly Specification[] = [
  ...crestaSpecs.map((s) => buildSpecification(s, IDS.categoryMalls, IDS.subgroupCresta, 'Malls Cresta')),
  ...menlynSpecs.map((s) => buildSpecification(s, IDS.categoryMalls, IDS.subgroupMenlyn, 'Malls Menlyn')),
  ...monteCasinoSpecs.map((s) =>
    buildSpecification(s, IDS.categoryMalls, IDS.subgroupMonteCasino, 'Malls Monte Casino'),
  ),
  ...pavilionSpecs.map((s) => buildSpecification(s, IDS.categoryMalls, IDS.subgroupPavilion, 'Malls Pavilion')),
  ...southgateSpecs.map((s) => buildSpecification(s, IDS.categoryMalls, IDS.subgroupSouthgate, 'Malls Southgate')),
  ...tygervalleySpecs.map((s) =>
    buildSpecification(s, IDS.categoryMalls, IDS.subgroupTygervalley, 'Malls Tygervalley'),
  ),
  ...mallsDirectSpecs.map((s) => buildSpecification(s, IDS.categoryMalls, null, 'Malls')),
  ...canalWalkSpecs.map((s) =>
    buildSpecification(s, IDS.categoryHyprop, IDS.subgroupCanalWalk, 'Hyprop Malls Canal Walk'),
  ),
  ...capeGateSpecs.map((s) =>
    buildSpecification(s, IDS.categoryHyprop, IDS.subgroupCapeGate, 'Hyprop Malls Cape Gate'),
  ),
  ...clearwaterSpecs.map((s) =>
    buildSpecification(s, IDS.categoryHyprop, IDS.subgroupClearwater, 'Hyprop Malls Clearwater'),
  ),
  ...tableBaySpecs.map((s) =>
    buildSpecification(s, IDS.categoryHyprop, IDS.subgroupTableBay, 'Hyprop Malls Table Bay'),
  ),
  ...hypropDirectSpecs.map((s) => buildSpecification(s, IDS.categoryHyprop, null, 'Hyprop Malls')),
];

function byId<T extends { id: string }>(items: readonly T[]): Record<string, T> {
  const record: Record<string, T> = {};
  for (const item of items) record[item.id] = item;
  return record;
}

export const catalogue: Catalogue = {
  ...emptyCatalogue(),
  categories: byId([categoryMalls, categoryHyprop]),
  subGroups: byId(subGroups),
  tags: byId([TAG_APPROVAL, TAG_REVSHARE, TAG_SPECIAL]),
  specifications: byId(allSpecs),
  generatedAt: NOW,
};

export default catalogue;
