"""SQLite storage: bot runs, products waiting for approval or published, and earnings."""
import json
import sqlite3
from datetime import datetime, timezone

from .config import DATA

DB_FILE = DATA / "earning_bots.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bot TEXT NOT NULL,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    status TEXT NOT NULL,          -- running | ok | error
    summary TEXT
);
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bot TEXT NOT NULL,
    sku TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    folder TEXT NOT NULL,
    data TEXT NOT NULL,            -- JSON: listing copy, price, tags, file paths
    status TEXT NOT NULL,          -- pending | publishing | published | ready_manual | rejected | failed
    created_at TEXT NOT NULL,
    etsy_listing_id TEXT,
    gumroad_folder TEXT,
    log TEXT
);
CREATE TABLE IF NOT EXISTS earnings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,          -- etsy | gumroad | manual
    external_id TEXT NOT NULL,
    product_id INTEGER,
    bot TEXT,
    amount_cents INTEGER NOT NULL,
    currency TEXT NOT NULL,
    occurred_at TEXT NOT NULL,
    note TEXT,
    UNIQUE(source, external_id)
);
"""


def now():
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


def connect():
    DATA.mkdir(exist_ok=True)
    con = sqlite3.connect(DB_FILE, timeout=30)
    con.row_factory = sqlite3.Row
    con.executescript(SCHEMA)
    return con


# ---- runs ---------------------------------------------------------------

def start_run(bot):
    with connect() as con:
        cur = con.execute("INSERT INTO runs (bot, started_at, status) VALUES (?, ?, 'running')", (bot, now()))
        return cur.lastrowid


def finish_run(run_id, status, summary):
    with connect() as con:
        con.execute("UPDATE runs SET finished_at=?, status=?, summary=? WHERE id=?",
                    (now(), status, summary, run_id))


def recent_runs(limit=15):
    with connect() as con:
        return [dict(r) for r in con.execute("SELECT * FROM runs ORDER BY id DESC LIMIT ?", (limit,))]


def running_bots():
    with connect() as con:
        return {r["bot"] for r in con.execute("SELECT bot FROM runs WHERE status='running'")}


def clear_stale_runs():
    """Runs left 'running' after a crash or restart are marked as interrupted."""
    with connect() as con:
        con.execute("UPDATE runs SET status='error', summary='Interrupted (app was stopped)', finished_at=? "
                    "WHERE status='running'", (now(),))


# ---- products -----------------------------------------------------------

def existing_skus(bot=None):
    with connect() as con:
        if bot:
            rows = con.execute("SELECT sku FROM products WHERE bot=?", (bot,))
        else:
            rows = con.execute("SELECT sku FROM products")
        return {r["sku"] for r in rows}


def add_product(bot, sku, title, folder, data):
    with connect() as con:
        cur = con.execute(
            "INSERT INTO products (bot, sku, title, folder, data, status, created_at) VALUES (?,?,?,?,?, 'pending', ?)",
            (bot, sku, title, str(folder), json.dumps(data), now()))
        return cur.lastrowid


def get_product(product_id):
    with connect() as con:
        row = con.execute("SELECT * FROM products WHERE id=?", (product_id,)).fetchone()
    return _product(row) if row else None


def list_products(status=None, limit=200):
    with connect() as con:
        if status:
            rows = con.execute("SELECT * FROM products WHERE status=? ORDER BY id DESC LIMIT ?", (status, limit))
        else:
            rows = con.execute("SELECT * FROM products ORDER BY id DESC LIMIT ?", (limit,))
        return [_product(r) for r in rows]


def update_product(product_id, **fields):
    if not fields:
        return
    cols = ", ".join(f"{k}=?" for k in fields)
    with connect() as con:
        con.execute(f"UPDATE products SET {cols} WHERE id=?", (*fields.values(), product_id))


def _product(row):
    p = dict(row)
    p["data"] = json.loads(p["data"])
    return p


def product_by_etsy_listing(listing_id):
    with connect() as con:
        row = con.execute("SELECT * FROM products WHERE etsy_listing_id=?", (str(listing_id),)).fetchone()
    return _product(row) if row else None


def product_by_title(title):
    with connect() as con:
        row = con.execute("SELECT * FROM products WHERE title=?", (title,)).fetchone()
    return _product(row) if row else None


# ---- earnings -----------------------------------------------------------

def add_earning(source, external_id, amount_cents, currency, occurred_at, product=None, note=None, bot=None):
    """Returns True if this sale is new."""
    with connect() as con:
        cur = con.execute(
            "INSERT OR IGNORE INTO earnings (source, external_id, product_id, bot, amount_cents, currency, occurred_at, note) "
            "VALUES (?,?,?,?,?,?,?,?)",
            (source, str(external_id), product["id"] if product else None,
             product["bot"] if product else bot, int(amount_cents), currency.upper(), occurred_at, note))
        return cur.rowcount == 1


def earnings_rows():
    with connect() as con:
        return [dict(r) for r in con.execute(
            "SELECT e.*, p.title AS product_title FROM earnings e LEFT JOIN products p ON p.id = e.product_id "
            "ORDER BY e.occurred_at DESC")]
