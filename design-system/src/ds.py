"""Design-system specimen plates. Colour is permitted from Phase 3 onward."""
from tokens import LIGHT, DARK, STATUS, TYPE, SPACE, RADII, ELEV, MOTION, BREAK, ZINDEX, CONTAINER, ratio, audit
import re

FD = "Poppins"          # stand-in for Wix Madefor Display
FB = "Lato"             # stand-in for Montserrat
FM = "DejaVu Sans Mono"

PLATES = {}


def reg(pid, title, notes, c):
    PLATES[pid] = (title, notes, c.out())


class C:
    def __init__(self, w, h, bg=None, pal=None):
        self.w, self.h = w, h
        self.P = pal or LIGHT
        self.o = [f'<rect width="{w}" height="{h}" fill="{bg or self.P["bg"]}"/>']

    def add(self, s):
        self.o.append(s); return self

    def r(self, x, y, w, h, fill="none", stroke=None, sw=1, rx=0, dash=None, op=None):
        d = f' stroke-dasharray="{dash}"' if dash else ""
        st = f' stroke="{stroke}" stroke-width="{sw}"' if stroke else ""
        o = f' opacity="{op}"' if op is not None else ""
        return self.add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}"{st}{d}{o}/>')

    def t(self, x, y, s, size=14, fill=None, anchor="start", w=400, ls=0, f=None, op=None):
        s = str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        o = f' opacity="{op}"' if op is not None else ""
        return self.add(
            f'<text x="{x}" y="{y}" font-family="{f or FB}" font-size="{size}" fill="{fill or self.P["fg"]}"'
            f' text-anchor="{anchor}" font-weight="{w}" letter-spacing="{ls}"{o}>{s}</text>')

    def ln(self, x1, y1, x2, y2, stroke=None, sw=1, dash=None):
        d = f' stroke-dasharray="{dash}"' if dash else ""
        return self.add(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" '
                        f'stroke="{stroke or self.P["border"]}" stroke-width="{sw}"{d}/>')

    def circ(self, cx, cy, rr, fill="none", stroke=None, sw=1):
        st = f' stroke="{stroke}" stroke-width="{sw}"' if stroke else ""
        return self.add(f'<circle cx="{cx}" cy="{cy}" r="{rr}" fill="{fill}"{st}/>')

    def poly(self, pts, fill="none", stroke=None, sw=1.6):
        p = " ".join(f"{a},{b}" for a, b in pts)
        st = f' stroke="{stroke}" stroke-width="{sw}"' if stroke else ""
        return self.add(f'<polyline points="{p}" fill="{fill}"{st} stroke-linecap="round" stroke-linejoin="round"/>')

    # ---- design-system components ---------------------------------------
    def head(self, x, y, label, w=None):
        """Section label with flexing rule — the retained reference pattern."""
        self.t(x, y, label, 12, self.P["fg-muted"], w=700, ls=1.4, f=FD)
        if w:
            self.ln(x + len(label) * 8.1 + 14, y - 4, x + w, y - 4, self.P["border"], 1)
        return y + 26

    def btn(self, x, y, w, h, label, kind="secondary", state="default", size=14, icon=False):
        P = self.P
        M = {
            "primary":  (P["accent"], P["fg-on-accent"], None),
            "brand":    (P["brand"], "#FFFFFF", None),
            "secondary": (P["bg"], P["fg"], P["border-control"]),
            "subtle":   (P["bg-muted"], P["fg"], None),
            "ghost":    ("none", P["fg-muted"], None),
            "danger":   (P["danger-fg"], "#FFFFFF", None),
            "danger-ghost": (P["bg"], P["danger-fg"], P["danger-border"]),
        }
        bg, fg, bd = M[kind]
        if state == "hover":
            bg = {"primary": P["accent-hover"], "brand": P["brand-hover"], "secondary": P["bg-subtle"],
                  "subtle": P["bg-strong"], "ghost": P["bg-subtle"], "danger": "#8E1E17",
                  "danger-ghost": P["danger-bg"]}[kind]
        if state == "active":
            bg = {"primary": P["accent-active"], "brand": "#0F1D38", "secondary": P["bg-muted"],
                  "subtle": P["bg-strong"], "ghost": P["bg-muted"], "danger": "#701712",
                  "danger-ghost": P["danger-bg"]}[kind]
        if state == "disabled":
            bg = P["bg-muted"] if kind != "ghost" else "none"
            fg = P["fg-subtle"]; bd = P["border"]
        self.r(x, y, w, h, fill=bg, stroke=bd, sw=1, rx=6)
        if state == "focus":
            self.r(x - 3, y - 3, w + 6, h + 6, fill="none", stroke=P["border-focus"], sw=2, rx=9)
        tx = x + w / 2 + (7 if icon else 0)
        self.t(tx, y + h / 2 + size * 0.35, label, size, fg, "middle", w=600)
        if icon:
            self.circ(x + w / 2 - len(label) * size * 0.30 - 9, y + h / 2 - 1, 4.5, stroke=fg, sw=1.6)
        return x + w

    def field(self, x, y, w, h, ph="", label=None, state="default", help_=None, size=14):
        P = self.P
        if label:
            self.t(x, y - 8, label, 12, P["fg-muted"], w=600, ls=0.4, f=FD)
        bd = {"default": P["border-control"], "hover": P["fg-subtle"], "focus": P["border-focus"],
              "error": P["danger-fg"], "disabled": P["border"], "filled": P["border-control"]}[state]
        bg = P["bg-muted"] if state == "disabled" else P["bg"]
        self.r(x, y, w, h, fill=bg, stroke=bd, sw=2 if state in ("focus", "error") else 1, rx=6)
        if state == "focus":
            self.r(x - 3, y - 3, w + 6, h + 6, fill="none", stroke=P["border-focus"], sw=2, rx=9, op=0.35)
        col = P["fg"] if state == "filled" else P["fg-subtle"]
        self.t(x + 12, y + h / 2 + size * 0.35, ph, size, col)
        if state == "focus":
            self.ln(x + 12 + len(ph) * size * 0.5 + 2, y + 9, x + 12 + len(ph) * size * 0.5 + 2, y + h - 9,
                    P["accent"], 1.6)
        if help_:
            self.t(x, y + h + 17, help_, 12, P["danger-fg"] if state == "error" else P["fg-subtle"])
        return y + h

    def badge(self, x, y, label, sem="neutral", size=11, solid=False, dot=False):
        P = self.P
        tw = len(label) * size * 0.64
        pad = 11
        gap = 16 if dot else 0
        w = tw + pad * 2 + gap
        h = 22
        fg = "#FFFFFF" if solid else P[f"{sem}-fg"]
        if solid:
            self.r(x, y, w, h, fill=P[f"{sem}-fg"], rx=11)
        else:
            self.r(x, y, w, h, fill=P[f"{sem}-bg"], stroke=P[f"{sem}-border"], sw=1, rx=11)
        if dot:
            self.circ(x + pad + 4, y + h / 2, 3.5, fill=fg)
        self.t(x + pad + gap, y + h / 2 + size * 0.36, label, size, fg, "start", w=700, ls=0.4, f=FD)
        return x + w

    def tag(self, x, y, label, removable=False, size=12):
        P = self.P
        w = len(label) * size * 0.56 + (34 if removable else 22)
        self.r(x, y, w, 24, fill=P["bg-muted"], stroke=P["border"], sw=1, rx=5)
        self.t(x + 11, y + 16, label, size, P["fg-muted"])
        if removable:
            cx = x + w - 13
            self.ln(cx - 3.5, 9 + y - 3.5 + 4, cx + 3.5, y + 16 - 3, P["fg-subtle"], 1.4)
            self.ln(cx + 3.5, y + 9, cx - 3.5, y + 16, P["fg-subtle"], 1.4)
        return x + w

    def code(self, x, y, label, size=12):
        P = self.P
        w = len(label) * size * 0.62 + 18
        self.r(x, y, w, 22, fill=P["accent-subtle"], stroke=P["accent-border"], sw=1, rx=11)
        self.t(x + w / 2, y + 15, label, size, P["accent-fg"], "middle", w=700, ls=0.4, f=FM)
        return x + w

    def swatch(self, x, y, w, h, name, val, on=None, ratio_=None):
        P = self.P
        self.r(x, y, w, h, fill=val, stroke=P["border"], sw=1, rx=6)
        if on:
            self.t(x + 12, y + 24, "Aa", 15, on, w=700, f=FD)
        self.t(x, y + h + 17, name, 11.5, P["fg"], w=600)
        self.t(x, y + h + 32, val, 11, P["fg-subtle"], f=FM)
        if ratio_:
            self.t(x + w, y + h + 32, ratio_, 11, P["fg-subtle"], "end", f=FM)
        return x + w

    def specrow(self, x, y, w, text, ref=None):
        P = self.P
        self.circ(x + 3, y - 4, 3, fill=P["accent"], sw=0)
        self.t(x + 14, y, text, 13, P["fg"])
        if ref:
            self.t(x + 14 + len(text) * 6.6 + 6, y, ref, 13, P["accent-fg"], w=700)
        return y + 22

    def card(self, x, y, w, h, elev=0, sel=False):
        P = self.P
        if elev:
            self.r(x + 1, y + 3, w - 2, h, fill=P["fg"], rx=10, op=0.05 * elev)
        self.r(x, y, w, h, fill=P["bg"], stroke=P["accent"] if sel else P["border"],
               sw=2 if sel else 1, rx=10)
        return self

    def skel(self, x, y, w, h, rx=4):
        return self.r(x, y, w, h, fill=self.P["bg-muted"], rx=rx)

    def out(self):
        return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" '
                f'viewBox="0 0 {self.w} {self.h}">' + "".join(self.o) + "</svg>")


def sect(c, x, y, label):
    c.t(x, y, label, 11, c.P["fg-subtle"], w=700, ls=1.8, f=FD)
    return y + 22
