"""Runs a bot, records the run, and never lets one bot run twice at the same time."""
import threading
import traceback

from . import config as config_mod
from . import db
from .registry import discover
from ..bots.base import Context

_locks = {}
_locks_guard = threading.Lock()


def _lock_for(name):
    with _locks_guard:
        return _locks.setdefault(name, threading.Lock())


def run_bot(name):
    bots = discover()
    if name not in bots:
        raise SystemExit(f"Unknown bot '{name}'. Available: {', '.join(bots) or 'none'}")
    bot = bots[name]
    lock = _lock_for(name)
    if not lock.acquire(blocking=False):
        return f"{bot.title} is already running."
    try:
        cfg = config_mod.load()
        run_id = db.start_run(name)
        ctx = Context(bot, cfg, config_mod.bot_settings(cfg, name), run_id)
        try:
            summary = bot.run(ctx) or "Done."
            db.finish_run(run_id, "ok", summary)
            return summary
        except Exception as exc:
            ctx.log(traceback.format_exc())
            db.finish_run(run_id, "error", f"{type(exc).__name__}: {exc}")
            return f"Failed: {exc}"
    finally:
        lock.release()


def run_in_background(name):
    thread = threading.Thread(target=run_bot, args=(name,), daemon=True)
    thread.start()
    return thread
