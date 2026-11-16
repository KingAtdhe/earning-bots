"""Dependency-free raster canvas that saves PNG files. Used for marketplace preview images."""
import math
import struct
import zlib

from .font5x7 import GLYPHS
from .pdf import text_width as pdf_text_width


def lighten(c, amount=0.5):
    return tuple(int(v + (255 - v) * amount) for v in c)


class Canvas:
    def __init__(self, w, h, bg=(255, 255, 255)):
        self.w, self.h = int(w), int(h)
        self.buf = bytearray(bytes(bg) * (self.w * self.h))

    def fill_rect(self, x, y, w, h, c):
        x0, y0 = max(0, int(round(x))), max(0, int(round(y)))
        x1, y1 = min(self.w, int(round(x + w))), min(self.h, int(round(y + h)))
        if x1 <= x0 or y1 <= y0:
            return
        row = bytes(c) * (x1 - x0)
        stride = self.w * 3
        for yy in range(y0, y1):
            start = yy * stride + x0 * 3
            self.buf[start:start + len(row)] = row

    def stroke_rect(self, x, y, w, h, t, c):
        t = max(1, int(round(t)))
        self.fill_rect(x, y, w, t, c)
        self.fill_rect(x, y + h - t, w, t, c)
        self.fill_rect(x, y, t, h, c)
        self.fill_rect(x + w - t, y, t, h, c)

    def line(self, x1, y1, x2, y2, t, c, dash=0):
        t = max(1, int(round(t)))
        length = math.hypot(x2 - x1, y2 - y1)
        if length == 0:
            return
        if dash:
            pos, on = 0.0, True
            while pos < length:
                seg = min(dash, length - pos)
                if on:
                    a, b = pos / length, (pos + seg) / length
                    self.line(x1 + (x2 - x1) * a, y1 + (y2 - y1) * a, x1 + (x2 - x1) * b, y1 + (y2 - y1) * b, t, c)
                pos += seg
                on = not on
            return
        if abs(y1 - y2) < 0.01:
            self.fill_rect(min(x1, x2), int(round(y1 - t / 2)), abs(x2 - x1), t, c)
        elif abs(x1 - x2) < 0.01:
            self.fill_rect(int(round(x1 - t / 2)), min(y1, y2), t, abs(y2 - y1), c)
        else:
            steps = int(length)
            for i in range(steps + 1):
                f = i / max(1, steps)
                self.fill_rect(x1 + (x2 - x1) * f - t / 2, y1 + (y2 - y1) * f - t / 2, t, t, c)

    def circle(self, cx, cy, r, stroke=None, fill=None, t=1):
        if fill:
            for dy in range(-int(r), int(r) + 1):
                dx = math.sqrt(max(0.0, r * r - dy * dy))
                self.fill_rect(cx - dx, cy + dy, 2 * dx, 1, fill)
        if stroke:
            t = max(1, int(round(t)))
            n = max(24, int(2 * math.pi * r))
            for i in range(n):
                a = 2 * math.pi * i / n
                self.fill_rect(cx + r * math.cos(a) - t / 2, cy + r * math.sin(a) - t / 2, t, t, stroke)

    @staticmethod
    def text_width(text, scale):
        return (6 * len(text) - 1) * scale

    def text(self, x, y, text, scale, c, bold=False):
        """Bitmap text; (x, y) is the top-left corner. Each glyph is 5x7 cells of `scale` pixels."""
        extra = max(1, scale // 3) if bold else 0
        cx = x
        for ch in text.upper():
            rows = GLYPHS.get(ch, GLYPHS[" "])
            for r, row in enumerate(rows):
                for col, bit in enumerate(row):
                    if bit == "1":
                        self.fill_rect(cx + col * scale, y + r * scale, scale + extra, scale, c)
            cx += 6 * scale

    def save(self, path):
        stride = self.w * 3
        raw = b"".join(b"\x00" + bytes(self.buf[y * stride:(y + 1) * stride]) for y in range(self.h))

        def chunk(tag, data):
            return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

        png = (b"\x89PNG\r\n\x1a\n"
               + chunk(b"IHDR", struct.pack(">IIBBBBB", self.w, self.h, 8, 2, 0, 0, 0))
               + chunk(b"IDAT", zlib.compress(raw, 6))
               + chunk(b"IEND", b""))
        with open(path, "wb") as fh:
            fh.write(png)


def render_shapes(cv, shapes, k, ox, oy):
    """Draw PDF-style shapes onto a canvas at scale k (pixels per point), offset (ox, oy)."""
    for s in shapes:
        t = s["t"]
        if t == "rect":
            x, y, w, h = ox + s["x"] * k, oy + s["y"] * k, s["w"] * k, s["h"] * k
            if s.get("fill"):
                cv.fill_rect(x, y, w, h, s["fill"])
            if s.get("stroke"):
                cv.stroke_rect(x, y, w, h, max(1, s.get("lw", 0.8) * k), s["stroke"])
        elif t == "line":
            cv.line(ox + s["x1"] * k, oy + s["y1"] * k, ox + s["x2"] * k, oy + s["y2"] * k,
                    max(1, s.get("lw", 0.5) * k), s.get("color", (0, 0, 0)), dash=3 * k if s.get("dash") else 0)
        elif t == "circle":
            cv.circle(ox + s["cx"] * k, oy + s["cy"] * k, s["r"] * k, stroke=s.get("stroke"),
                      fill=s.get("fill"), t=max(1, s.get("lw", 0.7) * k))
        elif t == "text":
            color = s.get("color", (0, 0, 0))
            cap_px = s["s"] * 0.72 * k
            scale = int(cap_px / 7 + 0.5)
            x = ox + s["x"] * k
            if scale >= 1 and cap_px >= 5:
                width = Canvas.text_width(s["text"], scale)
                if s.get("align") == "center":
                    x -= width / 2
                elif s.get("align") == "right":
                    x -= width
                cv.text(x, oy + s["y"] * k - 7 * scale, s["text"], scale, color, s.get("bold", False))
            else:  # too small to read: draw a soft bar where the text sits
                width = pdf_text_width(s["text"], s["s"], s.get("bold")) * k
                if s.get("align") == "center":
                    x -= width / 2
                elif s.get("align") == "right":
                    x -= width
                h = max(1, cap_px * 0.8)
                cv.fill_rect(x, oy + s["y"] * k - h, width, h, lighten(color, 0.45))
