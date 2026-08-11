import sys
sys.path.insert(0, "../phase3")
from ds import C, FD, FB, FM
from tokens import LIGHT as P

PLATES = {}


def reg(pid, title, notes, c):
    PLATES[pid] = (title, notes, c.out())


def ent(c, x, y, w, title, fields, tone="neutral", h=None):
    """Entity box."""
    rows = len(fields)
    h = h or (38 + rows * 20 + 10)
    accent = {"core": P["accent"], "tax": P["info-fg"], "hist": P["warning-fg"],
              "file": P["success-fg"], "sys": P["fg-subtle"], "neutral": P["border-strong"]}[tone]
    c.r(x, y + 2, w, h, fill=P["fg"], rx=8, op=0.05)
    c.r(x, y, w, h, fill=P["bg"], stroke=P["border-strong"], sw=1.2, rx=8)
    c.r(x, y, w, 30, fill=P["bg-muted"], rx=8)
    c.r(x, y + 24, w, 6, fill=P["bg-muted"])
    c.r(x, y, 4, 30, fill=accent, rx=2)
    c.t(x + 14, y + 20, title, 12.5, P["fg"], w=700, f=FD)
    yy = y + 48
    for name, typ, key in fields:
        col = P["accent-fg"] if key == "pk" else (P["fg-muted"] if key == "fk" else P["fg-subtle"])
        c.t(x + 14, yy, name, 10.5, P["fg"] if key == "pk" else P["fg-muted"], f=FM)
        c.t(x + w - 12, yy, typ, 10, col, "end", f=FM)
        yy += 20
    return h


def link(c, pts, label=None, dashed=False, card=None):
    c.poly(pts, stroke=P["border-strong"], sw=1.4)
    if dashed:
        c.o[-1] = c.o[-1].replace('fill="none"', 'fill="none" stroke-dasharray="5 4"')
    if label:
        mx = (pts[0][0] + pts[-1][0]) / 2
        my = (pts[0][1] + pts[-1][1]) / 2
        c.r(mx - len(label) * 3.2 - 6, my - 9, len(label) * 6.4 + 12, 18, fill=P["bg"], rx=4)
        c.t(mx, my + 4, label, 10, P["fg-subtle"], "middle")


# ══ M1 · ENTITY RELATIONSHIP MAP ════════════════════════════════════════
def m1():
    c = C(1240, 1000)
    c.t(40, 34, "Entities are stored by id and referenced by id — never nested. A specification can be edited without rewriting its category,", 12.5, P["fg-subtle"])
    c.t(40, 54, "and the search index can be built without walking a tree.", 12.5, P["fg-subtle"])

    # Category → SubGroup → Specification spine
    ent(c, 40, 90, 230, "Category", [
        ("id", "CategoryId pk", "pk"), ("name", "string", ""), ("slug", "Slug", ""),
        ("order", "SortOrder", ""), ("mediaId", "AssetId? fk", "fk"),
        ("metadataTemplate", "Template", ""), ("blockTemplate", "string[]", "")], "tax")
    ent(c, 40, 320, 230, "SubGroup", [
        ("id", "SubGroupId pk", "pk"), ("categoryId", "CategoryId fk", "fk"),
        ("name", "string", ""), ("order", "SortOrder", "")], "tax")
    ent(c, 40, 470, 230, "Tag", [
        ("id", "TagId pk", "pk"), ("name", "string", ""), ("tone", "TagTone", ""),
        ("usageCount", "number", "")], "tax")

    ent(c, 400, 90, 300, "Specification", [
        ("id", "SpecificationId pk", "pk"), ("title / slug / code", "string", ""),
        ("description", "string", ""), ("categoryId", "CategoryId fk", "fk"),
        ("subGroupId", "SubGroupId? fk", "fk"), ("tagIds", "TagId[] fk", "fk"),
        ("status", "SpecStatus", ""), ("supersededById", "SpecificationId? fk", "fk"),
        ("version", "number", ""), ("blocks", "SpecBlock[]", ""),
        ("metadata", "MetadataField[]", ""), ("mediaIds", "AssetId[] fk", "fk"),
        ("downloadIds", "AssetId[] fk", "fk"), ("attachmentIds", "AssetId[] fk", "fk"),
        ("relatedIds", "SpecificationId[] fk", "fk"), ("revisionIds", "RevisionId[] fk", "fk")], "core")

    ent(c, 830, 90, 250, "Revision", [
        ("id", "RevisionId pk", "pk"), ("specificationId", "SpecificationId fk", "fk"),
        ("version", "number", ""), ("summary", "string", ""),
        ("changes", "FieldChange[]", ""), ("snapshot", "string?", "")], "hist")
    ent(c, 830, 300, 250, "FieldChange", [
        ("path", "FieldPath", ""), ("label", "string", ""),
        ("kind", "added|removed|changed", ""), ("before", "string?", ""),
        ("after", "string?", "")], "hist")
    ent(c, 830, 460, 250, "Asset", [
        ("id", "AssetId pk", "pk"), ("role", "media|download|attachment", ""),
        ("kind", "AssetKind", ""), ("filename / storageKey", "string", ""),
        ("alt / caption", "string", ""), ("image", "ImageMeta?", "")], "file")

    ent(c, 400, 560, 300, "SpecBlock", [
        ("id", "BlockId pk", "pk"), ("label", "string", ""),
        ("lines", "BlockLine[]", ""), ("twoColumn", "boolean", ""),
        ("anchorId", "string", "")], "core")
    ent(c, 400, 720, 300, "MetadataField", [
        ("key / label", "string", ""), ("type", "MetadataValueType", ""),
        ("value", "string | null", ""), ("inherited", "boolean", "")], "core")

    ent(c, 40, 640, 230, "User", [
        ("id", "UserId pk", "pk"), ("email", "string", ""),
        ("role", "Role", "")], "sys")

    # relationships
    link(c, [(270, 150), (330, 150), (330, 170), (400, 170)], "1 : n")
    link(c, [(270, 360), (340, 360), (340, 190), (400, 190)], "0..1 : n")
    link(c, [(270, 510), (360, 510), (360, 210), (400, 210)], "n : n")
    link(c, [(270, 350), (300, 350), (300, 130), (270, 130)], None)
    c.t(302, 260, "1 : n", 10, P["fg-subtle"])
    link(c, [(700, 130), (830, 130)], "1 : n")
    link(c, [(955, 220), (955, 300)], "1 : n")
    link(c, [(700, 250), (770, 250), (770, 500), (830, 500)], "n : n")
    link(c, [(550, 430), (550, 560)], "1 : n")
    link(c, [(550, 690), (550, 720)], "1 : n")
    link(c, [(400, 240), (370, 240), (370, 300), (400, 300)], None)
    c.t(300, 305, "self ref", 10, P["fg-subtle"])

    # legend
    c.r(40, 890, 1160, 70, fill=P["bg-subtle"], stroke=P["border"], sw=1, rx=8)
    lx = 60
    for tone, lbl in (("core", "Content"), ("tax", "Taxonomy"), ("hist", "History"),
                      ("file", "Files"), ("sys", "Access")):
        accent = {"core": P["accent"], "tax": P["info-fg"], "hist": P["warning-fg"],
                  "file": P["success-fg"], "sys": P["fg-subtle"]}[tone]
        c.r(lx, 912, 4, 16, fill=accent, rx=2)
        c.t(lx + 14, 925, lbl, 11.5, P["fg-muted"])
        lx += 130
    c.t(700, 912, "pk  primary key", 10.5, P["accent-fg"], f=FM)
    c.t(700, 930, "fk  foreign key — referenced by id, never embedded", 10.5, P["fg-subtle"], f=FM)
    c.t(700, 948, "?   nullable", 10.5, P["fg-subtle"], f=FM)

    reg("M1", "Entity relationship map", [
        "Category to Specification is one-to-many and exclusive — a specification belongs to exactly one category, as confirmed.",
        "SubGroup is the nullable middle tier. A category may expose specifications directly, which is how the reference system behaves and what the navigation component already handles.",
        "Tag is many-to-many and carries no hierarchy. It is the only axis that crosses categories.",
        "supersededById is a self-reference, required when status is superseded and rejected when it points at the record itself.",
        "SpecBlock and MetadataField are owned by the specification, not shared. Everything else is referenced by id.",
        "Asset carries a role rather than a type hierarchy, so the same file model serves the media pane, the downloads bar and the attachments section.",
    ], c)


# ══ M2 · STATUS LIFECYCLE ═══════════════════════════════════════════════
def m2():
    c = C(1240, 640)
    c.t(40, 36, "Seven transitions permitted, thirteen blocked. Enforced by validateTransition() before anything is persisted —", 12.5, P["fg-subtle"])
    c.t(40, 56, "the lifecycle is a rule in the model, not a diagram in a document.", 12.5, P["fg-subtle"])

    nodes = {
        "draft":      (110, 250, "Draft", "neutral"),
        "in_review":  (390, 250, "In review", "warning"),
        "published":  (670, 250, "Published", "success"),
        "deprecated": (960, 150, "Deprecated", "danger"),
        "superseded": (960, 360, "Superseded", "info"),
    }
    edges = [("draft", "in_review", 0), ("in_review", "published", 0),
             ("draft", "published", -110), ("in_review", "draft", 46),
             ("published", "deprecated", 0), ("published", "superseded", 0),
             ("deprecated", "published", 40)]

    for a, b, bow in edges:
        x1, y1, _, _ = nodes[a]; x2, y2, _, _ = nodes[b]
        if a == "published" and b in ("deprecated", "superseded"):
            c.poly([(x1 + 80, y1 + 20), (x1 + 140, y1 + 20), (x1 + 140, y2 + 20), (x2 - 4, y2 + 20)],
                   stroke=P["border-strong"], sw=1.6)
            c.poly([(x2 - 12, y2 + 14), (x2 - 4, y2 + 20), (x2 - 12, y2 + 26)], stroke=P["border-strong"], sw=1.6)
        elif bow == 0:
            c.poly([(x1 + 80, y1 + 20), (x2 - 4, y2 + 20)], stroke=P["border-strong"], sw=1.6)
            c.poly([(x2 - 12, y2 + 14), (x2 - 4, y2 + 20), (x2 - 12, y2 + 26)], stroke=P["border-strong"], sw=1.6)
        elif bow < 0:
            c.poly([(x1 + 40, y1 + 4), (x1 + 40, y1 + bow), (x2 + 40, y1 + bow), (x2 + 40, y2 + 2)],
                   stroke=P["border-strong"], sw=1.6)
            c.poly([(x2 + 32, y2 - 8), (x2 + 40, y2 + 2), (x2 + 48, y2 - 8)], stroke=P["border-strong"], sw=1.6)
        else:
            c.poly([(x1 + 40, y1 + 44), (x1 + 40, y1 + 44 + bow), (x2 + 40, y1 + 44 + bow), (x2 + 40, y2 + 46)],
                   stroke=P["border-strong"], sw=1.6)
            c.poly([(x2 + 32, y2 + 56), (x2 + 40, y2 + 46), (x2 + 48, y2 + 56)], stroke=P["border-strong"], sw=1.6)

    for key, (x, y, label, tone) in nodes.items():
        c.r(x + 1, y + 3, 160, 44, fill=P["fg"], rx=22, op=0.06)
        c.r(x, y, 160, 44, fill=P[f"{tone}-bg"], stroke=P[f"{tone}-border"], sw=1.4, rx=22)
        c.circ(x + 22, y + 22, 4.5, fill=P[f"{tone}-fg"])
        c.t(x + 38, y + 27, label, 13, P[f"{tone}-fg"], w=700, f=FD)
        c.t(x, y + 62, f"'{key}'", 10.5, P["fg-subtle"], f=FM)

    c.t(110, 200, "start", 11, P["fg-subtle"])
    c.r(960, 428, 200, 24, fill=P["info-bg"], stroke=P["info-border"], sw=1, rx=6)
    c.t(1060, 444, "requires a replacement", 10.5, P["info-fg"], "middle", w=600)
    c.t(960, 470, "terminal — no onward transition", 10.5, P["fg-subtle"])

    c.r(40, 500, 1160, 110, fill=P["bg-subtle"], stroke=P["border"], sw=1, rx=8)
    c.t(62, 528, "WHY NOTHING RETURNS TO DRAFT", 11, P["fg-subtle"], w=700, ls=1.6, f=FD)
    for i, s in enumerate([
        "Once published, a specification is a document other people rely on — a supplier may already be printing from it.",
        "Correcting it means a new revision against the published record, not a silent regression to an unpublished state.",
        "Deprecated can return to Published because reinstating a retired specification is a legitimate editorial act.",
        "Superseded cannot, because the replacement relationship would become ambiguous.",
    ]):
        c.t(62, 552 + i * 18, "· " + s, 11.5, P["fg-muted"])

    reg("M2", "Specification lifecycle", [
        "Five states, the confirmed vocabulary. Every new specification starts in Draft.",
        "Draft can publish directly, skipping review, so a single author is not forced through an approval step that has no second party.",
        "Only Published can move to Deprecated or Superseded, which prevents a draft from being retired before it ever existed publicly.",
        "Superseded requires supersededById and is the only terminal state. Deprecated is reversible.",
        "publiclyVisible is a property of the state, so an unauthenticated reader never sees a Draft or In-review record without a separate permission check.",
    ], c)


# ══ M3 · EMPTY RECORD ANATOMY ═══════════════════════════════════════════
def m3():
    c = C(1240, 820)
    c.t(40, 36, "What a specification looks like the moment it is created. Nothing is invented — the verification script asserts this.", 12.5, P["fg-subtle"])

    lines = [
        ("{", 0, "p"),
        ('id: "k3m2p8xq4a7f",', 1, "v"),
        ('title: "",', 1, "e"),
        ('slug: "",', 1, "e"),
        ('code: "",', 1, "e"),
        ('description: "",', 1, "e"),
        ("categoryId: null,", 1, "e"),
        ("subGroupId: null,", 1, "e"),
        ("tagIds: [],", 1, "e"),
        ('status: "draft",', 1, "v"),
        ("supersededById: null,", 1, "e"),
        ("version: 0,", 1, "e"),
        ("publishedAt: null,", 1, "e"),
        ("blocks: [],", 1, "e"),
        ("metadata: [],", 1, "e"),
        ("mediaIds: [],", 1, "e"),
        ("downloadIds: [],", 1, "e"),
        ("attachmentIds: [],", 1, "e"),
        ("relatedIds: [],", 1, "e"),
        ("revisionIds: [],", 1, "e"),
        ("currentRevisionId: null,", 1, "e"),
        ('searchText: "",', 1, "e"),
        ("createdAt: null,  createdBy: null,", 1, "e"),
        ("updatedAt: null,  updatedBy: null,", 1, "e"),
        ("archivedAt: null, archivedBy: null,", 1, "e"),
        ("}", 0, "p"),
    ]
    c.r(40, 70, 560, 700, fill=P["bg-subtle"], stroke=P["border"], sw=1, rx=8)
    c.t(60, 98, "createSpecification()", 11.5, P["accent-fg"], w=700, f=FM)
    yy = 126
    for txt, ind, kind in lines:
        col = {"p": P["fg-muted"], "v": P["fg"], "e": P["fg-subtle"]}[kind]
        c.t(60 + ind * 20, yy, txt, 11.5, col, f=FM)
        yy += 24

    c.r(640, 70, 560, 340, fill=P["bg"], stroke=P["border"], sw=1, rx=8)
    c.t(662, 98, "THE ONLY TWO NON-EMPTY VALUES", 11, P["fg-subtle"], w=700, ls=1.6, f=FD)
    c.r(662, 116, 516, 60, fill=P["accent-subtle"], stroke=P["accent-border"], sw=1, rx=6)
    c.t(680, 140, "id", 12, P["accent-fg"], w=700, f=FM)
    c.t(680, 160, "A minted identifier. Sortable, collision-resistant.", 11.5, P["fg-muted"])
    c.r(662, 186, 516, 60, fill=P["bg-muted"], stroke=P["border"], sw=1, rx=6)
    c.t(680, 210, 'status: "draft"', 12, P["fg"], w=700, f=FM)
    c.t(680, 230, "The lifecycle has to start somewhere.", 11.5, P["fg-muted"])
    c.t(662, 278, "Everything else is an empty string, an empty array, a null,", 12, P["fg-muted"])
    c.t(662, 298, "or a zero. No placeholder text, no lorem ipsum, no defaults", 12, P["fg-muted"])
    c.t(662, 318, "borrowed from the reference system.", 12, P["fg-muted"])
    c.r(662, 340, 516, 46, fill=P["success-bg"], stroke=P["success-border"], sw=1, rx=6)
    c.t(680, 368, "npm run verify  —  23 checks, all passing", 11.5, P["success-fg"], w=700, f=FM)

    c.r(640, 434, 560, 336, fill=P["bg"], stroke=P["border"], sw=1, rx=8)
    c.t(662, 462, "THE EMPTY CATALOGUE", 11, P["fg-subtle"], w=700, ls=1.6, f=FD)
    yy = 492
    for txt, kind in [("{", "p"), ("specifications: {},", "e"), ("categories: {},", "e"),
                      ("subGroups: {},", "e"), ("tags: {},", "e"), ("assets: {},", "e"),
                      ("revisions: {},", "e"), ("users: {},", "e"),
                      ("index: { entries: [], builtAt: null },", "e"),
                      ("schemaVersion: 1,", "v"), ("generatedAt: null,", "e"), ("}", "p")]:
        col = {"p": P["fg-muted"], "v": P["fg"], "e": P["fg-subtle"]}[kind]
        c.t(662 + (0 if txt in ("{", "}") else 20), yy, txt, 11.5, col, f=FM)
        yy += 22
    c.t(662, yy + 14, "data/catalogue.empty.ts — the file the application loads on first run.", 11.5, P["fg-muted"])

    reg("M3", "The empty record", [
        "A newly created specification carries exactly two non-empty values: its identifier, and the draft status the lifecycle has to start from.",
        "Nulls and empty strings are used deliberately rather than interchangeably. Null means 'no value exists'; an empty string means 'a value exists and is blank'.",
        "Optional references are null, never undefined, so a record round-trips through JSON without changing shape.",
        "The shipping catalogue holds no categories, no specifications, no tags, no assets, no revisions and no users.",
        "verify.ts asserts all of this on every run, because 'every field ships empty' is easy to claim and easy to break with one careless default.",
    ], c)


# ══ M4 · REVISION DIFF ══════════════════════════════════════════════════
def m4():
    c = C(1240, 700)
    c.t(40, 36, "Field-level diffs — confirmed. A revision is written automatically on every save, so history is a by-product of authoring", 12.5, P["fg-subtle"])
    c.t(40, 56, "rather than a separate chore the author has to remember.", 12.5, P["fg-subtle"])

    c.r(40, 90, 380, 250, fill=P["bg"], stroke=P["border"], sw=1, rx=8)
    c.t(62, 118, "REVISION", 11, P["fg-subtle"], w=700, ls=1.6, f=FD)
    for i, (k, v) in enumerate([("version", "number — monotonic per spec"),
                                ("createdAt / createdBy", "who and when"),
                                ("summary", "authored, or generated"),
                                ("status", "state at the time"),
                                ("published", "publish event or draft save"),
                                ("changes", "FieldChange[]"),
                                ("snapshot", "full record, serialised")]):
        c.t(62, 148 + i * 24, k, 11.5, P["fg"], f=FM)
        c.t(400, 148 + i * 24, v, 11, P["fg-subtle"], "end")

    c.r(460, 90, 740, 250, fill=P["bg-subtle"], stroke=P["border"], sw=1, rx=8)
    c.t(482, 118, "FIELDCHANGE — ONE PER ALTERED FIELD", 11, P["fg-subtle"], w=700, ls=1.6, f=FD)
    hdr = [("PATH", 482), ("LABEL", 700), ("KIND", 920), ("BEFORE → AFTER", 1020)]
    for lbl, x in hdr:
        c.t(x, 148, lbl, 10, P["fg-subtle"], w=700, ls=1.2, f=FD)
    c.ln(482, 156, 1180, 156, P["border"], 1)
    rows = [("title", "Title", "changed", "info"),
            ("blocks.0.lines.4.text", "Technical · line 5", "changed", "info"),
            ("blocks.1.lines.2", "Requirements · line 3", "added", "success"),
            ("metadata.effective_date", "Effective date", "changed", "info"),
            ("downloadIds.2", "Die line v2.pdf", "removed", "danger")]
    for i, (path, label, kind, tone) in enumerate(rows):
        yy = 180 + i * 28
        c.t(482, yy, path, 10.5, P["accent-fg"], f=FM)
        c.t(700, yy, label, 11, P["fg-muted"])
        c.r(920, yy - 12, 76, 18, fill=P[f"{tone}-bg"], stroke=P[f"{tone}-border"], sw=1, rx=9)
        c.t(958, yy, kind, 9.5, P[f"{tone}-fg"], "middle", w=700, f=FD)
        c.t(1020, yy, "—  →  —", 10.5, P["fg-subtle"], f=FM)

    c.r(40, 380, 560, 280, fill=P["bg"], stroke=P["border"], sw=1, rx=8)
    c.t(62, 408, "WHY BOTH DIFFS AND A SNAPSHOT", 11, P["fg-subtle"], w=700, ls=1.6, f=FD)
    for i, s in enumerate([
        "Diffs answer 'what changed', which is what the history table shows",
        "and what a reviewer needs.",
        "",
        "The snapshot answers 'what did it look like', which is what restore",
        "needs. Replaying diffs backwards to reconstruct a record is fragile",
        "and gets more fragile as the schema evolves.",
        "",
        "Storing both costs disk and buys correctness. For a catalogue of",
        "hundreds of specifications that is the right trade.",
    ]):
        c.t(62, 436 + i * 20, s, 11.5, P["fg-muted"])

    c.r(640, 380, 560, 280, fill=P["bg"], stroke=P["border"], sw=1, rx=8)
    c.t(662, 408, "VERSIONING RULES", 11, P["fg-subtle"], w=700, ls=1.6, f=FD)
    for i, s in enumerate([
        "Specification.version is the published version, starting at 0",
        "and incrementing only on a publish event.",
        "",
        "Revision.version is monotonic per specification and increments",
        "on every save, published or not.",
        "",
        "So a specification at v3 may have twenty revisions behind it —",
        "seventeen drafts and three publishes. The downloads bar and the",
        "PDF export both carry the published version, never the revision",
        "count, so a printed sheet is never mistaken for current.",
    ]):
        c.t(662, 436 + i * 20, s, 11.5, P["fg-muted"])

    reg("M4", "Revision history and diffs", [
        "Every save writes a Revision. There is no separate 'record a change' action, because one that exists will not be used.",
        "FieldChange carries a dotted path, a human label for the diff view, a kind, and serialised before and after values.",
        "Paths reach into nested content — blocks.0.lines.4.text — so a change to one line of technical specification is recorded precisely, not as 'blocks changed'.",
        "A full snapshot accompanies the diffs so restore does not depend on replaying history backwards.",
        "Published version and revision count are different numbers and are never conflated. Exports carry the published version.",
    ], c)
