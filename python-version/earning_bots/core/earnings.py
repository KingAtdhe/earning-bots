"""Pulls sales from every connected platform and builds the earnings report."""
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from . import config as config_mod
from . import db
from ..publishers import etsy, gumroad


def sync():
    cfg = config_mod.load()
    messages = []
    if etsy.is_connected(cfg):
        try:
            new = 0
            for tid, listing_id, cents, cur, when in etsy.fetch_sales(cfg):
                product = db.product_by_etsy_listing(listing_id) if listing_id else None
                new += db.add_earning("etsy", tid, cents, cur, when, product=product)
            messages.append(f"Etsy: {new} new sale(s).")
        except Exception as exc:
            messages.append(f"Etsy sync failed: {exc}")
    if gumroad.is_connected(cfg):
        try:
            by_name = {p["data"].get("short_name"): p for p in db.list_products(limit=100000)}
            new = 0
            for sid, name, cents, cur, when in gumroad.fetch_sales(cfg):
                new += db.add_earning("gumroad", sid, cents, cur, when, product=by_name.get(name))
            messages.append(f"Gumroad: {new} new sale(s).")
        except Exception as exc:
            messages.append(f"Gumroad sync failed: {exc}")
    return " ".join(messages) or "No sales platforms connected yet."


def add_manual(amount, currency, note, bot=None):
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    db.add_earning("manual", f"manual-{stamp}-{note}", round(float(amount) * 100), currency, stamp,
                   note=note, bot=bot)


def report():
    rows = db.earnings_rows()
    now = datetime.now(timezone.utc)
    cutoffs = {"7 days": now - timedelta(days=7), "30 days": now - timedelta(days=30)}
    totals = defaultdict(int)                     # currency -> cents
    windows = {k: defaultdict(int) for k in cutoffs}
    by_bot = defaultdict(lambda: defaultdict(int))
    by_source = defaultdict(lambda: defaultdict(int))
    by_product = defaultdict(lambda: [0, 0, ""])  # title -> [cents, count, currency]
    for r in rows:
        cur, cents = r["currency"], r["amount_cents"]
        totals[cur] += cents
        when = datetime.strptime(r["occurred_at"][:19], "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
        for k, cut in cutoffs.items():
            if when >= cut:
                windows[k][cur] += cents
        by_bot[r["bot"] or "unassigned"][cur] += cents
        by_source[r["source"]][cur] += cents
        if r["product_title"]:
            entry = by_product[r["product_title"]]
            entry[0] += cents
            entry[1] += 1
            entry[2] = cur
    top = sorted(by_product.items(), key=lambda kv: -kv[1][0])[:10]
    return {"sales": len(rows), "total": dict(totals), "windows": {k: dict(v) for k, v in windows.items()},
            "by_bot": {k: dict(v) for k, v in by_bot.items()},
            "by_source": {k: dict(v) for k, v in by_source.items()}, "top_products": top}


def money(cents_by_currency):
    if not cents_by_currency:
        return "0.00"
    return " + ".join(f"{c / 100:,.2f} {cur}" for cur, c in sorted(cents_by_currency.items()))
