# AIIncomeLab — auto-publishing, SEO-optimized, ad-monetized AI blog

A complete, **zero-dependency** blog engine (Node only, no npm install) that:

- Picks a high-demand, high-ad-value niche: **AI tools, productivity & online income**.
- Publishes SEO-optimized articles with **Article + Breadcrumb JSON-LD, Open Graph, Twitter cards, canonical URLs, sitemap.xml, robots.txt, RSS, and ads.txt**.
- Is monetized with **Google AdSense** ad units (header, in-article, footer) plus affiliate disclosure.
- **Auto-publishes a new post every 2 hours** from a topic queue, then rebuilds and deploys — free.

> Honest expectations: no tool can *guarantee* Google #1 or a fixed income. This project gives you the technically correct foundation (fast, crawlable, structured, monetized) and an automation loop. Rankings and revenue come from consistent publishing, real usefulness, and backlinks over weeks/months.

## Quick start

```bash
node build.js     # generate the static site into public/
node serve.js     # preview at http://localhost:8080
```

No `npm install` is required — there are no runtime dependencies.

## Project layout

```
data/site.json          Site config: name, URL, AdSense client/slots, GA4, nav
content/topics.json     Queue of high-demand topics for auto-publishing
content/posts/*.md      Markdown posts (frontmatter + body)
lib/markdown.js         Minimal Markdown->HTML (headings, lists, tables, code, links)
build.js                Static site generator (SEO, JSON-LD, sitemap, RSS, ads.txt)
new-post.js             Publishes the next queued topic as a new post
serve.js                Local preview server
scripts/                Schedulers: Windows Task Scheduler, cron, .bat
.github/workflows/      GitHub Actions: publish every 2h + deploy to Pages
```

## Publish a new post

```bash
node new-post.js        # writes the next queued topic to content/posts/
node build.js           # rebuild
# or in one step:
npm run autopublish
```

`new-post.js` walks `content/topics.json` in order; after the queue is exhausted it
re-publishes "Updated" refreshes with a dated slug, so it never overwrites older posts.
Add more topics to `content/topics.json` to extend the runway.

## Automate "every 2 hours" (pick one)

- **GitHub Actions (recommended, fully free + hosting):** push this repo to GitHub,
  enable Pages (Settings → Pages → Source: GitHub Actions). The workflow in
  `.github/workflows/autopublish.yml` publishes + deploys every 2 hours automatically.
- **Windows:** run `powershell -ExecutionPolicy Bypass -File scripts\schedule-windows.ps1`
  to register a Task Scheduler job that runs `scripts\autopublish.bat` every 2 hours.
- **Linux/macOS:** edit the path in `scripts/crontab.example`, then `crontab scripts/crontab.example`.

## Turn on the money (AdSense)

1. Apply at <https://adsense.google.com> with your live domain.
2. In `data/site.json` set `adsense.client` to your `ca-pub-XXXXXXXXXXXXXXXX` and the three slot IDs.
3. Rebuild. `ads.txt` is generated automatically from your publisher ID (required for payouts).
4. Add affiliate links inside posts where genuinely relevant — the Privacy/Disclosure page already discloses ads + affiliates.

To disable ads during development, set `adsense.enabled` to `false`.

## SEO checklist (already wired)

- [x] Unique title + meta description per page
- [x] Canonical URLs, Open Graph, Twitter cards
- [x] Article + Breadcrumb structured data (JSON-LD)
- [x] XML sitemap + robots.txt + RSS feed
- [x] Fast, mobile-first, no render-blocking dependencies
- [x] Internal linking (related posts, categories, breadcrumbs)
- [x] FAQ sections in generated posts (snippet-friendly)

After deploying: set the real domain in `data/site.json`, submit `sitemap.xml` in
Google Search Console, and add your GA4 ID (`analytics.ga4`) to track what converts.

## Free deployment options

GitHub Pages (via the included workflow), Cloudflare Pages, or Netlify — all serve the
static `public/` folder for free. Point your build command to `node build.js` and the
publish directory to `public`.
