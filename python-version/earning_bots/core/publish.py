"""Approval step: you approve a product, it goes to Etsy (if connected) and gets a Gumroad-ready folder."""
import traceback

from . import config as config_mod
from . import db
from ..publishers import etsy, gumroad


def approve(product_id):
    cfg = config_mod.load()
    product = db.get_product(product_id)
    if not product:
        return f"Product {product_id} not found."
    if product["status"] not in ("pending", "failed", "ready_manual"):
        return f"Product {product_id} is already {product['status']}."
    db.update_product(product_id, status="publishing")
    log = []
    try:
        folder = gumroad.prepare(product)
        db.update_product(product_id, gumroad_folder=folder)
        log.append(f"Gumroad upload folder ready: {folder}")
        if etsy.is_connected(cfg):
            listing_id, state = etsy.publish(cfg, product)
            db.update_product(product_id, etsy_listing_id=listing_id, status="published")
            log.append(f"Etsy listing {listing_id} is {state}: https://www.etsy.com/listing/{listing_id}")
        else:
            db.update_product(product_id, status="ready_manual")
            log.append("Etsy is not connected, so nothing was published automatically.")
    except Exception as exc:
        db.update_product(product_id, status="failed")
        log.append(f"Publishing failed: {exc}")
        print(traceback.format_exc(), flush=True)
    db.update_product(product_id, log="\n".join(log))
    return "\n".join(log)


def reject(product_id):
    db.update_product(product_id, status="rejected")
    return f"Product {product_id} rejected."
