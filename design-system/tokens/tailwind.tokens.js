// Specification Platform — Tailwind token bridge
// Generated from the Phase 3 token layer. Do not hand-edit.
// Values resolve to CSS custom properties so dark mode needs no Tailwind variants.

module.exports = {
  "theme": {
    "screens": {
      "sm": "480px",
      "md": "768px",
      "lg": "1024px",
      "xl": "1440px",
      "2xl": "1728px"
    },
    "extend": {
      "colors": {
        "bg": "var(--color-bg)",
        "bg-subtle": "var(--color-bg-subtle)",
        "bg-muted": "var(--color-bg-muted)",
        "bg-strong": "var(--color-bg-strong)",
        "bg-inverse": "var(--color-bg-inverse)",
        "fg": "var(--color-fg)",
        "fg-muted": "var(--color-fg-muted)",
        "fg-subtle": "var(--color-fg-subtle)",
        "fg-on-accent": "var(--color-fg-on-accent)",
        "fg-on-inverse": "var(--color-fg-on-inverse)",
        "border": "var(--color-border)",
        "border-strong": "var(--color-border-strong)",
        "border-control": "var(--color-border-control)",
        "border-focus": "var(--color-border-focus)",
        "accent": "var(--color-accent)",
        "accent-hover": "var(--color-accent-hover)",
        "accent-active": "var(--color-accent-active)",
        "accent-subtle": "var(--color-accent-subtle)",
        "accent-border": "var(--color-accent-border)",
        "accent-fg": "var(--color-accent-fg)",
        "brand": "var(--color-brand)",
        "brand-hover": "var(--color-brand-hover)",
        "brand-subtle": "var(--color-brand-subtle)",
        "brand-surface": "var(--color-brand-surface)",
        "brand-surface-hover": "var(--color-brand-surface-hover)",
        "brand-on-surface": "var(--color-brand-on-surface)",
        "brand-on-surface-muted": "var(--color-brand-on-surface-muted)",
        "info-fg": "var(--color-info-fg)",
        "info-bg": "var(--color-info-bg)",
        "info-border": "var(--color-info-border)",
        "success-fg": "var(--color-success-fg)",
        "success-bg": "var(--color-success-bg)",
        "success-border": "var(--color-success-border)",
        "warning-fg": "var(--color-warning-fg)",
        "warning-bg": "var(--color-warning-bg)",
        "warning-border": "var(--color-warning-border)",
        "danger-fg": "var(--color-danger-fg)",
        "danger-bg": "var(--color-danger-bg)",
        "danger-border": "var(--color-danger-border)",
        "neutral-fg": "var(--color-neutral-fg)",
        "neutral-bg": "var(--color-neutral-bg)",
        "neutral-border": "var(--color-neutral-border)",
        "status": {
          "draft": {
            "fg": "var(--status-draft-fg)",
            "bg": "var(--status-draft-bg)",
            "border": "var(--status-draft-border)"
          },
          "review": {
            "fg": "var(--status-review-fg)",
            "bg": "var(--status-review-bg)",
            "border": "var(--status-review-border)"
          },
          "published": {
            "fg": "var(--status-published-fg)",
            "bg": "var(--status-published-bg)",
            "border": "var(--status-published-border)"
          },
          "deprecated": {
            "fg": "var(--status-deprecated-fg)",
            "bg": "var(--status-deprecated-bg)",
            "border": "var(--status-deprecated-border)"
          },
          "superseded": {
            "fg": "var(--status-superseded-fg)",
            "bg": "var(--status-superseded-bg)",
            "border": "var(--status-superseded-border)"
          }
        }
      },
      "spacing": {
        "0": "var(--space-0)",
        "px": "var(--space-px)",
        "0.5": "var(--space-0_5)",
        "1": "var(--space-1)",
        "1.5": "var(--space-1_5)",
        "2": "var(--space-2)",
        "3": "var(--space-3)",
        "4": "var(--space-4)",
        "5": "var(--space-5)",
        "6": "var(--space-6)",
        "8": "var(--space-8)",
        "10": "var(--space-10)",
        "12": "var(--space-12)",
        "16": "var(--space-16)",
        "20": "var(--space-20)",
        "24": "var(--space-24)"
      },
      "borderRadius": {
        "xs": "var(--radius-xs)",
        "sm": "var(--radius-sm)",
        "md": "var(--radius-md)",
        "lg": "var(--radius-lg)",
        "xl": "var(--radius-xl)",
        "full": "var(--radius-full)"
      },
      "boxShadow": {
        "0": "var(--shadow-0)",
        "1": "var(--shadow-1)",
        "2": "var(--shadow-2)",
        "3": "var(--shadow-3)",
        "4": "var(--shadow-4)"
      },
      "fontSize": {
        "display-2xl": [
          "var(--text-display-2xl)",
          {
            "lineHeight": "0.92",
            "letterSpacing": "-0.04em",
            "fontWeight": "900"
          }
        ],
        "display-xl": [
          "var(--text-display-xl)",
          {
            "lineHeight": "1.1",
            "letterSpacing": "-0.03em",
            "fontWeight": "800"
          }
        ],
        "display-lg": [
          "var(--text-display-lg)",
          {
            "lineHeight": "1.15",
            "letterSpacing": "-0.02em",
            "fontWeight": "800"
          }
        ],
        "display-md": [
          "var(--text-display-md)",
          {
            "lineHeight": "1.0",
            "letterSpacing": "-0.03em",
            "fontWeight": "900"
          }
        ],
        "display-sm": [
          "var(--text-display-sm)",
          {
            "lineHeight": "1.25",
            "letterSpacing": "-0.01em",
            "fontWeight": "700"
          }
        ],
        "body-lg": [
          "var(--text-body-lg)",
          {
            "lineHeight": "1.6",
            "letterSpacing": "0",
            "fontWeight": "400"
          }
        ],
        "body-md": [
          "var(--text-body-md)",
          {
            "lineHeight": "1.6",
            "letterSpacing": "0",
            "fontWeight": "400"
          }
        ],
        "body-sm": [
          "var(--text-body-sm)",
          {
            "lineHeight": "1.55",
            "letterSpacing": "0",
            "fontWeight": "400"
          }
        ],
        "label-lg": [
          "var(--text-label-lg)",
          {
            "lineHeight": "1.2",
            "letterSpacing": "0.08em",
            "fontWeight": "700"
          }
        ],
        "label-md": [
          "var(--text-label-md)",
          {
            "lineHeight": "1.2",
            "letterSpacing": "0.1em",
            "fontWeight": "700"
          }
        ],
        "label-sm": [
          "var(--text-label-sm)",
          {
            "lineHeight": "1.2",
            "letterSpacing": "0.12em",
            "fontWeight": "700"
          }
        ],
        "mono-md": [
          "var(--text-mono-md)",
          {
            "lineHeight": "1.5",
            "letterSpacing": "0",
            "fontWeight": "500"
          }
        ]
      },
      "fontFamily": {
        "display": [
          "var(--font-display)"
        ],
        "body": [
          "var(--font-body)"
        ],
        "mono": [
          "var(--font-mono)"
        ]
      },
      "zIndex": {
        "base": "0",
        "raised": "10",
        "sticky": "100",
        "topbar": "200",
        "scrim": "300",
        "drawer": "310",
        "modal": "400",
        "popover": "500",
        "tooltip": "550",
        "toast": "600"
      },
      "maxWidth": {
        "prose": "var(--container-prose)",
        "panel": "var(--container-panel)",
        "sheet": "var(--container-sheet)",
        "admin": "var(--container-admin)",
        "page": "var(--container-page)",
        "full": "var(--container-full)"
      },
      "transitionTimingFunction": {
        "expressive": "var(--ease-expressive)",
        "standard": "var(--ease-standard)",
        "exit": "var(--ease-exit)"
      },
      "transitionDuration": {
        "instant": "var(--duration-instant)",
        "fast": "var(--duration-fast)",
        "normal": "var(--duration-normal)",
        "slow": "var(--duration-slow)",
        "slower": "var(--duration-slower)"
      }
    }
  }
};
