"""Settings: config.json in the project folder, with environment variables as overrides."""
import copy
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data"
OUTPUT = ROOT / "output"
CONFIG_FILE = ROOT / "config.json"

DEFAULTS = {
    "dashboard": {"host": "127.0.0.1", "port": 8080},
    "etsy": {
        "keystring": "",
        "shared_secret": "",
        "redirect_uri": "http://localhost:8765/callback",
        "taxonomy_id": None,
        "who_made": "i_did",
        "when_made": "made_to_order",
        "quantity": 999,
        "activate_on_approve": True,
    },
    "gumroad": {"access_token": "", "currency": "USD"},
    "bots": {
        "product_factory": {"per_run": 3, "image_width": 2000, "price_overrides": {}},
    },
}

ENV_OVERRIDES = {
    "ETSY_KEYSTRING": ("etsy", "keystring"),
    "ETSY_SHARED_SECRET": ("etsy", "shared_secret"),
    "GUMROAD_ACCESS_TOKEN": ("gumroad", "access_token"),
}


def _merge(base, extra):
    for key, value in extra.items():
        if isinstance(value, dict) and isinstance(base.get(key), dict):
            _merge(base[key], value)
        else:
            base[key] = value
    return base


def load():
    cfg = copy.deepcopy(DEFAULTS)
    if CONFIG_FILE.exists():
        _merge(cfg, json.loads(CONFIG_FILE.read_text(encoding="utf-8")))
    for env, (section, key) in ENV_OVERRIDES.items():
        if os.environ.get(env):
            cfg[section][key] = os.environ[env]
    DATA.mkdir(exist_ok=True)
    OUTPUT.mkdir(exist_ok=True)
    return cfg


def bot_settings(cfg, bot_name):
    return cfg.get("bots", {}).get(bot_name, {})
