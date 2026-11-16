"""Tiny dependency-free PDF writer for vector pages (boxes, lines, circles, text).

A page is (width, height, shapes) in points, with y measured from the TOP of the page.
Shapes are dicts:
  {"t": "rect", "x", "y", "w", "h", "stroke": rgb|None, "fill": rgb|None, "lw"}
  {"t": "line", "x1", "y1", "x2", "y2", "color", "lw", "dash": bool}
  {"t": "circle", "cx", "cy", "r", "stroke", "fill", "lw"}
  {"t": "text", "x", "y" (baseline), "s" (size), "text", "color", "bold", "align": left|center|right}
"""
import zlib

KAPPA = 0.5523
_NARROW = set("il.,:;|!'ftjI ")
_WIDE = set("mwMW@%")


def text_width(text, size, bold=False):
    """Approximate Helvetica width, good enough for centring and fitting."""
    w = 0.0
    for ch in text:
        if ch in _NARROW:
            w += 0.28
        elif ch in _WIDE:
            w += 0.86
        elif ch.isupper():
            w += 0.68
        elif ch.isdigit():
            w += 0.556
        else:
            w += 0.52
    return w * size * (1.06 if bold else 1.0)


def _esc(s):
    return s.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _rgb(c):
    return "%.3f %.3f %.3f" % (c[0] / 255, c[1] / 255, c[2] / 255)


def _stream(H, shapes):
    out = []
    for s in shapes:
        t = s["t"]
        if t == "rect":
            x, y, w, h = s["x"], H - s["y"] - s["h"], s["w"], s["h"]
            if s.get("fill"):
                out.append(f"{_rgb(s['fill'])} rg {x:.2f} {y:.2f} {w:.2f} {h:.2f} re f")
            if s.get("stroke"):
                out.append(f"{s.get('lw', 0.8):.2f} w {_rgb(s['stroke'])} RG {x:.2f} {y:.2f} {w:.2f} {h:.2f} re S")
        elif t == "line":
            dash = "[2 2.5] 0 d" if s.get("dash") else "[] 0 d"
            out.append(f"{s.get('lw', 0.5):.2f} w {dash} {_rgb(s.get('color', (0, 0, 0)))} RG "
                       f"{s['x1']:.2f} {H - s['y1']:.2f} m {s['x2']:.2f} {H - s['y2']:.2f} l S [] 0 d")
        elif t == "circle":
            cx, cy, r = s["cx"], H - s["cy"], s["r"]
            k = r * KAPPA
            path = (f"{cx + r:.2f} {cy:.2f} m "
                    f"{cx + r:.2f} {cy + k:.2f} {cx + k:.2f} {cy + r:.2f} {cx:.2f} {cy + r:.2f} c "
                    f"{cx - k:.2f} {cy + r:.2f} {cx - r:.2f} {cy + k:.2f} {cx - r:.2f} {cy:.2f} c "
                    f"{cx - r:.2f} {cy - k:.2f} {cx - k:.2f} {cy - r:.2f} {cx:.2f} {cy - r:.2f} c "
                    f"{cx + k:.2f} {cy - r:.2f} {cx + r:.2f} {cy - k:.2f} {cx + r:.2f} {cy:.2f} c")
            if s.get("fill"):
                out.append(f"{_rgb(s['fill'])} rg {path} f")
            if s.get("stroke"):
                out.append(f"{s.get('lw', 0.7):.2f} w {_rgb(s['stroke'])} RG {path} S")
        elif t == "text":
            size = s["s"]
            font = "F2" if s.get("bold") else "F1"
            x = s["x"]
            width = text_width(s["text"], size, s.get("bold"))
            if s.get("align") == "center":
                x -= width / 2
            elif s.get("align") == "right":
                x -= width
            out.append(f"BT /{font} {size:.2f} Tf {_rgb(s.get('color', (0, 0, 0)))} rg "
                       f"{x:.2f} {H - s['y']:.2f} Td ({_esc(s['text'])}) Tj ET")
    return "\n".join(out).encode("cp1252", "replace")


def render_pdf(pages, path, title=""):
    objs = []

    def add(body):
        objs.append(body)
        return len(objs)

    catalog = add(None)
    pages_id = add(None)
    f1 = add(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>")
    f2 = add(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>")
    kids = []
    for W, H, shapes in pages:
        data = zlib.compress(_stream(H, shapes))
        content = add(b"<< /Length %d /Filter /FlateDecode >>\nstream\n" % len(data) + data + b"\nendstream")
        page = add((f"<< /Type /Page /Parent {pages_id} 0 R /MediaBox [0 0 {W:.2f} {H:.2f}] "
                    f"/Resources << /Font << /F1 {f1} 0 R /F2 {f2} 0 R >> >> /Contents {content} 0 R >>").encode())
        kids.append(page)
    objs[catalog - 1] = f"<< /Type /Catalog /Pages {pages_id} 0 R >>".encode()
    objs[pages_id - 1] = (f"<< /Type /Pages /Kids [{' '.join(f'{k} 0 R' for k in kids)}] "
                          f"/Count {len(kids)} >>").encode()
    info = add(f"<< /Title ({_esc(title)}) >>".encode("cp1252", "replace"))

    buf = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = []
    for i, body in enumerate(objs, 1):
        offsets.append(len(buf))
        buf += f"{i} 0 obj\n".encode() + body + b"\nendobj\n"
    xref = len(buf)
    buf += f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n".encode()
    for off in offsets:
        buf += f"{off:010d} 00000 n \n".encode()
    buf += (f"trailer\n<< /Size {len(objs) + 1} /Root {catalog} 0 R /Info {info} 0 R >>\n"
            f"startxref\n{xref}\n%%EOF\n").encode()
    with open(path, "wb") as fh:
        fh.write(buf)
