# Earning Bots 3.0

Worker bots that make things you can sell or turn into paid work, an approval inbox, a library of
everything they made, and an earnings dashboard. The same app runs inside Claude and on Android.

## Bots

| Bot | What it makes | Earns via | Needs |
|---|---|---|---|
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

## Develop
```
npm install
npm run sync      # copies www/ into the Android project
```
`python-version/` holds the earlier Termux (Python) version with direct Etsy API publishing.
