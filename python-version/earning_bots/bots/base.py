"""Every worker bot extends BaseBot. Drop a new module or package into earning_bots/bots/
that defines a class named `Bot`, and the manager and dashboard pick it up automatically."""
from ..core import db
from ..core.config import OUTPUT


class BaseBot:
    name = ""            # short id, used on the command line: python main.py run <name>
    title = ""           # shown on the dashboard
    description = ""     # one line: what the bot does
    earns_via = ""       # where the money comes from, e.g. "Etsy + Gumroad sales"

    def run(self, ctx):
        """Do one round of work. Return a short summary string for the dashboard."""
        raise NotImplementedError


class Context:
    """What a bot gets when it runs: its settings, a logger, and helpers for saving work."""

    def __init__(self, bot, config, settings, run_id):
        self.bot = bot
        self.config = config
        self.settings = settings
        self.run_id = run_id
        self.lines = []

    def log(self, message):
        self.lines.append(message)
        print(f"[{self.bot.name}] {message}", flush=True)

    def output_dir(self):
        path = OUTPUT / "products"
        path.mkdir(parents=True, exist_ok=True)
        return path

    def existing_skus(self):
        return db.existing_skus(self.bot.name)

    def add_product(self, sku, title, folder, data):
        """Queue a finished product for your approval on the dashboard."""
        return db.add_product(self.bot.name, sku, title, folder, data)
