"""Etsy Open API v3: one-time login (OAuth with PKCE), publishing digital listings, and
reading sales for the earnings report."""
import base64
import hashlib
import json
import secrets
import shutil
import subprocess
import time
import urllib.parse
import webbrowser
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer

from ..core.config import DATA
from .http import request

API = "https://api.etsy.com/v3/application"
AUTH_URL = "https://www.etsy.com/oauth/connect"
TOKEN_URL = "https://api.etsy.com/v3/public/oauth/token"
SCOPES = "listings_r listings_w shops_r transactions_r"
TOKEN_FILE = DATA / "etsy_token.json"


class EtsyError(Exception):
    pass


def is_configured(cfg):
    return bool(cfg["etsy"].get("keystring"))


def is_connected(cfg):
    return is_configured(cfg) and TOKEN_FILE.exists()


def _api_key(cfg):
    # Etsy asks for "keystring:shared_secret" in x-api-key; older apps accept the keystring alone.
    e = cfg["etsy"]
    return f"{e['keystring']}:{e['shared_secret']}" if e.get("shared_secret") else e["keystring"]


# ---- login ---------------------------------------------------------------

def login(cfg, timeout=300):
    e = cfg["etsy"]
    if not e.get("keystring"):
        raise EtsyError("Add your Etsy keystring (and shared secret) to config.json first.")
    verifier = secrets.token_urlsafe(64)[:96]
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip("=")
    state = secrets.token_urlsafe(16)
    redirect = urllib.parse.urlparse(e["redirect_uri"])
    url = AUTH_URL + "?" + urllib.parse.urlencode({
        "response_type": "code", "redirect_uri": e["redirect_uri"], "scope": SCOPES,
        "client_id": e["keystring"], "state": state,
        "code_challenge": challenge, "code_challenge_method": "S256",
    })
    result = {}

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            qs = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            if qs.get("state", [""])[0] == state and "code" in qs:
                result["code"] = qs["code"][0]
                msg = "Etsy is connected. You can close this tab and go back to Earning Bots."
            else:
                result["error"] = qs.get("error_description", qs.get("error", ["unknown"]))[0]
                msg = f"Etsy login failed: {result['error']}"
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(f"<h2 style='font-family:sans-serif'>{msg}</h2>".encode())

        def log_message(self, *args):
            pass

    server = HTTPServer((redirect.hostname, redirect.port or 80), Handler)
    server.timeout = 5
    print("\nOpen this link, log in to Etsy and press 'Allow access':\n\n" + url + "\n", flush=True)
    _open_url(url)
    deadline = time.time() + timeout
    while not result and time.time() < deadline:
        server.handle_request()
    server.server_close()
    if "code" not in result:
        raise EtsyError(f"No approval received ({result.get('error', 'timed out')}).")

    token = request("POST", TOKEN_URL, form={
        "grant_type": "authorization_code", "client_id": e["keystring"], "redirect_uri": e["redirect_uri"],
        "code": result["code"], "code_verifier": verifier,
    })
    token["expires_at"] = time.time() + int(token.get("expires_in", 3600))
    _save(token)
    shop = _call(cfg, "GET", f"/users/{token['access_token'].split('.')[0]}/shops")
    shop = shop["results"][0] if "results" in shop else shop
    token["shop_id"], token["shop_name"] = shop["shop_id"], shop.get("shop_name", "")
    _save(token)
    return token["shop_name"]


def _open_url(url):
    if shutil.which("termux-open-url"):
        subprocess.run(["termux-open-url", url], check=False)
    else:
        try:
            webbrowser.open(url)
        except Exception:
            pass


def _save(token):
    TOKEN_FILE.write_text(json.dumps(token, indent=2), encoding="utf-8")


def _token(cfg):
    if not TOKEN_FILE.exists():
        raise EtsyError("Etsy is not connected yet. Run: python main.py etsy-login")
    token = json.loads(TOKEN_FILE.read_text(encoding="utf-8"))
    if token.get("expires_at", 0) - 60 < time.time():
        fresh = request("POST", TOKEN_URL, form={
            "grant_type": "refresh_token", "client_id": cfg["etsy"]["keystring"],
            "refresh_token": token["refresh_token"],
        })
        token.update(fresh)
        token["expires_at"] = time.time() + int(fresh.get("expires_in", 3600))
        _save(token)
    return token


def _call(cfg, method, path, **kwargs):
    token = _token(cfg)
    headers = {"x-api-key": _api_key(cfg), "Authorization": f"Bearer {token['access_token']}"}
    return request(method, API + path, headers=headers, **kwargs)


# ---- helpers ----------------------------------------------------------------

def find_taxonomy(cfg, words):
    """Search Etsy's seller categories, e.g. 'planner', to find the taxonomy_id for config.json."""
    data = request("GET", API + "/seller-taxonomy/nodes", headers={"x-api-key": _api_key(cfg)})
    hits = []

    def walk(nodes, trail):
        for n in nodes:
            path = trail + [n["name"]]
            if all(w.lower() in " > ".join(path).lower() for w in words.split()):
                hits.append((n["id"], " > ".join(path)))
            walk(n.get("children", []), path)

    walk(data.get("results", []), [])
    return hits


# ---- publishing -------------------------------------------------------------

def publish(cfg, product):
    e = cfg["etsy"]
    if not e.get("taxonomy_id"):
        raise EtsyError("Set etsy.taxonomy_id in config.json (find it with: python main.py etsy-taxonomy planner)")
    token = _token(cfg)
    shop = token["shop_id"]
    d = product["data"]
    listing = _call(cfg, "POST", f"/shops/{shop}/listings", form={
        "quantity": e.get("quantity", 999),
        "title": d["title"],
        "description": d["description"],
        "price": f"{d['price']:.2f}",
        "who_made": e.get("who_made", "i_did"),
        "when_made": e.get("when_made", "made_to_order"),
        "taxonomy_id": e["taxonomy_id"],
        "type": "download",
        "is_supply": "false",
        "tags": ",".join(d["tags"]),
    })
    listing_id = listing["listing_id"]
    for rank, image in enumerate(d["images"][:10], start=1):
        _call(cfg, "POST", f"/shops/{shop}/listings/{listing_id}/images", fields={"rank": rank},
              files={"image": image})
    for rank, pdf in enumerate(d["pdfs"][:5], start=1):
        name = pdf.replace("\\", "/").rsplit("/", 1)[-1]
        _call(cfg, "POST", f"/shops/{shop}/listings/{listing_id}/files", fields={"name": name, "rank": rank},
              files={"file": pdf})
    state = "draft"
    if e.get("activate_on_approve", True):
        _call(cfg, "PATCH", f"/shops/{shop}/listings/{listing_id}", form={"state": "active"})
        state = "active"
    return str(listing_id), state


# ---- earnings ---------------------------------------------------------------

def fetch_sales(cfg, max_pages=10):
    """Yields one record per sold item: (transaction_id, listing_id, amount_cents, currency, when)."""
    token = _token(cfg)
    shop = token["shop_id"]
    offset, limit = 0, 100
    for _ in range(max_pages):
        data = _call(cfg, "GET", f"/shops/{shop}/receipts",
                     query={"limit": limit, "offset": offset, "was_paid": "true"})
        receipts = data.get("results", [])
        for r in receipts:
            when = datetime.fromtimestamp(r.get("created_timestamp", 0), timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
            for t in r.get("transactions", []):
                price = t.get("price", {})
                divisor = price.get("divisor", 100) or 100
                cents = round(price.get("amount", 0) * 100 / divisor) * int(t.get("quantity", 1))
                yield (t["transaction_id"], t.get("listing_id"), cents, price.get("currency_code", "USD"), when)
        if len(receipts) < limit:
            break
        offset += limit
