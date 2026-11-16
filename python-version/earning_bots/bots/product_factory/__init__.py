"""Product Factory: designs printable PDF products, renders preview images, writes the listing
and queues each product for your approval. Approved products are published to Etsy and
packaged for Gumroad."""
import json
import random
import zipfile

from ..base import BaseBot
from ...core.pdf import render_pdf
from ...core.png import Canvas, render_shapes, lighten
from .catalog import BUNDLES, listing_copy
from .layouts import LAYOUTS, SIZES, THEMES, build_page

HOW_TO = """Thank you for your purchase!

FILES
- The -A4 file is for A4 paper (Europe and most of the world).
- The -US-Letter file is for US Letter paper (USA and Canada).

PRINTING
- Open the PDF and print at 100% / "Actual size" for the best result.
- Print single pages as many times as you like for personal use.

DIGITAL USE
- Import the PDF into any note-taking app that supports PDF annotation.
"""


def slugify(text):
    keep = "".join(ch.lower() if ch.isalnum() else "-" for ch in text)
    while "--" in keep:
        keep = keep.replace("--", "-")
    return keep.strip("-")


class Bot(BaseBot):
    name = "product_factory"
    title = "Product Factory"
    description = "Designs printable planner PDFs, makes the preview images and writes the listing."
    earns_via = "Etsy + Gumroad sales"

    def run(self, ctx):
        per_run = int(ctx.settings.get("per_run", 3))
        width = int(ctx.settings.get("image_width", 2000))
        overrides = ctx.settings.get("price_overrides", {})
        done = ctx.existing_skus()
        todo = [(b, t) for b in BUNDLES for t in THEMES if f"{b}-{t.lower()}" not in done]
        if not todo:
            return "The catalogue is complete. Add new bundles or themes in catalog.py / layouts.py."
        # spread the work: favour bundles with the fewest products so far, random theme order
        made_per_bundle = {b: sum(1 for s in done if s.startswith(b + "-")) for b in BUNDLES}
        random.shuffle(todo)
        todo.sort(key=lambda bt: made_per_bundle[bt[0]])

        made = []
        for bundle_key, theme in todo[:per_run]:
            sku = f"{bundle_key}-{theme.lower()}"
            ctx.log(f"Making {sku}")
            data = self.make_product(ctx, bundle_key, theme, sku, width, overrides)
            ctx.add_product(sku, data["title"], data["folder"], data)
            made.append(data["short_name"])
        left = len(todo) - len(made)
        return f"Made {len(made)} product(s), waiting for your approval: {', '.join(made)}. {left} more in the catalogue."

    def make_product(self, ctx, bundle_key, theme, sku, width, overrides):
        bundle = BUNDLES[bundle_key]
        folder = ctx.output_dir() / sku
        (folder / "files").mkdir(parents=True, exist_ok=True)
        (folder / "images").mkdir(parents=True, exist_ok=True)
        page_names = [LAYOUTS[k][0] for k in bundle["pages"]]
        price = float(overrides.get(bundle_key, bundle["price"]))
        copy = listing_copy(bundle_key, theme, page_names, price)
        file_stem = slugify(copy["short_name"])

        pdfs = []
        for size_name, size in SIZES.items():
            pages = [(size[0], size[1], build_page(k, size_name, theme).shapes) for k in bundle["pages"]]
            path = folder / "files" / f"{file_stem}-{size_name}.pdf"
            render_pdf(pages, path, title=copy["short_name"])
            pdfs.append(path)

        theme_colors = THEMES[theme]
        images = [folder / "images" / "01-cover.png"]
        self.render_cover(images[0], bundle, theme, theme_colors, width)
        for i, key in enumerate(bundle["pages"][:9], start=2):
            path = folder / "images" / f"{i:02d}-{key}.png"
            self.render_page_image(path, key, theme, theme_colors, width)
            images.append(path)

        zip_path = folder / f"{file_stem}.zip"
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            for pdf in pdfs:
                zf.write(pdf, pdf.name)
            zf.writestr("HOW-TO-PRINT.txt", HOW_TO)

        data = {
            **copy,
            "sku": sku,
            "bundle": bundle_key,
            "theme": theme,
            "pages": bundle["pages"],
            "folder": str(folder),
            "pdfs": [str(p) for p in pdfs],
            "images": [str(p) for p in images],
            "zip": str(zip_path),
        }
        (folder / "listing.json").write_text(json.dumps(data, indent=2), encoding="utf-8")
        return data

    # ---- preview images -------------------------------------------------

    def render_cover(self, path, bundle, theme, colors, width):
        W, H = width, int(width * 0.8)
        acc, light = colors["accent"], colors["light"]
        cv = Canvas(W, H, light)
        name = bundle["name"].upper()
        scale = min(9, int((W * 0.9) / (6 * len(name))))
        cv.text((W - Canvas.text_width(name, scale)) / 2, H * 0.06, name, scale, acc, bold=True)
        sub = "PRINTABLE PDF - A4 & US LETTER - INSTANT DOWNLOAD"
        s2 = max(2, int(W / 700))
        cv.text((W - Canvas.text_width(sub, s2)) / 2, H * 0.06 + 7 * scale + H * 0.03, sub, s2, colors["ink"])

        keys = bundle["pages"][:3]
        ph = H * 0.62
        size = SIZES["A4"]
        k = ph / size[1]
        pw = size[0] * k
        gap = W * 0.03
        total = len(keys) * pw + (len(keys) - 1) * gap
        x0, top = (W - total) / 2, H * 0.24
        for i, key in enumerate(keys):
            x = x0 + i * (pw + gap)
            cv.fill_rect(x + 10, top + 12, pw, ph, lighten(acc, 0.55))  # shadow
            cv.fill_rect(x, top, pw, ph, (255, 255, 255))
            render_shapes(cv, build_page(key, "A4", theme).shapes, k, x, top)

        band_y = H * 0.9
        cv.fill_rect(0, band_y, W, H - band_y, acc)
        n = len(bundle["pages"])
        foot = f"{n} PAGE{'S' if n != 1 else ''} - UNDATED - {theme.upper()} THEME"
        s3 = max(2, int(W / 500))
        cv.text((W - Canvas.text_width(foot, s3)) / 2, band_y + (H - band_y - 7 * s3) / 2, foot, s3,
                (255, 255, 255), bold=True)
        cv.save(path)

    def render_page_image(self, path, key, theme, colors, width):
        W, H = width, int(width * 0.8)
        cv = Canvas(W, H, colors["light"])
        size = SIZES["A4"]
        ph = H * 0.9
        k = ph / size[1]
        pw = size[0] * k
        x, top = (W - pw) / 2, (H - ph) / 2
        cv.fill_rect(x + 10, top + 12, pw, ph, lighten(colors["accent"], 0.55))
        cv.fill_rect(x, top, pw, ph, (255, 255, 255))
        render_shapes(cv, build_page(key, "A4", theme).shapes, k, x, top)
        cv.save(path)
