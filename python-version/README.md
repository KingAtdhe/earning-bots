# Earning Bots

A manager app that runs worker bots, publishes what they make, and reports what each one earns.
It's pure Python with nothing to install, so it runs on an Android phone in Termux.

Bot 1 is the **Product Factory**. It designs printable planner PDFs (12 page designs, 10 bundles, 8 colour themes, 80 products to start), renders the preview images and writes the Etsy listing: title, description and 13 tags. Each product waits for your approval. Approved products are published to Etsy automatically and packaged for Gumroad.

## Start (Termux)

```bash
pkg install python git
cd earning-bots
python main.py run product_factory   # makes 3 products
python main.py                       # dashboard: open http://127.0.0.1:8080 in your phone browser
```

On the dashboard you can tap **Run** on a bot, check the previews and listing text, then tap **Approve & publish** or **Reject**. The earnings section shows totals per bot and per platform.

## Connect Etsy (one time)

1. Open an Etsy shop if you don't have one. This needs ID and bank checks, which only you can do.
2. Go to https://www.etsy.com/developers/your-apps and create an app.
   - Set the callback URL to `http://localhost:8765/callback`
3. Copy `config.example.json` to `config.json` and paste in your **keystring** and **shared secret**.
4. Find the category id for planners:
   ```bash
   python main.py etsy-taxonomy planner
   ```
   Put the best match's number in `"taxonomy_id"`.
5. Connect your shop:
   ```bash
   python main.py etsy-login
   ```
   Etsy opens in the browser. Tap **Allow access**.

From then on, **Approve & publish** creates the listing, uploads the images and both PDFs, and makes it live.

Etsy charges USD 0.20 per listing plus a fee on each sale. To review listings on Etsy first, set `"activate_on_approve": false` and they'll be saved as drafts.

## Connect Gumroad

Gumroad's API can't create products, so for every approved product the bot fills a folder in `output/gumroad/<product>/` with the ZIP, cover image and `PASTE-INTO-GUMROAD.txt`. Upload it by hand in about 2 minutes.

To include Gumroad sales in the earnings report, create an application under Gumroad **Settings > Advanced > Applications**, generate an access token and put it in `config.json` under `gumroad.access_token`.

## Earnings

- `python main.py sync` pulls new sales from Etsy and Gumroad. The dashboard has a button for this.
- `python main.py report` prints the report.
- `python main.py add-earning 12.50 EUR "note"` records income from anywhere else.

Amounts are gross sales before platform fees.

## Run on repeat

```bash
python main.py schedule product_factory --hours 24
```

This makes new products every day and syncs sales. They still wait for your approval. `--auto-approve` publishes without review, but marketplaces punish low-quality bulk uploads, so check your products first.

## Add a new worker bot

Create `earning_bots/bots/my_bot.py`:

```python
from .base import BaseBot

class Bot(BaseBot):
    name = "my_bot"
    title = "My Bot"
    description = "What it does in one line."
    earns_via = "Where the money comes from"

    def run(self, ctx):
        ctx.log("working...")
        # ctx.add_product(sku, title, folder, data) queues work for approval
        return "Summary for the dashboard"
```

It appears on the dashboard automatically. Earnings are credited to a bot through the products it created, or recorded with `add-earning`.

## Grow the Product Factory

- New colour theme: add it to `THEMES` in `bots/product_factory/layouts.py`.
- New page design: write a layout function and add it to `LAYOUTS`.
- New bundle: add it to `BUNDLES` in `bots/product_factory/catalog.py`.
- Prices: `bots.product_factory.price_overrides` in `config.json`, e.g. `{"life": 12.90}`.
