const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle,
  ImageRun, Footer, PageNumber, PageOrientation
} = require('docx');
const fs = require('fs');

const M = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const D = JSON.parse(fs.readFileSync('data.json', 'utf8'));

const NAVY = '1B3769', ACC = '2861FD', INK = '0D1E3F', MUTE = '4B5870';
const RULE = 'D8DEEC', TINT = 'F5F7FC', HEAD = 'EEF1F8';
const OK = '0F7A4D', BAD = 'B3261E';

const PAGE_W = 16838, PAGE_H = 23814, MARGIN = 720;
const CW = PAGE_H - MARGIN * 2;             // 22374 landscape content width
const MAX_IMG_W = 1492, MAX_IMG_H = 830;

const body = [];

const P = (t, o = {}) => new Paragraph({
  spacing: { before: o.before ?? 0, after: o.after ?? 100, line: o.line ?? 264 },
  alignment: o.align,
  children: [new TextRun({ text: t, size: o.size ?? 19, color: o.color ?? INK, bold: o.bold,
    font: 'Calibri', allCaps: o.caps, characterSpacing: o.ls })]
});
const RICH = (runs, o = {}) => new Paragraph({
  spacing: { before: o.before ?? 0, after: o.after ?? 100, line: 264 },
  children: runs.map(r => new TextRun({ text: r.t, size: r.size ?? 19, bold: r.b,
    color: r.c ?? INK, font: r.f ?? 'Calibri', allCaps: r.caps, characterSpacing: r.ls }))
});
const H1 = (t, br = true) => new Paragraph({
  heading: HeadingLevel.HEADING_1, pageBreakBefore: br, spacing: { after: 200 },
  children: [new TextRun({ text: t, size: 32, bold: true, color: NAVY, font: 'Calibri' })]
});
const H2 = (t) => new Paragraph({
  heading: HeadingLevel.HEADING_2, spacing: { before: 260, after: 120 },
  children: [new TextRun({ text: t, size: 24, bold: true, color: NAVY, font: 'Calibri' })]
});
const BUL = (t) => new Paragraph({ bullet: { level: 0 }, spacing: { after: 50, line: 258 },
  children: [new TextRun({ text: t, size: 19, color: INK, font: 'Calibri' })] });
const SP = (h = 100) => new Paragraph({ spacing: { after: h }, children: [] });

const cell = (paras, o = {}) => new TableCell({
  width: { size: o.w, type: WidthType.DXA },
  shading: o.bg ? { type: ShadingType.CLEAR, fill: o.bg, color: 'auto' } : undefined,
  margins: { top: o.m ?? 70, bottom: o.m ?? 70, left: 110, right: 110 },
  children: paras
});
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
    insideVertical: { style: BorderStyle.SINGLE, size: 4, color: RULE }
  },
  rows: [
    new TableRow({ tableHeader: true, cantSplit: true,
      children: headers.map((h, i) => tc(h, { w: widths[i], bg: HEAD, b: true, c: NAVY, size: 15 })) }),
    ...rows.map(r => new TableRow({ cantSplit: true,
      children: r.map((v, i) => {
        if (v && typeof v === 'object') return tc(v.t, { w: widths[i], c: v.c, b: v.b, mono: v.mono, size: v.size });
        return tc(v, { w: widths[i], mono: opts.mono && opts.mono.includes(i) });
      }) }))
  ]
});

const CALLOUT = (label, lines, w = CW, col = ACC) => new Table({
  width: { size: w, type: WidthType.DXA }, columnWidths: [w],
  borders: {
    top: { style: BorderStyle.SINGLE, size: 4, color: RULE },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: RULE },
    left: { style: BorderStyle.SINGLE, size: 18, color: col },
    right: { style: BorderStyle.SINGLE, size: 4, color: RULE },
    insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE }
  },
  rows: [new TableRow({ children: [new TableCell({
    width: { size: w, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill: TINT, color: 'auto' },
    margins: { top: 130, bottom: 130, left: 180, right: 180 },
    children: [
      new Paragraph({ spacing: { after: 70 }, children: [new TextRun({ text: label, size: 15,
        bold: true, color: col, font: 'Calibri', allCaps: true, characterSpacing: 30 })] }),
      ...lines.map(l => new Paragraph({ spacing: { after: 50, line: 262 },
        children: [new TextRun({ text: l, size: 18, color: INK, font: 'Calibri' })] }))
    ]
  })] })]
});

// ── COVER ────────────────────────────────────────────────────────────────
body.push(SP(900));
body.push(RICH([{ t: 'SPECIFICATIONS PLATFORM', size: 17, b: true, c: ACC, caps: true, ls: 90 }], { after: 140 }));
body.push(P('Phase 3', { size: 72, bold: true, color: NAVY, after: 80 }));
body.push(P('Component Inventory & Design System', { size: 38, after: 260 }));
body.push(new Paragraph({ spacing: { after: 300 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: ACC } }, children: [] }));
body.push(RICH([{ t: 'Deliverables 7–8 of 12', b: true, size: 21, c: NAVY }], { after: 180 }));
[['Prepared for', 'Moses Mkhumbuza'],
 ['Project', 'Malls Specs — reusable specification portal'],
 ['Contents', `${M.length} specimen plates · ${D.inventory.length} components · ${D.verify_light.length + D.verify_dark.length} verified colour pairings`],
 ['Ships with', 'tokens.css · tailwind.tokens.js · tokens.ts · CONTRAST-REPORT.md'],
 ['Date', '7 August 2026'],
 ['Status', 'Awaiting approval to proceed to Phase 4']].forEach(([k, v], i) =>
  body.push(RICH([{ t: k + '  ', c: MUTE, size: 18 }, { t: v, b: true, size: 18, c: i === 5 ? ACC : INK }], { after: 50 })));
body.push(SP(240));
body.push(CALLOUT('Confirmed in Phase 2', [
  'Split-pane variant A + B — panel widens to 58% above 1440px; attachments, revision history and related specifications render full-width beneath the split.',
  'Landing opens with a compact hero above the browse surface.',
  'Status vocabulary — Draft, In review, Published, Deprecated, Superseded.',
  'Metadata is dynamic key/value pairs, authored per specification or inherited from a category template.',
], 12600));

// ── CONTENTS ─────────────────────────────────────────────────────────────
body.push(H1('Contents'));
const TOC = [
  ['1.', 'How this system is built', 0],
  ['2.', 'Foundations', 0],
  ['S1', 'Colour — light mode', 1], ['S2', 'Colour — dark mode', 1],
  ['S3', 'Contrast — before and after', 1], ['S4', 'Typography', 1],
  ['S5', 'Spacing, radii and elevation', 1], ['S6', 'Motion, focus, breakpoints and layering', 1],
  ['S7', 'Grid, containers and the shell', 1],
  ['3.', 'Component inventory', 0],
  ['4.', 'Components', 0],
  ['S8', 'Buttons', 1], ['S9', 'Inputs and form controls', 1],
  ['S10', 'Badges, status, tags and codes', 1], ['S11', 'Cards', 1],
  ['S12', 'Tables', 1], ['S13', 'Navigation, sidebar, breadcrumbs and tabs', 1],
  ['S14', 'Accordions, modals, sheets, tooltips and popovers', 1],
  ['S15', 'Alerts and toasts', 1], ['S16', 'Icons', 1],
  ['S17', 'Empty, loading, error and skeleton states', 1],
  ['S18', 'Theme applied — light and dark', 1],
  ['5.', 'Composition rules', 0],
  ['6.', 'Accessibility conformance', 0],
  ['7.', 'Token delivery', 0],
  ['8.', 'Phase 4 scope & approval', 0],
];
TOC.forEach(([n, t, sub]) => body.push(new Paragraph({
  spacing: { before: sub ? 30 : 150, after: 30 },
  indent: { left: sub ? 340 : 0 },
  children: [new TextRun({ text: `${n}  ${t}`, size: sub ? 18 : 21, bold: !sub,
    color: sub ? MUTE : NAVY, font: 'Calibri' })]
})));

// ── 1. HOW THIS SYSTEM IS BUILT ──────────────────────────────────────────
body.push(H1('1. How this system is built'));
body.push(P('Three rules govern everything that follows. They are what make the system reusable rather than merely tidy.'));
body.push(H2('1.1 Tokens are named by role, never by value'));
body.push(P('There is no token called "navy" or "blue-500". There is fg-muted, border-control, accent-subtle, brand-surface. A component asks for the role it needs and receives whatever the active theme binds to it. This is the single decision that makes dark mode cost one stylesheet block instead of a parallel component tree, and it is why plate S18 shows two themes rendered from identical markup.'));
body.push(H2('1.2 Contrast is solved, not chosen'));
body.push(P('Every neutral step is derived by binary search against a contrast target rather than picked as an opacity that looked right. fg-muted is whatever composite of the ink over the surface reaches 7.2:1; fg-subtle is whatever reaches 4.65:1. The same function that produces those values produces the verification report that ships with the tokens, so the document and the code cannot drift apart.'));
body.push(P('This matters because it is exactly how the reference system went wrong. Its neutrals were chosen as opacities — 55% and 35% — which look reasonable and fail measurably.', { before: 60 }));
body.push(H2('1.3 The reference system’s character is preserved deliberately'));
body.push(P('This is a refinement, not a redesign, and the confirmed direction is to keep the split-pane and the visual language. So the navy-and-accent relationship, the two-curve motion vocabulary, the label-plus-flexing-rule section header, the bulleted specification row, the navigation selection marker and the reference-code chip all survive essentially unchanged. What changes is what was measurably broken: contrast, type floor, focus, semantics and state coverage.'));
body.push(SP(160));
body.push(CALLOUT('What the numbers say', [
  `Reference system audit: 7 of 12 representative colour pairings fail WCAG 2.1 AA.`,
  `New palette: 0 failures across ${D.verify_light.length + D.verify_dark.length} pairings, light and dark.`,
  `Component inventory: ${D.inventory.length} components — 6 retained unchanged, 8 extended, 8 rebuilt, 1 consolidated, 1 derived, 35 new.`,
  'The new components are not embellishment. They are the status, tags, revision history, attachments, related specifications, anchor navigation, print view, bookmarks, keyboard navigation, dark mode and the four system states your brief requires and the reference system does not have.',
]));

// ── 2. FOUNDATIONS + 4. COMPONENTS (plates) ──────────────────────────────
const FOUNDATION = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7'];

function plate(p) {
  const scale = Math.min(MAX_IMG_W / p.w, MAX_IMG_H / p.h);
  const iw = Math.round(p.w * scale), ih = Math.round(p.h * scale);
  body.push(new Paragraph({
    heading: HeadingLevel.HEADING_2, pageBreakBefore: true, spacing: { after: 90 },
    children: [
      new TextRun({ text: p.id + '   ', size: 22, bold: true, color: ACC, font: 'Calibri' }),
      new TextRun({ text: p.title, size: 30, bold: true, color: NAVY, font: 'Calibri' })
    ]
  }));
  body.push(new Paragraph({ spacing: { after: 130 }, alignment: AlignmentType.CENTER,
    children: [new ImageRun({ type: 'png', data: fs.readFileSync(p.png),
      transformation: { width: iw, height: ih } })] }));
  const half = Math.ceil(p.notes.length / 2);
  const mk = (arr, off) => arr.map((n, i) => new Paragraph({
    spacing: { after: 60, line: 244 }, indent: { left: 220, hanging: 220 },
    children: [
      new TextRun({ text: String(off + i + 1) + '  ', size: 15, bold: true, color: ACC, font: 'Calibri' }),
      new TextRun({ text: n, size: 15, color: INK, font: 'Calibri' })
    ]
  }));
  const HW = Math.floor(CW / 2) - 60;
  body.push(new Table({
    width: { size: HW * 2 + 120, type: WidthType.DXA }, columnWidths: [HW, 120, HW],
    borders: { top: { style: BorderStyle.SINGLE, size: 4, color: RULE },
      bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE } },
    rows: [new TableRow({ children: [
      cell(mk(p.notes.slice(0, half), 0), { w: HW, m: 100 }),
      cell([new Paragraph({ children: [] })], { w: 120, m: 100 }),
      cell(p.notes.length > half ? mk(p.notes.slice(half), half) : [new Paragraph({ children: [] })], { w: HW, m: 100 })
    ] })]
  }));
}

body.push(H1('2. Foundations'));
body.push(P('The token layer. Everything in Section 4 is assembled from these values and references nothing else.'));
M.filter(p => FOUNDATION.includes(p.id)).forEach(plate);

// token tables
body.push(H1('2.8 Token reference'));
body.push(H2('Colour — light'));
body.push(TBL(['Token', 'Value', 'Token', 'Value'],
  chunk2(Object.entries(D.light)), [4200, 2400, 4200, 2400], { mono: [1, 3] }));
body.push(H2('Colour — dark'));
body.push(TBL(['Token', 'Value', 'Token', 'Value'],
  chunk2(Object.entries(D.dark)), [4200, 2400, 4200, 2400], { mono: [1, 3] }));

body.push(H1('2.9 Scale reference'));
body.push(H2('Type'));
body.push(TBL(['Token', 'Size', 'px', 'Weight', 'Tracking', 'Leading', 'Family', 'Role'],
  D.type.map(t => [t[0], t[1], t[2], String(t[3]), t[4], t[5], t[6], t[7]]),
  [2100, 2400, 900, 1000, 1400, 1200, 1200, 5000], { mono: [0, 1] }));
body.push(SP(180));
body.push(H2('Spacing · radii · elevation · motion'));
const scaleRows = [];
const maxLen = Math.max(D.space.length, D.radii.length + D.elev.length + D.motion.length);
body.push(TBL(['Spacing', 'px', 'Radius', 'px', 'Motion token', 'Value'],
  buildScaleRows(), [1800, 1100, 1800, 1100, 3600, 3600], { mono: [0, 2, 4, 5] }));
body.push(SP(180));
body.push(H2('Breakpoints · layering · containers'));
body.push(TBL(['Breakpoint', 'px', 'Behaviour', 'z-index', 'Value', 'Container', 'px'],
  buildBrkRows(), [1500, 900, 6600, 1900, 1000, 1900, 900], { mono: [0, 1, 3, 4, 5, 6] }));

// ── 3. INVENTORY ─────────────────────────────────────────────────────────
body.push(H1('3. Component inventory'));
body.push(P(`Deliverable 7. ${D.inventory.length} components across seven groups. This table is the source of truth for the Phase 5 build — every component listed here becomes a directory under /components with its own types, stories and tests.`));
body.push(SP(140));
body.push(H2('Origin key'));
body.push(TBL(['Origin', 'Meaning', 'Count'],
  D.origin_key.map(([k, v]) => [k, v, String(D.inventory.filter(r => r[6] === k).length)]),
  [2000, 12800, 1400]));
body.push(SP(200));
D.groups.forEach(g => {
  const rows = D.inventory.filter(r => r[1] === g);
  body.push(H2(`${g} — ${rows.length} components`));
  body.push(TBL(['Component', 'Variants', 'States', 'Key props', 'Accessibility obligation', 'Origin'],
    rows.map(r => [{ t: r[0], b: true }, r[2], r[3], { t: r[4], mono: true, size: 14 }, r[5],
      { t: r[6], c: r[6] === 'New' ? ACC : (r[6] === 'Retained' ? OK : MUTE) }]),
    [2100, 3900, 3600, 4200, 6600, 1600]));
  body.push(SP(200));
});

body.push(H1('4. Components'));
body.push(P('Specimens for every component family, with the reasoning behind each decision. Variants, states and props are catalogued in Section 3.'));
M.filter(p => !FOUNDATION.includes(p.id)).forEach(plate);

// ── 5. COMPOSITION ───────────────────────────────────────────────────────
body.push(H1('5. Composition rules'));
body.push(P('Rules that govern how components combine. These are the ones that break systems when left unstated.'));
body.push(SP(140));
body.push(TBL(['Rule', 'Why'], [
  ['A card is one link target and one focus stop. Interactive elements are never nested inside it.',
   'Nested interactives inside a link produce an invalid accessibility tree and make keyboard traversal unpredictable.'],
  ['Only one primary button per view region.',
   'Primary is a claim about the single most likely action. Two primaries is no primary.'],
  ['Destructive actions are confirmed before they happen, never undone after.',
   'An undo toast is not a substitute for confirmation on an irreversible action. Archive is soft, so it needs no modal; permanent delete is not, so it needs a typed confirmation.'],
  ['Colour is never the only carrier of meaning.',
   'Every status badge has a dot, every alert has an icon, every sort column has an arrow. WCAG 1.4.1.'],
  ['Empty states carry the action that resolves them.',
   'The catalogue ships empty. An empty state without a next step is a dead end at the exact moment the user needs direction.'],
  ['Anything hidden is unmounted or inert, never merely invisible.',
   'The reference system’s collapsed branches and closed drawer stay in the tab order. This is the most common keyboard defect in the product.'],
  ['Controls relocate on small screens; they are never removed.',
   'The reference system deletes the image-download control below 360px. Function must not depend on viewport width.'],
  ['Every field label sits above its input, at every breakpoint.',
   'Keeps association unambiguous, keeps touch targets full-width, and removes an entire class of responsive layout bug.'],
  ['Error message rows are reserved in the layout before an error exists.',
   'Revealing an error must not shift the form under the user’s cursor.'],
  ['Skeletons match resolved dimensions exactly.',
   'A skeleton that is the wrong size causes the layout shift it was introduced to prevent.'],
  ['Tooltips describe; popovers contain. Tooltips never hold interactive content.',
   'A tooltip with a button in it is unreachable by keyboard and is the classic source of focus traps.'],
  ['Saving a specification always writes a revision.',
   'History that depends on the author remembering to record it will not be maintained.'],
], [7200, 9200]));

// ── 6. ACCESSIBILITY ─────────────────────────────────────────────────────
body.push(H1('6. Accessibility conformance'));
body.push(P('Target: WCAG 2.1 Level AA. Every Phase 1 finding is resolved at the system level rather than per component.'));
body.push(SP(140));
body.push(TBL(['Criterion', 'Obligation', 'How this system meets it'], [
  ['1.4.1 Use of colour', 'Colour is not the sole means of conveying information',
   'Status badges carry a dot, alerts carry an icon and a leading bar, sortable columns carry a direction arrow.'],
  ['1.4.3 Contrast (minimum)', 'Text reaches 4.5:1, large text 3:1',
   `Solved rather than chosen. All ${D.verify_light.length + D.verify_dark.length} pairings verified; report regenerated from source.`],
  ['1.4.4 Resize text', 'Text scales to 200% without loss of function',
   'Every size is in rem against a 16px root. Type floor raised from 8px to 11px.'],
  ['1.4.10 Reflow', 'No horizontal scroll at 320px / 400% zoom',
   'The shell scrolls internally without locking the document. The reference system sets overflow:hidden on html and body, which prevents reflow entirely.'],
  ['1.4.11 Non-text contrast', 'UI component boundaries reach 3:1',
   'border-control is a distinct token solved at 3.05:1, used on every input and secondary button.'],
  ['1.4.12 Text spacing', 'No loss of content when spacing is overridden',
   'No fixed heights on text containers; the specification row and section label both flow.'],
  ['2.1.1 Keyboard', 'All functionality available from a keyboard',
   'Command palette, roving tab index in the tree, full menu and tabs patterns, arrow-key groups.'],
  ['2.1.2 No keyboard trap', 'Focus can always leave a component',
   'Tooltips hold no interactive content; modals trap deliberately and release on Escape.'],
  ['2.4.1 Bypass blocks', 'A mechanism to skip repeated content',
   'SkipLink is the first focusable element on every page, targeting the main landmark.'],
  ['2.4.3 Focus order', 'Focus order preserves meaning',
   'Collapsed accordions and the closed drawer are unmounted or inert, so they leave the tab order.'],
  ['2.4.7 Focus visible', 'Keyboard focus is visible',
   'A single :focus-visible primitive — 2px ring, 2px offset. The reference system suppresses outlines without replacing them.'],
  ['2.5.5 Target size', 'Touch targets are at least 44×44',
   'Every control reaches 44×44 through padding at touch widths without changing its visual height.'],
  ['3.3.1 Error identification', 'Errors are identified in text',
   'Field errors use aria-invalid and aria-describedby; the message row is reserved before it is needed.'],
  ['3.3.2 Labels or instructions', 'Inputs carry labels',
   'The Field wrapper guarantees association. Placeholder is never the label.'],
  ['4.1.2 Name, role, value', 'Components expose correct semantics',
   'Real tables, real dl for metadata, real dialog semantics, aria-current on breadcrumb and anchor rail.'],
  ['4.1.3 Status messages', 'Status is announced without focus change',
   'Toasts and result counts announce through polite live regions.'],
], [2400, 5000, 9000]));
body.push(SP(200));
body.push(CALLOUT('Reference system audit — the measured baseline', [
  'Computed from the values as found in the published stylesheet. Every figure below is produced by the same function that generates the shipped contrast report.',
], CW, BAD));
body.push(SP(140));
body.push(TBL(['Pairing', 'Ratio', 'Required', 'Result'],
  D.audit.map(a => [a[0], { t: a[3] + ':1', mono: true }, { t: a[4] + ':1', mono: true },
    { t: a[5], b: true, c: a[5] === 'PASS' ? OK : BAD }]),
  [9200, 2400, 2400, 2400]));

// ── 7. TOKEN DELIVERY ────────────────────────────────────────────────────
body.push(H1('7. Token delivery'));
body.push(P('The design system ships as files, not only as a document. These are in your project folder now, under design-system/tokens, and Phase 5 consumes them directly.'));
body.push(SP(140));
body.push(TBL(['File', 'Contains', 'Consumed by'], [
  ['tokens.css', 'Every token as a CSS custom property. Light set on :root, dark set on [data-theme="dark"] and under prefers-color-scheme. Includes the reduced-motion block and the :focus-visible primitive.',
   'Imported once at the application root.'],
  ['tailwind.tokens.js', 'Tailwind theme bridge. Colours, spacing, radii, shadows, type, screens, z-index and containers all resolve to the CSS variables above.',
   'Spread into tailwind.config.js. Because values are variables, no dark: variants are needed anywhere.'],
  ['tokens.ts', 'TypeScript literal unions for colour, type, spacing and radius tokens, plus the specification status list and breakpoint map.',
   'Component prop types, so an invalid token is a compile error rather than a silent fallback.'],
  ['CONTRAST-REPORT.md', 'The full computed verification — reference-system audit plus every pairing in both new palettes.',
   'Regenerated from source. If a token changes and a pairing fails, the report says so.'],
], [3000, 8000, 5400]));
body.push(SP(200));
body.push(H2('7.1 Why this matters for Phase 5'));
body.push(P('The reference system’s design decisions live inside an 80KB HTML file alongside its content, which is why they cannot be reused. Extracting them into typed, verified files is what turns this from a redesign of one site into the reusable platform your brief asks for. A future category, a future theme, or a future consumer of these tokens needs no code change.'));

// ── 8. PHASE 4 ───────────────────────────────────────────────────────────
body.push(H1('8. Phase 4 scope & approval'));
body.push(P('On approval, Phase 4 produces the data model — deliverable 9. Reusable, fully typed, entirely empty.'));
body.push(H2('8.1 Scope'));
[['Specification', 'Identity, status, category and sub-group references, description, tags, technical specifications, requirements, dynamic metadata, notes, media, attachments, downloads, related specifications, revision history, timestamps and authorship.'],
 ['Category', 'Name, slug, description, order, media, optional sub-groups, and a metadata field template that new specifications inherit.'],
 ['Sub-group', 'Nullable middle tier. Name, slug, order, parent category.'],
 ['Tag', 'Name, slug, colour tone, usage count. Many-to-many, unordered, never navigable as a tree.'],
 ['Status', 'The five confirmed states with permitted transitions encoded, so the lifecycle is enforced rather than drawn.'],
 ['Revision', 'Version, timestamp, author, summary, and a diff of the changed fields.'],
 ['Attachment / Download', 'Filename, kind, size, MIME type, dimensions where applicable, storage key.'],
 ['Metadata field', 'Key, label, value, type, order. Dynamic per the confirmed decision.'],
 ['User / Role', 'The four roles named in the admin plates: Viewer, Editor, Approver, Administrator.']
].forEach(([k, v]) => body.push(new Paragraph({ bullet: { level: 0 }, spacing: { after: 60 },
  children: [new TextRun({ text: k + ' — ', size: 19, bold: true, color: INK, font: 'Calibri' }),
    new TextRun({ text: v, size: 19, color: INK, font: 'Calibri' })] })));
body.push(H2('8.2 What Phase 4 will not do'));
body.push(P('It will not populate anything. Every model ships with empty values — empty strings, empty arrays, empty objects — exactly as your brief specifies. The seed data will be a single empty catalogue with no categories and no specifications.'));
body.push(H2('8.3 Decisions needed'));
body.push(BUL('Reference code format. The plates use PI-000 as a placeholder. Is the code authored, or generated from a category prefix and a sequence?'));
body.push(BUL('Whether a specification can belong to more than one category. The current model says no — category is the exclusive primary axis and tags carry everything else. Confirm.'));
body.push(BUL('Whether revision history records field-level diffs or only a summary. Field-level is more useful and more work.'));
body.push(H2('8.4 Approval'));
body.push(P('If any foundation in Section 2 is wrong, it is far cheaper to change here than after fifty-nine components are built on top of it. The corrected palette in particular changes the smallest type sizes and the lightest text colours from the reference system — plate S3 shows exactly what that looks like side by side.'));
body.push(SP(240));
body.push(new Paragraph({ spacing: { before: 60, after: 180 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: RULE } }, children: [] }));
body.push(RICH([{ t: 'End of Phase 3. ', b: true, c: NAVY },
  { t: 'Deliverables 7–8 of 12 complete. Awaiting approval to proceed to Phase 4.', c: MUTE }]));

// ── helpers ──────────────────────────────────────────────────────────────
function chunk2(entries) {
  const rows = [];
  const half = Math.ceil(entries.length / 2);
  for (let i = 0; i < half; i++) {
    const a = entries[i], b = entries[i + half];
    rows.push([a ? '--color-' + a[0] : '', a ? a[1] : '',
               b ? '--color-' + b[0] : '', b ? b[1] : '']);
  }
  return rows;
}
function buildScaleRows() {
  const rows = [];
  const n = Math.max(D.space.length, D.radii.length, D.motion.length);
  for (let i = 0; i < n; i++) {
    const s = D.space[i], r = D.radii[i], m = D.motion[i];
    rows.push([
      s ? 'space-' + s[0] : '', s ? s[1] + 'px' : '',
      r ? 'radius-' + r[0] : '', r ? (r[1] > 100 ? '999px' : r[1] + 'px') : '',
      m ? '--' + m[0] : '', m ? m[1] : ''
    ]);
  }
  return rows;
}
function buildBrkRows() {
  const rows = [];
  const n = Math.max(D.brk.length, D.z.length, D.container.length);
  for (let i = 0; i < n; i++) {
    const b = D.brk[i], z = D.z[i], c = D.container[i];
    rows.push([
      b ? b[0] : '', b ? (b[1] ? b[1] + 'px' : '0') : '', b ? b[2] : '',
      z ? 'z-' + z[0] : '', z ? String(z[1]) : '',
      c ? c[0] : '', c ? c[1] + 'px' : ''
    ]);
  }
  return rows;
}

// ── ASSEMBLE ─────────────────────────────────────────────────────────────
const doc = new Document({
  creator: 'Specifications Platform',
  title: 'Phase 3 — Component Inventory & Design System',
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
        new TextRun({ text: 'Phase 3 — Component Inventory & Design System    ', size: 14, color: MUTE, font: 'Calibri' }),
        new TextRun({ children: [PageNumber.CURRENT], size: 14, color: NAVY, bold: true, font: 'Calibri' })
      ] })] }) },
    children: body
  }]
});

Packer.toBuffer(doc).then(b => {
  fs.writeFileSync(process.argv[2] || 'Phase-3.docx', b);
  console.log('written', (b.length / 1024 / 1024).toFixed(1), 'MB');
});
