"""Phone-friendly dashboard: run bots with one tap, approve products, see earnings."""
import html
import threading
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from ..core import config as config_mod
from ..core import db, earnings, publish
from ..core.config import OUTPUT
from ..core.registry import discover
from ..core.runner import run_bot
from ..publishers import etsy, gumroad

_notices = []
_busy = set()
_busy_lock = threading.Lock()


def _notice(msg):
    _notices.insert(0, msg)
    del _notices[5:]


def _background(key, fn, *args):
    with _busy_lock:
        if key in _busy:
            _notice("That is already in progress.")
            return
        _busy.add(key)

    def work():
        try:
            _notice(str(fn(*args)))
        except Exception as exc:
            _notice(f"Error: {exc}")
        finally:
            with _busy_lock:
                _busy.discard(key)

    threading.Thread(target=work, daemon=True).start()


def e(text):
    return html.escape(str(text if text is not None else ""))


def _img_url(path):
    try:
        rel = Path(path).resolve().relative_to(OUTPUT.resolve())
    except ValueError:
        return ""
    return "/img?p=" + urllib.parse.quote(str(rel))


CSS = """
*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
background:#f4f3ef;color:#222}main{max-width:760px;margin:0 auto;padding:16px}
h1{font-size:22px;margin:4px 0 16px}h2{font-size:15px;text-transform:uppercase;letter-spacing:.06em;
color:#666;margin:26px 0 10px}.card{background:#fff;border-radius:14px;padding:14px;margin-bottom:10px;
box-shadow:0 1px 3px rgba(0,0,0,.06)}.big{font-size:30px;font-weight:700}.muted{color:#777;font-size:13px}
.row{display:flex;gap:10px;flex-wrap:wrap}.row>.card{flex:1;min-width:140px}
button{border:0;border-radius:10px;padding:10px 14px;font-size:15px;font-weight:600;background:#2d6a4f;
color:#fff}button.alt{background:#e9e6df;color:#333}button.bad{background:#b5452c}
form{display:inline}img{width:100%;border-radius:10px;display:block;margin:8px 0}
.notice{background:#fff7d6;border-radius:10px;padding:10px 12px;margin-bottom:8px;font-size:14px;
white-space:pre-wrap}.pill{display:inline-block;font-size:12px;padding:2px 8px;border-radius:99px;
background:#eee;margin-left:6px}.ok{background:#d8f3dc}.err{background:#fde2dc}.run{background:#fff1b8}
table{width:100%;border-collapse:collapse;font-size:14px}td{padding:6px 2px;border-bottom:1px solid #eee}
td:last-child{text-align:right}a{color:#2d6a4f}
"""


def page():
    cfg = config_mod.load()
    bots = discover()
    running = db.running_bots()
    rep = earnings.report()
    pending = db.list_products("pending") + db.list_products("failed")
    done = [p for p in db.list_products() if p["status"] in ("published", "ready_manual", "publishing")][:15]
    out = [f"<!doctype html><html><head><meta charset=utf-8><meta name=viewport content='width=device-width,"
           f"initial-scale=1'><title>Earning Bots</title><style>{CSS}</style>"]
    if running or _busy:
        out.append("<meta http-equiv=refresh content=4>")
    out.append("</head><body><main><h1>Earning Bots</h1>")
    for n in _notices:
        out.append(f"<div class=notice>{e(n)}</div>")

    # earnings
    out.append("<h2>Earnings</h2><div class=row>")
    out.append(f"<div class=card><div class=muted>All time</div><div class=big>{e(earnings.money(rep['total']))}"
               f"</div><div class=muted>{rep['sales']} sale(s)</div></div>")
    for label, vals in rep["windows"].items():
        out.append(f"<div class=card><div class=muted>Last {e(label)}</div><div class=big>"
                   f"{e(earnings.money(vals))}</div></div>")
    out.append("</div><div class=card><table>")
    for name, vals in rep["by_bot"].items():
        title = bots[name].title if name in bots else name
        out.append(f"<tr><td>{e(title)}</td><td>{e(earnings.money(vals))}</td></tr>")
    for name, vals in rep["by_source"].items():
        out.append(f"<tr><td class=muted>via {e(name.title())}</td><td class=muted>{e(earnings.money(vals))}</td></tr>")
    if not rep["sales"]:
        out.append("<tr><td class=muted>No sales recorded yet.</td><td></td></tr>")
    out.append("</table><p><form method=post action=/sync><button class=alt>Sync sales now</button></form></p>")
    if rep["top_products"]:
        out.append("<div class=muted>Best sellers</div><table>")
        for title, (cents, count, cur) in rep["top_products"]:
            out.append(f"<tr><td>{e(title[:60])} ({count})</td><td>{cents / 100:,.2f} {e(cur)}</td></tr>")
        out.append("</table>")
    out.append("</div>")

    # bots
    out.append("<h2>Worker bots</h2>")
    last = {}
    for r in db.recent_runs(50):
        last.setdefault(r["bot"], r)
    for name, bot in bots.items():
        r = last.get(name)
        status = ""
        if name in running:
            status = "<span class='pill run'>running</span>"
        elif r:
            status = f"<span class='pill {'ok' if r['status'] == 'ok' else 'err'}'>{e(r['status'])}</span>"
        out.append(f"<div class=card><b>{e(bot.title)}</b>{status}<div class=muted>{e(bot.description)}<br>"
                   f"Earns via: {e(bot.earns_via)}</div>")
        if r and r.get("summary"):
            out.append(f"<p class=muted>Last run {e(r['started_at'])} UTC: {e(r['summary'])}</p>")
        out.append(f"<form method=post action='/run/{e(name)}'><button>Run</button></form></div>")

    # approvals
    out.append(f"<h2>Waiting for approval ({len(pending)})</h2>")
    if not pending:
        out.append("<div class='card muted'>Nothing waiting. Run a bot to make new products.</div>")
    elif len(pending) > 1:
        out.append("<p><form method=post action=/approve-all><button>Approve &amp; publish all</button></form></p>")
    for p in pending:
        d = p["data"]
        img = _img_url(d["images"][0]) if d.get("images") else ""
        failed = "<span class='pill err'>failed</span>" if p["status"] == "failed" else ""
        out.append(f"<div class=card><b>{e(d.get('short_name', p['title']))}</b>{failed}"
                   f"<div class=muted>{e(d.get('price'))} - {len(d.get('pages', []))} page(s) - "
                   f"{e(p['bot'])}</div>")
        if img:
            out.append(f"<img src='{img}' alt='' loading=lazy>")
        if p.get("log"):
            out.append(f"<p class=muted>{e(p['log'])}</p>")
        out.append(f"<details><summary class=muted>Listing text</summary><p class=muted><b>{e(d.get('title'))}</b>"
                   f"</p><pre class=muted style='white-space:pre-wrap'>{e(d.get('description'))}</pre>"
                   f"<p class=muted>Tags: {e(', '.join(d.get('tags', [])))}</p></details><p>"
                   f"<form method=post action='/approve/{p['id']}'><button>Approve &amp; publish</button></form> "
                   f"<form method=post action='/reject/{p['id']}'><button class=bad>Reject</button></form></p></div>")

    # published
    if done:
        out.append("<h2>Published</h2><div class=card><table>")
        for p in done:
            link = (f"<a href='https://www.etsy.com/listing/{e(p['etsy_listing_id'])}'>Etsy</a>"
                    if p.get("etsy_listing_id") else e(p["status"].replace("_", " ")))
            out.append(f"<tr><td>{e(p['data'].get('short_name', p['title']))}</td><td>{link}</td></tr>")
        out.append("</table></div>")

    # connections
    etsy_state = ("connected" if etsy.is_connected(cfg) else
                  "keys added, run: python main.py etsy-login" if etsy.is_configured(cfg) else "not set up")
    gum_state = "connected (sales sync)" if gumroad.is_connected(cfg) else "not set up"
    out.append(f"<h2>Connections</h2><div class=card><table><tr><td>Etsy</td><td>{e(etsy_state)}</td></tr>"
               f"<tr><td>Gumroad</td><td>{e(gum_state)}</td></tr></table>"
               f"<p class=muted>Setup steps are in README.md.</p></div></main></body></html>")
    return "".join(out)


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, body, ctype="text/html; charset=utf-8"):
        data = body if isinstance(body, bytes) else body.encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        url = urllib.parse.urlparse(self.path)
        if url.path == "/":
            return self._send(200, page())
        if url.path == "/img":
            rel = urllib.parse.parse_qs(url.query).get("p", [""])[0]
            path = (OUTPUT / rel).resolve()
            if OUTPUT.resolve() in path.parents and path.suffix == ".png" and path.exists():
                return self._send(200, path.read_bytes(), "image/png")
        self._send(404, "Not found")

    def do_POST(self):
        parts = self.path.strip("/").split("/")
        if parts[0] == "run" and len(parts) == 2:
            name = parts[1]
            _background(f"run:{name}", run_bot, name)
            _notice(f"Started {name}.")
        elif parts[0] == "approve" and len(parts) == 2:
            _background(f"approve:{parts[1]}", publish.approve, int(parts[1]))
        elif parts[0] == "approve-all":
            ids = [p["id"] for p in db.list_products("pending")]
            _background("approve-all", lambda: "\n".join(publish.approve(i) for i in ids))
        elif parts[0] == "reject" and len(parts) == 2:
            _notice(publish.reject(int(parts[1])))
        elif parts[0] == "sync":
            _background("sync", earnings.sync)
        self.send_response(303)
        self.send_header("Location", "/")
        self.end_headers()

    def log_message(self, *args):
        pass


def serve():
    cfg = config_mod.load()
    db.clear_stale_runs()
    host, port = cfg["dashboard"]["host"], int(cfg["dashboard"]["port"])
    server = ThreadingHTTPServer((host, port), Handler)
    print(f"Earning Bots dashboard: http://{host}:{port}  (Ctrl+C to stop)", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
