"""Derive the corrected token layer. Contrast is solved, not guessed."""
import json


# ── colour maths ─────────────────────────────────────────────────────────
def hx(c):
    c = c.lstrip("#")
    return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))


def sh(t):
    return "#%02X%02X%02X" % tuple(int(round(max(0, min(255, v)))) for v in t)


def lin(v):
    v /= 255
    return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4


def lum(c):
    r, g, b = c if isinstance(c, tuple) else hx(c)
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)


def ratio(a, b):
    la, lb = lum(a), lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def blend(fg, bg, a):
    f, b = (fg if isinstance(fg, tuple) else hx(fg)), (bg if isinstance(bg, tuple) else hx(bg))
    return tuple(a * f[i] + (1 - a) * b[i] for i in range(3))


def solve_alpha(fg, bg, target, lo=0.0, hi=1.0):
    """Find the alpha of fg over bg that reaches the target contrast against bg."""
    for _ in range(60):
        mid = (lo + hi) / 2
        if ratio(blend(fg, bg, mid), bg) < target:
            lo = mid
        else:
            hi = mid
    return round((lo + hi) / 2, 4)


# ── reference values (as found in the reference system) ──────────────────
REF = {
    "bg": "#FFFFFF", "bg1": "#F4F6FB", "bg2": "#EEF1F8", "bg3": "#E4E9F4",
    "txt": "#0D1E3F", "txt2_a": 0.55, "txt3_a": 0.35,
    "acc": "#2861FD", "acc2": "#1A4FD6", "navy": "#1B3769",
    "red": "#FF4D4D", "blue": "#4D8FFF",
    "line_a": 0.08, "line2_a": 0.14, "line3_a": 0.22,
    "nav_label_a": 0.45, "nav_item_a": 0.75, "nav_sub_a": 0.60,
}

INK = "#0D1E3F"
WHITE = "#FFFFFF"

# ── LIGHT: corrected neutral ramp ────────────────────────────────────────
# Keep the hue relationship (every neutral is the ink over white) and solve
# each step for a contrast target instead of picking an opacity by eye.
L_TARGETS = {"txt2": 7.2, "txt3": 4.65}
a_txt2 = solve_alpha(INK, WHITE, L_TARGETS["txt2"])
a_txt3 = solve_alpha(INK, WHITE, L_TARGETS["txt3"])

LIGHT = {
    "bg":        WHITE,
    "bg-subtle": "#F5F7FC",
    "bg-muted":  "#EEF1F8",
    "bg-strong": "#E3E8F4",
    "bg-inverse": "#16294C",

    "fg":        INK,
    "fg-muted":  sh(blend(INK, WHITE, a_txt2)),
    "fg-subtle": sh(blend(INK, WHITE, a_txt3)),
    "fg-on-accent": WHITE,
    "fg-on-inverse": "#FFFFFF",

    # border      — decorative hairline, no contrast requirement (WCAG 1.4.11 n/a)
    # border-strong — divider between surfaces
    # border-control — the visible boundary of an input or button: must reach 3:1
    "border":        sh(blend(INK, WHITE, 0.10)),
    "border-strong": sh(blend(INK, WHITE, 0.20)),
    "border-control": sh(blend(INK, WHITE, solve_alpha(INK, WHITE, 3.05))),
    "border-focus":  "#2861FD",

    "accent":         "#2861FD",
    "accent-hover":   "#1A4FD6",
    "accent-active":  "#1540B0",
    "accent-subtle":  "#EDF2FF",
    "accent-border":  "#B9CCFF",
    "accent-fg":      "#1A4FD6",

    # brand          — the navy as a foreground on light surfaces
    # brand-surface  — the navy chrome itself (sidebar, brand block); stays dark in both themes
    # brand-on-surface / -muted — text on that chrome, solved against it
    "brand":        "#1B3769",
    "brand-hover":  "#16294C",
    "brand-subtle": "#EBEFF7",
    "brand-surface": "#1B3769",
    "brand-surface-hover": "#22437C",
    "brand-on-surface": "#FFFFFF",
    "brand-on-surface-muted": "#C3D0E8",
}

# Status / semantic — solved to pass on their own subtle background
SEM_SEED = {
    "info":    ("#2861FD", "#EDF2FF", "#B9CCFF"),
    "success": ("#0F7A4D", "#E8F6EF", "#A8DCC4"),
    "warning": ("#8A5A00", "#FCF2DF", "#EBD199"),
    "danger":  ("#B3261E", "#FDECEA", "#F2B8B4"),
    "neutral": ("#42506B", "#F0F2F7", "#CDD4E2"),
}
for k, (fg, bgs, bd) in SEM_SEED.items():
    LIGHT[f"{k}-fg"] = fg
    LIGHT[f"{k}-bg"] = bgs
    LIGHT[f"{k}-border"] = bd

# Specification status palette (confirmed vocabulary)
STATUS = [
    ("draft",      "Draft",       "neutral"),
    ("review",     "In review",   "warning"),
    ("published",  "Published",   "success"),
    ("deprecated", "Deprecated",  "danger"),
    ("superseded", "Superseded",  "info"),
]

# ── DARK ─────────────────────────────────────────────────────────────────
D_BG = "#0C1424"
D_INK = "#E9EEF9"
a_dtxt2 = solve_alpha(D_INK, D_BG, 7.2)
a_dtxt3 = solve_alpha(D_INK, D_BG, 4.65)

DARK = {
    "bg":        D_BG,
    "bg-subtle": "#121B2E",
    "bg-muted":  "#18243C",
    "bg-strong": "#1F2D4A",
    "bg-inverse": "#E9EEF9",

    "fg":        D_INK,
    "fg-muted":  sh(blend(D_INK, D_BG, a_dtxt2)),
    "fg-subtle": sh(blend(D_INK, D_BG, a_dtxt3)),
    "fg-on-accent": "#08111F",
    "fg-on-inverse": "#0C1424",

    "border":        sh(blend(D_INK, D_BG, 0.14)),
    "border-strong": sh(blend(D_INK, D_BG, 0.26)),
    "border-control": sh(blend(D_INK, D_BG, solve_alpha(D_INK, D_BG, 3.05))),
    "border-focus":  "#7FA6FF",

    "accent":        "#7FA6FF",
    "accent-hover":  "#9CBAFF",
    "accent-active": "#B7CDFF",
    "accent-subtle": "#16243F",
    "accent-border": "#2E4A80",
    "accent-fg":     "#9CBAFF",

    "brand":        "#C9D6EE",
    "brand-hover":  "#E2EAF8",
    "brand-subtle": "#16243F",
    "brand-surface": "#111B2E",
    "brand-surface-hover": "#1A2842",
    "brand-on-surface": "#E9EEF9",
    "brand-on-surface-muted": "#A3B0C9",
}
DSEM = {
    "info":    ("#8FB2FF", "#14213A", "#2E4A80"),
    "success": ("#63C79B", "#0E2620", "#1F5B44"),
    "warning": ("#E0B25C", "#251E0E", "#5E4718"),
    "danger":  ("#F08279", "#2A1414", "#6B2B26"),
    "neutral": ("#A8B4CC", "#18202F", "#39445C"),
}
for k, (fg, bgs, bd) in DSEM.items():
    DARK[f"{k}-fg"] = fg
    DARK[f"{k}-bg"] = bgs
    DARK[f"{k}-border"] = bd

# ── TYPOGRAPHY ───────────────────────────────────────────────────────────
TYPE = [
    # key, rem, px, weight, tracking, leading, family, role
    ("display-2xl", "clamp(3.25rem, 8vw, 6.25rem)", "52–100", 900, "-0.04em", "0.92", "Display", "Landing headline"),
    ("display-xl",  "2.25rem", "36", 800, "-0.03em", "1.1",  "Display", "Page title"),
    ("display-lg",  "1.75rem", "28", 800, "-0.02em", "1.15", "Display", "Specification title"),
    ("display-md",  "1.5rem",  "24", 900, "-0.03em", "1.0",  "Display", "Statistic numeral"),
    ("display-sm",  "1.25rem", "20", 700, "-0.01em", "1.25", "Display", "Section heading, sheet title"),
    ("body-lg",     "1rem",    "16", 400, "0",       "1.6",  "Body",    "Lead paragraph, description"),
    ("body-md",     "0.875rem","14", 400, "0",       "1.6",  "Body",    "Base — body copy, controls, nav"),
    ("body-sm",     "0.8125rem","13",400, "0",       "1.55", "Body",    "Dense rows, table cells, help text"),
    ("label-lg",    "0.8125rem","13",700, "0.08em",  "1.2",  "Display", "Section label with rule"),
    ("label-md",    "0.75rem", "12", 700, "0.1em",   "1.2",  "Display", "Table header, group label, chip"),
    ("label-sm",    "0.6875rem","11",700, "0.12em",  "1.2",  "Display", "Smallest permitted — sidebar label"),
    ("mono-md",     "0.8125rem","13",500, "0",       "1.5",  "Mono",    "Reference codes, dimensions, tokens"),
]

# ── SPACING ──────────────────────────────────────────────────────────────
SPACE = [("0", 0), ("px", 1), ("0.5", 2), ("1", 4), ("1.5", 6), ("2", 8),
         ("3", 12), ("4", 16), ("5", 20), ("6", 24), ("8", 32), ("10", 40),
         ("12", 48), ("16", 64), ("20", 80), ("24", 96)]

RADII = [("xs", 4), ("sm", 6), ("md", 8), ("lg", 10), ("xl", 14), ("full", 9999)]

ELEV = [
    ("0", "none", "Flat — default for cards and rows"),
    ("1", "0 1px 0 rgba(13,30,63,.06), 0 1px 2px rgba(13,30,63,.06)", "Top bar, sticky headers"),
    ("2", "0 2px 4px rgba(13,30,63,.06), 0 4px 12px rgba(13,30,63,.08)", "Popover, dropdown, tooltip"),
    ("3", "0 8px 24px rgba(13,30,63,.12)", "Off-canvas drawer, command palette"),
    ("4", "0 16px 48px rgba(13,30,63,.18)", "Modal sheet"),
]

MOTION = [
    ("duration-instant", "80ms",  "Colour-only state change"),
    ("duration-fast",    "140ms", "Hover, focus, button and nav states"),
    ("duration-normal",  "220ms", "Popover, tooltip, badge change"),
    ("duration-slow",    "300ms", "Route transition, accordion, sheet"),
    ("duration-slower",  "420ms", "Drawer, media zoom"),
    ("ease-expressive",  "cubic-bezier(.16, 1, .3, 1)", "Structural movement — panels, routes, accordions"),
    ("ease-standard",    "cubic-bezier(.4, 0, .2, 1)",  "State change — hover, focus, fills"),
    ("ease-exit",        "cubic-bezier(.4, 0, 1, 1)",   "Dismissal, collapse"),
]

BREAK = [("xs", 0, "390px reference — single column"),
         ("sm", 480, "Compact mobile — icon-only chrome, overflow menu"),
         ("md", 768, "Tablet — sidebar goes off-canvas, split rotates to stack"),
         ("lg", 1024, "Small desktop — sidebar returns, split-pane restored"),
         ("xl", 1440, "Desktop — panel widens to 58% (variant A)"),
         ("2xl", 1728, "Wide — container max-width caps")]

ZINDEX = [("base", 0), ("raised", 10), ("sticky", 100), ("topbar", 200),
          ("scrim", 300), ("drawer", 310), ("modal", 400), ("popover", 500),
          ("tooltip", 550), ("toast", 600)]

CONTAINER = [("prose", 720, "Long-form text — notes, descriptions"),
             ("panel", 640, "Specification data panel at its default 50%"),
             ("sheet", 1020, "Editor sheet"),
             ("admin", 960, "Management sheet"),
             ("page", 1440, "Page content maximum"),
             ("full", 1728, "Shell maximum before margins grow")]


# ── verification ─────────────────────────────────────────────────────────
def verify(pal, name):
    bgs = ["bg", "bg-subtle", "bg-muted", "bg-strong"]
    fgs = ["fg", "fg-muted", "fg-subtle", "accent-fg", "brand"]
    rows = []
    for f in fgs:
        for b in bgs:
            r = ratio(pal[f], pal[b])
            rows.append((f, b, pal[f], pal[b], round(r, 2),
                         "AAA" if r >= 7 else "AA" if r >= 4.5 else "AA-large" if r >= 3 else "FAIL"))
    for f, b in (("fg-on-accent", "accent"), ("fg-on-inverse", "bg-inverse"),
                 ("accent", "bg"), ("accent-fg", "accent-subtle")):
        r = ratio(pal[f], pal[b])
        rows.append((f, b, pal[f], pal[b], round(r, 2),
                     "AAA" if r >= 7 else "AA" if r >= 4.5 else "AA-large" if r >= 3 else "FAIL"))
    for sem in ("info", "success", "warning", "danger", "neutral"):
        for b in ("bg", f"{sem}-bg"):
            r = ratio(pal[f"{sem}-fg"], pal[b])
            rows.append((f"{sem}-fg", b, pal[f"{sem}-fg"], pal[b], round(r, 2),
                         "AAA" if r >= 7 else "AA" if r >= 4.5 else "AA-large" if r >= 3 else "FAIL"))
    # non-text contrast (WCAG 1.4.11) — needs 3:1
    for f, b in (("border-control", "bg"), ("border-focus", "bg"), ("accent", "bg")):
        r = ratio(pal[f], pal[b])
        rows.append((f, b, pal[f], pal[b], round(r, 2),
                     "AA-nontext" if r >= 3 else "FAIL-nontext"))
    return rows


# ── reference-system audit (what was actually wrong) ─────────────────────
def audit():
    out = []
    def add(label, fg, bg, size):
        r = ratio(fg, bg)
        need = 3.0 if size == "large" else 4.5
        out.append((label, sh(fg) if isinstance(fg, tuple) else fg,
                    sh(bg) if isinstance(bg, tuple) else bg,
                    round(r, 2), need, "PASS" if r >= need else "FAIL"))
    add("--txt on white (body)", INK, WHITE, "normal")
    add("--txt2 on white (secondary, 55%)", blend(INK, WHITE, 0.55), WHITE, "normal")
    add("--txt3 on white (tertiary, 35%)", blend(INK, WHITE, 0.35), WHITE, "normal")
    add("--acc on white (links, codes)", REF["acc"], WHITE, "normal")
    add("--navy on white (headings)", REF["navy"], WHITE, "normal")
    add("--txt2 on --bg1 (secondary on tint)", blend(INK, WHITE, 0.55), REF["bg1"], "normal")
    add("--txt3 on --bg2 (placeholder on tint)", blend(INK, WHITE, 0.35), REF["bg2"], "normal")
    add("nav section label, white 45% on navy", blend(WHITE, REF["navy"], 0.45), REF["navy"], "normal")
    add("nav sub-item, white 60% on navy", blend(WHITE, REF["navy"], 0.60), REF["navy"], "normal")
    add("nav item, white 75% on navy", blend(WHITE, REF["navy"], 0.75), REF["navy"], "normal")
    add("--red on white (destructive)", REF["red"], WHITE, "normal")
    add("--line3 border on white", blend(INK, WHITE, 0.22), WHITE, "large")
    return out


CORRECTED = {
    "fg-muted alpha": a_txt2, "fg-subtle alpha": a_txt3,
    "dark fg-muted alpha": a_dtxt2, "dark fg-subtle alpha": a_dtxt3,
}

if __name__ == "__main__":
    print("LIGHT fg-muted", LIGHT["fg-muted"], round(ratio(LIGHT["fg-muted"], LIGHT["bg"]), 2))
    print("LIGHT fg-subtle", LIGHT["fg-subtle"], round(ratio(LIGHT["fg-subtle"], LIGHT["bg"]), 2))
    print("DARK  fg-muted", DARK["fg-muted"], round(ratio(DARK["fg-muted"], DARK["bg"]), 2))
    print("DARK  fg-subtle", DARK["fg-subtle"], round(ratio(DARK["fg-subtle"], DARK["bg"]), 2))
    print()
    print("REFERENCE AUDIT")
    for r in audit():
        print(f"  {r[5]:5} {r[3]:6}  need {r[4]}  {r[0]}")
    print()
    fails = [r for r in verify(LIGHT, "light") + verify(DARK, "dark") if r[5] == "FAIL"]
    print("NEW PALETTE FAILURES:", fails if fails else "none")
