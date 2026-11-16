# Earning Bots

Worker bots that make products to sell online, with an approval queue and an earnings report.
The same app runs inside Claude and as an Android app.

## Bots
- **Product Factory**: designs printable planner PDFs (12 page designs × 10 bundles × 8 colour themes),
  renders Etsy preview images and writes the listing title, description and 13 tags.
- **Idea Bot**: asks Claude for new niche printables (teachers, nurses, weddings, pets...) and builds them.
  In the Android app it needs an Anthropic API key (Settings).

## How it works
1. **Bots** tab: tap Run.
2. **Approve** tab: check the preview and listing text, then Approve or Reject.
3. **Sell** tab: download the upload kit (PDFs, Etsy photos, Gumroad zip, LISTING.txt), list it on Etsy / Gumroad, paste the links.
4. **Earnings** tab: log each sale. You get totals by bot, platform and product.

## Get the APK
Every push to `main` builds the app with GitHub Actions. Open the repo's **Releases** on your phone,
download the newest `EarningBots-N.apk` and open it to install (allow "install unknown apps" once).

Actions minutes are free on public repos. If you make the repo private, builds use your monthly minutes.

## Add a bot
Add an object to the `BOTS` list in `www/app.js` with `id`, `title`, `desc`, `earnsVia` and an
`async run(ctx)` that calls `ctx.addProduct(...)` and returns a summary. It shows up on the Bots tab automatically.

## Develop
```
npm install
npm run sync          # copies www/ into the Android project
```
`python-version/` holds the earlier Termux (Python) version with direct Etsy API publishing.
