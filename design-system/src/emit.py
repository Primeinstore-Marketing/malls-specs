"""Emit machine-readable token files for Phase 5 to consume directly."""
import json, os
from tokens import (LIGHT, DARK, STATUS, TYPE, SPACE, RADII, ELEV, MOTION,
                    BREAK, ZINDEX, CONTAINER, ratio, audit, verify)

OUT = os.environ.get("OUT", "tokens")
os.makedirs(OUT, exist_ok=True)

# ── tokens.css ───────────────────────────────────────────────────────────
def css():
    L = []
    L.append("/* Specification Platform — design tokens")
    L.append("   Generated from the Phase 3 token layer. Do not hand-edit.")
    L.append("   Every colour pairing in this file is verified against WCAG 2.1 AA. */")
    L.append("")
    L.append(":root {")
    L.append("  /* ── typography ─────────────────────────────────────── */")
    L.append('  --font-display: "Wix Madefor Display", "Poppins", system-ui, sans-serif;')
    L.append('  --font-body: "Montserrat", "Lato", system-ui, sans-serif;')
    L.append('  --font-mono: ui-monospace, "SF Mono", "Cascadia Mono", Menlo, monospace;')
    L.append("")
    for k, rem, px, w, ls, lh, fam, role in TYPE:
        L.append(f"  --text-{k}: {rem};            /* {px}px · {role} */")
        L.append(f"  --text-{k}-weight: {w};")
        L.append(f"  --text-{k}-tracking: {ls};")
        L.append(f"  --text-{k}-leading: {lh};")
    L.append("")
    L.append("  /* ── spacing (4px base) ─────────────────────────────── */")
    for k, v in SPACE:
        L.append(f"  --space-{k}: {v}px;")
    L.append("")
    L.append("  /* ── radii ──────────────────────────────────────────── */")
    for k, v in RADII:
        L.append(f"  --radius-{k}: {v}px;")
    L.append("")
    L.append("  /* ── elevation ──────────────────────────────────────── */")
    for k, v, use in ELEV:
        L.append(f"  --shadow-{k}: {v};   /* {use} */")
    L.append("")
    L.append("  /* ── motion ─────────────────────────────────────────── */")
    for k, v, use in MOTION:
        L.append(f"  --{k}: {v};   /* {use} */")
    L.append("")
    L.append("  /* ── z-index ────────────────────────────────────────── */")
    for k, v in ZINDEX:
        L.append(f"  --z-{k}: {v};")
    L.append("")
    L.append("  /* ── containers ─────────────────────────────────────── */")
    for k, v, use in CONTAINER:
        L.append(f"  --container-{k}: {v}px;   /* {use} */")
    L.append("")
    L.append("  /* ── layout ─────────────────────────────────────────── */")
    L.append("  --sidebar-width: 260px;")
    L.append("  --sidebar-width-md: 220px;")
    L.append("  --topbar-height: 52px;")
    L.append("  --topbar-height-md: 48px;")
    L.append("  --topbar-height-sm: 44px;")
    L.append("  --panel-split: 50%;")
    L.append("  --panel-split-xl: 58%;   /* variant A, >=1440px */")
    L.append("  --focus-ring-width: 2px;")
    L.append("  --focus-ring-offset: 2px;")
    L.append("}")
    L.append("")
    L.append("/* ── colour · light (default) ─────────────────────────── */")
    L.append(":root, [data-theme='light'] {")
    for k, v in LIGHT.items():
        L.append(f"  --color-{k}: {v};")
    L.append("")
    for key, label, sem in STATUS:
        L.append(f"  --status-{key}-fg: var(--color-{sem}-fg);")
        L.append(f"  --status-{key}-bg: var(--color-{sem}-bg);")
        L.append(f"  --status-{key}-border: var(--color-{sem}-border);")
    L.append("}")
    L.append("")
    L.append("/* ── colour · dark ────────────────────────────────────── */")
    L.append("[data-theme='dark'] {")
    for k, v in DARK.items():
        L.append(f"  --color-{k}: {v};")
    L.append("}")
    L.append("")
    L.append("@media (prefers-color-scheme: dark) {")
    L.append("  :root:not([data-theme='light']) {")
    for k, v in DARK.items():
        L.append(f"    --color-{k}: {v};")
    L.append("  }")
    L.append("}")
    L.append("")
    L.append("/* ── reduced motion ───────────────────────────────────── */")
    L.append("/* Absent from the reference system. Every transition there plays unconditionally. */")
    L.append("@media (prefers-reduced-motion: reduce) {")
    L.append("  *, *::before, *::after {")
    L.append("    animation-duration: 0.01ms !important;")
    L.append("    animation-iteration-count: 1 !important;")
    L.append("    transition-duration: 0.01ms !important;")
    L.append("    scroll-behavior: auto !important;")
    L.append("  }")
    L.append("}")
    L.append("")
    L.append("/* ── focus ────────────────────────────────────────────── */")
    L.append("/* The reference system suppresses default outlines without replacing them. */")
    L.append(":where(a, button, input, select, textarea, [tabindex]):focus-visible {")
    L.append("  outline: var(--focus-ring-width) solid var(--color-border-focus);")
    L.append("  outline-offset: var(--focus-ring-offset);")
    L.append("  border-radius: var(--radius-xs);")
    L.append("}")
    return "\n".join(L)


# ── tailwind.tokens.js ───────────────────────────────────────────────────
def tailwind():
    colors = {k: f"var(--color-{k})" for k in LIGHT}
    status = {k: {"fg": f"var(--status-{k}-fg)", "bg": f"var(--status-{k}-bg)",
                  "border": f"var(--status-{k}-border)"} for k, _, _ in STATUS}
    spacing = {k: f"var(--space-{k})" for k, _ in SPACE}
    radius = {k: f"var(--radius-{k})" for k, _ in RADII}
    shadow = {k: f"var(--shadow-{k})" for k, _, _ in ELEV}
    fontsize = {k: [f"var(--text-{k})", {"lineHeight": lh, "letterSpacing": ls, "fontWeight": str(w)}]
                for k, rem, px, w, ls, lh, fam, role in TYPE}
    screens = {k: f"{v}px" for k, v, _ in BREAK if v}
    z = {k: str(v) for k, v in ZINDEX}
    maxw = {k: f"var(--container-{k})" for k, _, _ in CONTAINER}
    cfg = {
        "theme": {
            "screens": screens,
            "extend": {
                "colors": {**colors, "status": status},
                "spacing": spacing,
                "borderRadius": radius,
                "boxShadow": shadow,
                "fontSize": fontsize,
                "fontFamily": {
                    "display": ["var(--font-display)"],
                    "body": ["var(--font-body)"],
                    "mono": ["var(--font-mono)"],
                },
                "zIndex": z,
                "maxWidth": maxw,
                "transitionTimingFunction": {
                    "expressive": "var(--ease-expressive)",
                    "standard": "var(--ease-standard)",
                    "exit": "var(--ease-exit)",
                },
                "transitionDuration": {
                    "instant": "var(--duration-instant)", "fast": "var(--duration-fast)",
                    "normal": "var(--duration-normal)", "slow": "var(--duration-slow)",
                    "slower": "var(--duration-slower)",
                },
            },
        }
    }
    return ("// Specification Platform — Tailwind token bridge\n"
            "// Generated from the Phase 3 token layer. Do not hand-edit.\n"
            "// Values resolve to CSS custom properties so dark mode needs no Tailwind variants.\n\n"
            "module.exports = " + json.dumps(cfg, indent=2) + ";\n")


# ── tokens.ts ────────────────────────────────────────────────────────────
def ts():
    L = ["// Specification Platform — design token types",
         "// Generated from the Phase 3 token layer. Do not hand-edit.", ""]
    L.append("export const colorTokens = [")
    for k in LIGHT:
        L.append(f"  '{k}',")
    L.append("] as const;")
    L.append("export type ColorToken = (typeof colorTokens)[number];")
    L.append("")
    L.append("export const specStatuses = [")
    for k, label, sem in STATUS:
        L.append(f"  {{ id: '{k}', label: '{label}', tone: '{sem}' }},")
    L.append("] as const;")
    L.append("export type SpecStatus = (typeof specStatuses)[number]['id'];")
    L.append("")
    L.append("export const textTokens = [")
    for k, rem, px, w, ls, lh, fam, role in TYPE:
        L.append(f"  '{k}',")
    L.append("] as const;")
    L.append("export type TextToken = (typeof textTokens)[number];")
    L.append("")
    L.append("export const spaceTokens = [" + ", ".join(f"'{k}'" for k, _ in SPACE) + "] as const;")
    L.append("export type SpaceToken = (typeof spaceTokens)[number];")
    L.append("")
    L.append("export const radiusTokens = [" + ", ".join(f"'{k}'" for k, _ in RADII) + "] as const;")
    L.append("export type RadiusToken = (typeof radiusTokens)[number];")
    L.append("")
    L.append("export const breakpoints = {")
    for k, v, note in BREAK:
        L.append(f"  {k}: {v},   // {note}")
    L.append("} as const;")
    L.append("export type Breakpoint = keyof typeof breakpoints;")
    L.append("")
    L.append("export const zIndex = {")
    for k, v in ZINDEX:
        L.append(f"  {k}: {v},")
    L.append("} as const;")
    return "\n".join(L) + "\n"


# ── contrast report ──────────────────────────────────────────────────────
def report():
    L = ["# Contrast verification report", "",
         "Generated from the token layer. Every value is computed, not asserted.", "",
         "## Reference system — audit of the values as found", "",
         "| Pairing | Ratio | Required | Result |", "|---|---|---|---|"]
    for label, fg, bg, r, need, res in audit():
        L.append(f"| {label} | {r}:1 | {need}:1 | **{res}** |")
    nf = sum(1 for a in audit() if a[5] == "FAIL")
    L.append("")
    L.append(f"**{nf} of {len(audit())} pairings fail.**")
    L.append("")
    for pal, name in ((LIGHT, "light"), (DARK, "dark")):
        L.append(f"## New palette — {name}")
        L.append("")
        L.append("| Foreground | Background | Values | Ratio | Level |")
        L.append("|---|---|---|---|---|")
        for f, b, fv, bv, r, lvl in verify(pal, name):
            L.append(f"| {f} | {b} | `{fv}` on `{bv}` | {r}:1 | {lvl} |")
        fails = [x for x in verify(pal, name) if "FAIL" in x[5]]
        L.append("")
        L.append(f"**{len(fails)} failures.**" if fails else "**No failures.**")
        L.append("")
    return "\n".join(L)


if __name__ == "__main__":
    files = {"tokens.css": css(), "tailwind.tokens.js": tailwind(),
             "tokens.ts": ts(), "CONTRAST-REPORT.md": report()}
    for n, body in files.items():
        open(os.path.join(OUT, n), "w").write(body)
        print(f"{n:26} {len(body):>7,} bytes")
