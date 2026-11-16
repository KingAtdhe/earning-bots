"""Finds every worker bot in earning_bots/bots/."""
import importlib
import pkgutil
import traceback

from .. import bots as bots_pkg


def discover():
    found = {}
    for mod_info in pkgutil.iter_modules(bots_pkg.__path__):
        if mod_info.name.startswith("_") or mod_info.name == "base":
            continue
        try:
            module = importlib.import_module(f"{bots_pkg.__name__}.{mod_info.name}")
        except Exception:
            print(f"Could not load bot '{mod_info.name}':\n{traceback.format_exc()}")
            continue
        cls = getattr(module, "Bot", None)
        if cls is None:
            continue
        bot = cls()
        found[bot.name] = bot
    return dict(sorted(found.items()))
