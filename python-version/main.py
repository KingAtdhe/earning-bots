#!/usr/bin/env python3
"""Earning Bots: a manager that runs worker bots, publishes their work and reports earnings.

  python main.py                      open the dashboard (default)
  python main.py bots                 list worker bots
  python main.py run product_factory  run one bot now
  python main.py pending              list products waiting for approval
  python main.py approve 3            approve and publish product 3 (or: approve all)
  python main.py reject 3             reject product 3
  python main.py sync                 pull new sales from Etsy and Gumroad
  python main.py report               print the earnings report
  python main.py add-earning 12.50 EUR "note"   record income from somewhere else
  python main.py schedule product_factory --hours 24   run a bot on repeat
  python main.py etsy-taxonomy planner             find the Etsy category id
  python main.py etsy-login                        connect your Etsy shop (one time)
"""
import argparse
import sys
import time

from earning_bots.core import db, earnings, publish
from earning_bots.core import config as config_mod
from earning_bots.core.registry import discover
from earning_bots.core.runner import run_bot


def cmd_report():
    rep = earnings.report()
    print(f"All time:      {earnings.money(rep['total'])}  ({rep['sales']} sales)")
    for label, vals in rep["windows"].items():
        print(f"Last {label:8} {earnings.money(vals)}")
    print("\nBy bot:")
    for name, vals in rep["by_bot"].items() or {"-": {}}.items():
        print(f"  {name:20} {earnings.money(vals)}")
    print("By platform:")
    for name, vals in rep["by_source"].items():
        print(f"  {name:20} {earnings.money(vals)}")
    if rep["top_products"]:
        print("Best sellers:")
        for title, (cents, count, cur) in rep["top_products"]:
            print(f"  {count:3}x  {cents / 100:9,.2f} {cur}  {title[:70]}")


def main(argv=None):
    ap = argparse.ArgumentParser(description="Earning Bots manager")
    sub = ap.add_subparsers(dest="cmd")
    sub.add_parser("dashboard")
    sub.add_parser("bots")
    p = sub.add_parser("run"); p.add_argument("bot")
    sub.add_parser("pending")
    p = sub.add_parser("approve"); p.add_argument("id")
    p = sub.add_parser("reject"); p.add_argument("id", type=int)
    sub.add_parser("sync")
    sub.add_parser("report")
    p = sub.add_parser("add-earning"); p.add_argument("amount"); p.add_argument("currency"); p.add_argument("note")
    p = sub.add_parser("schedule"); p.add_argument("bot"); p.add_argument("--hours", type=float, default=24)
    p.add_argument("--auto-approve", action="store_true",
                   help="publish without your review (not recommended: marketplaces punish low-quality bulk listings)")
    p = sub.add_parser("etsy-taxonomy"); p.add_argument("words", nargs="+")
    sub.add_parser("etsy-login")
    args = ap.parse_args(argv)

    if args.cmd in (None, "dashboard"):
        from earning_bots.dashboard.server import serve
        serve()
    elif args.cmd == "bots":
        for name, bot in discover().items():
            print(f"{name:20} {bot.title}: {bot.description}")
    elif args.cmd == "run":
        print(run_bot(args.bot))
    elif args.cmd == "pending":
        rows = db.list_products("pending")
        for prod in rows:
            print(f"{prod['id']:4}  {prod['data'].get('price'):>6}  {prod['data'].get('short_name')}")
            print(f"      preview: {prod['data']['images'][0]}")
        if not rows:
            print("Nothing waiting for approval.")
    elif args.cmd == "approve":
        ids = [x["id"] for x in db.list_products("pending")] if args.id == "all" else [int(args.id)]
        for pid in ids:
            print(publish.approve(pid))
    elif args.cmd == "reject":
        print(publish.reject(args.id))
    elif args.cmd == "sync":
        print(earnings.sync())
    elif args.cmd == "report":
        cmd_report()
    elif args.cmd == "add-earning":
        earnings.add_manual(args.amount, args.currency, args.note)
        print("Recorded.")
    elif args.cmd == "schedule":
        print(f"Running {args.bot} every {args.hours} hours. Ctrl+C to stop.")
        while True:
            print(run_bot(args.bot))
            if args.auto_approve:
                for prod in db.list_products("pending"):
                    print(publish.approve(prod["id"]))
            print(earnings.sync())
            time.sleep(args.hours * 3600)
    elif args.cmd == "etsy-taxonomy":
        from earning_bots.publishers import etsy
        for tid, path in etsy.find_taxonomy(config_mod.load(), " ".join(args.words))[:30]:
            print(f"{tid:8}  {path}")
    elif args.cmd == "etsy-login":
        from earning_bots.publishers import etsy
        print(f"Connected to Etsy shop: {etsy.login(config_mod.load())}")


if __name__ == "__main__":
    sys.exit(main())
