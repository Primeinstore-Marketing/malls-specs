# Contrast verification report

Generated from the token layer. Every value is computed, not asserted.

## Reference system — audit of the values as found

| Pairing | Ratio | Required | Result |
|---|---|---|---|
| --txt on white (body) | 16.48:1 | 4.5:1 | **PASS** |
| --txt2 on white (secondary, 55%) | 3.8:1 | 4.5:1 | **FAIL** |
| --txt3 on white (tertiary, 35%) | 2.17:1 | 4.5:1 | **FAIL** |
| --acc on white (links, codes) | 4.98:1 | 4.5:1 | **PASS** |
| --navy on white (headings) | 11.69:1 | 4.5:1 | **PASS** |
| --txt2 on --bg1 (secondary on tint) | 3.52:1 | 4.5:1 | **FAIL** |
| --txt3 on --bg2 (placeholder on tint) | 1.92:1 | 4.5:1 | **FAIL** |
| nav section label, white 45% on navy | 3.67:1 | 4.5:1 | **FAIL** |
| nav sub-item, white 60% on navy | 5.28:1 | 4.5:1 | **PASS** |
| nav item, white 75% on navy | 7.31:1 | 4.5:1 | **PASS** |
| --red on white (destructive) | 3.27:1 | 4.5:1 | **FAIL** |
| --line3 border on white | 1.59:1 | 3.0:1 | **FAIL** |

**7 of 12 pairings fail.**

## New palette — light

| Foreground | Background | Values | Ratio | Level |
|---|---|---|---|---|
| fg | bg | `#0D1E3F` on `#FFFFFF` | 16.48:1 | AAA |
| fg | bg-subtle | `#0D1E3F` on `#F5F7FC` | 15.37:1 | AAA |
| fg | bg-muted | `#0D1E3F` on `#EEF1F8` | 14.57:1 | AAA |
| fg | bg-strong | `#0D1E3F` on `#E3E8F4` | 13.43:1 | AAA |
| fg-muted | bg | `#4B5870` on `#FFFFFF` | 7.17:1 | AAA |
| fg-muted | bg-subtle | `#4B5870` on `#F5F7FC` | 6.69:1 | AA |
| fg-muted | bg-muted | `#4B5870` on `#EEF1F8` | 6.34:1 | AA |
| fg-muted | bg-strong | `#4B5870` on `#E3E8F4` | 5.84:1 | AA |
| fg-subtle | bg | `#6A7589` on `#FFFFFF` | 4.65:1 | AA |
| fg-subtle | bg-subtle | `#6A7589` on `#F5F7FC` | 4.34:1 | AA-large |
| fg-subtle | bg-muted | `#6A7589` on `#EEF1F8` | 4.11:1 | AA-large |
| fg-subtle | bg-strong | `#6A7589` on `#E3E8F4` | 3.79:1 | AA-large |
| accent-fg | bg | `#1A4FD6` on `#FFFFFF` | 6.7:1 | AA |
| accent-fg | bg-subtle | `#1A4FD6` on `#F5F7FC` | 6.25:1 | AA |
| accent-fg | bg-muted | `#1A4FD6` on `#EEF1F8` | 5.93:1 | AA |
| accent-fg | bg-strong | `#1A4FD6` on `#E3E8F4` | 5.46:1 | AA |
| brand | bg | `#1B3769` on `#FFFFFF` | 11.69:1 | AAA |
| brand | bg-subtle | `#1B3769` on `#F5F7FC` | 10.9:1 | AAA |
| brand | bg-muted | `#1B3769` on `#EEF1F8` | 10.34:1 | AAA |
| brand | bg-strong | `#1B3769` on `#E3E8F4` | 9.52:1 | AAA |
| fg-on-accent | accent | `#FFFFFF` on `#2861FD` | 4.98:1 | AA |
| fg-on-inverse | bg-inverse | `#FFFFFF` on `#16294C` | 14.43:1 | AAA |
| accent | bg | `#2861FD` on `#FFFFFF` | 4.98:1 | AA |
| accent-fg | accent-subtle | `#1A4FD6` on `#EDF2FF` | 5.98:1 | AA |
| info-fg | bg | `#2861FD` on `#FFFFFF` | 4.98:1 | AA |
| info-fg | info-bg | `#2861FD` on `#EDF2FF` | 4.44:1 | AA-large |
| success-fg | bg | `#0F7A4D` on `#FFFFFF` | 5.37:1 | AA |
| success-fg | success-bg | `#0F7A4D` on `#E8F6EF` | 4.82:1 | AA |
| warning-fg | bg | `#8A5A00` on `#FFFFFF` | 5.93:1 | AA |
| warning-fg | warning-bg | `#8A5A00` on `#FCF2DF` | 5.34:1 | AA |
| danger-fg | bg | `#B3261E` on `#FFFFFF` | 6.54:1 | AA |
| danger-fg | danger-bg | `#B3261E` on `#FDECEA` | 5.72:1 | AA |
| neutral-fg | bg | `#42506B` on `#FFFFFF` | 8.1:1 | AAA |
| neutral-fg | neutral-bg | `#42506B` on `#F0F2F7` | 7.24:1 | AAA |
| border-control | bg | `#8C94A4` on `#FFFFFF` | 3.05:1 | AA-nontext |
| border-focus | bg | `#2861FD` on `#FFFFFF` | 4.98:1 | AA-nontext |
| accent | bg | `#2861FD` on `#FFFFFF` | 4.98:1 | AA-nontext |

**No failures.**

## New palette — dark

| Foreground | Background | Values | Ratio | Level |
|---|---|---|---|---|
| fg | bg | `#E9EEF9` on `#0C1424` | 15.83:1 | AAA |
| fg | bg-subtle | `#E9EEF9` on `#121B2E` | 14.78:1 | AAA |
| fg | bg-muted | `#E9EEF9` on `#18243C` | 13.32:1 | AAA |
| fg | bg-strong | `#E9EEF9` on `#1F2D4A` | 11.79:1 | AAA |
| fg-muted | bg | `#9CA2AF` on `#0C1424` | 7.19:1 | AAA |
| fg-muted | bg-subtle | `#9CA2AF` on `#121B2E` | 6.71:1 | AA |
| fg-muted | bg-muted | `#9CA2AF` on `#18243C` | 6.05:1 | AA |
| fg-muted | bg-strong | `#9CA2AF` on `#1F2D4A` | 5.35:1 | AA |
| fg-subtle | bg | `#7A808E` on `#0C1424` | 4.65:1 | AA |
| fg-subtle | bg-subtle | `#7A808E` on `#121B2E` | 4.34:1 | AA-large |
| fg-subtle | bg-muted | `#7A808E` on `#18243C` | 3.91:1 | AA-large |
| fg-subtle | bg-strong | `#7A808E` on `#1F2D4A` | 3.46:1 | AA-large |
| accent-fg | bg | `#9CBAFF` on `#0C1424` | 9.54:1 | AAA |
| accent-fg | bg-subtle | `#9CBAFF` on `#121B2E` | 8.9:1 | AAA |
| accent-fg | bg-muted | `#9CBAFF` on `#18243C` | 8.02:1 | AAA |
| accent-fg | bg-strong | `#9CBAFF` on `#1F2D4A` | 7.1:1 | AAA |
| brand | bg | `#C9D6EE` on `#0C1424` | 12.56:1 | AAA |
| brand | bg-subtle | `#C9D6EE` on `#121B2E` | 11.73:1 | AAA |
| brand | bg-muted | `#C9D6EE` on `#18243C` | 10.57:1 | AAA |
| brand | bg-strong | `#C9D6EE` on `#1F2D4A` | 9.36:1 | AAA |
| fg-on-accent | accent | `#08111F` on `#7FA6FF` | 7.93:1 | AAA |
| fg-on-inverse | bg-inverse | `#0C1424` on `#E9EEF9` | 15.83:1 | AAA |
| accent | bg | `#7FA6FF` on `#0C1424` | 7.71:1 | AAA |
| accent-fg | accent-subtle | `#9CBAFF` on `#16243F` | 8.01:1 | AAA |
| info-fg | bg | `#8FB2FF` on `#0C1424` | 8.75:1 | AAA |
| info-fg | info-bg | `#8FB2FF` on `#14213A` | 7.63:1 | AAA |
| success-fg | bg | `#63C79B` on `#0C1424` | 8.91:1 | AAA |
| success-fg | success-bg | `#63C79B` on `#0E2620` | 7.73:1 | AAA |
| warning-fg | bg | `#E0B25C` on `#0C1424` | 9.37:1 | AAA |
| warning-fg | warning-bg | `#E0B25C` on `#251E0E` | 8.41:1 | AAA |
| danger-fg | bg | `#F08279` on `#0C1424` | 7.16:1 | AAA |
| danger-fg | danger-bg | `#F08279` on `#2A1414` | 6.76:1 | AA |
| neutral-fg | bg | `#A8B4CC` on `#0C1424` | 8.82:1 | AAA |
| neutral-fg | neutral-bg | `#A8B4CC` on `#18202F` | 7.82:1 | AAA |
| border-control | bg | `#5C6371` on `#0C1424` | 3.05:1 | AA-nontext |
| border-focus | bg | `#7FA6FF` on `#0C1424` | 7.71:1 | AA-nontext |
| accent | bg | `#7FA6FF` on `#0C1424` | 7.71:1 | AA-nontext |

**No failures.**
