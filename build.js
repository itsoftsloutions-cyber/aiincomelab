import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { markdownToHtml, parseFrontmatter, escapeHtml } from "./lib/markdown.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = __dirname;
const OUT = path.join(root, "public");
const POSTS_DIR = path.join(root, "content", "posts");

const site = JSON.parse(fs.readFileSync(path.join(root, "data", "site.json"), "utf8"));

function rmrf(dir) { fs.rmSync(dir, { recursive: true, force: true }); }
function ensure(dir) { fs.mkdirSync(dir, { recursive: true }); }
function write(rel, content) {
  const file = path.join(OUT, rel);
  ensure(path.dirname(file));
  fs.writeFileSync(file, content);
}

function readingTime(text) {
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function catLabel(slug) {
  const found = (site.nav || []).find((n) => n.href === `/category/${slug}/`);
  if (found) return found.label;
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---- AdSense helpers ----
const ad = site.adsense || {};
function adScriptTag() {
  if (!ad.enabled) return "";
  return `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ad.client}" crossorigin="anonymous"></script>`;
}
function adUnit(slotKey) {
  if (!ad.enabled) return "";
  const slot = (ad.slots || {})[slotKey] || "";
  return `<div class="ad ad-${slotKey}">
  <ins class="adsbygoogle" style="display:block" data-ad-client="${ad.client}" data-ad-slot="${slot}" data-ad-format="auto" data-full-width-responsive="true"></ins>
  <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
</div>`;
}

function analyticsTag() {
  const id = site.analytics && site.analytics.ga4;
  if (!id || /X{4,}/.test(id)) return "";
  return `<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}');</script>`;
}

// ---- Layout ----
function layout({ title, description, canonical, head = "", body, jsonld = "" }) {
  const fullTitle = title === site.name ? `${site.name} — ${site.tagline}` : `${title} | ${site.name}`;
  return `<!doctype html>
<html lang="${site.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(fullTitle)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${canonical}">
<meta name="theme-color" content="${site.themeColor}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${escapeHtml(site.name)}">
<meta property="og:title" content="${escapeHtml(fullTitle)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:locale" content="${site.locale}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="${site.twitter}">
<meta name="twitter:title" content="${escapeHtml(fullTitle)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<link rel="alternate" type="application/rss+xml" title="${escapeHtml(site.name)} RSS" href="${site.url}/rss.xml">
<link rel="stylesheet" href="/assets/style.css">
${adScriptTag()}
${analyticsTag()}
${jsonld}
${head}
</head>
<body>
<header class="site-header">
  <div class="wrap">
    <a class="brand" href="/">${escapeHtml(site.logoText)}</a>
    <nav>${(site.nav || []).map((n) => `<a href="${n.href}">${escapeHtml(n.label)}</a>`).join("")}</nav>
  </div>
</header>
<div class="wrap">${adUnit("header")}</div>
<main class="wrap">
${body}
</main>
<footer class="site-footer">
  <div class="wrap">
    ${adUnit("footer")}
    <p><strong>${escapeHtml(site.name)}</strong> — ${escapeHtml(site.tagline)}</p>
    <p><a href="/about/">About</a> · <a href="/privacy/">Privacy &amp; Disclosure</a> · <a href="/sitemap.xml">Sitemap</a> · <a href="/rss.xml">RSS</a></p>
    <p class="muted">Some links are affiliate links. We only recommend tools we have tested. &copy; ${new Date().getFullYear()} ${escapeHtml(site.name)}.</p>
  </div>
</footer>
</body>
</html>`;
}

// ---- Load posts ----
function loadPosts() {
  if (!fs.existsSync(POSTS_DIR)) return [];
  const files = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith(".md"));
  const posts = files.map((f) => {
    const raw = fs.readFileSync(path.join(POSTS_DIR, f), "utf8");
    const { data, body } = parseFrontmatter(raw);
    const slug = data.slug || f.replace(/\.md$/, "");
    return {
      slug,
      title: data.title || slug,
      description: data.description || "",
      category: data.category || "guides",
      keywords: Array.isArray(data.keywords) ? data.keywords : (data.keywords ? [data.keywords] : []),
      date: data.date || new Date().toISOString().slice(0, 10),
      author: data.author || site.author,
      image: data.image || "",
      body,
      url: `${site.url}/posts/${slug}/`,
      readMin: readingTime(body),
    };
  });
  posts.sort((a, b) => (a.date < b.date ? 1 : -1));
  return posts;
}

// ---- Render article body with mid-article ad ----
function renderArticleHtml(post) {
  let html = markdownToHtml(post.body);
  // inject an in-article ad after the second </p>
  let count = 0;
  html = html.replace(/<\/p>/g, (m) => {
    count++;
    return count === 2 ? `</p>\n${adUnit("inArticle")}\n` : m;
  });
  return html;
}

function articleJsonLd(post) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.date,
    author: { "@type": "Organization", name: post.author },
    publisher: { "@type": "Organization", name: site.name },
    mainEntityOfPage: { "@type": "WebPage", "@id": post.url },
    keywords: post.keywords.join(", "),
  };
  return `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
}

function breadcrumbJsonLd(post) {
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: site.url + "/" },
      { "@type": "ListItem", position: 2, name: catLabel(post.category), item: `${site.url}/category/${post.category}/` },
      { "@type": "ListItem", position: 3, name: post.title, item: post.url },
    ],
  };
  return `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
}

function postCard(p) {
  return `<article class="card">
  <span class="tag"><a href="/category/${p.category}/">${escapeHtml(catLabel(p.category))}</a></span>
  <h2><a href="/posts/${p.slug}/">${escapeHtml(p.title)}</a></h2>
  <p>${escapeHtml(p.description)}</p>
  <p class="meta">${fmtDate(p.date)} · ${p.readMin} min read</p>
</article>`;
}

// ---- Build ----
function build() {
  rmrf(OUT);
  ensure(OUT);

  const posts = loadPosts();

  // assets
  write("assets/style.css", CSS);

  // home
  const homeBody = `<section class="hero">
  <h1>${escapeHtml(site.tagline)}</h1>
  <p>${escapeHtml(site.description)}</p>
</section>
<section class="grid">${posts.map(postCard).join("\n")}</section>`;
  write("index.html", layout({
    title: site.name,
    description: site.description,
    canonical: site.url + "/",
    body: homeBody,
    jsonld: `<script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org", "@type": "WebSite", name: site.name, url: site.url + "/",
      potentialAction: { "@type": "SearchAction", target: `${site.url}/?q={query}`, "query-input": "required name=query" },
    })}</script>`,
  }));

  // posts
  for (const p of posts) {
    const related = posts.filter((o) => o.category === p.category && o.slug !== p.slug).slice(0, 3);
    const relatedHtml = related.length
      ? `<aside class="related"><h3>Related reading</h3><ul>${related.map((r) => `<li><a href="/posts/${r.slug}/">${escapeHtml(r.title)}</a></li>`).join("")}</ul></aside>`
      : "";
    const body = `<article class="post">
  <nav class="crumbs"><a href="/">Home</a> › <a href="/category/${p.category}/">${escapeHtml(catLabel(p.category))}</a></nav>
  <h1>${escapeHtml(p.title)}</h1>
  <p class="meta">By ${escapeHtml(p.author)} · ${fmtDate(p.date)} · ${p.readMin} min read</p>
  <div class="content">${renderArticleHtml(p)}</div>
  ${relatedHtml}
</article>`;
    write(`posts/${p.slug}/index.html`, layout({
      title: p.title,
      description: p.description,
      canonical: p.url,
      head: p.keywords.length ? `<meta name="keywords" content="${escapeHtml(p.keywords.join(", "))}">` : "",
      body,
      jsonld: articleJsonLd(p) + breadcrumbJsonLd(p),
    }));
  }

  // categories
  const cats = [...new Set(posts.map((p) => p.category))];
  for (const c of cats) {
    const list = posts.filter((p) => p.category === c);
    const body = `<section class="hero"><h1>${escapeHtml(catLabel(c))}</h1><p>${list.length} article${list.length === 1 ? "" : "s"}</p></section>
<section class="grid">${list.map(postCard).join("\n")}</section>`;
    write(`category/${c}/index.html`, layout({
      title: catLabel(c),
      description: `${catLabel(c)} articles on ${site.name}: ${site.tagline}.`,
      canonical: `${site.url}/category/${c}/`,
      body,
    }));
  }

  // static pages
  write("about/index.html", layout({
    title: "About", description: `About ${site.name}.`, canonical: `${site.url}/about/`,
    body: `<article class="post"><h1>About ${escapeHtml(site.name)}</h1><div class="content">${markdownToHtml(ABOUT_MD)}</div></article>`,
  }));
  write("privacy/index.html", layout({
    title: "Privacy & Disclosure", description: `Privacy policy and affiliate/ads disclosure for ${site.name}.`,
    canonical: `${site.url}/privacy/`,
    body: `<article class="post"><h1>Privacy &amp; Disclosure</h1><div class="content">${markdownToHtml(PRIVACY_MD)}</div></article>`,
  }));

  // 404
  write("404.html", layout({
    title: "Not Found", description: "Page not found.", canonical: `${site.url}/404.html`,
    body: `<section class="hero"><h1>404 — Not found</h1><p>That page moved or never existed. <a href="/">Go home</a>.</p></section>`,
  }));

  // sitemap
  const urls = [
    site.url + "/",
    ...cats.map((c) => `${site.url}/category/${c}/`),
    `${site.url}/about/`, `${site.url}/privacy/`,
    ...posts.map((p) => p.url),
  ];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u}</loc></url>`).join("\n")}
</urlset>`;
  write("sitemap.xml", sitemap);

  // robots
  write("robots.txt", `User-agent: *\nAllow: /\n\nSitemap: ${site.url}/sitemap.xml\n`);

  // ads.txt (required for AdSense)
  if (ad.enabled) {
    write("ads.txt", `google.com, ${ad.client.replace(/^ca-/, "")}, DIRECT, f08c47fec0942fa0\n`);
  }

  // rss
  const rssItems = posts.slice(0, 20).map((p) => `  <item>
    <title>${escapeHtml(p.title)}</title>
    <link>${p.url}</link>
    <guid>${p.url}</guid>
    <pubDate>${new Date(p.date).toUTCString()}</pubDate>
    <description>${escapeHtml(p.description)}</description>
  </item>`).join("\n");
  write("rss.xml", `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>${escapeHtml(site.name)}</title>
  <link>${site.url}/</link>
  <description>${escapeHtml(site.description)}</description>
  <language>${site.lang}</language>
${rssItems}
</channel></rss>`);

  // manifest
  write("site.webmanifest", JSON.stringify({
    name: site.name, short_name: site.logoText, start_url: "/",
    display: "standalone", background_color: site.themeColor, theme_color: site.themeColor,
  }, null, 2));

  console.log(`Built ${posts.length} posts, ${cats.length} categories -> ${path.relative(root, OUT)}/`);
  return { posts: posts.length, cats: cats.length };
}

const ABOUT_MD = `${site.name} publishes hands-on guides about AI tools, productivity, and earning income online.

Every article is written to be useful first. We test tools before recommending them and we update posts as the landscape changes.

This site is monetized with display ads and a small number of affiliate links. That never changes our recommendations.`;

const PRIVACY_MD = `## Advertising

We use Google AdSense to display ads. Third-party vendors, including Google, use cookies to serve ads based on prior visits. You can opt out of personalized advertising via Google Ads Settings.

## Affiliate disclosure

Some outbound links are affiliate links. If you buy through them we may earn a commission at no extra cost to you. We only link to tools we have tested.

## Analytics

We use privacy-respecting analytics to understand which content is useful. We do not sell personal data.

## Contact

Questions about this policy can be sent through the channels listed in the footer.`;

const CSS = `:root{--bg:#0b1020;--card:#141b2e;--ink:#e8ecf6;--muted:#9aa6c2;--accent:#6ea8fe;--line:#243049}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.7 system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
a{color:var(--accent);text-decoration:none}
a:hover{text-decoration:underline}
.wrap{max-width:880px;margin:0 auto;padding:0 20px}
.site-header{border-bottom:1px solid var(--line);background:rgba(11,16,32,.85);position:sticky;top:0;backdrop-filter:blur(8px);z-index:10}
.site-header .wrap{display:flex;align-items:center;justify-content:space-between;gap:16px;padding-top:14px;padding-bottom:14px}
.brand{font-weight:800;font-size:20px;color:var(--ink)}
.site-header nav{display:flex;gap:16px;flex-wrap:wrap}
.site-header nav a{color:var(--muted);font-size:14px}
.hero{padding:40px 0 8px}
.hero h1{font-size:34px;line-height:1.2;margin:0 0 10px}
.hero p{color:var(--muted);font-size:18px;margin:0}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;padding:24px 0 48px}
@media(max-width:680px){.grid{grid-template-columns:1fr}}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px}
.card h2{font-size:20px;margin:8px 0}
.card p{color:var(--muted);margin:6px 0}
.card .meta,.post .meta{color:var(--muted);font-size:13px}
.tag a{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--accent)}
.post{padding:32px 0 56px;max-width:720px;margin:0 auto}
.post h1{font-size:32px;line-height:1.2;margin:6px 0 10px}
.crumbs{color:var(--muted);font-size:13px;margin-bottom:8px}
.content h2{font-size:24px;margin:32px 0 10px;border-top:1px solid var(--line);padding-top:24px}
.content h3{font-size:19px;margin:24px 0 8px}
.content p{margin:14px 0}
.content ul,.content ol{margin:14px 0;padding-left:22px}
.content li{margin:6px 0}
.content blockquote{margin:18px 0;padding:8px 16px;border-left:3px solid var(--accent);color:var(--muted);background:var(--card);border-radius:0 8px 8px 0}
.content pre{background:#0a0f1d;border:1px solid var(--line);border-radius:10px;padding:14px;overflow:auto}
.content code{background:#0a0f1d;border:1px solid var(--line);border-radius:5px;padding:1px 5px;font-size:14px}
.content pre code{border:0;padding:0}
.content img{max-width:100%;border-radius:10px}
.content table{width:100%;border-collapse:collapse;margin:18px 0;font-size:15px}
.content th,.content td{border:1px solid var(--line);padding:8px 10px;text-align:left}
.content th{background:var(--card)}
.related{margin-top:40px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px 18px}
.related h3{margin:0 0 8px}
.ad{margin:22px 0;min-height:90px;display:flex;align-items:center;justify-content:center;border:1px dashed var(--line);border-radius:10px;color:var(--muted);font-size:12px;background:rgba(110,168,254,.04)}
.ad:empty::before,.ad ins:empty{content:"Advertisement"}
.site-footer{border-top:1px solid var(--line);margin-top:40px;padding:28px 0;color:var(--muted)}
.site-footer p{margin:6px 0}
.muted{font-size:13px;color:var(--muted)}
`;

build();
