"""Gumroad: its API can't create new products, so the bot prepares a ready-to-upload folder for
each approved product. Sales are read through the API for the earnings report."""
import shutil
from pathlib import Path

from ..core.config import OUTPUT
from .http import request

API = "https://api.gumroad.com/v2"


def is_connected(cfg):
    return bool(cfg["gumroad"].get("access_token"))


def prepare(product):
    d = product["data"]
    folder = OUTPUT / "gumroad" / product["sku"]
    folder.mkdir(parents=True, exist_ok=True)
    shutil.copy2(d["zip"], folder / Path(d["zip"]).name)
    for image in d["images"][:3]:
        shutil.copy2(image, folder / Path(image).name)
    (folder / "PASTE-INTO-GUMROAD.txt").write_text(
        f"""Gumroad > Products > New product > Digital product

NAME (copy exactly, the earnings report matches sales by this name)
{d['short_name']}

PRICE
{d['price']:.2f}

DESCRIPTION
{d['description']}
TAGS
{', '.join(d['tags'][:5])}

FILES
- Content: upload {Path(d['zip']).name}
- Cover and thumbnail: upload 01-cover.png
""", encoding="utf-8")
    return str(folder)


def fetch_sales(cfg, max_pages=20):
    """Yields (sale_id, product_name, amount_cents, currency, when)."""
    token = cfg["gumroad"]["access_token"]
    currency = cfg["gumroad"].get("currency", "USD")
    query = {"access_token": token}
    for _ in range(max_pages):
        data = request("GET", API + "/sales", query=query)
        for s in data.get("sales", []):
            if s.get("refunded") or s.get("chargedback"):
                continue
            when = (s.get("created_at") or "")[:19].replace("T", " ")
            yield (s["id"], s.get("product_name", ""), int(s.get("price", 0)), currency, when)
        if not data.get("next_page_key"):
            break
        query["page_key"] = data["next_page_key"]
