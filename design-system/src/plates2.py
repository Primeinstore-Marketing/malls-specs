from ds import C, reg, sect, FD, FB, FM
from tokens import LIGHT, DARK, STATUS
from plates import W

P = LIGHT


# ══ S11 · CARDS ═════════════════════════════════════════════════════════
def s11():
    c = C(W, 780)
    y = 56
    y = sect(c, 40, y, "SPECIFICATION CARD · GRID VIEW")
    for i, (state, lab) in enumerate([("default", "Default"), ("hover", "Hover"), ("selected", "Selected")]):
        x = 40 + i * 300
        c.card(x, y, 270, 268, elev=1 if state == "hover" else 0, sel=state == "selected")
        c.r(x + 1, y + 1, 268, 132, fill=P["bg-muted"], rx=9)
        c.ln(x + 1, y + 1, x + 269, y + 133, P["border"], 1)
        c.ln(x + 269, y + 1, x + 1, y + 133, P["border"], 1)
        c.t(x + 135, y + 72, "MEDIA", 11, P["fg-subtle"], "middle", ls=1.4, f=FD)
        xx = x + 16
        xx = c.code(xx, y + 148, "PI-000") + 8
        c.badge(xx, y + 148, "Draft", "neutral", dot=True)
        c.r(x + 16, y + 186, 190, 12, fill=P["bg-strong"], rx=3)
        c.r(x + 16, y + 206, 120, 9, fill=P["bg-muted"], rx=3)
        c.ln(x + 1, y + 230, x + 269, y + 230, P["border"], 1)
        c.t(x + 16, y + 252, "Category placeholder", 12, P["fg-subtle"])
        c.t(x + 254, y + 252, "—", 12, P["fg-subtle"], "end")
        c.t(x, y + 292, lab, 12, P["fg-muted"], w=600, f=FM)
    y += 330

    y = sect(c, 40, y, "BOXED SUB-GROUP · RETAINED FROM THE REFERENCE SYSTEM")
    c.r(40, y, 540, 130, fill=P["bg-subtle"], stroke=P["border"], sw=1, rx=8)
    c.t(58, y + 26, "SUB-GROUP LABEL", 11, P["fg-subtle"], w=700, ls=1.6, f=FD)
    yy = y + 52
    for _ in range(3):
        c.circ(63, yy - 4, 3, fill=P["brand"])
        c.r(76, yy - 12, 380, 10, fill=P["bg-strong"], rx=3)
        yy += 24
    c.r(620, y, 540, 130, fill=P["bg"], stroke=P["border"], sw=1, rx=8)
    c.t(638, y + 26, "METADATA · DYNAMIC KEY / VALUE", 11, P["fg-subtle"], w=700, ls=1.6, f=FD)
    for i in range(4):
        gx = 638 + (i % 2) * 262
        gy = y + 56 + (i // 2) * 30
        c.t(gx, gy, "Field label", 12.5, P["fg-subtle"])
        c.t(gx + 240, gy, "—", 12.5, P["fg-muted"], "end")
    reg("S11", "Cards", [
        "The specification card has no precedent in the reference system, which has no grid, no summary card and no related-item card. It is built from the boxed sub-group's materials — same radius, same border, same tint.",
        "Hover raises to shadow-1 and nothing else. No scale, no lift beyond 1px. Motion in this system is restrained by design.",
        "Selected uses a 2px accent border rather than a fill, so the card's own content keeps its contrast.",
        "The whole card is one link target and one focus stop. Nested interactive elements inside a card are prohibited.",
        "Metadata renders as dynamic key/value rows — the confirmed structure. Labels are authored per specification or inherited from a category template, so a new field never needs a code change.",
    ], c)


# ══ S12 · TABLES ════════════════════════════════════════════════════════
def s12():
    c = C(W, 760)
    y = 56
    y = sect(c, 40, y, "DATA TABLE · SEMANTIC, SORTABLE, SELECTABLE")
    cols = [("", 44), ("NAME", 300), ("CODE", 130), ("CATEGORY", 220), ("STATUS", 150), ("UPDATED", 120), ("", 156)]
    x = 40
    c.r(40, y, 1120, 38, fill=P["bg-muted"], rx=6)
    for lbl, cw in cols:
        if lbl == "":
            if x == 40:
                c.r(x + 14, y + 11, 16, 16, fill=P["bg"], stroke=P["border-control"], sw=1.2, rx=4)
        else:
            c.t(x + 4, y + 24, lbl, 11.5, P["fg-muted"], w=700, ls=1.2, f=FD)
            if lbl in ("NAME", "UPDATED"):
                c.poly([(x + len(lbl) * 8 + 12, y + 21), (x + len(lbl) * 8 + 16, y + 16),
                        (x + len(lbl) * 8 + 20, y + 21)], stroke=P["accent"] if lbl == "NAME" else P["fg-subtle"], sw=1.6)
        x += cw
    y += 38
    for i in range(5):
        hov = i == 2
        c.r(40, y, 1120, 46, fill=P["bg-subtle"] if hov else P["bg"])
        c.ln(40, y + 46, 1160, y + 46, P["border"], 1)
        x = 40
        c.r(x + 14, y + 15, 16, 16, fill=P["accent"] if i == 1 else P["bg"],
            stroke=P["accent"] if i == 1 else P["border-control"], sw=1.2, rx=4)
        if i == 1:
            c.poly([(x + 18, y + 23), (x + 21, y + 26), (x + 26, y + 19)], stroke="#FFFFFF", sw=2)
        x += 44
        c.r(x + 4, y + 18, 210, 11, fill=P["bg-strong"], rx=3); x += 300
        c.code(x + 4, y + 12, "PI-000"); x += 130
        c.r(x + 4, y + 19, 130, 9, fill=P["bg-muted"], rx=3); x += 220
        c.badge(x + 4, y + 12, STATUS[i % 5][1], STATUS[i % 5][2], dot=True); x += 150
        c.t(x + 4, y + 28, "—", 12.5, P["fg-subtle"]); x += 120
        if hov:
            c.btn(x + 4, y + 11, 58, 24, "Edit", "secondary", size=11)
            c.btn(x + 68, y + 11, 74, 24, "Archive", "secondary", size=11)
    y += 46 * 5 + 22
    c.r(40, y, 1120, 46, fill=P["accent-subtle"], stroke=P["accent-border"], sw=1, rx=6)
    c.t(60, y + 28, "1 selected", 13, P["accent-fg"], w=700)
    xx = 150
    for lbl in ("Change status", "Add tag", "Archive"):
        w_ = len(lbl) * 7.4 + 26
        c.btn(xx, y + 9, w_, 28, lbl, "secondary", size=12)
        xx += w_ + 10
    y += 76

    y = sect(c, 40, y, "REVISION HISTORY · EMPTY, WITH THE COLUMN MODEL STILL LEGIBLE")
    c.r(40, y, 700, 34, fill=P["bg-muted"], rx=6)
    for lbl, off in (("VERSION", 14), ("DATE", 130), ("AUTHOR", 280), ("SUMMARY", 440)):
        c.t(40 + off, y + 22, lbl, 11, P["fg-muted"], w=700, ls=1.2, f=FD)
    c.r(40, y + 34, 700, 64, fill=P["bg"], stroke=P["border"], sw=1, rx=6, dash="6 5")
    c.t(390, y + 72, "No revisions recorded", 13, P["fg-subtle"], "middle")
    c.t(780, y + 40, "The empty state sits beneath the header, not in place of it, so", 12.5, P["fg-subtle"])
    c.t(780, y + 60, "the user can see what will appear here once the record is edited.", 12.5, P["fg-subtle"])
    c.t(780, y + 86, "Saving a specification writes a revision automatically.", 12.5, P["fg-muted"], w=600)
    reg("S12", "Tables", [
        "Real table semantics — thead, th with scope, and caption. The reference system draws its admin lists as CSS Grid rows, which screen readers cannot announce as rows and columns.",
        "Sortable columns carry an indicator and aria-sort. Sorting does not exist in the reference system at all.",
        "Selection column with an indeterminate header state, driving the bulk actions bar.",
        "Row actions appear on hover and focus, and are always present in the DOM so keyboard users reach them.",
        "Below 768px rows become stacked cards rather than scrolling horizontally — shown on Phase 2 plate R5.",
    ], c)


# ══ S13 · NAVIGATION ════════════════════════════════════════════════════
def s13():
    c = C(W, 800)
    y = 50
    y = sect(c, 40, y, "SIDEBAR · TREE")
    c.r(40, y, 300, 420, fill=P["brand-surface"], rx=8)
    c.r(56, y + 16, 268, 34, fill="#FFFFFF", rx=6, op=0.12)
    c.circ(76, y + 33, 6, stroke=P["brand-on-surface-muted"], sw=1.5)
    c.t(92, y + 38, "Filter navigation…", 12.5, P["brand-on-surface-muted"])
    yy = y + 72
    c.t(58, yy, "SECTION LABEL", 11, P["brand-on-surface-muted"], w=700, ls=1.6, f=FD)
    yy += 20
    items = [("Category placeholder", False, False), ("Category placeholder", True, True),
             ("Category placeholder", False, False)]
    for lbl, sel, open_ in items:
        if sel:
            c.r(52, yy, 276, 34, fill=LIGHT["accent"], rx=6, op=0.30)
            c.r(52, yy + 7, 3, 20, fill=LIGHT["accent"], rx=1.5)
        c.circ(70, yy + 17, 3, fill=P["brand-on-surface"], sw=0)
        c.t(84, yy + 22, lbl, 13, P["brand-on-surface"] if sel else P["brand-on-surface-muted"], w=600 if sel else 400)
        c.poly([(308, yy + 12), (314, yy + 17), (308, yy + 22)] if not open_
               else [(303, yy + 15), (309, yy + 21), (315, yy + 15)], stroke=P["brand-on-surface-muted"], sw=1.6)
        yy += 38
        if open_:
            for i in range(3):
                s = i == 1
                if s:
                    c.r(68, yy, 260, 30, fill=LIGHT["accent"], rx=5, op=0.34)
                    c.r(68, yy + 6, 3, 18, fill=LIGHT["accent"], rx=1.5)
                c.circ(86, yy + 15, 2.4, fill=P["brand-on-surface"], sw=0)
                c.t(98, yy + 20, "Specification placeholder", 12.5, "#FFFFFF" if s else P["brand-on-surface-muted"])
                yy += 34
    c.t(40, y + 444, "Selection = accent fill + 2px left edge bar. Retained exactly.", 12, P["fg-subtle"])
    c.t(40, y + 462, "Collapsed branches are unmounted, not hidden by overflow.", 12, P["danger-fg"], w=600)

    x = 400
    yy = y
    yy = sect(c, x, yy, "BREADCRUMB")
    cx = x
    for i, cr in enumerate(("Home", "Category", "Sub-group", "Specification")):
        last = i == 3
        c.t(cx, yy + 16, cr, 13, P["fg"] if last else P["fg-muted"], w=700 if last else 400)
        cx += len(cr) * 7.6 + 10
        if not last:
            c.t(cx, yy + 16, "›", 13, P["fg-subtle"]); cx += 16
    yy += 52

    yy = sect(c, x, yy, "ANCHOR RAIL · SCROLL-SPY")
    ax = x
    for i, lbl in enumerate(("Technical", "Requirements", "Metadata", "Notes", "Attachments")):
        w_ = len(lbl) * 7.2 + 24
        sel = i == 0
        c.r(ax, yy, w_, 28, fill=P["accent-subtle"] if sel else P["bg"],
            stroke=P["accent"] if sel else P["border"], sw=1.4 if sel else 1, rx=14)
        c.t(ax + w_ / 2, yy + 19, lbl, 12, P["accent-fg"] if sel else P["fg-muted"], "middle",
            w=700 if sel else 400)
        ax += w_ + 8
    yy += 62

    yy = sect(c, x, yy, "TABS")
    tx = x
    for i, lbl in enumerate(("Specs", "Categories", "Users", "Archive", "Settings")):
        w_ = len(lbl) * 7.8 + 30
        sel = i == 0
        c.t(tx + w_ / 2, yy + 20, lbl, 13.5, P["fg"] if sel else P["fg-muted"], "middle", w=700 if sel else 400)
        if sel:
            c.r(tx, yy + 32, w_, 2.5, fill=P["accent"], rx=1.5)
        tx += w_ + 10
    c.ln(x, yy + 34, x + 700, yy + 34, P["border"], 1)
    yy += 72

    yy = sect(c, x, yy, "PAGINATION")
    px = x
    for lbl, sel in (("‹", False), ("1", True), ("2", False), ("3", False), ("›", False)):
        c.r(px, yy, 36, 36, fill=P["accent"] if sel else P["bg"],
            stroke=None if sel else P["border-control"], sw=1, rx=6)
        c.t(px + 18, yy + 23, lbl, 13, "#FFFFFF" if sel else P["fg-muted"], "middle", w=600)
        px += 42
    c.t(px + 20, yy + 23, "Rows per page  ▾", 12.5, P["fg-subtle"])
    yy += 66

    yy = sect(c, x, yy, "TOP BAR")
    c.r(x, yy, 700, 52, fill=P["bg"], stroke=P["border"], sw=1, rx=8)
    c.r(x, yy, 150, 52, fill=P["brand-surface"], rx=8)
    c.t(x + 75, yy + 31, "LOGO", 11.5, "#FFFFFF", "middle", ls=1.4, f=FD)
    c.t(x + 168, yy + 31, "Home › Category", 12, P["fg-subtle"])
    c.r(x + 320, yy + 11, 210, 30, fill=P["bg-subtle"], stroke=P["border"], sw=1, rx=6)
    c.t(x + 340, yy + 31, "Search specifications", 12, P["fg-subtle"])
    c.btn(x + 552, yy + 11, 62, 30, "Admin", "secondary", size=12)
    c.btn(x + 622, yy + 11, 66, 30, "Sign out", "ghost", size=12)
    reg("S13", "Navigation, sidebar, breadcrumbs and tabs", [
        "The sidebar keeps the reference system's navy surface and its selection marker — accent fill plus a 2px left edge bar — because it is the clearest visual anchor in the product.",
        "White-on-navy text is corrected: the section label moves from 45% to a solid tint that reaches AA, and rises from 8.5px to 11px.",
        "Collapsed branches are unmounted and the closed drawer is marked inert, so their controls leave the tab order. The reference system leaves them focusable while invisible.",
        "Breadcrumbs become a real navigable trail with an ordered list and aria-current. The reference system's strip is decorative and drops its last segment on mobile.",
        "The anchor rail is a scroll-spy segmented control — the mechanism that lets twelve sections live in a half-width panel.",
    ], c)


# ══ S14 · OVERLAYS ══════════════════════════════════════════════════════
def s14():
    c = C(W, 820)
    y = 50
    y = sect(c, 40, y, "ACCORDION")
    for i, open_ in enumerate((True, False)):
        c.r(40, y, 520, 44, fill=P["bg-subtle"], stroke=P["border"], sw=1, rx=6)
        c.poly([(60, y + 19), (66, y + 25), (72, y + 19)] if open_ else [(62, y + 16), (68, y + 22), (62, y + 28)],
               stroke=P["fg-muted"], sw=1.8)
        c.t(86, y + 28, "Sub-group placeholder", 13.5, P["fg"], w=600)
        c.t(540, y + 28, "0 items", 12, P["fg-subtle"], "end")
        y += 44
        if open_:
            c.r(40, y, 520, 76, fill=P["bg"], stroke=P["border"], sw=1)
            for j in range(2):
                c.r(60, y + 18 + j * 26, 300, 10, fill=P["bg-strong"], rx=3)
            y += 76
        y += 12
    c.t(600, 76, "Height is measured, not capped. The reference system", 12.5, P["fg-subtle"])
    c.t(600, 94, "animates max-height to a fixed 600px ceiling, which", 12.5, P["fg-subtle"])
    c.t(600, 112, "silently clips any branch taller than that.", 12.5, P["danger-fg"], w=600)
    y += 20

    y = sect(c, 40, y, "MODAL · SHEET · TOOLTIP · POPOVER")
    c.r(40, y, 400, 230, fill=P["fg"], rx=8, op=0.55)
    c.r(70, y + 30, 340, 170, fill=P["bg"], stroke=P["border"], sw=1, rx=14)
    c.r(70, y + 30, 340, 52, fill=P["bg-subtle"], rx=14)
    c.t(92, y + 62, "Confirm archive", 15, P["fg"], w=700, f=FD)
    c.t(92, y + 106, "This specification will be archived and can be", 12.5, P["fg-muted"])
    c.t(92, y + 126, "restored from the Archive tab.", 12.5, P["fg-muted"])
    c.btn(226, y + 154, 78, 32, "Cancel", "secondary", size=12)
    c.btn(312, y + 154, 84, 32, "Archive", "danger", size=12)
    c.t(40, y + 250, "Modal — focus trapped, scroll locked, Escape closes, focus restored on close.", 12, P["fg-subtle"])

    c.r(480, y, 300, 230, fill=P["bg-subtle"], stroke=P["border"], sw=1, rx=8)
    c.r(480, y + 92, 300, 138, fill=P["bg"], stroke=P["border"], sw=1, rx=14)
    c.r(612, y + 104, 36, 4, fill=P["border-strong"], rx=2)
    c.t(500, y + 138, "FILTERS", 11, P["fg-subtle"], w=700, ls=1.6, f=FD)
    for j in range(2):
        c.r(500, y + 156 + j * 28, 16, 16, fill=P["bg"], stroke=P["border-control"], sw=1.2, rx=4)
        c.r(526, y + 160 + j * 28, 120, 9, fill=P["bg-strong"], rx=3)
    c.t(480, y + 250, "Bottom sheet — the mobile form of a modal.", 12, P["fg-subtle"])

    c.r(830, y + 20, 200, 34, fill=P["bg"], stroke=P["border-control"], sw=1, rx=6)
    c.t(930, y + 42, "Hover target", 13, P["fg-muted"], "middle")
    c.r(852, y + 64, 156, 34, fill=P["fg"], rx=6)
    c.poly([(922, y + 64), (930, y + 56), (938, y + 64)], fill=P["fg"], stroke=P["fg"], sw=1)
    c.t(930, y + 86, "Tooltip placeholder", 12, "#FFFFFF", "middle")
    c.t(830, y + 250, "Tooltip — describes, never the only source of", 12, P["fg-subtle"])
    c.t(830, y + 268, "information. Reachable on keyboard focus.", 12, P["fg-subtle"])

    c.r(830, y + 128, 300, 96, fill=P["bg"], stroke=P["border"], sw=1, rx=10)
    c.r(831, y + 129, 298, 34, fill=P["bg-subtle"], rx=9)
    c.t(848, y + 151, "SORT BY", 11, P["fg-subtle"], w=700, ls=1.6, f=FD)
    for j, lbl in enumerate(("Name", "Recently updated")):
        sel = j == 0
        c.r(838, y + 168 + j * 26, 284, 24, fill=P["accent-subtle"] if sel else "none", rx=5)
        c.t(852, y + 185 + j * 26, lbl, 12.5, P["accent-fg"] if sel else P["fg-muted"], w=600 if sel else 400)
    reg("S14", "Accordions, modals, sheets, tooltips and popovers", [
        "Accordion height is measured rather than capped, removing the reference system's 600px clipping ceiling.",
        "Modals trap focus, lock background scroll, close on Escape and restore focus to the trigger. None of this is implemented in the reference system's overlays.",
        "The bottom sheet is the mobile form of the modal — same component, different presentation, chosen by breakpoint rather than by a separate implementation.",
        "Tooltips describe and never carry information available nowhere else. They open on hover and on keyboard focus, and never contain interactive content.",
        "Popovers do contain interactive content and therefore take focus, unlike tooltips. Keeping the two distinct is what prevents keyboard traps.",
    ], c)


# ══ S15 · FEEDBACK ══════════════════════════════════════════════════════
def s15():
    c = C(W, 640)
    y = 56
    y = sect(c, 40, y, "ALERT · INLINE")
    for sem, title, msg in (("info", "Information", "Placeholder message for a neutral notice."),
                            ("success", "Saved", "Revision recorded automatically."),
                            ("warning", "Review required", "This specification has unpublished changes."),
                            ("danger", "Could not save", "Placeholder message with an error reference.")):
        c.r(40, y, 1120, 62, fill=P[f"{sem}-bg"], stroke=P[f"{sem}-border"], sw=1, rx=8)
        c.r(40, y, 4, 62, fill=P[f"{sem}-fg"], rx=2)
        c.circ(74, y + 31, 11, stroke=P[f"{sem}-fg"], sw=1.8)
        c.t(74, y + 36, "!" if sem in ("warning", "danger") else "i", 13, P[f"{sem}-fg"], "middle", w=700)
        c.t(102, y + 27, title, 13.5, P[f"{sem}-fg"], w=700)
        c.t(102, y + 47, msg, 12.5, P["fg-muted"])
        c.t(1140, y + 36, "✕", 13, P["fg-subtle"], "end")
        y += 74
    y += 14

    y = sect(c, 40, y, "TOAST")
    x = 40
    for sem, msg in (("success", "Specification saved"), ("danger", "Upload failed"), ("neutral", "Link copied")):
        c.r(x, y + 3, 340, 56, fill=P["fg"], rx=8, op=0.10)
        c.r(x, y, 340, 56, fill=P["bg"], stroke=P["border"], sw=1, rx=8)
        c.circ(x + 28, y + 28, 9, fill=P[f"{sem}-fg"])
        c.t(x + 50, y + 26, msg, 13, P["fg"], w=600)
        c.t(x + 50, y + 44, "Placeholder detail", 11.5, P["fg-subtle"])
        c.t(x + 320, y + 33, "Undo" if sem != "danger" else "Retry", 12, P["accent-fg"], "end", w=700)
        x += 360
    y += 88
    c.t(40, y, "Toasts announce through an aria-live polite region, auto-dismiss after 6 seconds, and pause on hover or focus.", 12.5, P["fg-subtle"])
    c.t(40, y + 20, "A toast never carries the only route to an action — Undo is always also reachable from the Archive tab or the record itself.", 12.5, P["fg-subtle"])
    reg("S15", "Alerts and toasts", [
        "Four semantic tones, each with an icon and a coloured leading bar so tone is never conveyed by colour alone.",
        "Inline alerts sit in the layout and persist. Toasts float and expire. The two are never interchangeable.",
        "Every toast announces politely to assistive technology and pauses its timer on hover or focus.",
        "Destructive confirmations use a modal, never a toast — an action that cannot be undone must be confirmed before it happens, not offered an undo after.",
        "The reference system has a notification panel but no inline alert and no toast; form errors surface only as browser validation.",
    ], c)


# ══ S16 · ICONS ═════════════════════════════════════════════════════════
def s16():
    c = C(W, 520)
    y = 56
    y = sect(c, 40, y, "ICON SET · 20px GRID · 1.6px STROKE")
    icons = ["search", "filter", "sort", "chevron", "close", "plus", "minus", "check",
             "download", "upload", "print", "link", "star", "bookmark", "edit", "trash",
             "archive", "restore", "image", "file", "video", "cad", "grid", "list",
             "menu", "user", "bell", "settings", "info", "warning", "external", "copy"]
    for i, name in enumerate(icons):
        x = 44 + (i % 8) * 142
        yy = y + (i // 8) * 92
        c.r(x, yy, 52, 52, fill=P["bg-subtle"], stroke=P["border"], sw=1, rx=8)
        cx, cy = x + 26, yy + 26
        s = P["fg-muted"]
        if name == "search":
            c.circ(cx - 2, cy - 2, 7, stroke=s, sw=1.6); c.ln(cx + 3, cy + 3, cx + 8, cy + 8, s, 1.8)
        elif name == "filter":
            c.poly([(cx - 8, cy - 7), (cx + 8, cy - 7), (cx + 2, cy), (cx + 2, cy + 8), (cx - 2, cy + 6), (cx - 2, cy)], stroke=s, sw=1.6)
        elif name in ("sort", "list"):
            for k in range(3):
                c.ln(cx - 8, cy - 6 + k * 6, cx + (8 - k * 3), cy - 6 + k * 6, s, 1.6)
        elif name == "chevron":
            c.poly([(cx - 3, cy - 7), (cx + 4, cy), (cx - 3, cy + 7)], stroke=s, sw=1.8)
        elif name == "close":
            c.ln(cx - 6, cy - 6, cx + 6, cy + 6, s, 1.8); c.ln(cx + 6, cy - 6, cx - 6, cy + 6, s, 1.8)
        elif name == "plus":
            c.ln(cx, cy - 7, cx, cy + 7, s, 1.8); c.ln(cx - 7, cy, cx + 7, cy, s, 1.8)
        elif name == "minus":
            c.ln(cx - 7, cy, cx + 7, cy, s, 1.8)
        elif name == "check":
            c.poly([(cx - 7, cy), (cx - 2, cy + 5), (cx + 7, cy - 5)], stroke=s, sw=1.9)
        elif name in ("download", "upload"):
            d = 1 if name == "download" else -1
            c.ln(cx, cy - 7 * d, cx, cy + 4 * d, s, 1.6)
            c.poly([(cx - 4, cy * 1 + 0 * d), (cx, cy + 4 * d), (cx + 4, cy)], stroke=s, sw=1.6)
            c.ln(cx - 7, cy + 8, cx + 7, cy + 8, s, 1.6)
        elif name == "print":
            c.r(cx - 7, cy - 2, 14, 8, stroke=s, sw=1.5, rx=2)
            c.r(cx - 4, cy - 8, 8, 6, stroke=s, sw=1.5, rx=1)
        elif name == "link":
            c.r(cx - 8, cy - 3, 8, 6, stroke=s, sw=1.6, rx=3)
            c.r(cx, cy - 3, 8, 6, stroke=s, sw=1.6, rx=3)
        elif name in ("star", "bookmark"):
            if name == "star":
                c.poly([(cx, cy - 8), (cx + 2.4, cy - 2), (cx + 8, cy - 2), (cx + 3.6, cy + 2),
                        (cx + 5.4, cy + 8), (cx, cy + 4.4), (cx - 5.4, cy + 8), (cx - 3.6, cy + 2),
                        (cx - 8, cy - 2), (cx - 2.4, cy - 2), (cx, cy - 8)], stroke=s, sw=1.5)
            else:
                c.poly([(cx - 6, cy - 8), (cx + 6, cy - 8), (cx + 6, cy + 8), (cx, cy + 3), (cx - 6, cy + 8), (cx - 6, cy - 8)], stroke=s, sw=1.6)
        elif name == "edit":
            c.poly([(cx - 7, cy + 7), (cx - 7, cy + 3), (cx + 3, cy - 7), (cx + 7, cy - 3), (cx - 3, cy + 7), (cx - 7, cy + 7)], stroke=s, sw=1.5)
        elif name in ("trash", "archive", "restore"):
            c.r(cx - 7, cy - 4, 14, 11, stroke=s, sw=1.5, rx=2)
            c.ln(cx - 8, cy - 4, cx + 8, cy - 4, s, 1.6)
            if name == "trash":
                c.ln(cx - 3, cy - 7, cx + 3, cy - 7, s, 1.6)
            if name == "restore":
                c.poly([(cx - 2, cy + 3), (cx, cy + 1), (cx + 2, cy + 3)], stroke=s, sw=1.5)
        elif name in ("image", "file", "video", "cad"):
            c.r(cx - 7, cy - 8, 14, 16, stroke=s, sw=1.5, rx=2)
            if name == "image":
                c.circ(cx - 2, cy - 3, 2, stroke=s, sw=1.3)
                c.poly([(cx - 6, cy + 5), (cx - 1, cy), (cx + 6, cy + 5)], stroke=s, sw=1.4)
            elif name == "video":
                c.poly([(cx - 2, cy - 4), (cx + 4, cy), (cx - 2, cy + 4), (cx - 2, cy - 4)], stroke=s, sw=1.4)
            elif name == "cad":
                c.ln(cx - 4, cy + 4, cx + 4, cy - 4, s, 1.3)
                c.circ(cx - 4, cy + 4, 1.6, stroke=s, sw=1.2); c.circ(cx + 4, cy - 4, 1.6, stroke=s, sw=1.2)
            else:
                for k in range(3):
                    c.ln(cx - 4, cy - 2 + k * 4, cx + 4, cy - 2 + k * 4, s, 1.3)
        elif name == "grid":
            for a in range(2):
                for b in range(2):
                    c.r(cx - 7 + a * 8, cy - 7 + b * 8, 6, 6, stroke=s, sw=1.4, rx=1)
        elif name == "menu":
            for k in range(3):
                c.ln(cx - 8, cy - 6 + k * 6, cx + 8, cy - 6 + k * 6, s, 1.7)
        elif name == "user":
            c.circ(cx, cy - 3, 4, stroke=s, sw=1.5)
            c.poly([(cx - 7, cy + 8), (cx - 6, cy + 3), (cx + 6, cy + 3), (cx + 7, cy + 8)], stroke=s, sw=1.5)
        elif name == "bell":
            c.poly([(cx - 6, cy + 3), (cx - 6, cy - 2), (cx, cy - 8), (cx + 6, cy - 2), (cx + 6, cy + 3), (cx - 6, cy + 3)], stroke=s, sw=1.5)
            c.ln(cx - 2, cy + 6, cx + 2, cy + 6, s, 1.5)
        elif name == "settings":
            c.circ(cx, cy, 3.4, stroke=s, sw=1.5); c.circ(cx, cy, 7.4, stroke=s, sw=1.4)
        elif name in ("info", "warning"):
            if name == "info":
                c.circ(cx, cy, 8, stroke=s, sw=1.5)
            else:
                c.poly([(cx, cy - 8), (cx + 8, cy + 6), (cx - 8, cy + 6), (cx, cy - 8)], stroke=s, sw=1.5)
            c.ln(cx, cy - 2, cx, cy + 3, s, 1.7)
        elif name == "external":
            c.r(cx - 7, cy - 3, 10, 10, stroke=s, sw=1.5, rx=2)
            c.poly([(cx, cy - 7), (cx + 7, cy - 7), (cx + 7, cy)], stroke=s, sw=1.5)
        elif name == "copy":
            c.r(cx - 7, cy - 7, 10, 10, stroke=s, sw=1.4, rx=2)
            c.r(cx - 3, cy - 3, 10, 10, stroke=s, sw=1.4, rx=2)
        c.t(x + 26, yy + 70, name, 10.5, P["fg-subtle"], "middle")
    reg("S16", "Icons", [
        "Thirty-two icons on a 20px grid with a 1.6px stroke, matching the reference system's stroke weight so they sit correctly beside its type.",
        "A single typed Icon component with a required name prop. The reference system writes each icon out inline at its point of use, with no component and no sprite.",
        "Decorative icons take aria-hidden. Icon-only buttons take an accessible name — the reference system's icon-only mobile controls have neither.",
        "Icons never carry meaning alone. Every icon-only control has a tooltip, and every status icon is paired with a text label.",
        "Sizes are 16, 20 and 24, tied to the type size they accompany rather than chosen per instance.",
    ], c)


# ══ S17 · STATES ════════════════════════════════════════════════════════
def s17():
    c = C(W, 860)
    y = 56
    y = sect(c, 40, y, "EMPTY · NO DATA AT ALL (THE SHIPPING STATE)")
    c.r(40, y, 540, 190, fill=P["bg-subtle"], stroke=P["border"], sw=1, rx=10, dash="7 5")
    c.circ(310, y + 56, 22, stroke=P["border-strong"], sw=1.8)
    c.ln(300, y + 56, 320, y + 56, P["border-strong"], 1.8)
    c.t(310, y + 100, "No specifications yet", 15, P["fg"], "middle", w=700, f=FD)
    c.t(310, y + 122, "Sign in and create the first record.", 12.5, P["fg-subtle"], "middle")
    c.btn(248, y + 140, 124, 34, "Create", "primary", size=13)

    c.r(620, y, 540, 190, fill=P["bg-subtle"], stroke=P["border"], sw=1, rx=10, dash="7 5")
    c.t(890, y + 74, "No specifications match", 15, P["fg"], "middle", w=700, f=FD)
    c.t(890, y + 96, "3 filters applied.", 12.5, P["fg-subtle"], "middle")
    c.btn(806, y + 118, 168, 34, "Clear all filters", "secondary", size=13)
    c.t(620, y + 210, "Filtered-empty is a distinct state — the resolution differs, so the message and the action differ.", 12, P["fg-subtle"])
    y += 246

    y = sect(c, 40, y, "SKELETON · RESERVES FINAL DIMENSIONS")
    for i in range(4):
        c.r(40, y + i * 56, 540, 46, fill=P["bg"], stroke=P["border"], sw=1, rx=6)
        c.skel(56, y + i * 56 + 12, 200, 11)
        c.skel(56, y + i * 56 + 28, 130, 8)
        c.skel(300, y + i * 56 + 16, 60, 18, rx=9)
        c.skel(380, y + i * 56 + 16, 74, 18, rx=9)
        c.skel(500, y + i * 56 + 20, 60, 9)
    c.t(620, y + 26, "Shown for any load expected to exceed 400ms.", 12.5, P["fg-muted"], w=600)
    c.t(620, y + 48, "Dimensions match the resolved row exactly, so nothing", 12.5, P["fg-subtle"])
    c.t(620, y + 66, "shifts when data arrives. A shimmer animation is applied", 12.5, P["fg-subtle"])
    c.t(620, y + 84, "only when prefers-reduced-motion is not set.", 12.5, P["fg-subtle"])

    c.circ(700, y + 148, 20, stroke=P["border-strong"], sw=3)
    c.poly([(700, y + 128), (700, y + 128)], stroke=P["accent"], sw=3)
    c.add(f'<path d="M 700 {y+128} A 20 20 0 0 1 720 {y+148}" fill="none" stroke="{P["accent"]}" stroke-width="3" stroke-linecap="round"/>')
    c.t(740, y + 144, "Spinner — delayed 400ms so a fast", 12.5, P["fg-subtle"])
    c.t(740, y + 162, "response never flashes it.", 12.5, P["fg-subtle"])
    y += 250

    y = sect(c, 40, y, "ERROR · NOT FOUND")
    c.r(40, y, 540, 150, fill=P["danger-bg"], stroke=P["danger-border"], sw=1, rx=10)
    c.circ(80, y + 44, 13, stroke=P["danger-fg"], sw=1.8)
    c.t(80, y + 50, "!", 15, P["danger-fg"], "middle", w=700)
    c.t(108, y + 40, "Something went wrong", 14.5, P["danger-fg"], w=700)
    c.t(108, y + 62, "Placeholder message. Error reference —", 12.5, P["fg-muted"])
    c.btn(108, y + 84, 106, 32, "Try again", "primary", size=12.5)
    c.btn(224, y + 84, 96, 32, "Go back", "secondary", size=12.5)

    c.r(620, y, 540, 150, fill=P["bg-subtle"], stroke=P["border"], sw=1, rx=10)
    c.t(890, y + 54, "404", 40, P["border-strong"], "middle", w=900, f=FD)
    c.t(890, y + 82, "This specification does not exist", 13.5, P["fg"], "middle", w=600)
    c.t(890, y + 102, "It may have been archived or renamed.", 12, P["fg-subtle"], "middle")
    c.r(700, y + 114, 380, 30, fill=P["bg"], stroke=P["border-control"], sw=1, rx=6)
    c.t(716, y + 134, "Search for it instead…", 12.5, P["fg-subtle"])
    reg("S17", "Empty, loading, error and skeleton states", [
        "Because every specification ships empty, these are not edge cases — for a period they are the primary experience. The reference system defines none of them.",
        "Empty-with-no-data and empty-after-filtering are separate components with different messages and different actions.",
        "Skeletons reserve the resolved dimensions exactly, so data arrival causes no layout shift.",
        "The spinner is delayed 400ms; the skeleton appears immediately. A fast response shows neither.",
        "404 offers search rather than only a link home, because a dead specification link usually means the record was renamed rather than removed.",
    ], c)


# ══ S18 · THEME APPLIED ═════════════════════════════════════════════════
def s18():
    c = C(W, 620)

    def frag(x, y, pal, label):
        Q = pal
        c.r(x, y, 540, 400, fill=Q["bg"], stroke=Q["border"], sw=1, rx=10)
        c.r(x, y, 540, 46, fill=Q["bg-subtle"], rx=10)
        c.r(x, y, 130, 46, fill=Q["brand-surface"], rx=10)
        c.t(x + 65, y + 28, "LOGO", 11, Q["brand-on-surface"], "middle", ls=1.4, f=FD)
        c.t(x + 148, y + 28, "Home › Category", 11.5, Q["fg-subtle"])
        c.r(x + 300, y + 9, 160, 28, fill=Q["bg"], stroke=Q["border"], sw=1, rx=6)
        c.t(x + 316, y + 28, "Search…", 11.5, Q["fg-subtle"])
        c.r(x + 1, y + 46, 130, 353, fill=Q["brand-surface"])
        yy = y + 70
        for i in range(5):
            sel = i == 1
            if sel:
                c.r(x + 10, yy, 112, 26, fill=Q["accent"], rx=5, op=0.30)
                c.r(x + 10, yy + 5, 2.5, 16, fill=Q["accent"], rx=1.2)
            c.r(x + 24, yy + 9, 78, 8, fill=Q["brand-on-surface"] if sel else Q["brand-on-surface-muted"], rx=3,
                op=1 if sel else 0.55)
            yy += 32
        px = x + 148
        c.t(px, y + 78, "Specification title", 17, Q["fg"], w=800, f=FD)
        xx = px
        c.r(xx, y + 90, 62, 20, fill=Q["accent-subtle"], stroke=Q["accent-border"], sw=1, rx=10)
        c.t(xx + 31, y + 104, "PI-000", 10.5, Q["accent-fg"], "middle", w=700, f=FM)
        c.r(xx + 70, y + 90, 86, 20, fill=Q["success-bg"], stroke=Q["success-border"], sw=1, rx=10)
        c.circ(xx + 80, y + 100, 3, fill=Q["success-fg"])
        c.t(xx + 90, y + 104, "Published", 10.5, Q["success-fg"], "start", w=700, f=FD)
        for j in range(3):
            c.r(px, y + 126 + j * 16, 340 - j * 90, 8, fill=Q["bg-muted"], rx=3)
        c.t(px, y + 196, "TECHNICAL SPECIFICATIONS", 10.5, Q["fg-muted"], w=700, ls=1.4, f=FD)
        c.ln(px + 174, y + 192, x + 512, y + 192, Q["border"], 1)
        yy = y + 220
        for j in range(3):
            c.circ(px + 3, yy - 4, 2.6, fill=Q["accent"])
            c.r(px + 14, yy - 11, 280 - j * 40, 8, fill=Q["bg-muted"], rx=3)
            yy += 20
        c.r(px, y + 296, 364, 62, fill=Q["bg-subtle"], stroke=Q["border"], sw=1, rx=8)
        c.t(px + 14, y + 318, "METADATA", 10, Q["fg-subtle"], w=700, ls=1.4, f=FD)
        for j in range(2):
            c.t(px + 14 + j * 180, y + 340, "Field label", 11, Q["fg-subtle"])
            c.t(px + 150 + j * 180, y + 340, "—", 11, Q["fg-muted"], "end")
        c.t(x, y + 424, label, 13, LIGHT["fg"], w=700, f=FD)

    frag(40, 46, LIGHT, "Light")
    frag(620, 46, DARK, "Dark")
    c.t(40, 520, "Identical markup. The only difference is the value bound to each token name — no dark variants, no duplicated components,", 12.5, LIGHT["fg-subtle"])
    c.t(40, 540, "no conditional classes. This is the payoff of naming tokens by role rather than by colour.", 12.5, LIGHT["fg-subtle"])
    reg("S18", "Theme applied — light and dark", [
        "The same component tree rendered under both token sets. Nothing in the markup or the component code differs.",
        "Dark mode is a Phase 9 requirement in your brief. Because it is derived from the token layer rather than retrofitted, it costs one stylesheet block.",
        "The brand navy surface persists in dark mode as the sidebar, so the product's silhouette is recognisable in both themes.",
        "Accent and semantic colours shift value but hold their hue, so a Published badge reads as the same thing in either theme.",
        "Theme is chosen by a data-theme attribute with prefers-color-scheme as the fallback, and is exposed in the settings tab shown on Phase 2 plate D14.",
    ], c)
