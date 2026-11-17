# Earning Bots 4.2

Worker bots that make things you can sell or turn into paid work, an approval inbox, a library of
everything they made, and an earnings dashboard. The same app runs inside Claude and on Android.

## Bots

| Bot | What it makes | Earns via | Needs |
|---|---|---|---|
| Niche Research Bot | Scores product niches: demand (Google + Amazon suggestions, Etsy favorites) vs competition (Etsy listing count), then feeds the best ones to the other bots | Better products | Android app for live data; inside Claude it gives labelled estimates |
| Product Factory | Printable planner PDFs (A4 + US Letter), Etsy photos, listing | Etsy, Gumroad | nothing |
| Idea Bot | Niche printable bundles (teachers, nurses, weddings...) | Etsy, Gumroad | Claude |
| Puzzle Book Bot | Large-print Sudoku / Word Search books with solutions, cover, KDP listing | Amazon KDP | nothing (Claude optional for fresh themes) |
| Shirt Design Bot | Slogan designs as 4500x5400 transparent PNG + mockup + tags | Redbubble, Merch by Amazon | nothing (Claude optional) |
| Content Bot | Carousel posts (slides), caption, hashtags, voiceover script | TikTok, Instagram, YouTube | Claude |
| Article Bot | SEO articles in Markdown + HTML | Affiliate links / ads | Claude |
| Client Finder | Local businesses with no website (OpenStreetMap) + personal pitch | Client work | Android app for the map search; Claude optional |
| Job Scanner | Remote jobs (Remotive, Remote OK) and GitHub bounties + proposals | Freelance work, bounties | Android app; Claude for proposals |
| Deal Finder | Price drops below your buy price on any product page | Reselling | Android app |
| Listing Optimizer | Better titles and tags for approved/live products | More Etsy views | Claude |
| Calendar Bot | Dated printable wall calendars for next year (Monday/Sunday start) | Etsy, Gumroad (seasonal) | nothing |
| Maze Book Bot | Maze activity books with solutions + KDP listing | Amazon KDP | nothing |
| Coloring Book Bot | Original mandala coloring books | Amazon KDP | nothing |
| Notebook Bot | Themed 6x9 lined / dot / graph notebooks | Amazon KDP | nothing |
| Worksheet Bot | Math worksheet packs with answer keys | Etsy, Teachers Pay Teachers | nothing |
| Wall Art Bot | Boho / Bauhaus / quote prints in 5 frame ratios + room mockup | Etsy | nothing (Claude optional) |
| Pinterest Pin Bot | Vertical pins for your approved products | Traffic to your listings | nothing |
| Ebook Bot | 6-chapter guide as a designed PDF | Gumroad, Etsy | Claude |
| Newsletter Bot | Weekly newsletter issue | Sponsors, paid subs | Claude |
| Social Text Bot | Text posts for X, Threads, LinkedIn, Bluesky; auto-schedules in Metricool (inside Claude) | Audience growth | Claude |
| Gig Writer | Fiverr / Upwork service listings | Freelance work | Claude |

## Marketplace rules built in (researched Nov 2026)
- **Etsy** removes listings made without human involvement and requires AI disclosure; AI-written guides and instructions are not allowed. So: marketplace uploads only happen after you approve or tap **Publish**, AI use is disclosed in the listing text, and ebooks are never sent to Etsy.
- **KDP** limits uploads to about 3 new titles a day and removes books that hide AI-generated content. Every KDP kit says whether to tick the AI box.
- **Daily limits** (Settings): Etsy 15, Printify 10, Pinterest 20 per day by default.
- **Seasonal timing**: research adds seasonal keywords 1-3 months ahead, because seasonal items sell when listed 8-12 weeks early.
- Every printable includes a **low-ink version** (a 2026 buyer trend).

## Publishing connections (Android app)
- **Etsy**: printables, calendars, wall art and worksheets with photos and files.
- **Printify**: shirt designs become real t-shirts (print + shipping by Printify) published to your connected Etsy or Shopify store.
- **Pinterest**: pins posted to your board (public once Pinterest grants your app Standard access).

## Focus on what sells
- Etsy sync pulls views and favorites for every listing the bots made. Together with sales this ranks your **winners** (Home).
- Product Factory, Wall Art, Shirt and Notebook bots lean towards the bundles, styles, niches and themes of your winners.
- **More like this / Make 3 variations** creates new colourways, styles or volumes of any product.

## Reliability
- Claude calls retry once; Etsy calls retry on rate limits and server errors.
- **Needs attention** (Home) lists failed runs and failed publishes with Retry buttons.
- **Diagnostics** (Settings) checks Claude, storage, files, web, Etsy, Gumroad, Gmail and Metricool.
- Bots can be switched off; Autopilot and Run all skip them. Android sends a daily 9:00 reminder while Autopilot is on.

## Automation
- **Autopilot** (Home): schedules every bot that can run, turns on Claude quality review and sales sync. Runs while the app is open.
- **Quality gate** per bot: wait in Inbox, Claude reviews and approves items scoring 7/10+, or approve everything.
- **Etsy auto-publish + sales sync** (Android): connect your Etsy developer app in Settings (callback `https://localhost/etsy-callback.html`).
- **Gmail drafts** for Client Finder pitches and **Metricool scheduling** for text posts (inside Claude, through your connectors).
- **Gumroad sales sync** (Android).

In the Android app, Claude bots use your Anthropic API key (Settings). Inside Claude they need no key.

## Screens
- **Home**: month earnings vs goal, 30-day chart, next steps, activity
- **Bots**: run one or all, per-bot settings, autopilot (runs on a schedule while the app is open)
- **Inbox**: approve or reject new work
- **Library**: everything approved, with search and filters, upload kits, copy buttons, listing links, lead/job pipelines
- **Money**: sales by bot, platform and product, CSV export, Gumroad sync (Android)

## Get the APK
Every push to `main` builds the app. On your phone open **Releases**, download the newest
`EarningBots-N.apk` and install it. From 2.0 on, every build is signed with the same key, so new
versions install as updates and keep your data.

Builds are free while the repo is public. In a private repo they use your monthly Actions minutes.

## Add a bot
Append an object to `BOTS` in `www/bots.js`: `id`, `title`, `desc`, `icon`, `category`, `earnsVia`,
`needs`, `settings` and `async run(ctx)`. Use `ctx.add(kind, title, data)` to send work to the Inbox.
New output types go in `KINDS` (thumbnail, kit, copy buttons).

## New in 4.2
- **Digital Planner Bot**: hyperlinked landscape planners for tablets (side tabs on every page, year > month > week
  links, goals, habit tracker, to-do, notes). Dated for the coming year or undated, 6 themes including a dark one.
- **Digital Paper Bot**: packs of 12 seamless patterns (16 pattern styles, 14 palettes with seasonal timing),
  3600 x 3600 px at 300 dpi, delivered as 2 ZIPs under Etsy's 20 MB limit with a commercial-use license.
- **Party Games Bot**: 23-page bundles (bingo with 30 unique cards and a caller list, word scramble, word search,
  would you rather, find the guest, answer keys) for 6 occasions timed to the season; Claude can add any occasion.
- **Card Deck Bot**: print-and-cut decks (affirmations, kids affirmations, couples and family conversation cards,
  journal prompts, Dolch sight-word flashcards) with card backs and crop marks; Claude can write any topic.
- **KDP**: every book kit now includes a print-ready full cover PDF (back + spine + front with bleed), sized from the
  interior's real page count with KDP's spine formula, spine text from 79 pages, barcode area left clear.
- **Shirts**: 3 new styles (vintage worn print, varsity arch, sunset badge) and 4 new ink palettes.
- **Pins**: 3 layouts, using the product's lifestyle photo instead of a flat cover.
- Quality check now tells identical designs (rejected) apart from similar titles (warning to reword).

## Quality check, market data and listing photos (4.1)
- **Quality check** on everything the bots make, before it reaches your Inbox: tidies titles and tags, catches
  near-duplicates of earlier listings, looks at the main image (empty or washed-out designs) and, if Claude is
  available, has Claude judge the main photo like a buyer (text cut off, readability, appeal). Each item gets a
  0-100 score with reasons. Clearly broken items go to Rejected with the reason; auto-approve needs 50+ and
  "Claude checks it" needs 70+. Items the cloud makes get their image check when they reach the phone.
- **Market data**: Niche Research now reads the top 100 Etsy listings per niche: the real price range (digital
  listings), the tags top sellers use, and whether listings under 4 months old still win favorites. New items that
  match a niche get those tags (only relevant ones, never trademarks) and an out-of-range price moved into the range.
- **Listing photos**: printables get cover, desk flat-lay, what's included, clipboard, tablet and details photos;
  wall art gets living room, bedroom and office scenes, a sizes image, details and a close-up; worksheets get 6.
  Everything written on a photo matches the files the buyer gets.

## Cloud: bots that run 24/7
`cloud/` is a Cloudflare Worker with a D1 database. Every 10 minutes it runs whichever bots are due
(using the same bot code as the app), syncs Etsy and Gumroad sales, and checks prices, jobs and leads.
The app becomes a dashboard: it syncs both ways, you approve and tap Publish on the phone
(marketplaces require a person in the loop), and the phone does the uploading.

**Set up once**
1. Cloudflare dashboard > My Profile > API Tokens > Create Token > "Edit Cloudflare Workers" template, add the permission *Account > D1 > Edit*, create it.
2. In this repo: Settings > Secrets and variables > Actions > New repository secret:
   `CLOUDFLARE_API_TOKEN` (the token) and `CLOUDFLARE_ACCOUNT_ID` (Workers & Pages page, right side).
3. Actions > **Deploy cloud** > Run workflow. The run summary shows your cloud address.
4. App: Settings > Cloud > paste the address > Connect. Your keys (Claude, Etsy, Gumroad) are sent so the cloud can work.

**Notes**
- Runs on Cloudflare's free plan. Each check runs one bot, so runs stay small. If the activity log shows runs
  "stopped before finishing", the Workers Paid plan (USD 5/month) lifts the time limit.
- The Sudoku book bot stays on the phone (it needs more computing time than a free cloud run allows).
- The cloud owns the Etsy login refresh once connected, so the app and cloud never conflict.
- Your keys are stored in your own Cloudflare database; only an app holding the connection token can read or change data.
- To connect a different phone: delete the `token_hash` row (`npx wrangler d1 execute earning-bots-db --remote --command "DELETE FROM meta WHERE key='token_hash'"`) and connect again.

## Engineering
- **Storage**: on-device data lives in IndexedDB (no 5 MB browser limit, one record written per change); inside Claude it uses the artifact database. Old data migrates automatically.
- **Resumable publishing**: Etsy and Printify uploads save progress after every step, so a retry continues instead of creating a duplicate listing or product.
- **Listing validator**: blocks uploads with trademarked terms, over-long titles, invalid tags, short descriptions or missing prices.
- **Performance**: long books render with pauses so the screen never freezes; photos and files are drawn one at a time and freed; wall-art resolution adapts to the phone's memory; long lists load 40 at a time.
- **Activity log** (Settings): every run, publish and error, exportable for debugging on a real phone.
- **Tests**: `npm test` runs 91 app checks and `tests/cloud.mjs` 23 cloud checks (auth, two-way sync, newest-change-wins, scheduled runs, big items, deletes) against the worker on Cloudflare's runtime. App checks cover (puzzle/maze/calendar correctness, Etsy listing limits, storage, every bot inside Claude, and the full Android publishing flow against fake Etsy/Printify/Pinterest APIs, including failure and resume). CI runs them before every APK build; a failing test blocks the build.

## Develop
```
npm install
npm run sync      # copies www/ into the Android project
```
`python-version/` holds the earlier Termux (Python) version with direct Etsy API publishing.
