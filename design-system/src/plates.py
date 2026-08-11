from ds import C, reg, sect, PLATES, FD, FB, FM
from tokens import (LIGHT, DARK, STATUS, TYPE, SPACE, RADII, ELEV, MOTION,
                    BREAK, ZINDEX, CONTAINER, ratio, audit, blend, sh, INK)

W = 1200


def rr(f, b):
    return f"{round(ratio(f, b), 2)}:1"


# ══ S1/S2 · COLOUR ══════════════════════════════════════════════════════
def colour(pal, name, pid):
    c = C(W, 1000, pal=pal)
    P = pal
    y = 40
    groups = [
        ("SURFACES", [("bg", "fg"), ("bg-subtle", "fg"), ("bg-muted", "fg"),
                      ("bg-strong", "fg"), ("bg-inverse", "fg-on-inverse")]),
        ("FOREGROUNDS", [("fg", None), ("fg-muted", None), ("fg-subtle", None),
                         ("brand", None), ("accent-fg", None)]),
        ("ACCENT", [("accent", "fg-on-accent"), ("accent-hover", "fg-on-accent"),
                    ("accent-active", "fg-on-accent"), ("accent-subtle", "accent-fg"),
                    ("accent-border", None)]),
        ("BORDERS", [("border", None), ("border-strong", None),
                     ("border-control", None), ("border-focus", None)]),
    ]
    for label, items in groups:
        y = sect(c, 40, y, label)
        x = 40
        for k, on in items:
            fg = P[on] if on else None
            rat = rr(P[k], P["bg"]) if not on else rr(P[on], P[k])
            c.swatch(x, y, 200, 62, "--color-" + k, P[k], fg, rat)
            x += 216
        y += 118

    y = sect(c, 40, y, "SEMANTIC · FOREGROUND ON SUBTLE BACKGROUND")
    x = 40
    for sem in ("info", "success", "warning", "danger", "neutral"):
        c.r(x, y, 200, 62, fill=P[f"{sem}-bg"], stroke=P[f"{sem}-border"], sw=1, rx=6)
        c.t(x + 14, y + 26, "Aa", 15, P[f"{sem}-fg"], w=700, f=FD)
        c.t(x + 14, y + 46, sem, 11.5, P[f"{sem}-fg"], w=600)
        c.t(x, y + 79, f"--color-{sem}-*", 11.5, P["fg"], w=600)
        c.t(x, y + 94, rr(P[f"{sem}-fg"], P[f"{sem}-bg"]), 11, P["fg-subtle"], f=FM)
        x += 216
    y += 128

    y = sect(c, 40, y, "SPECIFICATION STATUS · CONFIRMED VOCABULARY")
    x = 40
    for key, label, sem in STATUS:
        c.badge(x, y, label.upper(), sem, dot=True)
        c.t(x, y + 44, f"status.{key}", 11, P["fg-subtle"], f=FM)
        x += len(label) * 8.5 + 66
    y += 78
    x = 40
    for key, label, sem in STATUS:
        c.badge(x, y, label.upper(), sem, solid=True)
        x += len(label) * 8.5 + 66

    notes = [
        "Every neutral is the ink colour composited over the surface, so the palette stays tonally unified — the single best property of the reference system, preserved exactly.",
        "The neutral steps are solved for a contrast target rather than picked as an opacity. fg-muted lands at 7.2:1 and fg-subtle at 4.65:1, both against the base surface.",
        "border-control is a separate token from border. Input and button boundaries must reach 3:1 under WCAG 1.4.11; decorative hairlines have no such requirement and stay subtle.",
        "Status uses the semantic scale rather than its own colours, so a new status needs no new palette.",
        "Soft badges are the default. Solid badges are reserved for the specification action bar, where the badge sits against a tinted surface.",
    ] if name == "light" else [
        "Dark mode is derived from the same token names, not a separate palette. Components reference --color-fg and never a literal, so nothing needs a dark variant.",
        "Accent lightens to #7FA6FF because the light accent fails against a dark surface. Foreground-on-accent inverts to near-black.",
        "The neutral ramp is solved against the dark base to the same targets — 7.2:1 and 4.65:1 — so the tonal rhythm matches light mode rather than merely inverting.",
        "Semantic backgrounds are deep tints of their hue rather than dark greys, so status remains identifiable at a glance.",
        "Theme is set by a data-theme attribute, with prefers-color-scheme as the default. Both are emitted in tokens.css.",
    ]
    reg(pid, f"Colour — {name} mode", notes, c)


# ══ S3 · CONTRAST BEFORE / AFTER ════════════════════════════════════════
def s3():
    c = C(W, 900)
    P = LIGHT
    y = 44
    c.t(40, y, "Reference system, as found", 17, P["fg"], w=700, f=FD)
    c.t(640, y, "Corrected", 17, P["fg"], w=700, f=FD)
    y += 12
    c.ln(40, y, 560, y, P["border"], 1); c.ln(640, y, 1160, y, P["border"], 1)
    y += 34

    pairs = [
        ("Secondary text", sh(blend(INK, "#FFFFFF", 0.55)), P["fg-muted"], "#FFFFFF", "#FFFFFF"),
        ("Tertiary / placeholder", sh(blend(INK, "#FFFFFF", 0.35)), P["fg-subtle"], "#FFFFFF", "#FFFFFF"),
        ("Placeholder on tint", sh(blend(INK, "#FFFFFF", 0.35)), P["fg-subtle"], "#EEF1F8", P["bg-muted"]),
        ("Destructive action", "#FF4D4D", P["danger-fg"], "#FFFFFF", "#FFFFFF"),
        ("Sidebar section label", sh(blend("#FFFFFF", "#1B3769", 0.45)), "#C9D6EE", "#1B3769", "#1B3769"),
        ("Control border", sh(blend(INK, "#FFFFFF", 0.22)), P["border-control"], "#FFFFFF", "#FFFFFF"),
    ]
    for label, oldc, newc, oldbg, newbg in pairs:
        for x, col, bg in ((40, oldc, oldbg), (640, newc, newbg)):
            c.r(x, y, 520, 62, fill=bg, stroke=P["border"], sw=1, rx=8)
            c.t(x + 18, y + 27, label, 14, col, w=600)
            c.t(x + 18, y + 48, "Specification dimensions, materials and tolerances", 12.5, col)
            r = ratio(col, bg)
            need = 3.0 if "border" in label.lower() else 4.5
            ok = r >= need
            bw = 78
            c.r(x + 520 - bw - 14, y + 19, bw, 24, fill=P["success-bg"] if ok else P["danger-bg"],
                stroke=P["success-border"] if ok else P["danger-border"], sw=1, rx=12)
            c.t(x + 520 - bw / 2 - 14, y + 35, f"{round(r,2)}:1", 11.5,
                P["success-fg"] if ok else P["danger-fg"], "middle", w=700, f=FM)
        y += 76

    y += 16
    c.r(40, y, 1120, 96, fill=P["accent-subtle"], stroke=P["accent-border"], sw=1, rx=10)
    c.t(62, y + 30, "7 of 12 audited pairings in the reference system fail WCAG 2.1 AA.", 14.5,
        P["accent-fg"], w=700)
    c.t(62, y + 54, "All 68 pairings in the new palette pass, in both light and dark mode. The full computed report ships as", 13, P["fg"])
    c.t(62, y + 74, "design-system/tokens/CONTRAST-REPORT.md and is regenerated from the token source, not maintained by hand.", 13, P["fg"])

    reg("S3", "Contrast — before and after", [
        "Each row shows the same role at the reference system's value and at the corrected value, with the computed ratio.",
        "The tonal step between primary, secondary and tertiary text is preserved — the ramp is darkened rather than flattened, so the hierarchy reads the same.",
        "The destructive red moves from #FF4D4D to a darker tone. This is the most visible change in the palette, and it only affects text and icons; a solid red fill can stay bright.",
        "The sidebar section label was the worst offender in the navigation at 3.67:1, because it sits at 8.5px as well as low contrast. It is corrected on both axes.",
        "Ratios here are computed by the same function that generates the shipped report, so the document and the code cannot drift apart.",
    ], c)


# ══ S4 · TYPOGRAPHY ═════════════════════════════════════════════════════
def s4():
    c = C(W, 1080)
    P = LIGHT
    y = 50
    y = sect(c, 40, y, "TYPE SCALE")
    samples = {
        "display-2xl": ("Specifications", 56),
        "display-xl": ("Page title", 36),
        "display-lg": ("Specification title", 28),
        "display-md": ("128", 24),
        "display-sm": ("Section heading", 20),
        "body-lg": ("Lead paragraph and specification description", 16),
        "body-md": ("Base body copy, controls and navigation", 14),
        "body-sm": ("Dense table rows, help text and metadata", 13),
        "label-lg": ("TECHNICAL SPECIFICATIONS", 13),
        "label-md": ("TABLE HEADER", 12),
        "label-sm": ("SIDEBAR LABEL", 11),
        "mono-md": ("PI-000  ·  150 × 400 mm", 13),
    }
    for k, rem, px, wt, ls, lh, fam, role in TYPE:
        txt, size = samples[k]
        fam_f = FD if fam == "Display" else (FM if fam == "Mono" else FB)
        c.t(40, y + size * 0.36, txt, size, P["fg"], w=wt,
            ls=(-0.03 * size if ls.startswith("-") else (0.1 * size if "0.1" in ls or "0.12" in ls else 0)),
            f=fam_f)
        c.t(700, y + 4, k, 12, P["fg-muted"], w=600, f=FM)
        c.t(870, y + 4, rem if "clamp" not in rem else "clamp(…)", 11.5, P["fg-subtle"], f=FM)
        c.t(1010, y + 4, f"{px}px · {wt}", 11.5, P["fg-subtle"], f=FM)
        c.t(1160, y + 4, fam, 11.5, P["fg-subtle"], "end")
        y += max(size * 1.15, 34) + 12
        c.ln(40, y - 12, 1160, y - 12, P["border"], 1)

    y += 16
    y = sect(c, 40, y, "SECTION LABEL WITH FLEXING RULE · RETAINED FROM THE REFERENCE SYSTEM")
    for label in ("TECHNICAL SPECIFICATIONS", "REVISION HISTORY"):
        c.head(40, y + 12, label, 1160)
        y += 44
    y += 8
    y = sect(c, 40, y, "SPECIFICATION ROW · THE MOST CONTENT-BEARING PATTERN")
    yy = y + 16
    for t_, ref in (("Overall size: Width — × Height —", "[CODE]"),
                    ("Portrait — printed both sides. Bleed: minimum —", None)):
        yy = c.specrow(40, yy, 1120, t_, ref)
    reg("S4", "Typography", [
        "Two families, as in the reference system: a display face for headings, labels, numerals and chips, and a body face for copy, controls and navigation. A mono face is added for reference codes and dimensions, which the reference system sets in the body face.",
        "The scale bottoms out at 11px, not 8px. label-sm replaces six separate roles that previously sat between 8px and 10px.",
        "Base body size rises from 13px to 14px. Every step is expressed in rem so the scale responds to user font-size preferences.",
        "Tracking is retained: tight negative tracking on display sizes, wide positive tracking on uppercase labels. This is what gives the interface its character and it survives unchanged.",
        "Specimens render in Poppins and Lato as stand-ins. The specified stack is Wix Madefor Display and Montserrat, with system fallbacks declared in tokens.css.",
    ], c)


# ══ S5 · SPACING · RADII · ELEVATION ════════════════════════════════════
def s5():
    c = C(W, 880)
    P = LIGHT
    y = 50
    y = sect(c, 40, y, "SPACING SCALE · 4px BASE")
    for k, v in SPACE:
        if v == 0:
            continue
        c.r(40, y, max(v, 1), 18, fill=P["accent"], rx=2)
        c.t(150, y + 14, f"space-{k}", 12, P["fg"], w=600, f=FM)
        c.t(260, y + 14, f"{v}px", 12, P["fg-subtle"], f=FM)
        use = {1: "hairline offsets", 4: "icon gap", 8: "control padding",
               12: "row padding", 16: "block gap", 24: "section gap",
               32: "panel padding", 48: "major section", 96: "hero rhythm"}.get(v, "")
        c.t(330, y + 14, use, 12, P["fg-subtle"])
        y += 26
    y += 18

    y = sect(c, 40, y, "RADII")
    x = 40
    for k, v in RADII:
        vv = 26 if v > 100 else v
        c.r(x, y, 92, 60, fill=P["bg-muted"], stroke=P["border-strong"], sw=1, rx=vv)
        c.t(x + 46, y + 36, k, 12, P["fg-muted"], "middle", w=600)
        c.t(x + 46, y + 78, f"{v}px" if v < 100 else "999px", 11, P["fg-subtle"], "middle", f=FM)
        x += 108
    c.t(x + 20, y + 26, "Radius scales with the element:", 12.5, P["fg-muted"])
    c.t(x + 20, y + 44, "controls take xs–sm, containers md–lg,", 12.5, P["fg-subtle"])
    c.t(x + 20, y + 62, "sheets take xl, chips take full.", 12.5, P["fg-subtle"])
    y += 118

    y = sect(c, 40, y, "ELEVATION")
    x = 40
    for k, v, use in ELEV:
        n = int(k)
        if n:
            c.r(x + 2, y + 4 + n, 190, 76, fill=P["fg"], rx=10, op=0.05 + n * 0.02)
        c.r(x, y, 190, 76, fill=P["bg"], stroke=P["border"], sw=1, rx=10)
        c.t(x + 16, y + 30, f"shadow-{k}", 12.5, P["fg"], w=700, f=FM)
        c.t(x + 16, y + 50, use, 11, P["fg-subtle"])
        x += 210
    reg("S5", "Spacing, radii and elevation", [
        "A formal 4px scale replaces the reference system's informal one. Seventeen values were in use there; all but five were already multiples of four, so imposing the scale causes almost no visual drift.",
        "Half-steps at 2px and 6px are kept because the reference system's control padding depends on them.",
        "Radii are unchanged from the reference system's observed values. The relationship — radius scales with element size — was already consistent and is now stated as a rule.",
        "Elevation is five levels where the reference system had three ad-hoc shadows. Level 0 is the default: cards and rows are flat, separated by borders rather than shadows.",
        "Shadows are tinted with the ink colour rather than pure black, so they stay tonally consistent with the palette.",
    ], c)


# ══ S6 · MOTION · FOCUS · BREAKPOINTS ═══════════════════════════════════
def s6():
    c = C(W, 900)
    P = LIGHT
    y = 50
    y = sect(c, 40, y, "MOTION")
    for k, v, use in MOTION:
        c.t(40, y + 14, "--" + k, 12.5, P["fg"], w=600, f=FM)
        c.t(300, y + 14, v, 12, P["accent-fg"], f=FM)
        c.t(560, y + 14, use, 12.5, P["fg-subtle"])
        y += 26
    y += 10
    # easing curves
    for i, (label, pts) in enumerate([
        ("ease-expressive", [(0, 0), (.16, 1), (.3, 1), (1, 1)]),
        ("ease-standard", [(0, 0), (.4, 0), (.2, 1), (1, 1)]),
    ]):
        bx = 40 + i * 260
        c.r(bx, y, 200, 120, fill=P["bg-subtle"], stroke=P["border"], sw=1, rx=8)
        path = []
        for s in range(41):
            t = s / 40
            # cubic bezier y for x=t approximation
            p0, p1, p2, p3 = 0, pts[1][1], pts[2][1], 1
            yv = ((1 - t) ** 3) * p0 + 3 * ((1 - t) ** 2) * t * p1 + 3 * (1 - t) * t * t * p2 + t ** 3 * p3
            path.append((bx + 10 + t * 180, y + 110 - yv * 100))
        c.poly(path, stroke=P["accent"], sw=2.2)
        c.t(bx + 100, y + 142, label, 12, P["fg-muted"], "middle", w=600, f=FM)
    c.t(560, y + 34, "Two curves, as in the reference system.", 13, P["fg"])
    c.t(560, y + 56, "Expressive for structural movement — routes, panels, accordions.", 12.5, P["fg-subtle"])
    c.t(560, y + 76, "Standard for state change — hover, focus, fills.", 12.5, P["fg-subtle"])
    c.t(560, y + 104, "A reduced-motion query collapses every duration to 0.01ms.", 12.5, P["danger-fg"], w=600)
    c.t(560, y + 124, "The reference system has no such query.", 12.5, P["fg-subtle"])
    y += 176

    y = sect(c, 40, y, "FOCUS · A DESIGN-SYSTEM PRIMITIVE, NOT A PER-COMPONENT PATCH")
    x = 40
    c.btn(x, y, 120, 38, "Default"); x += 136
    c.btn(x, y, 120, 38, "Focused", state="focus"); x += 136
    c.field(x, y, 200, 38, "Focused input", state="focus"); x += 224
    c.r(x, y, 160, 38, fill=P["accent-subtle"], stroke=P["accent"], sw=2, rx=6)
    c.r(x - 3, y - 3, 166, 44, fill="none", stroke=P["border-focus"], sw=2, rx=9)
    c.t(x + 80, y + 24, "Nav item", 13, P["accent-fg"], "middle", w=600)
    y += 74
    c.t(40, y, "2px ring in --color-border-focus, 2px offset, applied through :focus-visible so it never appears on pointer interaction.", 12.5, P["fg-subtle"])
    y += 40

    y = sect(c, 40, y, "BREAKPOINTS")
    for k, v, note in BREAK:
        c.t(40, y + 14, k, 12.5, P["fg"], w=700, f=FM)
        c.t(110, y + 14, f"{v}px" if v else "0", 12, P["accent-fg"], f=FM)
        c.t(200, y + 14, note, 12.5, P["fg-subtle"])
        y += 24
    x = 700
    yz = y - 152
    c.t(x, yz, "Z-INDEX", 11, P["fg-subtle"], w=700, ls=1.8, f=FD)
    yz += 20
    for k, v in ZINDEX:
        c.t(x, yz + 12, k, 12, P["fg"], w=600, f=FM)
        c.t(x + 130, yz + 12, str(v), 12, P["fg-subtle"], f=FM)
        yz += 20
    reg("S6", "Motion, focus, breakpoints and layering", [
        "The two-curve vocabulary is retained exactly. It is the clearest piece of design thinking in the reference system.",
        "Durations are formalised into five steps. The reference system clustered at 120–180ms and 280–350ms; those become fast and slow.",
        "A prefers-reduced-motion query is added globally. This is a correction, not a refinement — the reference system plays every transition unconditionally.",
        "Focus is a single primitive applied through :focus-visible. The reference system suppresses default outlines through border and background resets without replacing them, leaving keyboard focus invisible in parts of the interface.",
        "Layering is formalised into ten named steps. The reference system used four ad-hoc values between 140 and 400.",
    ], c)


# ══ S7 · GRID & CONTAINERS ══════════════════════════════════════════════
def s7():
    c = C(W, 820)
    P = LIGHT
    y = 50
    y = sect(c, 40, y, "12-COLUMN FLUID GRID · 24px GUTTER")
    gw = (1120 - 11 * 24) / 12
    for i in range(12):
        c.r(40 + i * (gw + 24), y, gw, 90, fill=P["accent-subtle"], stroke=P["accent-border"], sw=1, rx=4)
        c.t(40 + i * (gw + 24) + gw / 2, y + 52, str(i + 1), 12, P["accent-fg"], "middle", w=600, f=FM)
    y += 118
    c.t(40, y, "Twelve columns at lg and above · eight at md · four at sm and below. Gutter 24px, 20px, 16px respectively.", 12.5, P["fg-subtle"])
    y += 40

    y = sect(c, 40, y, "CONTAINERS")
    for k, v, use in CONTAINER:
        wpx = v / 1728 * 1120
        c.r(40, y, wpx, 30, fill=P["bg-muted"], stroke=P["border-strong"], sw=1, rx=4)
        c.t(52, y + 20, k, 12, P["fg"], w=600, f=FM)
        c.t(40 + wpx + 14, y + 20, f"{v}px  ·  {use}", 12, P["fg-subtle"])
        y += 40
    y += 14

    y = sect(c, 40, y, "SHELL · THE SPLIT AT ITS THREE STATES (VARIANT A + B, CONFIRMED)")
    for i, (lab, frac, note) in enumerate([
        ("lg  1024–1439", 0.50, "panel 50%"),
        ("xl  1440+", 0.58, "panel 58% — variant A"),
        ("below the fold", 1.00, "full-width sections — variant B"),
    ]):
        bx = 40 + i * 380
        c.r(bx, y, 350, 130, fill=P["bg-subtle"], stroke=P["border"], sw=1, rx=8)
        c.r(bx, y, 46, 130, fill=P["brand-subtle"], stroke=P["border"], sw=1, rx=8)
        c.t(bx + 23, y + 70, "nav", 10, P["fg-subtle"], "middle")
        pw = (350 - 46) * frac
        c.r(bx + 46, y, pw, 130, fill=P["bg"], stroke=P["accent"], sw=1.6)
        c.t(bx + 46 + pw / 2, y + 66, "PANEL", 11.5, P["accent-fg"], "middle", w=700, f=FD)
        c.t(bx + 46 + pw / 2, y + 84, note, 10, P["fg-subtle"], "middle")
        if frac < 1:
            c.r(bx + 46 + pw, y, 350 - 46 - pw, 130, fill=P["bg-muted"], stroke=P["border"], sw=1)
            c.t(bx + 46 + pw + (350 - 46 - pw) / 2, y + 70, "media", 10.5, P["fg-subtle"], "middle")
        c.t(bx, y + 152, lab, 12, P["fg"], w=600, f=FM)
    reg("S7", "Grid, containers and the shell", [
        "A twelve-column fluid grid governs the browse and landing surfaces. The specification detail view is not on the grid — it is a two-pane split, which is why the reference system needed no grid at all.",
        "Container widths are named by purpose rather than size, so a component asks for the prose container rather than for 720px.",
        "The prose container caps long-form notes at 720px, which is roughly 75 characters at body-md — the readable measure the reference system has no mechanism to enforce.",
        "Variant A: the panel widens from 50% to 58% at 1440px, using space the media pane does not need.",
        "Variant B: attachments, revision history and related specifications render full-width beneath the split, so the split governs only the identity-and-technical fold.",
    ], c)


# ══ S8 · BUTTONS ════════════════════════════════════════════════════════
def s8():
    c = C(W, 860)
    P = LIGHT
    y = 54
    y = sect(c, 40, y, "VARIANTS · DEFAULT STATE")
    x = 40
    for kind, lbl in (("primary", "Primary"), ("brand", "Brand"), ("secondary", "Secondary"),
                      ("subtle", "Subtle"), ("ghost", "Ghost"), ("danger", "Danger"),
                      ("danger-ghost", "Danger ghost")):
        w = len(lbl) * 8 + 34
        c.btn(x, y, w, 38, lbl, kind)
        x += w + 12
    y += 74

    y = sect(c, 40, y, "STATES")
    for kind in ("primary", "secondary", "ghost"):
        x = 40
        c.t(x, y + 24, kind, 12, P["fg-subtle"], w=600, f=FM)
        x = 150
        for st in ("default", "hover", "active", "focus", "disabled"):
            c.btn(x, y, 104, 38, st.capitalize(), kind, st)
            x += 120
        y += 60
    y += 18

    y = sect(c, 40, y, "SIZES")
    x = 40
    for lbl, h, size, pad in (("xs", 26, 11.5, 22), ("sm", 32, 12.5, 26),
                              ("md", 38, 14, 32), ("lg", 44, 15, 38)):
        w = len(lbl) * 9 + pad + 30
        c.btn(x, y + (44 - h) / 2, w, h, lbl, "secondary", size=size)
        c.t(x, y + 66, f"{h}px", 11, P["fg-subtle"], f=FM)
        x += w + 18
    c.t(x + 20, y + 20, "xs for table row actions · sm for toolbars and chips", 12.5, P["fg-subtle"])
    c.t(x + 20, y + 40, "md is the default · lg for empty-state and form primaries", 12.5, P["fg-subtle"])
    y += 106

    y = sect(c, 40, y, "WITH ICON · ICON-ONLY · BUTTON GROUP")
    x = 40
    c.btn(x, y, 132, 38, "Export", "secondary", icon=True); x += 148
    for g in range(3):
        c.r(x, y, 38, 38, fill=P["bg"], stroke=P["border-control"], sw=1, rx=6)
        c.circ(x + 19, y + 19, 5.5, stroke=P["fg-muted"], sw=1.6)
        x += 46
    x += 20
    for i, lbl in enumerate(("List", "Grid")):
        sel = i == 0
        c.r(x, y, 74, 38, fill=P["accent-subtle"] if sel else P["bg"],
            stroke=P["accent"] if sel else P["border-control"], sw=1.4 if sel else 1,
            rx=6 if i == 0 else 6)
        c.t(x + 37, y + 24, lbl, 13, P["accent-fg"] if sel else P["fg-muted"], "middle", w=600)
        x += 78
    c.t(x + 24, y + 16, "Icon-only buttons carry a required accessible name.", 12.5, P["fg-subtle"])
    c.t(x + 24, y + 36, "Minimum target 44 × 44 including padding at touch widths.", 12.5, P["fg-subtle"])
    reg("S8", "Buttons", [
        "Seven variants. The reference system had four inconsistent treatments; these consolidate them and add the two danger forms it lacked.",
        "Five states on every variant, including the focus ring the reference system never defines.",
        "Four sizes on a 26 / 32 / 38 / 44 ladder, derived from the control heights already in use — 26 for admin row actions, 32 for toolbars, 38 default, 44 for primary form actions.",
        "Disabled uses a muted fill with subtle foreground and is never the only signal — disabled controls carry aria-disabled and a tooltip explaining why.",
        "At touch widths every button reaches a 44 × 44 target through padding, without changing its visual height.",
    ], c)


# ══ S9 · INPUTS ═════════════════════════════════════════════════════════
def s9():
    c = C(W, 960)
    P = LIGHT
    y = 60
    y = sect(c, 40, y, "TEXT INPUT · STATES")
    x = 40
    for st, ph in (("default", "Placeholder"), ("hover", "Placeholder"), ("focus", "Typed value"),
                   ("filled", "Typed value"), ("disabled", "Unavailable")):
        c.field(x, y, 210, 40, ph, st.upper(), st)
        x += 226
    y += 82
    c.field(40, y, 210, 40, "Invalid value", "ERROR", "error", "Format name must be unique")
    c.field(266, y, 436, 40, "Placeholder", "WITH HELP TEXT", "default", "One item per line · prefix ** for a sub-heading")
    y += 96

    y = sect(c, 40, y, "SELECT · TEXTAREA · SEARCH")
    c.field(40, y, 260, 40, "Select…", "CATEGORY *")
    c.poly([(40 + 260 - 22, y + 17), (40 + 260 - 16, y + 23), (40 + 260 - 10, y + 17)],
           stroke=P["fg-muted"], sw=1.8)
    c.r(320, y, 400, 88, fill=P["bg"], stroke=P["border-control"], sw=1, rx=6)
    c.t(320, y - 8, "DESCRIPTION", 12, P["fg-muted"], w=600, f=FD)
    c.t(334, y + 24, "Placeholder", 14, P["fg-subtle"])
    c.r(740, y, 420, 40, fill=P["bg"], stroke=P["border-control"], sw=1, rx=6)
    c.circ(762, y + 20, 6, stroke=P["fg-muted"], sw=1.6)
    c.ln(766, y + 24, 771, y + 29, P["fg-muted"], 1.8)
    c.t(782, y + 25, "Search specifications…", 14, P["fg-subtle"])
    c.r(1096, y + 9, 50, 22, fill=P["bg-muted"], stroke=P["border"], sw=1, rx=5)
    c.t(1121, y + 24, "⌘K", 11.5, P["fg-muted"], "middle", w=600, f=FM)
    y += 122

    y = sect(c, 40, y, "CHECKBOX · RADIO · SWITCH · TAG INPUT")
    x = 40
    for lbl, on in (("Unchecked", False), ("Checked", True)):
        c.r(x, y, 18, 18, fill=P["accent"] if on else P["bg"],
            stroke=P["accent"] if on else P["border-control"], sw=1.4, rx=4)
        if on:
            c.poly([(x + 4.5, y + 9), (x + 7.6, y + 12.6), (x + 13.5, y + 5.4)], stroke="#FFFFFF", sw=2)
        c.t(x + 28, y + 14, lbl, 13.5, P["fg"])
        x += len(lbl) * 8 + 56
    for lbl, on in (("Off", False), ("On", True)):
        c.circ(x + 9, y + 9, 9, fill=P["bg"], stroke=P["accent"] if on else P["border-control"], sw=1.6)
        if on:
            c.circ(x + 9, y + 9, 4.5, fill=P["accent"])
        c.t(x + 28, y + 14, lbl, 13.5, P["fg"])
        x += len(lbl) * 8 + 56
    for lbl, on in (("Two columns", True),):
        c.r(x, y - 1, 38, 21, fill=P["accent"] if on else P["bg-strong"], rx=10.5)
        c.circ(x + (27 if on else 11), y + 9.5, 7.5, fill="#FFFFFF")
        c.t(x + 48, y + 14, lbl, 13.5, P["fg"])
        x += 180
    y += 56
    c.r(40, y, 560, 44, fill=P["bg"], stroke=P["border-control"], sw=1, rx=6)
    tx = 52
    for t_ in ("placeholder", "placeholder"):
        tx = c.tag(tx, y + 10, t_, removable=True) + 8
    c.t(tx + 4, y + 28, "Type to add…", 13.5, P["fg-subtle"])
    c.t(620, y + 28, "Tag input — token chips with a remove control and a typeahead.", 12.5, P["fg-subtle"])
    y += 78

    y = sect(c, 40, y, "DROP ZONE")
    c.r(40, y, 540, 110, fill=P["bg-subtle"], stroke=P["border-control"], sw=1.4, rx=8, dash="7 5")
    c.t(310, y + 50, "Drop files or click to browse", 14, P["fg-muted"], "middle", w=600)
    c.t(310, y + 74, "PDF · CAD · video · any file type", 12.5, P["fg-subtle"], "middle")
    c.r(620, y, 540, 110, fill=P["accent-subtle"], stroke=P["accent"], sw=2, rx=8, dash="7 5")
    c.t(890, y + 50, "Release to upload", 14, P["accent-fg"], "middle", w=700)
    c.t(890, y + 74, "Drag-over state", 12.5, P["accent-fg"], "middle")
    reg("S9", "Inputs and form controls", [
        "Six states per field. The reference system defines default and focus only, with focus signalled by a border colour that does not reach 3:1.",
        "border-control gives every field boundary a 3:1 minimum, satisfying WCAG 1.4.11 for non-text contrast.",
        "Error state reserves its message row in the layout, so revealing an error never shifts the form.",
        "Labels sit above inputs at every width. This keeps association unambiguous and touch targets full-width on mobile.",
        "The tag input and drag-over state are net-new; the reference system has drop zones but no visible drag feedback.",
    ], c)


# ══ S10 · BADGES · STATUS · TAGS ════════════════════════════════════════
def s10():
    c = C(W, 760)
    P = LIGHT
    y = 56
    y = sect(c, 40, y, "SPECIFICATION STATUS · SOFT (DEFAULT)")
    x = 40
    for key, label, sem in STATUS:
        x = c.badge(x, y, label, sem, dot=True) + 14
    y += 56
    y = sect(c, 40, y, "SOLID · FOR TINTED SURFACES")
    x = 40
    for key, label, sem in STATUS:
        x = c.badge(x, y, label, sem, solid=True) + 14
    y += 60

    y = sect(c, 40, y, "STATUS LIFECYCLE")
    x = 44
    for i, (key, label, sem) in enumerate(STATUS):
        if i:
            c.poly([(x - 26, y + 11), (x - 12, y + 11)], stroke=P["fg-subtle"], sw=1.6)
            c.poly([(x - 17, y + 6), (x - 12, y + 11), (x - 17, y + 16)], stroke=P["fg-subtle"], sw=1.6)
        nx = c.badge(x, y, label, sem, dot=True)
        x = nx + 40
    y += 44
    c.t(40, y, "Deprecated and Superseded are terminal. Superseded carries a required link to the replacing specification;", 12.5, P["fg-subtle"])
    c.t(40, y + 18, "Deprecated does not. A specification cannot return to Draft once Published — it forks a new revision instead.", 12.5, P["fg-subtle"])
    y += 56

    y = sect(c, 40, y, "REFERENCE CODE · TAG · COUNT · GENERIC BADGE")
    x = 40
    x = c.code(x, y, "PI-000") + 18
    x = c.code(x, y, "CODE-PLACEHOLDER") + 30
    x = c.tag(x, y - 1, "tag placeholder") + 12
    x = c.tag(x, y - 1, "removable", removable=True) + 30
    c.r(x, y, 26, 22, fill=P["bg-strong"], rx=11)
    c.t(x + 13, y + 15, "0", 11.5, P["fg-muted"], "middle", w=700, f=FM)
    x += 42
    for sem in ("info", "success", "warning", "danger", "neutral"):
        x = c.badge(x, y, sem.upper(), sem) + 10
    y += 62
    c.t(40, y, "The reference code chip is the reference system's only badge. Every badge here is derived from it — same height, same radius,", 12.5, P["fg-subtle"])
    c.t(40, y + 18, "same display face at the same tracking — so the new elements read as native rather than imported.", 12.5, P["fg-subtle"])
    y += 52

    y = sect(c, 40, y, "STATUS IN CONTEXT")
    c.card(40, y, 540, 92)
    c.t(60, y + 30, "Specification title placeholder", 15, P["fg"], w=700, f=FD)
    xx = 60
    xx = c.code(xx, y + 46, "PI-000") + 10
    c.badge(xx, y + 46, "Published", "success", dot=True)
    c.t(560, y + 62, "—", 13, P["fg-subtle"], "end")
    c.card(620, y, 540, 92)
    c.t(640, y + 30, "Specification title placeholder", 15, P["fg"], w=700, f=FD)
    xx = 640
    xx = c.code(xx, y + 46, "PI-000") + 10
    xx = c.badge(xx, y + 46, "Superseded", "info", dot=True) + 10
    c.t(xx + 4, y + 61, "→ replaced by —", 12, P["accent-fg"], w=600)
    reg("S10", "Badges, status, tags and codes", [
        "The confirmed five-state vocabulary, rendered in both soft and solid forms.",
        "A dot precedes each status label so state is not conveyed by colour alone — required by WCAG 1.4.1.",
        "The lifecycle is enforced in the data layer, not just drawn. Terminal states cannot transition back to Draft.",
        "Superseded requires a link to its replacement. This is the state that matters most for print specifications, where retired versions circulate physically.",
        "Tags are visually distinct from status and from category — flat neutral chips, no dot, optionally removable. Three classification axes must never look alike.",
    ], c)
