const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle,
  ImageRun, Footer, PageNumber, PageOrientation
} = require('docx');
const fs = require('fs');

const M = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));

const NAVY = '1B3769', ACC = '2861FD', INK = '0D1E3F', MUTE = '4B5870';
const RULE = 'D8DEEC', TINT = 'F5F7FC', HEAD = 'EEF1F8';
const OK = '0F7A4D', BAD = 'B3261E';

const PAGE_W = 16838, PAGE_H = 23814, MARGIN = 720;
const CW = PAGE_H - MARGIN * 2;
const MAX_IMG_W = 1492, MAX_IMG_H = 830;

const body = [];
const P = (t, o = {}) => new Paragraph({
  spacing: { before: o.before ?? 0, after: o.after ?? 100, line: 264 },
  children: [new TextRun({ text: t, size: o.size ?? 19, color: o.color ?? INK,
    bold: o.bold, font: 'Calibri', allCaps: o.caps, characterSpacing: o.ls })] });
const RICH = (runs, o = {}) => new Paragraph({
  spacing: { before: o.before ?? 0, after: o.after ?? 100, line: 264 },
  children: runs.map(r => new TextRun({ text: r.t, size: r.size ?? 19, bold: r.b,
    color: r.c ?? INK, font: r.f ?? 'Calibri', allCaps: r.caps, characterSpacing: r.ls })) });
const H1 = (t, br = true) => new Paragraph({ heading: HeadingLevel.HEADING_1,
  pageBreakBefore: br, spacing: { after: 200 },
  children: [new TextRun({ text: t, size: 32, bold: true, color: NAVY, font: 'Calibri' })] });
const H2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 260, after: 120 },
  children: [new TextRun({ text: t, size: 24, bold: true, color: NAVY, font: 'Calibri' })] });
const BUL = (t) => new Paragraph({ bullet: { level: 0 }, spacing: { after: 50, line: 258 },
  children: [new TextRun({ text: t, size: 19, color: INK, font: 'Calibri' })] });
const SP = (h = 100) => new Paragraph({ spacing: { after: h }, children: [] });

const cell = (paras, o = {}) => new TableCell({
  width: { size: o.w, type: WidthType.DXA },
  shading: o.bg ? { type: ShadingType.CLEAR, fill: o.bg, color: 'auto' } : undefined,
  margins: { top: o.m ?? 70, bottom: o.m ?? 70, left: 110, right: 110 },
  children: paras });
const tc = (t, o = {}) => cell([new Paragraph({ spacing: { after: 0, line: 244 },
  children: [new TextRun({ text: String(t), size: o.size ?? 15, bold: o.b, color: o.c ?? INK,
    font: o.mono ? 'Consolas' : 'Calibri' })] })], o);

const TBL = (headers, rows, widths, opts = {}) => new Table({
  width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
  columnWidths: widths,
  borders: {
    top: { style: BorderStyle.SINGLE, size: 4, color: RULE },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: RULE },
    left: { style: BorderStyle.SINGLE, size: 4, color: RULE },
    right: { style: BorderStyle.SINGLE, size: 4, color: RULE },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: RULE },
    insideVertical: { style: BorderStyle.SINGLE, size: 4, color: RULE } },
  rows: [
    new TableRow({ tableHeader: true, cantSplit: true,
      children: headers.map((h, i) => tc(h, { w: widths[i], bg: HEAD, b: true, c: NAVY, size: 15 })) }),
    ...rows.map(r => new TableRow({ cantSplit: true,
      children: r.map((v, i) => (v && typeof v === 'object')
        ? tc(v.t, { w: widths[i], c: v.c, b: v.b, mono: v.mono, size: v.size })
        : tc(v, { w: widths[i], mono: opts.mono && opts.mono.includes(i) })) }))
  ] });

const CALLOUT = (label, lines, w = CW, col = ACC) => new Table({
  width: { size: w, type: WidthType.DXA }, columnWidths: [w],
  borders: { top: { style: BorderStyle.SINGLE, size: 4, color: RULE },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: RULE },
    left: { style: BorderStyle.SINGLE, size: 18, color: col },
    right: { style: BorderStyle.SINGLE, size: 4, color: RULE },
    insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
  rows: [new TableRow({ children: [new TableCell({
    width: { size: w, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill: TINT, color: 'auto' },
    margins: { top: 130, bottom: 130, left: 180, right: 180 },
    children: [
      new Paragraph({ spacing: { after: 70 }, children: [new TextRun({ text: label, size: 15,
        bold: true, color: col, font: 'Calibri', allCaps: true, characterSpacing: 30 })] }),
      ...lines.map(l => new Paragraph({ spacing: { after: 50, line: 262 },
        children: [new TextRun({ text: l, size: 18, color: INK, font: 'Calibri' })] }))
    ] })] })] });

function plate(p) {
  const scale = Math.min(MAX_IMG_W / p.w, MAX_IMG_H / p.h);
  body.push(new Paragraph({ heading: HeadingLevel.HEADING_2, pageBreakBefore: true,
    spacing: { after: 90 },
    children: [new TextRun({ text: p.id + '   ', size: 22, bold: true, color: ACC, font: 'Calibri' }),
      new TextRun({ text: p.title, size: 30, bold: true, color: NAVY, font: 'Calibri' })] }));
  body.push(new Paragraph({ spacing: { after: 130 }, alignment: AlignmentType.CENTER,
    children: [new ImageRun({ type: 'png', data: fs.readFileSync(p.png),
      transformation: { width: Math.round(p.w * scale), height: Math.round(p.h * scale) } })] }));
  const half = Math.ceil(p.notes.length / 2);
  const mk = (arr, off) => arr.map((n, i) => new Paragraph({
    spacing: { after: 60, line: 244 }, indent: { left: 220, hanging: 220 },
    children: [new TextRun({ text: String(off + i + 1) + '  ', size: 15, bold: true, color: ACC, font: 'Calibri' }),
      new TextRun({ text: n, size: 15, color: INK, font: 'Calibri' })] }));
  const HW = Math.floor(CW / 2) - 60;
  body.push(new Table({ width: { size: HW * 2 + 120, type: WidthType.DXA },
    columnWidths: [HW, 120, HW],
    borders: { top: { style: BorderStyle.SINGLE, size: 4, color: RULE },
      bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE } },
    rows: [new TableRow({ children: [
      cell(mk(p.notes.slice(0, half), 0), { w: HW, m: 100 }),
      cell([new Paragraph({ children: [] })], { w: 120, m: 100 }),
      cell(p.notes.length > half ? mk(p.notes.slice(half), half) : [new Paragraph({ children: [] })], { w: HW, m: 100 })
    ] })] }));
}

// ── COVER ────────────────────────────────────────────────────────────────
body.push(SP(900));
body.push(RICH([{ t: 'SPECIFICATIONS PLATFORM', size: 17, b: true, c: ACC, caps: true, ls: 90 }], { after: 140 }));
body.push(P('Phase 4', { size: 72, bold: true, color: NAVY, after: 80 }));
body.push(P('Data Model', { size: 38, after: 260 }));
body.push(new Paragraph({ spacing: { after: 300 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: ACC } }, children: [] }));
body.push(RICH([{ t: 'Deliverable 9 of 12', b: true, size: 21, c: NAVY }], { after: 180 }));
[['Prepared for', 'Moses Mkhumbuza'],
 ['Project', 'Malls Specs — reusable specification portal'],
 ['Contents', '13 entities · 4 diagrams · 23 automated checks'],
 ['Ships as', 'A type-checked TypeScript package under data-model/'],
 ['Date', '7 August 2026'],
 ['Status', 'Awaiting approval to proceed to Phase 5']].forEach(([k, v], i) =>
  body.push(RICH([{ t: k + '  ', c: MUTE, size: 18 }, { t: v, b: true, size: 18, c: i === 5 ? ACC : INK }], { after: 50 })));
body.push(SP(240));
body.push(CALLOUT('Confirmed for this phase', [
  'Reference code — free text, optional, no enforced format. An existing external numbering scheme can be entered as-is.',
  'Category — exclusive. A specification belongs to exactly one, with tags carrying every other classification.',
  'Revision history — field-level diffs, written automatically on every save.',
  'Every model ships empty. verify.ts asserts it on every run.',
], 12600));

// ── CONTENTS ─────────────────────────────────────────────────────────────
body.push(H1('Contents'));
[['1.', 'Modelling principles', 0],
 ['2.', 'The model at a glance', 0],
 ['M1', 'Entity relationship map', 1],
 ['M2', 'Specification lifecycle', 1],
 ['M3', 'The empty record', 1],
 ['M4', 'Revision history and diffs', 1],
 ['3.', 'Entities', 0],
 ['3.1', 'Specification', 1], ['3.2', 'Category and SubGroup', 1], ['3.3', 'Tag', 1],
 ['3.4', 'SpecBlock and BlockLine', 1], ['3.5', 'MetadataField', 1],
 ['3.6', 'Asset', 1], ['3.7', 'Revision and FieldChange', 1],
 ['3.8', 'User and Role', 1], ['3.9', 'Collections', 1], ['3.10', 'Search and filter', 1],
 ['4.', 'Invariants', 0],
 ['5.', 'The empty catalogue', 0],
 ['6.', 'Extensibility', 0],
 ['7.', 'Delivered files', 0],
 ['8.', 'Phase 5 scope & approval', 0],
].forEach(([n, t, sub]) => body.push(new Paragraph({
  spacing: { before: sub ? 30 : 150, after: 30 }, indent: { left: sub ? 340 : 0 },
  children: [new TextRun({ text: `${n}  ${t}`, size: sub ? 18 : 21, bold: !sub,
    color: sub ? MUTE : NAVY, font: 'Calibri' })] })));

// ── 1. PRINCIPLES ────────────────────────────────────────────────────────
body.push(H1('1. Modelling principles'));
body.push(P('Five decisions shape the whole model. Each one is a direct response to something in the reference system.'));
body.push(H2('1.1 Normalised, not nested'));
body.push(P('Entities are stored by id and referenced by id. The reference system holds its entire dataset as one nested JavaScript object literal, which means a specification cannot be edited without rewriting its category, and the whole catalogue must be parsed to render one record. Here, a specification carries a categoryId, not a category.'));
body.push(H2('1.2 Identity is typed'));
body.push(P('CategoryId and SpecificationId are both strings at runtime, but assigning one where the other is expected is a compile error. This costs nothing at runtime and removes an entire class of bug that reference-by-string invites.'));
body.push(P('Identifiers are minted in one function. The reference system uses Date.now(), which collides under concurrent authoring and leaks creation time into every URL.', { before: 60 }));
body.push(H2('1.3 Structure is explicit, conventions are preserved'));
body.push(P('The reference system stores specification content as arrays of strings, parsed one item per line, with a leading double asterisk marking a sub-heading. That convention works and your authors know it — so it is kept, but modelled explicitly as BlockLine records rather than left implicit in a parser. The structure now survives round-tripping.'));
body.push(H2('1.4 Rules live in the model'));
body.push(P('A lifecycle drawn in a design document is decoration. STATUS_TRANSITIONS is a map, canTransition() is a function, and validateTransition() rejects anything not permitted before it can be persisted. Referential integrity works the same way — a sub-group that belongs to a different category than its specification is a validation error, not a rendering bug discovered later.'));
body.push(H2('1.5 Nothing is populated'));
body.push(P('Every factory returns empty strings, empty arrays, nulls and zeros. A newly created specification carries exactly two non-empty values: its identifier, and the draft status the lifecycle has to start from. This is asserted by an automated check rather than promised in prose, because a single careless default would quietly break it.'));
body.push(SP(160));
body.push(CALLOUT('What ships alongside this document', [
  'data-model/ is a real TypeScript package. It compiles under strict mode with exactOptionalPropertyTypes and noUncheckedIndexedAccess, and it has no runtime dependencies.',
  'npm run check runs the type-checker and 23 assertions covering emptiness, referential integrity and the lifecycle. All pass.',
  'Phase 5 imports it directly. There is no translation step between this document and the build.',
]));

// ── 2. DIAGRAMS ──────────────────────────────────────────────────────────
body.push(H1('2. The model at a glance'));
body.push(P('Four views: how the entities relate, how a specification moves through its lifecycle, what an empty record actually contains, and how history is recorded.'));
M.forEach(plate);

// ── 3. ENTITIES ──────────────────────────────────────────────────────────
body.push(H1('3. Entities'));
body.push(P('Thirteen entities. Field tables below are the authoritative reference; the TypeScript files are generated from the same decisions, not the other way round.'));

body.push(H2('3.1 Specification'));
body.push(P('The leaf record. Everything else exists to organise, describe or version one of these. Twelve sections, matching the Phase 1 information architecture and the Phase 2 wireframes.'));
body.push(SP(120));
body.push(TBL(['Field', 'Type', 'Empty value', 'Notes'], [
  ['id', 'SpecificationId', 'minted', 'Branded. Sortable, collision-resistant.'],
  ['title', 'string', '""', 'Required before save. The only required text field.'],
  ['slug', 'Slug', '""', 'Derived from title. Uniqueness enforced across the catalogue.'],
  ['code', 'string', '""', { t: 'Free text, optional, no enforced format — confirmed. Uniqueness is advisory, so an existing external scheme can be entered as-is.', c: ACC }],
  ['description', 'string', '""', 'Plain text. Renders under the title and feeds the search index.'],
  ['categoryId', 'CategoryId | null', 'null', { t: 'Exclusive — exactly one category. Required before save.', c: ACC }],
  ['subGroupId', 'SubGroupId | null', 'null', 'The nullable middle tier. Must belong to the same category.'],
  ['tagIds', 'TagId[]', '[]', 'Many-to-many. The only axis that crosses categories.'],
  ['status', 'SpecStatus', "'draft'", 'One of five. Transitions enforced.'],
  ['supersededById', 'SpecificationId | null', 'null', "Required when status is 'superseded'. Self-reference rejected."],
  ['version', 'number', '0', 'Published version. Increments only on a publish event.'],
  ['publishedAt', 'string | null', 'null', 'First publish timestamp.'],
  ['blocks', 'SpecBlock[]', '[]', 'Technical specifications, requirements, notes — labels are authored.'],
  ['metadata', 'MetadataField[]', '[]', { t: 'Dynamic key/value pairs — confirmed structure.', c: ACC }],
  ['mediaIds', 'AssetId[]', '[]', 'The image pane and its thumbnail strip.'],
  ['downloadIds', 'AssetId[]', '[]', 'The pinned downloads bar. Die lines, artwork templates.'],
  ['attachmentIds', 'AssetId[]', '[]', 'The attachments section. Any file type.'],
  ['relatedIds', 'SpecificationId[]', '[]', 'Explicit cross-references. Self-reference rejected.'],
  ['revisionIds', 'RevisionId[]', '[]', 'Every save, published or not.'],
  ['currentRevisionId', 'RevisionId | null', 'null', 'Points at the most recent revision.'],
  ['searchText', 'string', '""', 'Derived on save. Never authored.'],
  ['createdAt / By, updatedAt / By', 'Timestamp | UserId | null', 'null', 'Audit trail.'],
  ['archivedAt / By', 'Timestamp | UserId | null', 'null', 'Soft deletion. Restorable from the Archive tab.'],
], [2900, 3000, 1800, 8700], { mono: [0, 1, 2] }));

body.push(H2('3.2 Category and SubGroup'));
body.push(P('The navigable spine. Category is exclusive and ordered; SubGroup is the optional middle tier the reference system already handles with the same navigation primitive.'));
body.push(SP(120));
body.push(TBL(['Entity', 'Field', 'Type', 'Notes'], [
  ['Category', 'name / slug / description', 'string', 'Slug derived from name.'],
  ['', 'order', 'SortOrder', 'Authored, not alphabetical. Specification catalogues have a conventional sequence.'],
  ['', 'mediaId', 'AssetId | null', 'Optional category header image.'],
  ['', 'subGroupIds', 'SubGroupId[]', 'In authored order. Empty means the category exposes specifications directly.'],
  ['', 'metadataTemplate', 'MetadataTemplate', { t: 'Fields new specifications inherit — with empty values. This is how a domain convention propagates without a schema change.', c: ACC }],
  ['', 'blockTemplate', 'string[]', 'Block labels new specifications start with.'],
  ['SubGroup', 'categoryId', 'CategoryId', 'Parent. Orphans are a validation error.'],
  ['', 'name / slug / description', 'string', ''],
  ['', 'order', 'SortOrder', 'Drag-reorderable within its category.'],
], [1800, 3400, 2800, 8400], { mono: [1, 2] }));

body.push(H2('3.3 Tag'));
body.push(P('The cross-cutting axis. Many-to-many, unordered, never navigable as a tree. Keeping tags visually and structurally distinct from categories is what stops the taxonomy collapsing as the catalogue grows.'));
body.push(SP(120));
body.push(TBL(['Field', 'Type', 'Notes'], [
  ['name / slug / description', 'string', ''],
  ['tone', 'TagTone', 'Maps to the design-system semantic tokens, so tags can be colour-coded without new palette entries.'],
  ['usageCount', 'number', 'Denormalised for facet counts. Recomputed, never authored.'],
], [3400, 2800, 10200], { mono: [0, 1] }));

body.push(H2('3.4 SpecBlock and BlockLine'));
body.push(P('The reference system’s core content pattern, modelled explicitly. A block is a titled run of lines; a line is an item or a sub-heading, optionally carrying an inline reference callout.'));
body.push(SP(120));
body.push(TBL(['Entity', 'Field', 'Type', 'Notes'], [
  ['SpecBlock', 'label', 'string', 'Authored. "Technical specifications" is a convention, not schema.'],
  ['', 'lines', 'BlockLine[]', ''],
  ['', 'twoColumn', 'boolean', 'The reference system’s two-column toggle, retained.'],
  ['', 'order / anchorId', 'SortOrder / string', 'anchorId is the scroll-spy target for the anchor rail.'],
  ['BlockLine', 'kind', "'item' | 'subheading'", 'The reference system marks sub-headings with a leading **.'],
  ['', 'text', 'string', ''],
  ['', 'reference', 'string | null', 'Inline callout rendered in the accent colour. Written as *[CODE] in the reference system.'],
], [1800, 2600, 3200, 8800], { mono: [1, 2] }));

body.push(H2('3.5 MetadataField'));
body.push(P('Dynamic key/value pairs — the confirmed structure. Adding a field never requires a code change or a migration, which is the point of the reusable platform.'));
body.push(SP(120));
body.push(TBL(['Field', 'Type', 'Notes'], [
  ['key', 'string', 'Stable machine key. Survives a label rename, so renaming a field does not orphan its data.'],
  ['label', 'string', 'What the user sees.'],
  ['type', 'MetadataValueType', "text · number · date · boolean · dimension · url · user. Drives the input control and the sort comparator."],
  ['value', 'string | null', 'Null means empty. Every field ships null.'],
  ['unit', 'string | null', 'For dimension and number types.'],
  ['order', 'SortOrder', 'Position in the boxed definition grid.'],
  ['inherited', 'boolean', 'True when the field came from the category template rather than being authored on the record.'],
  ['indexed', 'boolean', 'Surfaced in list columns and search facets.'],
], [2600, 3000, 10800], { mono: [0, 1] }));

body.push(H2('3.6 Asset'));
body.push(P('One file model with a role, rather than three parallel types. The reference system handles exactly two kinds — one JPEG per specification and a list of die-line PDFs committed through a browser-held repository token.'));
body.push(SP(120));
body.push(TBL(['Field', 'Type', 'Notes'], [
  ['role', "'media' | 'download' | 'attachment'", 'Determines where the asset surfaces, not what it is.'],
  ['kind', 'AssetKind', 'image · video · document · cad · archive · other. Derived from MIME type.'],
  ['filename / storageKey', 'string', 'storageKey is opaque. The service layer resolves it to a URL.'],
  ['mimeType / sizeBytes', 'string / number | null', ''],
  ['alt', 'string', 'Required for images and video. Used as the accessible name.'],
  ['caption / order', 'string / SortOrder', ''],
  ['image', 'ImageMeta | null', 'Width, height, blurred placeholder, and a focal point. The reference system hard-codes a 30% focal point on tablet.'],
  ['version', 'string | null', 'Version label for downloads, so a superseded die line is identifiable.'],
], [3000, 3600, 9800], { mono: [0, 1] }));
body.push(SP(160));
body.push(CALLOUT('Storage is abstracted', [
  'StorageAdapter is an interface with put, url and remove. Phase 5 ships a local adapter.',
  'The reference system’s repository-token strategy becomes one implementation of that interface rather than a property of the product. This is the security exposure flagged in Phase 1 §2.15, resolved structurally.',
]));

body.push(H2('3.7 Revision and FieldChange'));
body.push(P('Field-level diffs, confirmed. Written automatically on every save.'));
body.push(SP(120));
body.push(TBL(['Entity', 'Field', 'Type', 'Notes'], [
  ['Revision', 'version', 'number', 'Monotonic per specification. Increments on every save, published or not.'],
  ['', 'summary', 'string', 'Author-supplied, optional. Falls back to a generated description of the changes.'],
  ['', 'status / published', 'SpecStatus / boolean', 'State at the time, and whether this was a publish event.'],
  ['', 'changes', 'FieldChange[]', 'What changed.'],
  ['', 'snapshot', 'string | null', 'The full record, serialised. What restore uses.'],
  ['FieldChange', 'path', 'FieldPath', 'Dotted path — blocks.0.lines.4.text. Precise to the line.'],
  ['', 'label', 'string', 'Human label for the diff view — "Technical · line 5".'],
  ['', 'kind', "'added' | 'removed' | 'changed'", ''],
  ['', 'before / after', 'string | null', 'Null on added and removed respectively.'],
], [1800, 2600, 3200, 8800], { mono: [1, 2] }));

body.push(H2('3.8 User and Role'));
body.push(P('Four roles, declared now so Approver exists before approval workflows are built rather than being retrofitted.'));
body.push(SP(120));
body.push(TBL(['Role', 'Permissions'], [
  ['viewer', 'spec.read'],
  ['editor', 'spec.read · spec.create · spec.update · spec.archive'],
  ['approver', 'the above, plus spec.approve · spec.publish'],
  ['administrator', 'the above, plus spec.delete · taxonomy.manage · user.manage · settings.manage'],
], [2600, 13800], { mono: [1] }));
body.push(SP(140));
body.push(P('Permissions are a flat list checked by can(role, permission). Note that only administrators hold spec.delete — permanent deletion exists solely in the Archive tab and requires a typed confirmation, as specified on Phase 2 plate D13.'));

body.push(H2('3.9 Collections'));
body.push(P('Bookmarks, favourites and recently viewed. Derived, device-scoped, never authored and never part of the category tree. Kept in a separate adapter so they can move to an account later without touching the content model.'));

body.push(H2('3.10 Search and filter'));
body.push(P('A pre-built index over every searchable field. The reference system filters the sidebar tree by title substring and has no results surface at all.'));
body.push(SP(120));
body.push(TBL(['Type', 'Purpose'], [
  ['IndexEntry', 'Title, code, description, tags, status and concatenated body text, plus a normalised form for prefix matching. Built once, queried many times.'],
  ['FilterState', 'Every field maps to a URL parameter, so a filtered view is shareable and survives reload — the Phase 1 §5.2 requirement.'],
  ['Facets', 'Live counts per category, sub-group, tag and status, driving the filter rail’s count column.'],
  ['SearchResult', 'Score plus character ranges to highlight, per matched field.'],
], [2600, 13800], { mono: [0] }));

// ── 4. INVARIANTS ────────────────────────────────────────────────────────
body.push(H1('4. Invariants'));
body.push(P('Rules checked before anything is persisted. Each is a function in invariants.ts and each has a test in verify.ts.'));
body.push(SP(140));
body.push(TBL(['Rule', 'Code', 'Why'], [
  ['A specification must have a title', 'required', 'The only required text field. Everything else may legitimately stay empty.'],
  ['A specification must belong to exactly one category', 'required', 'Category is the exclusive primary axis — confirmed.'],
  ['A sub-group must belong to its specification’s category', 'orphaned', 'Prevents a record appearing under a branch it does not belong to.'],
  ['Referenced categories, sub-groups, tags and assets must exist', 'not_found', 'Catches dangling references before they become rendering failures.'],
  ["A superseded specification must name its replacement", 'missing_replacement', 'This is the state that matters most for print specifications, where retired versions circulate physically.'],
  ['A specification cannot supersede or relate to itself', 'self_reference', 'Would produce an infinite navigation loop.'],
  ['Metadata keys must be unique within a specification', 'duplicate', 'Two fields with the same key make the record ambiguous.'],
  ['Slugs must be unique across the catalogue', 'duplicate', 'Slugs appear in URLs.'],
  ['Status transitions must be permitted', 'illegal_transition', 'Seven permitted, thirteen blocked. Nothing returns to draft once published.'],
  ['Revisions must belong to an existing specification', 'orphaned', 'History without a subject is unrecoverable.'],
  ['Deleting a category with specifications requires reassignment', '—', 'categoryDeletionBlockers() returns the affected records. Never cascades.'],
], [6400, 2600, 7400], { mono: [1] }));

// ── 5. EMPTY CATALOGUE ───────────────────────────────────────────────────
body.push(H1('5. The empty catalogue'));
body.push(P('What the application loads on first run, and how that is guaranteed.'));
body.push(SP(140));
body.push(TBL(['Check', 'Result'], [
  ['Schema version declared', { t: 'PASS  v1', b: true, c: OK }],
  ['A fresh catalogue is empty', { t: 'PASS', b: true, c: OK }],
  ['The shipping seed is empty', { t: 'PASS', b: true, c: OK }],
  ['Seed holds no assets, revisions or users', { t: 'PASS', b: true, c: OK }],
  ['Seed search index is unbuilt', { t: 'PASS', b: true, c: OK }],
  ['New Specification carries no content', { t: 'PASS', b: true, c: OK }],
  ['New Category, SubGroup, Tag, Asset, User carry no content', { t: 'PASS', b: true, c: OK }],
  ['Category inheritance adds no values', { t: 'PASS', b: true, c: OK }],
  ['Empty catalogue validates clean', { t: 'PASS', b: true, c: OK }],
  ['A specification without a category is rejected', { t: 'PASS', b: true, c: OK }],
  ['Self-relation is rejected', { t: 'PASS', b: true, c: OK }],
  ['Superseded without a replacement is rejected', { t: 'PASS', b: true, c: OK }],
  ['Transition map is restrictive', { t: 'PASS  7 permitted, 13 blocked', b: true, c: OK }],
  ['Nothing returns to draft from published', { t: 'PASS', b: true, c: OK }],
  ['Superseded is terminal', { t: 'PASS', b: true, c: OK }],
  ['Terminal flags match the transition map', { t: 'PASS', b: true, c: OK }],
  ['An illegal transition returns an error', { t: 'PASS', b: true, c: OK }],
  ['A legal transition succeeds', { t: 'PASS', b: true, c: OK }],
  ['TypeScript strict compilation', { t: 'PASS  0 errors', b: true, c: OK }],
], [11400, 5000]));
body.push(SP(160));
body.push(CALLOUT('Why this is a script and not a sentence', [
  '"Every field ships empty" is trivially easy to claim and trivially easy to break — one default string, one seeded category, one convenience value, and the promise is gone without anyone noticing.',
  'verify.ts walks every factory recursively and fails the build if any field carries authored content. It caught one genuine problem while being written: an over-strict check that flagged an empty nested object as populated.',
]));

// ── 6. EXTENSIBILITY ─────────────────────────────────────────────────────
body.push(H1('6. Extensibility'));
body.push(P('Your Phase 9 requirement was that future additions need no structural change. This is how each named item is already accommodated.'));
body.push(SP(140));
body.push(TBL(['Phase 9 requirement', 'How the model already carries it'], [
  ['Hundreds of specifications', 'Normalised storage keyed by id, a pre-built search index, and a summary type so a list row never loads blocks or assets.'],
  ['Multiple categories', 'Category is a first-class entity with authored order and its own templates. Adding one is data, not code.'],
  ['Nested specifications', 'The nullable SubGroup tier handles one level. Deeper nesting would need a parentId on Category — a single field, no restructuring.'],
  ['Images, videos, PDFs, CAD files', 'One Asset model with a kind derived from MIME type. AssetKind already names all four.'],
  ['Downloads', 'AssetRole distinguishes downloads from media and attachments, so the pinned bar is a filter, not a separate collection.'],
  ['Version control', 'Revision with field-level diffs and a full snapshot. Published version and revision count are distinct numbers.'],
  ['User permissions', 'Four roles, a flat permission list, and can(). Adding a permission is one entry in the map.'],
  ['Approval workflows', 'The in_review state and the approver role both exist now. A workflow adds transitions, not entities.'],
  ['Search indexing', 'SearchIndex, IndexEntry, Facets and FilterState are defined. Swapping in an external index means implementing one interface.'],
  ['API integration', 'Nothing in the model references a transport. The service layer in Phase 5 is the only thing that knows where data comes from.'],
  ['CMS integration', 'Same. A CMS becomes an adapter that returns a Catalogue.'],
], [4400, 12000]));
body.push(SP(160));
body.push(H2('6.1 What would require a migration'));
body.push(P('Stated plainly, because a model that claims to accommodate everything is not being honest.'));
body.push(BUL('Making category non-exclusive. Changing categoryId to categoryIds would touch the navigation, the filter rail, the breadcrumb and the index. This is why the question was worth asking before building.'));
body.push(BUL('Nesting categories more than one level deep. The tree components assume a fixed depth of three.'));
body.push(BUL('Making metadata typed rather than dynamic. Going the other way — dynamic to fixed — is the migration; the confirmed direction avoids it.'));
body.push(P('SCHEMA_VERSION exists for exactly these cases. Phase 5 reads it on load and can run a migration when it does not match.', { before: 100 }));

// ── 7. FILES ─────────────────────────────────────────────────────────────
body.push(H1('7. Delivered files'));
body.push(P('data-model/ in your project folder. No runtime dependencies.'));
body.push(SP(140));
body.push(TBL(['File', 'Contains'], [
  ['src/ids.ts', 'Branded identifier types, opaque constructors, and id minting.'],
  ['src/common.ts', 'Timestamps, audit and archive mixins, Result and ValidationError, slugify.'],
  ['src/status.ts', 'The five states, their metadata, and the transition map.'],
  ['src/content.ts', 'SpecBlock, BlockLine, MetadataField, MetadataTemplate.'],
  ['src/assets.ts', 'Asset, ImageMeta, StorageAdapter, MIME-to-kind mapping.'],
  ['src/taxonomy.ts', 'Category, SubGroup, Tag.'],
  ['src/specification.ts', 'Specification and SpecificationSummary.'],
  ['src/revision.ts', 'Revision, FieldChange, generated change descriptions.'],
  ['src/access.ts', 'User, Role, Permission, ROLE_PERMISSIONS, can().'],
  ['src/collections.ts', 'Bookmarks, favourites, recently viewed, and their adapter.'],
  ['src/search.ts', 'SearchIndex, IndexEntry, FilterState, Facets, SearchResult.'],
  ['src/catalogue.ts', 'The Catalogue aggregate, SCHEMA_VERSION, emptyCatalogue, isEmpty.'],
  ['src/factories.ts', 'Empty-value constructors, including category-template inheritance.'],
  ['src/invariants.ts', 'validateSpecification, validateTransition, validateCatalogue, categoryDeletionBlockers.'],
  ['src/index.ts', 'Barrel export.'],
  ['data/catalogue.empty.ts', 'The shipping catalogue. Verifiably empty.'],
  ['verify.ts', '23 assertions covering emptiness, invariants and the lifecycle.'],
  ['tsconfig.json · package.json', 'Strict configuration. npm run check runs both the type-checker and the assertions.'],
], [3600, 12800], { mono: [0] }));

// ── 8. PHASE 5 ───────────────────────────────────────────────────────────
body.push(H1('8. Phase 5 scope & approval'));
body.push(P('On approval, Phase 5 produces the application architecture — deliverable 10. The project structure, the service layer, routing, state and the build configuration.'));
body.push(H2('8.1 Scope'));
[['Project structure', 'React, TypeScript and Vite with the directory layout your brief specifies — components, layouts, pages, hooks, utils, types, services, data, assets, styles — populated with the fifty-nine components from Phase 3 and this data model.'],
 ['Service layer', 'The adapter boundary. A local file adapter backed by data/catalogue.empty.ts, written so an API or CMS can replace it without touching a component.'],
 ['Routing', 'Hash routing as specified in Phase 1 §6, isolated behind one module so a switch to history routing is a single-file change.'],
 ['State', 'What lives in the URL (filters, sort, view), what lives in memory (catalogue, index), and what persists per device (collections, theme, view preference).'],
 ['Build', 'Vite configuration, path aliases, the Tailwind bridge to the Phase 3 tokens, and a static build that deploys to GitHub Pages exactly as the current site does.'],
].forEach(([k, v]) => body.push(new Paragraph({ bullet: { level: 0 }, spacing: { after: 60 },
  children: [new TextRun({ text: k + ' — ', size: 19, bold: true, color: INK, font: 'Calibri' }),
    new TextRun({ text: v, size: 19, color: INK, font: 'Calibri' })] })));
body.push(H2('8.2 Decisions needed'));
body.push(BUL('Package manager and Node version, if you have a preference. Otherwise npm and Node 20 LTS.'));
body.push(BUL('Whether the admin layer should be behind a build flag, so a public deployment can ship without it.'));
body.push(BUL('Whether to include a test setup now — Vitest and Testing Library — or defer it to Phase 6.'));
body.push(H2('8.3 Approval'));
body.push(P('This is the last phase where the shape of the data can change cheaply. Once components are written against these types, changing categoryId to categoryIds or making metadata a fixed schema means touching the navigation, the filters, the breadcrumb and the index together.'));
body.push(SP(240));
body.push(new Paragraph({ spacing: { before: 60, after: 180 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: RULE } }, children: [] }));
body.push(RICH([{ t: 'End of Phase 4. ', b: true, c: NAVY },
  { t: 'Deliverable 9 of 12 complete. Awaiting approval to proceed to Phase 5.', c: MUTE }]));

const doc = new Document({
  creator: 'Specifications Platform',
  title: 'Phase 4 — Data Model',
  styles: { default: { document: { run: { font: 'Calibri', size: 19, color: INK } } } },
  sections: [{
    properties: { page: {
      size: { width: PAGE_W, height: PAGE_H, orientation: PageOrientation.LANDSCAPE },
      margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } } },
    footers: { default: new Footer({ children: [new Paragraph({
      alignment: AlignmentType.RIGHT,
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: RULE } },
      spacing: { before: 100 },
      children: [
        new TextRun({ text: 'Phase 4 — Data Model    ', size: 14, color: MUTE, font: 'Calibri' }),
        new TextRun({ children: [PageNumber.CURRENT], size: 14, color: NAVY, bold: true, font: 'Calibri' })
      ] })] }) },
    children: body
  }]
});

Packer.toBuffer(doc).then(b => {
  fs.writeFileSync(process.argv[2] || 'Phase-4.docx', b);
  console.log('written', (b.length / 1024 / 1024).toFixed(1), 'MB');
});
