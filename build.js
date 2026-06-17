import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { markdownToHtml, parseFrontmatter, escapeHtml } from "./lib/markdown.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = __dirname;
const OUT = path.join(root, "public");
const POSTS_DIR = path.join(root, "content", "posts");

const site = JSON.parse(fs.readFileSync(path.join(root, "data", "site.json"), "utf8"));
const money = site.monetization || {};

// Base path for GitHub Pages subpath hosting (e.g. "/aiincomelab")
const BASE = (() => { try { return new URL(site.url).pathname.replace(/\/$/, ""); } catch { return ""; } })();
// Prepend BASE to any root-relative internal path
function b(p) { return BASE + p; }

// ── helpers ────────────────────────────────────────────────────────────────
function rmrf(dir) { fs.rmSync(dir, { recursive: true, force: true }); }
function ensure(dir) { fs.mkdirSync(dir, { recursive: true }); }
function write(rel, content) {
  const file = path.join(OUT, rel);
  ensure(path.dirname(file));
  fs.writeFileSync(file, content);
}
function readingTime(text) { return Math.max(1, Math.round(text.trim().split(/\s+/).length / 200)); }
function fmtDate(iso) {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}
function catLabel(slug) {
  const found = (site.nav || []).find((n) => n.href === `/category/${slug}/`);
  return found ? found.label : slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function catEmoji(slug) {
  const map = { "make-money": "💰", "ai-tools": "🤖", productivity: "⚡", guides: "📚" };
  return map[slug] || "📌";
}

// ── Unsplash cover images (curated free, no API key needed for display) ────
const UNSPLASH_COVERS = {
  "make-money":  "https://images.unsplash.com/photo-1553729459-efe14ef6055d?w=800&q=80",
  "ai-tools":    "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&q=80",
  productivity:  "https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=800&q=80",
  guides:        "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800&q=80",
};
function coverImage(post) {
  if (post.image) return post.image;
  return UNSPLASH_COVERS[post.category] || UNSPLASH_COVERS["guides"];
}

// ── AdSense ─────────────────────────────────────────────────────────────────
const ad = site.adsense || {};
function adScriptTag() {
  if (!ad.enabled) return "";
  return `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ad.client}" crossorigin="anonymous"></script>`;
}
function adUnit(slotKey, format = "auto") {
  if (!ad.enabled) return "";
  const slot = (ad.slots || {})[slotKey] || "";
  return `<div class="ad-wrap ad-${slotKey}">
  <p class="ad-label">Advertisement</p>
  <ins class="adsbygoogle" style="display:block" data-ad-client="${ad.client}" data-ad-slot="${slot}" data-ad-format="${format}" data-full-width-responsive="true"></ins>
  <script>(adsbygoogle=window.adsbygoogle||[]).push({});</script>
</div>`;
}
function analyticsTag() {
  const id = site.analytics && site.analytics.ga4;
  if (!id || /X{4,}/.test(id)) return "";
  return `<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}');</script>`;
}

// ── Revenue widgets ──────────────────────────────────────────────────────────
function affiliateSidebarWidget() {
  const banners = (money.topAffiliateBanners || []);
  if (!banners.length) return "";
  const items = banners.map((b) => `
  <a class="aff-item" href="${b.href}" target="_blank" rel="noopener nofollow">
    ${b.badge ? `<span class="aff-badge">${escapeHtml(b.badge)}</span>` : ""}
    <span class="aff-label">${escapeHtml(b.label)}</span>
    <span class="aff-arrow">→</span>
  </a>`).join("");
  return `<aside class="widget widget-aff"><h4>Top Picks</h4>${items}</aside>`;
}
function emailCaptureWidget(compact = false) {
  if (!money.emailCapture) return "";
  const action = money.emailProvider || "#";
  if (compact) return `<div class="email-compact">
  <p>${escapeHtml(money.newsletterText || "Get free AI income tips weekly.")}</p>
  <form action="${action}" method="get" target="_blank" class="email-form-inline">
    <input type="email" name="email_address" placeholder="Your email" required>
    <button type="submit">Subscribe →</button>
  </form>
</div>`;
  return `<div class="email-box">
  <div class="email-icon">✉️</div>
  <h3>Free weekly AI income tips</h3>
  <p>${escapeHtml(money.newsletterText || "Get weekly AI tool picks & income strategies — free.")}</p>
  <form action="${action}" method="get" target="_blank" class="email-form">
    <input type="email" name="email_address" placeholder="Your best email" required>
    <button type="submit">Subscribe free →</button>
  </form>
  <p class="email-fine">No spam, unsubscribe any time.</p>
</div>`;
}
function supportWidget() {
  const links = [];
  if (money.buyMeACoffee) links.push(`<a href="${money.buyMeACoffee}" target="_blank" rel="noopener">☕ Buy me a coffee</a>`);
  if (money.gumroad) links.push(`<a href="${money.gumroad}" target="_blank" rel="noopener">🛒 Digital products</a>`);
  if (!links.length) return "";
  return `<aside class="widget widget-support"><h4>Support this site</h4>${links.join(" · ")}</aside>`;
}
function consultingWidget() { return ""; }
function sponsoredBanner() {
  if (!money.sponsoredPostRate) return "";
  return `<aside class="widget widget-sponsored">
  <h4>Advertise Here</h4>
  <p class="consult-text">Sponsored posts from <strong>${money.sponsoredPostRate}</strong>. Reach AI-focused readers interested in tools &amp; income.</p>
  <a class="consult-btn" href="mailto:itsoftsloutions@gmail.com?subject=Sponsorship%20Enquiry">Get in touch →</a>
</aside>`;
}
function affiliateBannerInline() {
  const banners = (money.topAffiliateBanners || []).slice(0, 2);
  if (!banners.length) return "";
  const items = banners.map((b) => `<a class="inline-aff" href="${b.href}" target="_blank" rel="noopener nofollow">${b.badge ? `<span>${escapeHtml(b.badge)}</span>` : ""}${escapeHtml(b.label)} →</a>`).join("");
  return `<div class="aff-inline-row">${items}</div>`;
}

// ── Sidebar ──────────────────────────────────────────────────────────────────
function sidebar(posts) {
  const recent = posts.slice(0, 5);
  const recentHtml = recent.map((p) => `
  <a class="sidebar-post" href="${b('/posts/' + p.slug + '/')}">
    <img src="${coverImage(p)}" alt="${escapeHtml(p.title)}" loading="lazy">
    <span>${escapeHtml(p.title)}</span>
  </a>`).join("");
  return `<aside class="sidebar">
  ${adUnit("sidebar", "rectangle")}
  ${affiliateSidebarWidget()}
  <div class="widget"><h4>Recent Posts</h4>${recentHtml}</div>
  ${emailCaptureWidget(true)}
  ${consultingWidget()}
  ${supportWidget()}
  ${sponsoredBanner()}
</aside>`;
}

// ── Layout ───────────────────────────────────────────────────────────────────
function cookieBanner() {
  return `<div class="cookie-banner" id="cookieBanner" role="dialog" aria-label="Cookie consent">
  <p>We use cookies and ads to keep this site free. By continuing you agree to our <a href="${b('/privacy/')}">Privacy Policy</a>.</p>
  <div class="cookie-btns">
    <button class="cookie-accept" onclick="document.getElementById('cookieBanner').style.display='none';localStorage.setItem('cc','1')">Accept</button>
    <a href="${b('/privacy/')}" class="cookie-more">Learn more</a>
  </div>
</div>
<script>if(localStorage.getItem('cc'))document.getElementById('cookieBanner').style.display='none';</script>`;
}

// Sitewide Organization schema with sameAs social profiles — strengthens brand entity
// recognition (knowledge graph) and consolidates E-E-A-T/author signals across pages.
function orgSchema() {
  const sameAs = Object.values(site.social || {}).filter(Boolean);
  return `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Organization",
    name: site.name,
    url: site.url + "/",
    logo: { "@type": "ImageObject", url: site.url + "/assets/logo.png", width: 200, height: 60 },
    description: site.description,
    ...(sameAs.length ? { sameAs } : {}),
  })}</script>`;
}

function layout({ title, description, canonical, head = "", body, jsonld = "", fullWidth = false, isArticle = false, articleDate = "", articleImage = "" }) {
  const fullTitle = title === site.name ? `${site.name} — ${site.tagline}` : `${title} | ${site.name}`;
  const ogType = isArticle ? "article" : "website";
  const ogImage = articleImage || `${site.url}/assets/og-default.png`;
  return `<!doctype html>
<html lang="${site.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(fullTitle)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${canonical}">
<meta name="theme-color" content="${site.themeColor}">
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">
<meta property="og:type" content="${ogType}">
<meta property="og:site_name" content="${escapeHtml(site.name)}">
<meta property="og:title" content="${escapeHtml(fullTitle)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${ogImage}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="${site.locale}">
${isArticle && articleDate ? `<meta property="article:published_time" content="${articleDate}">
<meta property="article:author" content="${escapeHtml(site.author)}">
<meta property="article:publisher" content="${site.social.twitter || ''}">` : ""}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="${site.twitter}">
<meta name="twitter:title" content="${escapeHtml(fullTitle)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${ogImage}">
<link rel="alternate" type="application/rss+xml" title="${escapeHtml(site.name)} RSS" href="${site.url}/rss.xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:wght@700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${b('/assets/style.css')}">
${ad.enabled ? `<meta name="google-adsense-account" content="${ad.client}">` : ""}
${adScriptTag()}
${analyticsTag()}
${orgSchema()}
${jsonld}
${head}
</head>
<body>
${cookieBanner()}
${topBar()}
${header()}
<main class="site-main${fullWidth ? " full-width" : ""}">
${body}
</main>
${footer()}
</body>
</html>`;
}

function topBar() {
  return `<div class="top-bar">
  <div class="wrap-wide">
    <span>🔥 New AI income guide every 2 hours — <a href="${b('/category/make-money/')}">start here</a></span>
    ${money.emailCapture ? `<a class="top-bar-cta" href="${money.emailProvider || '#'}">Get free tips →</a>` : ""}
  </div>
</div>`;
}

function header() {
  const navLinks = (site.nav || []).map((n) => `<a href="${b(n.href)}">${escapeHtml(n.label)}</a>`).join("");
  return `<header class="site-header">
  <div class="wrap-wide header-inner">
    <a class="brand" href="${b('/')}">
      <span class="brand-icon">🤖</span>
      <span class="brand-text">${escapeHtml(site.logoText)}</span>
    </a>
    <nav class="site-nav">${navLinks}</nav>
    <a class="header-cta" href="${b('/category/make-money/')}">Make Money →</a>
    <button class="nav-toggle" aria-label="Menu">☰</button>
  </div>
</header>
<nav class="mobile-nav" id="mobileNav">
  ${(site.nav || []).map((n) => `<a href="${b(n.href)}">${escapeHtml(n.label)}</a>`).join("")}
</nav>`;
}

function footer() {
  const cats = (site.nav || []).filter(n => !n.href.includes('/contact')).map((n) => `<a href="${b(n.href)}">${escapeHtml(n.label)}</a>`).join("\n");
  const socials = Object.entries(site.social || {}).map(([k, v]) => `<a href="${v}" target="_blank" rel="noopener">${k.charAt(0).toUpperCase() + k.slice(1)}</a>`).join(" · ");
  const year = new Date().getFullYear();
  return `<footer class="site-footer">
  <div class="wrap-wide">
    <div class="footer-grid">
      <div class="footer-brand">
        <a class="brand" href="${b('/')}"><span class="brand-icon">🤖</span><span class="brand-text">${escapeHtml(site.logoText)}</span></a>
        <p>${escapeHtml(site.tagline)}</p>
        <p class="footer-desc">${escapeHtml(site.description)}</p>
        <div class="footer-socials">${socials}</div>
      </div>
      <div class="footer-links">
        <h5>Categories</h5>
        <nav class="footer-nav-col">${cats}</nav>
      </div>
      <div class="footer-links">
        <h5>Quick Links</h5>
        <nav class="footer-nav-col">
          <a href="${b('/about/')}">About Us</a>
          <a href="${b('/privacy/')}">Privacy &amp; Disclosure</a>
          <a href="${b('/contact/')}">Contact</a>
          <a href="${b('/resources/')}">Resources</a>
          <a href="${b('/sitemap.xml')}">Sitemap</a>
          <a href="${b('/rss.xml')}">RSS Feed</a>
        </nav>
      </div>
      <div class="footer-email">
        <h5>Free Weekly Tips</h5>
        ${emailCaptureWidget(true)}
        ${supportWidget()}
      </div>
    </div>
    ${adUnit("footer")}
    <div class="footer-bottom">
      <p class="footer-fine">&copy; ${year} ${escapeHtml(site.name)} — AI Tools, Productivity &amp; Online Income.</p>
      <p class="footer-fine">Affiliate disclosure: some links earn us a commission at no extra cost to you. We only recommend tools we have personally tested.</p>
      <nav class="footer-legal"><a href="${b('/privacy/')}">Privacy Policy</a> · <a href="${b('/about/')}">About</a> · <a href="${b('/contact/')}">Contact</a></nav>
    </div>
  </div>
</footer>
<script>
document.querySelector('.nav-toggle')?.addEventListener('click',()=>{
  document.getElementById('mobileNav').classList.toggle('open');
});
</script>`;
}

// ── Post rendering ───────────────────────────────────────────────────────────
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

function renderArticleBody(post) {
  let html = markdownToHtml(post.body);
  let count = 0;
  html = html.replace(/<\/p>/g, (m) => {
    count++;
    if (count === 2) return `</p>\n${adUnit("inArticle")}\n${affiliateBannerInline()}`;
    if (count === 6) return `</p>\n${emailCaptureWidget(false)}\n`;
    return m;
  });
  return html;
}

function articleJsonLd(post) {
  const faqPairs = extractFaqPairs(post.body);
  const schemas = [
    {
      "@context": "https://schema.org", "@type": "Article",
      headline: post.title, description: post.description,
      image: { "@type": "ImageObject", url: coverImage(post), width: 800, height: 450 },
      datePublished: post.date + "T08:00:00+00:00",
      dateModified: post.date + "T08:00:00+00:00",
      author: { "@type": "Organization", name: post.author, url: site.url + "/" },
      publisher: { "@type": "Organization", name: site.name, url: site.url + "/",
        logo: { "@type": "ImageObject", url: site.url + "/assets/logo.png", width: 200, height: 60 } },
      mainEntityOfPage: { "@type": "WebPage", "@id": post.url },
      keywords: post.keywords.join(", "),
    }
  ];
  if (faqPairs.length) {
    schemas.push({
      "@context": "https://schema.org", "@type": "FAQPage",
      mainEntity: faqPairs.map(([q, a]) => ({
        "@type": "Question", name: q,
        acceptedAnswer: { "@type": "Answer", text: a }
      }))
    });
  }
  return schemas.map(s => `<script type="application/ld+json">${JSON.stringify(s)}</script>`).join("\n");
}

function extractFaqPairs(body) {
  const pairs = [];
  const lines = body.split("\n");
  let inFaq = false, curQ = "", curA = [];
  for (const line of lines) {
    if (/^#{1,3}\s*(faq|frequently asked)/i.test(line)) { inFaq = true; continue; }
    if (inFaq) {
      const qMatch = line.match(/^#{3,4}\s+(.+)/);
      if (qMatch) {
        if (curQ && curA.length) pairs.push([curQ, curA.join(" ").trim()]);
        curQ = qMatch[1].replace(/\*\*/g, ""); curA = [];
      } else if (curQ && line.trim()) {
        curA.push(line.replace(/[*_`#]/g, "").trim());
      }
    }
  }
  if (curQ && curA.length) pairs.push([curQ, curA.join(" ").trim()]);
  return pairs.slice(0, 5);
}
function breadcrumbJsonLd(post) {
  return `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: site.url + "/" },
      { "@type": "ListItem", position: 2, name: catLabel(post.category), item: `${site.url}/category/${post.category}/` },
      { "@type": "ListItem", position: 3, name: post.title, item: post.url },
    ],
  })}</script>`;
}

function postCard(p, featured = false) {
  const img = coverImage(p);
  const postHref = b('/posts/' + p.slug + '/');
  return `<article class="card${featured ? " card-featured" : ""}">
  <a class="card-img-link" href="${postHref}">
    <img src="${img}" alt="${escapeHtml(p.title)}" loading="lazy" class="card-img">
    <span class="card-cat">${catEmoji(p.category)} ${escapeHtml(catLabel(p.category))}</span>
  </a>
  <div class="card-body">
    <h2 class="card-title"><a href="${postHref}">${escapeHtml(p.title)}</a></h2>
    <p class="card-desc">${escapeHtml(p.description)}</p>
    <div class="card-meta">
      <span>${fmtDate(p.date)}</span>
      <span>${p.readMin} min read</span>
      <a class="card-read" href="${postHref}">Read →</a>
    </div>
  </div>
</article>`;
}

// ── Build ────────────────────────────────────────────────────────────────────
function build() {
  rmrf(OUT);
  ensure(OUT);

  const posts = loadPosts();

  write("assets/style.css", PREMIUM_CSS);

  // ── Homepage ──
  const featured = posts[0];
  const rest = posts.slice(1);
  const statsHtml = (site.heroStats || []).map((s) =>
    `<div class="stat"><span class="stat-val">${escapeHtml(s.value)}</span><span class="stat-lbl">${escapeHtml(s.label)}</span></div>`
  ).join("");
  const featCatsHtml = (site.featuredCategories || []).map((c) =>
    `<a class="fcat" href="${b('/category/' + c.slug + '/')}">
      <span class="fcat-icon">${c.icon}</span>
      <span class="fcat-title">${escapeHtml(c.title)}</span>
      <span class="fcat-desc">${escapeHtml(c.desc)}</span>
    </a>`
  ).join("");

  const homeBody = `
<section class="hero">
  <div class="wrap-wide hero-inner">
    <div class="hero-text">
      <div class="hero-badge">🔥 Updated every 2 hours</div>
      <h1>${escapeHtml(site.tagline)}</h1>
      <p>${escapeHtml(site.description)}</p>
      <div class="hero-stats">${statsHtml}</div>
      ${emailCaptureWidget(false)}
    </div>
    ${featured ? `<div class="hero-post">${postCard(featured, true)}</div>` : ""}
  </div>
</section>

<div class="wrap-wide">
  ${adUnit("header")}
  <section class="fcat-grid">${featCatsHtml}</section>

  <div class="content-sidebar-wrap">
    <div class="content-main">
      <h2 class="section-title">Latest Articles</h2>
      <div class="grid">${rest.map((p) => postCard(p)).join("\n")}</div>
    </div>
    ${sidebar(posts)}
  </div>
</div>`;

  write("index.html", layout({
    title: site.name, description: site.description, canonical: site.url + "/",
    body: homeBody,
    jsonld: `<script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org", "@type": "WebSite", name: site.name, url: site.url + "/",
      potentialAction: { "@type": "SearchAction", target: `${site.url}/?q={query}`, "query-input": "required name=query" },
    })}</script>`,
  }));

  // ── Post pages ──
  for (const p of posts) {
    const related = posts.filter((o) => o.category === p.category && o.slug !== p.slug).slice(0, 3);
    const relatedHtml = related.length
      ? `<section class="related"><h3>Related Articles</h3><div class="grid grid-sm">${related.map((r) => postCard(r)).join("")}</div></section>`
      : "";
    const body = `
<div class="post-hero" style="background-image:url('${coverImage(p)}')">
  <div class="post-hero-overlay">
    <div class="wrap-wide">
      <nav class="crumbs"><a href="${b('/')}">Home</a> › <a href="${b('/category/' + p.category + '/')}">${escapeHtml(catLabel(p.category))}</a></nav>
      <h1>${escapeHtml(p.title)}</h1>
      <div class="post-meta-hero">
        <span>By ${escapeHtml(p.author)}</span>
        <span>${fmtDate(p.date)}</span>
        <span>${p.readMin} min read</span>
      </div>
    </div>
  </div>
</div>
<div class="wrap-wide content-sidebar-wrap post-wrap">
  <article class="post-content">
    <div class="content">${renderArticleBody(p)}</div>
    ${relatedHtml}
  </article>
  ${sidebar(posts)}
</div>`;
    write(`posts/${p.slug}/index.html`, layout({
      title: p.title, description: p.description, canonical: p.url,
      isArticle: true, articleDate: p.date, articleImage: coverImage(p),
      head: p.keywords.length ? `<meta name="keywords" content="${escapeHtml(p.keywords.join(", "))}">` : "",
      body,
      jsonld: articleJsonLd(p) + breadcrumbJsonLd(p),
    }));
  }

  // ── Category pages ──
  const cats = [...new Set(posts.map((p) => p.category))];
  for (const c of cats) {
    const list = posts.filter((p) => p.category === c);
    const info = (site.featuredCategories || []).find((fc) => fc.slug === c) || {};
    const body = `
<div class="cat-hero">
  <div class="wrap-wide">
    <span class="cat-hero-icon">${info.icon || catEmoji(c)}</span>
    <h1>${escapeHtml(catLabel(c))}</h1>
    <p>${escapeHtml(info.desc || "")} · ${list.length} article${list.length !== 1 ? "s" : ""}</p>
  </div>
</div>
<div class="wrap-wide content-sidebar-wrap">
  <div class="content-main">
    <div class="grid">${list.map((p) => postCard(p)).join("\n")}</div>
  </div>
  ${sidebar(posts)}
</div>`;
    write(`category/${c}/index.html`, layout({
      title: catLabel(c),
      description: `${catLabel(c)} articles — ${site.name}: ${site.tagline}.`,
      canonical: `${site.url}/category/${c}/`,
      body,
    }));
  }

  // ── Static pages ──
  write("about/index.html", layout({
    title: "About", description: `About ${site.name} — hands-on AI tools guides, productivity tips, and proven ways to earn money online.`, canonical: `${site.url}/about/`,
    body: `<div class="wrap-wide"><article class="post-content static-page"><h1>About ${escapeHtml(site.name)}</h1><div class="content">${markdownToHtml(ABOUT_MD)}</div></article></div>`,
  }));
  write("privacy/index.html", layout({
    title: "Privacy Policy & Affiliate Disclosure", description: `Privacy policy, cookie policy, and affiliate disclosure for ${site.name}.`, canonical: `${site.url}/privacy/`,
    body: `<div class="wrap-wide"><article class="post-content static-page"><h1>Privacy Policy &amp; Disclosure</h1><div class="content">${markdownToHtml(PRIVACY_MD)}</div></article></div>`,
  }));
  write("contact/index.html", layout({
    title: "Contact Us", description: `Contact Kanav Sharma at ${site.name} — questions, sponsorships, content corrections, or advertising enquiries.`, canonical: `${site.url}/contact/`,
    body: `<div class="wrap-wide"><article class="post-content static-page">
<h1>Contact Us</h1>
<div class="contact-grid">
  <div class="contact-info">
    <div class="contact-card"><span class="contact-icon">👤</span><div><strong>Author / Editor</strong><p>Kanav Sharma</p></div></div>
    <div class="contact-card"><span class="contact-icon">✉️</span><div><strong>Email</strong><p><a href="mailto:itsoftsloutions@gmail.com">itsoftsloutions@gmail.com</a></p></div></div>
    <div class="contact-card"><span class="contact-icon">📣</span><div><strong>Sponsorships &amp; Advertising</strong><p>Starting from $150 per sponsored post.<br>Email: <a href="mailto:itsoftsloutions@gmail.com?subject=Sponsorship">itsoftsloutions@gmail.com</a></p></div></div>
    <div class="contact-card"><span class="contact-icon">🔗</span><div><strong>Social Media</strong><p>
      <a href="https://twitter.com/aiincomelab" target="_blank" rel="noopener">Twitter / X →</a><br>
      <a href="https://youtube.com/@aiincomelab" target="_blank" rel="noopener">YouTube →</a>
    </p></div></div>
    <div class="contact-card"><span class="contact-icon">⏱️</span><div><strong>Response Time</strong><p>We reply within 2 business days.</p></div></div>
  </div>
  <div class="contact-form-wrap">
    <h2>Send us a message</h2>
    <form class="contact-form" action="https://formsubmit.co/itsoftsloutions@gmail.com" method="POST">
      <input type="hidden" name="_subject" value="AIIncomeLab Contact Form">
      <input type="hidden" name="_captcha" value="false">
      <input type="hidden" name="_template" value="table">
      <label>Your name<input type="text" name="name" placeholder="Jane Smith" required></label>
      <label>Your email<input type="email" name="email" placeholder="you@example.com" required></label>
      <label>Subject
        <select name="subject">
          <option value="General question">General question</option>
          <option value="Sponsorship enquiry">Sponsorship enquiry</option>
          <option value="Press / media">Press / media</option>
          <option value="Content correction">Content correction</option>
          <option value="Other">Other</option>
        </select>
      </label>
      <label>Message<textarea name="message" rows="5" placeholder="Tell us how we can help…" required></textarea></label>
      <button type="submit" class="contact-submit">Send message →</button>
    </form>
    <p style="font-size:12px;color:var(--muted);margin-top:10px">First submission activates the form — Formsubmit will send a one-time confirmation to itsoftsloutions@gmail.com.</p>
  </div>
</div>
<div class="content" style="margin-top:40px">${markdownToHtml(CONTACT_MD)}</div>
</article></div>`,
  }));
  write("404.html", layout({
    title: "Not Found", description: "Page not found.", canonical: `${site.url}/404.html`,
    body: `<div class="wrap-wide" style="padding:80px 0 120px;text-align:center"><h1 style="font-size:80px;margin:0">404</h1><p style="font-size:20px;color:var(--muted)">That page doesn't exist. <a href="${b('/')}">Go home →</a></p></div>`,
  }));

  // ── Resources page ──
  const affRows = (money.topAffiliateBanners || []).map((af) =>
    `<div class="resource-card"><a href="${af.href}" target="_blank" rel="noopener nofollow">${af.badge ? `<span class="res-badge">${escapeHtml(af.badge)}</span>` : ""}<strong>${escapeHtml(af.label)}</strong></a></div>`
  ).join("");
  const resourceBody = `<div class="wrap-wide"><article class="post-content static-page">
<h1>Best AI Tools &amp; Resources</h1>
<p class="res-intro">Everything I actually use to run this blog and earn online. Tested and updated regularly. Some links are affiliate — I only list tools I recommend.</p>
<h2>Writing &amp; SEO Tools</h2><div class="resource-grid">${affRows}</div>
<h2>Earn From Your Blog</h2>
<div class="resource-grid">
  <div class="resource-card"><a href="https://adsense.google.com" target="_blank" rel="noopener"><span class="res-badge">Free</span><strong>Google AdSense — display ads</strong></a></div>
  <div class="resource-card"><a href="https://ezoic.com" target="_blank" rel="noopener"><span class="res-badge">Higher RPM</span><strong>Ezoic — AI ad optimization</strong></a></div>
  <div class="resource-card"><a href="https://www.mediavine.com" target="_blank" rel="noopener"><span class="res-badge">Premium</span><strong>Mediavine — 50k sessions+</strong></a></div>
  <div class="resource-card"><a href="https://app.convertkit.com" target="_blank" rel="noopener"><span class="res-badge">Free Plan</span><strong>ConvertKit — email newsletter</strong></a></div>
  <div class="resource-card"><a href="${money.gumroad || 'https://gumroad.com'}" target="_blank" rel="noopener"><span class="res-badge">0% fee</span><strong>Gumroad — sell digital products</strong></a></div>
  <div class="resource-card"><a href="https://www.amazon.com/associates" target="_blank" rel="noopener"><span class="res-badge">Affiliate</span><strong>Amazon Associates — product links</strong></a></div>
</div>
<h2>Start Your Own Blog</h2>
<div class="resource-grid">
  <div class="resource-card"><a href="https://www.hostinger.com/web-hosting?ref=aiincomelab" target="_blank" rel="noopener nofollow"><span class="res-badge">$2.99/mo</span><strong>Hostinger — cheapest reliable hosting</strong></a></div>
  <div class="resource-card"><a href="https://github.com/pages" target="_blank" rel="noopener"><span class="res-badge">Free</span><strong>GitHub Pages — free static hosting</strong></a></div>
</div>
<div class="consult-banner"><h3>Questions or want to work together?</h3><p>Reach out via our <a href="${b('/contact/')}">contact page</a> — we respond within 2 business days.</p><a href="${b('/contact/')}" class="consult-btn">Contact us →</a></div>
</article></div>`;
  write("resources/index.html", layout({
    title: "Best AI Tools & Resources", description: `Tested tools and resources for AI blogging, SEO, and online income — ${site.name}.`,
    canonical: `${site.url}/resources/`,
    body: resourceBody,
  }));

  // ── SEO files ──
  // Sitemap with lastmod/changefreq/priority. lastmod helps Google schedule recrawls.
  const latestDate = (posts[0] && posts[0].date) || new Date().toISOString().slice(0, 10);
  const catLastmod = (c) => {
    const p = posts.find((x) => x.category === c);
    return (p && p.date) || latestDate;
  };
  const sitemapEntries = [
    { loc: site.url + "/", lastmod: latestDate, changefreq: "daily", priority: "1.0" },
    ...cats.map((c) => ({ loc: `${site.url}/category/${c}/`, lastmod: catLastmod(c), changefreq: "weekly", priority: "0.8" })),
    { loc: `${site.url}/resources/`, lastmod: latestDate, changefreq: "weekly", priority: "0.7" },
    { loc: `${site.url}/about/`, lastmod: latestDate, changefreq: "monthly", priority: "0.5" },
    { loc: `${site.url}/contact/`, lastmod: latestDate, changefreq: "monthly", priority: "0.4" },
    { loc: `${site.url}/privacy/`, lastmod: latestDate, changefreq: "yearly", priority: "0.3" },
    ...posts.map((p) => ({ loc: p.url, lastmod: p.date, changefreq: "monthly", priority: "0.7" })),
  ];
  write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapEntries.map((e) => `  <url><loc>${e.loc}</loc><lastmod>${e.lastmod}</lastmod><changefreq>${e.changefreq}</changefreq><priority>${e.priority}</priority></url>`).join("\n")}\n</urlset>`);
  write("robots.txt", `User-agent: *\nAllow: /\n\nSitemap: ${site.url}/sitemap.xml\n`);
  if (ad.enabled) write("ads.txt", `google.com, ${ad.client.replace(/^ca-/, "")}, DIRECT, f08c47fec0942fa0\n`);
  write("rss.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel>\n  <title>${escapeHtml(site.name)}</title>\n  <link>${site.url}/</link>\n  <description>${escapeHtml(site.description)}</description>\n  <language>${site.lang}</language>\n${posts.slice(0, 20).map((p) => `  <item>\n    <title>${escapeHtml(p.title)}</title>\n    <link>${p.url}</link>\n    <guid>${p.url}</guid>\n    <pubDate>${new Date(p.date).toUTCString()}</pubDate>\n    <description>${escapeHtml(p.description)}</description>\n  </item>`).join("\n")}\n</channel></rss>`);
  write("site.webmanifest", JSON.stringify({ name: site.name, short_name: site.logoText, start_url: b("/"), display: "standalone", background_color: site.themeColor, theme_color: site.themeColor }, null, 2));

  console.log(`✓ Built ${posts.length} posts, ${cats.length} categories → ${path.relative(root, OUT)}/`);
}

// ── Static content ────────────────────────────────────────────────────────────
const ABOUT_MD = `## What is ${site.name}?

${site.name} publishes practical, hands-on guides about AI tools, automation, productivity, and earning income online. Every article is written to be genuinely useful — we test the tools, run the experiments, and share real results.

## Who writes here?

**Kanav Sharma** is the founder and editor of ${site.name}. He researches AI tools and online income strategies, tests them personally, and writes practical guides based on real results. You can reach him at [itsoftsloutions@gmail.com](mailto:itsoftsloutions@gmail.com).

## How we make money

This site earns revenue through:

- **Display advertising** (Google AdSense) — ads shown alongside content
- **Affiliate links** — we link to tools we use and recommend; if you buy, we may earn a small commission at no extra cost to you
- **Digital products** — ebooks and guides sold through Gumroad
- **Sponsored content** — clearly labelled posts from brands we vet

Our commercial relationships never influence editorial recommendations. We only link to tools we have personally tested.

## Our commitment

We update articles when tools change. We correct errors quickly. We do not publish AI-generated content without human review and editing.`;

const PRIVACY_MD = `**Last updated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}**

## 1. Information we collect

We collect non-personal analytics data (pages viewed, time on site, general location) via Google Analytics. We do not collect names, email addresses, or any personal data unless you voluntarily submit them via our newsletter signup.

If you subscribe to our newsletter, your email is stored with ConvertKit. You can unsubscribe at any time using the link in any email.

## 2. Cookies

This site uses cookies for:

- **Advertising** — Google AdSense uses cookies to serve relevant ads based on your browsing. You can opt out at [Google Ads Settings](https://www.google.com/settings/ads) or [aboutads.info](https://optout.aboutads.info/).
- **Analytics** — Google Analytics uses cookies to understand traffic patterns. No personally identifiable information is stored.
- **Preferences** — we store your cookie consent choice in your browser's localStorage.

## 3. Affiliate disclosure

Some links on this site are affiliate links. If you click and buy, we earn a small commission at no extra cost to you. We only recommend products we have tested. All affiliate links are marked with \`rel="nofollow"\`.

## 4. Third-party services

We use:

- **Google AdSense** — advertising (Google Privacy Policy: google.com/policies/privacy)
- **Google Analytics** — site analytics
- **ConvertKit** — email newsletter
- **Gumroad** — digital product sales
- **Unsplash** — stock photos (unsplash.com/license)

## 5. Your rights

You may request deletion of any personal data we hold. Contact us at itsoftsloutions@gmail.com. We respond within 30 days.

## 6. Changes

We may update this policy. The date at the top of this page will reflect the latest revision.

## 7. Contact

Questions about privacy: itsoftsloutions@gmail.com`;

const CONTACT_MD = `Have a question, correction, or want to work together? We read every message.

## About the author

**Kanav Sharma** is the founder and editor of AIIncomeLab. He researches AI tools and online income strategies, tests them personally, and writes practical guides based on real results.

## General enquiries

Email: **itsoftsloutions@gmail.com**

We aim to respond within 2 business days.

## Sponsored content & partnerships

Interested in reaching our audience of AI-focused readers? Sponsored posts start from $150.

Email: **itsoftsloutions@gmail.com** with subject line "Sponsorship"

## Press & media

For media enquiries, quotes, or interviews, email with subject line "Press".

## Report an error

Found a factual error in an article? We take accuracy seriously. Email the article URL and the correction and we will fix it promptly.

## Social media

Follow us for daily AI income tips:

- Twitter / X: [@aiincomelab](https://twitter.com/aiincomelab)
- YouTube: [youtube.com/@aiincomelab](https://youtube.com/@aiincomelab)
- Pinterest: [pinterest.com/aiincomelab](https://pinterest.com/aiincomelab)`;

// ── Premium CSS ───────────────────────────────────────────────────────────────
const PREMIUM_CSS = `
/* ─── Design tokens ─── */
:root{
  --bg:#0d1117;
  --surface:#161b22;
  --surface2:#1c2330;
  --border:#30363d;
  --ink:#e6edf3;
  --muted:#8b949e;
  --accent:#58a6ff;
  --accent2:#3fb950;
  --gradient:linear-gradient(135deg,#1a3a5c 0%,#0d1117 100%);
  --hero-gradient:linear-gradient(135deg,#0d1117 0%,#162032 50%,#0d1117 100%);
  --card-hover:#1c2330;
  --radius:12px;
  --radius-lg:20px;
  --shadow:0 4px 24px rgba(0,0,0,.4);
  --shadow-card:0 2px 12px rgba(0,0,0,.3);
  --font-sans:'Inter',system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
  --font-serif:'Playfair Display',Georgia,serif;
  --transition:.18s ease;
}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{background:var(--bg);color:var(--ink);font-family:var(--font-sans);font-size:16px;line-height:1.7;-webkit-font-smoothing:antialiased}
a{color:var(--accent);text-decoration:none;transition:color var(--transition)}
a:hover{color:#79c0ff}
img{max-width:100%;height:auto;display:block}
h1,h2,h3,h4,h5{line-height:1.2;font-weight:700}

/* ─── Layout ─── */
.wrap-wide{max-width:1180px;margin:0 auto;padding:0 24px}
.content-sidebar-wrap{display:grid;grid-template-columns:1fr 340px;gap:40px;padding:40px 0 80px}
@media(max-width:900px){.content-sidebar-wrap{grid-template-columns:1fr}}
.content-main{min-width:0}
.section-title{font-family:var(--font-serif);font-size:26px;margin-bottom:24px;padding-bottom:12px;border-bottom:2px solid var(--border)}

/* ─── Top bar ─── */
.top-bar{background:linear-gradient(90deg,#1f2d40,#1a3a5c);border-bottom:1px solid var(--border);padding:8px 0;font-size:13px;color:var(--muted)}
.top-bar .wrap-wide{display:flex;justify-content:space-between;align-items:center;gap:12px}
.top-bar a{color:var(--accent)}
.top-bar-cta{background:var(--accent);color:#0d1117!important;padding:3px 12px;border-radius:20px;font-weight:600;font-size:12px}

/* ─── Header ─── */
.site-header{position:sticky;top:0;z-index:100;background:rgba(13,17,23,.92);backdrop-filter:blur(12px);border-bottom:1px solid var(--border)}
.header-inner{display:flex;align-items:center;gap:20px;padding-top:14px;padding-bottom:14px}
.brand{display:flex;align-items:center;gap:8px;color:var(--ink)!important;font-weight:800;font-size:20px}
.brand-icon{font-size:22px}
.site-nav{display:flex;gap:4px;margin-left:auto}
.site-nav a{color:var(--muted);font-size:14px;font-weight:500;padding:6px 10px;border-radius:6px;transition:background var(--transition),color var(--transition)}
.site-nav a:hover{color:var(--ink);background:var(--surface2)}
.header-cta{background:var(--accent);color:#0d1117!important;padding:7px 16px;border-radius:8px;font-weight:700;font-size:13px;white-space:nowrap}
.header-cta:hover{background:#79c0ff;text-decoration:none}
.nav-toggle{display:none;background:none;border:1px solid var(--border);color:var(--ink);padding:6px 10px;border-radius:6px;cursor:pointer;font-size:18px}
.mobile-nav{display:none;flex-direction:column;background:var(--surface);border-bottom:1px solid var(--border)}
.mobile-nav.open{display:flex}
.mobile-nav a{padding:14px 24px;border-bottom:1px solid var(--border);color:var(--ink);font-weight:500}
@media(max-width:768px){.site-nav,.header-cta{display:none}.nav-toggle{display:block}}

/* ─── Hero ─── */
.hero{background:var(--hero-gradient);border-bottom:1px solid var(--border);padding:60px 0}
.hero-inner{display:grid;grid-template-columns:1fr 420px;gap:48px;align-items:center}
@media(max-width:900px){.hero-inner{grid-template-columns:1fr}}
.hero-badge{display:inline-block;background:rgba(63,185,80,.15);color:var(--accent2);border:1px solid rgba(63,185,80,.3);padding:4px 12px;border-radius:20px;font-size:13px;font-weight:600;margin-bottom:16px}
.hero h1{font-family:var(--font-serif);font-size:clamp(30px,4vw,48px);font-weight:800;line-height:1.15;margin-bottom:16px;background:linear-gradient(135deg,#e6edf3,#58a6ff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.hero>div>p,.hero-text>p{color:var(--muted);font-size:18px;margin-bottom:28px}
.hero-stats{display:flex;gap:32px;margin-bottom:28px}
.stat{display:flex;flex-direction:column}
.stat-val{font-size:28px;font-weight:800;color:var(--accent)}
.stat-lbl{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}

/* ─── Featured categories ─── */
.fcat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;padding:32px 0}
@media(max-width:768px){.fcat-grid{grid-template-columns:repeat(2,1fr)}}
.fcat{display:flex;flex-direction:column;gap:4px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:20px;transition:border-color var(--transition),transform var(--transition)}
.fcat:hover{border-color:var(--accent);transform:translateY(-2px)}
.fcat-icon{font-size:28px;margin-bottom:4px}
.fcat-title{font-weight:700;color:var(--ink)}
.fcat-desc{font-size:13px;color:var(--muted)}

/* ─── Post cards ─── */
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:24px}
.grid-sm{grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px}
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;transition:transform var(--transition),box-shadow var(--transition);display:flex;flex-direction:column}
.card:hover{transform:translateY(-3px);box-shadow:var(--shadow)}
.card-featured{border-color:var(--accent)}
.card-img-link{position:relative;display:block;overflow:hidden;height:200px}
.card-featured .card-img-link{height:260px}
.card-img{width:100%;height:100%;object-fit:cover;transition:transform .4s ease}
.card:hover .card-img{transform:scale(1.04)}
.card-cat{position:absolute;bottom:10px;left:10px;background:rgba(13,17,23,.85);backdrop-filter:blur(4px);color:var(--accent);font-size:11px;font-weight:700;padding:4px 10px;border-radius:20px;letter-spacing:.05em;text-transform:uppercase}
.card-body{padding:18px;display:flex;flex-direction:column;flex:1;gap:8px}
.card-title{font-size:17px;font-weight:700;line-height:1.3}
.card-title a{color:var(--ink)}
.card-title a:hover{color:var(--accent)}
.card-desc{color:var(--muted);font-size:14px;flex:1}
.card-meta{display:flex;align-items:center;gap:10px;font-size:12px;color:var(--muted);margin-top:auto}
.card-read{margin-left:auto;color:var(--accent);font-weight:600;font-size:13px}

/* ─── Post hero ─── */
.post-hero{min-height:340px;background-size:cover;background-position:center;position:relative}
.post-hero-overlay{position:absolute;inset:0;background:linear-gradient(to top,rgba(13,17,23,.95) 0%,rgba(13,17,23,.5) 100%);display:flex;align-items:flex-end}
.post-hero-overlay>div{padding-bottom:36px;width:100%}
.post-hero h1{font-family:var(--font-serif);font-size:clamp(22px,3.5vw,40px);max-width:760px;color:#fff;margin:8px 0 12px}
.post-meta-hero{display:flex;gap:16px;flex-wrap:wrap;font-size:13px;color:rgba(255,255,255,.65)}
.crumbs{font-size:13px;color:rgba(255,255,255,.5)}
.crumbs a{color:rgba(255,255,255,.6)}

/* ─── Post content ─── */
.post-wrap{align-items:start}
.post-content{min-width:0;padding:36px 0}
.static-page{max-width:720px;padding:48px 0 80px}
.content h2{font-family:var(--font-serif);font-size:26px;margin:40px 0 14px;padding-top:32px;border-top:1px solid var(--border)}
.content h3{font-size:20px;margin:28px 0 10px;color:#79c0ff}
.content p{margin:16px 0;color:#c9d1d9;line-height:1.8}
.content a{color:var(--accent);border-bottom:1px solid rgba(88,166,255,.3)}
.content a:hover{border-color:var(--accent)}
.content ul,.content ol{margin:16px 0;padding-left:24px;color:#c9d1d9}
.content li{margin:8px 0}
.content blockquote{margin:24px 0;padding:16px 20px;border-left:3px solid var(--accent);background:var(--surface);border-radius:0 var(--radius) var(--radius) 0;color:var(--muted)}
.content blockquote p{margin:0;color:var(--muted)}
.content pre{background:#090d13;border:1px solid var(--border);border-radius:var(--radius);padding:18px;overflow:auto;margin:20px 0}
.content code{background:#161b22;border:1px solid var(--border);border-radius:5px;padding:2px 6px;font-size:13px;font-family:'JetBrains Mono',Consolas,monospace}
.content pre code{border:0;padding:0;background:transparent}
.content img{border-radius:var(--radius-lg);margin:20px 0;box-shadow:var(--shadow)}
.content table{width:100%;border-collapse:collapse;margin:20px 0;font-size:14px;overflow:hidden;border-radius:var(--radius);border:1px solid var(--border)}
.content th,.content td{padding:12px 14px;text-align:left;border-bottom:1px solid var(--border)}
.content th{background:var(--surface2);font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}
.content tr:last-child td{border-bottom:0}
.content tr:hover td{background:var(--surface2)}
.content hr{border:0;border-top:1px solid var(--border);margin:32px 0}

/* ─── Related ─── */
.related{margin-top:48px;padding-top:32px;border-top:1px solid var(--border)}
.related h3{font-family:var(--font-serif);font-size:22px;margin-bottom:20px}

/* ─── Category hero ─── */
.cat-hero{background:var(--hero-gradient);border-bottom:1px solid var(--border);padding:48px 0;text-align:center}
.cat-hero-icon{font-size:52px;display:block;margin-bottom:12px}
.cat-hero h1{font-family:var(--font-serif);font-size:36px;margin-bottom:8px}
.cat-hero p{color:var(--muted);font-size:16px}

/* ─── Sidebar ─── */
.sidebar{display:flex;flex-direction:column;gap:20px;padding-top:36px}
.widget{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:20px}
.widget h4{font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:14px}
.sidebar-post{display:flex;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);color:var(--ink)!important;font-size:13px;line-height:1.4}
.sidebar-post:last-child{border-bottom:0}
.sidebar-post img{width:56px;height:44px;object-fit:cover;border-radius:8px;flex-shrink:0}

/* ─── Affiliate widget ─── */
.widget-aff .aff-item{display:flex;align-items:center;gap:8px;padding:10px 0;border-bottom:1px solid var(--border);color:var(--ink)!important;font-size:13px;font-weight:500}
.widget-aff .aff-item:last-child{border-bottom:0}
.aff-badge{background:rgba(88,166,255,.15);color:var(--accent);border-radius:20px;padding:2px 8px;font-size:11px;font-weight:700;flex-shrink:0}
.aff-arrow{margin-left:auto;color:var(--accent);opacity:.6}

/* ─── Inline affiliate ─── */
.aff-inline-row{display:flex;gap:10px;flex-wrap:wrap;margin:16px 0}
.inline-aff{display:inline-flex;align-items:center;gap:6px;background:var(--surface2);border:1px solid var(--border);padding:6px 14px;border-radius:20px;font-size:13px;font-weight:600;color:var(--ink)!important;transition:border-color var(--transition)}
.inline-aff:hover{border-color:var(--accent);text-decoration:none}
.inline-aff span{background:var(--accent);color:#0d1117;padding:1px 6px;border-radius:10px;font-size:11px}

/* ─── Email capture ─── */
.email-box{background:linear-gradient(135deg,#1a3a5c,#162032);border:1px solid rgba(88,166,255,.3);border-radius:var(--radius-lg);padding:28px;text-align:center;margin:32px 0}
.email-icon{font-size:36px;margin-bottom:10px}
.email-box h3{font-family:var(--font-serif);font-size:22px;margin-bottom:8px}
.email-box p{color:var(--muted);margin-bottom:16px}
.email-form,.email-form-inline{display:flex;gap:8px;flex-wrap:wrap}
.email-form{flex-direction:column}
.email-form input,.email-form-inline input{flex:1;min-width:0;background:#0d1117;border:1px solid var(--border);color:var(--ink);padding:10px 14px;border-radius:8px;font-size:14px;outline:none}
.email-form input:focus,.email-form-inline input:focus{border-color:var(--accent)}
.email-form button,.email-form-inline button{background:var(--accent);color:#0d1117;border:none;padding:10px 20px;border-radius:8px;font-weight:700;font-size:14px;cursor:pointer;white-space:nowrap}
.email-form button:hover,.email-form-inline button:hover{background:#79c0ff}
.email-fine{font-size:12px;color:var(--muted);margin-top:8px!important}
.email-compact{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px}
.email-compact p{font-size:13px;color:var(--muted);margin-bottom:10px}

/* ─── Support widget ─── */
.widget-support a{display:inline-block;font-size:13px;color:var(--accent);margin:4px 0}

/* ─── Ads ─── */
.ad-wrap{margin:24px 0;background:rgba(88,166,255,.04);border:1px dashed var(--border);border-radius:var(--radius);padding:12px;min-height:90px}
.ad-label{font-size:10px;color:var(--muted);text-align:center;letter-spacing:.05em;text-transform:uppercase;margin-bottom:6px}

/* ─── Footer ─── */
.site-footer{background:var(--surface);border-top:1px solid var(--border);margin-top:0;padding:48px 0 0}
.footer-grid{display:grid;grid-template-columns:2fr 1fr 1fr 2fr;gap:40px;padding-bottom:40px;border-bottom:1px solid var(--border)}
@media(max-width:768px){.footer-grid{grid-template-columns:1fr 1fr}.footer-brand{grid-column:1/-1}}
@media(max-width:480px){.footer-grid{grid-template-columns:1fr}.footer-brand{grid-column:1}}
.footer-brand .brand{margin-bottom:12px}
.footer-brand p{color:var(--muted);font-size:14px;margin-bottom:12px}
.footer-socials{display:flex;gap:12px}
.footer-socials a{color:var(--muted);font-size:13px}
.footer-links h5{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:12px}
.footer-links nav{display:flex;flex-direction:column;gap:6px}
.footer-links nav a{color:var(--muted);font-size:13px}
.footer-fine{font-size:12px;color:var(--muted);padding:20px 0;text-align:center}

/* ─── Consulting + Sponsored widgets ─── */
.widget-consult,.widget-sponsored{background:linear-gradient(135deg,var(--surface2),var(--surface));border:1px solid var(--accent);border-radius:var(--radius-lg);padding:20px}
.consult-text{font-size:13px;color:var(--muted);margin:8px 0 12px!important}
.consult-btn{display:inline-block;background:var(--accent);color:#0d1117!important;padding:8px 16px;border-radius:8px;font-weight:700;font-size:13px;transition:background var(--transition)}
.consult-btn:hover{background:#79c0ff;text-decoration:none}
.consult-banner{background:linear-gradient(135deg,#1a3a5c,#162032);border:1px solid rgba(88,166,255,.3);border-radius:var(--radius-lg);padding:28px;text-align:center;margin:32px 0}
.consult-banner h3{font-family:var(--font-serif);font-size:22px;margin-bottom:8px}
.consult-banner p{color:var(--muted);margin-bottom:16px}

/* ─── Resources page ─── */
.res-intro{color:var(--muted);font-size:16px;margin-bottom:32px!important}
.resource-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;margin:16px 0 32px}
.resource-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:14px 16px;transition:border-color var(--transition)}
.resource-card:hover{border-color:var(--accent)}
.resource-card a{display:flex;flex-direction:column;gap:4px;color:var(--ink)!important}
.resource-card strong{font-size:14px;line-height:1.3}
.res-badge{background:rgba(88,166,255,.15);color:var(--accent);border-radius:20px;padding:2px 8px;font-size:11px;font-weight:700;width:fit-content}

/* ─── Contact page ─── */
.contact-grid{display:grid;grid-template-columns:1fr 1.4fr;gap:40px;margin:32px 0}
@media(max-width:768px){.contact-grid{grid-template-columns:1fr}}
.contact-card{display:flex;gap:14px;align-items:flex-start;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:18px;margin-bottom:12px}
.contact-icon{font-size:24px;flex-shrink:0;margin-top:2px}
.contact-card strong{display:block;font-size:14px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px}
.contact-card p{margin:0;font-size:14px;color:var(--ink)}
.contact-card a{color:var(--accent)}
.contact-form-wrap h2{font-family:var(--font-serif);font-size:22px;margin-bottom:20px}
.contact-form{display:flex;flex-direction:column;gap:14px}
.contact-form label{display:flex;flex-direction:column;gap:5px;font-size:13px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}
.contact-form input,.contact-form select,.contact-form textarea{background:var(--surface);border:1px solid var(--border);border-radius:8px;color:var(--ink);padding:10px 14px;font-size:14px;font-family:var(--font-sans);outline:none;transition:border-color var(--transition)}
.contact-form input:focus,.contact-form select,.contact-form textarea:focus{border-color:var(--accent)}
.contact-form textarea{resize:vertical}
.contact-submit{background:var(--accent);color:#0d1117;border:none;padding:12px 24px;border-radius:8px;font-weight:700;font-size:15px;cursor:pointer;align-self:flex-start;transition:background var(--transition)}
.contact-submit:hover{background:#79c0ff}

/* ─── Cookie banner ─── */
.cookie-banner{position:fixed;bottom:0;left:0;right:0;z-index:9999;background:var(--surface);border-top:1px solid var(--border);padding:14px 24px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;box-shadow:0 -4px 20px rgba(0,0,0,.4)}
.cookie-banner p{margin:0;font-size:13px;color:var(--muted);flex:1}
.cookie-banner p a{color:var(--accent)}
.cookie-btns{display:flex;gap:10px;align-items:center;flex-shrink:0}
.cookie-accept{background:var(--accent);color:#0d1117;border:none;padding:7px 18px;border-radius:8px;font-weight:700;font-size:13px;cursor:pointer}
.cookie-accept:hover{background:#79c0ff}
.cookie-more{font-size:12px;color:var(--muted)}

/* ─── Footer improvements ─── */
.footer-desc{font-size:12px;color:var(--muted);margin-top:4px!important;margin-bottom:12px!important;line-height:1.5}
.footer-nav-col{display:flex;flex-direction:column;gap:8px}
.footer-nav-col a{color:var(--muted);font-size:13px;transition:color var(--transition)}
.footer-nav-col a:hover{color:var(--ink)}
.footer-bottom{border-top:1px solid var(--border);padding:20px 0;text-align:center}
.footer-legal{margin-top:8px;font-size:12px}
.footer-legal a{color:var(--muted)}
.footer-legal a:hover{color:var(--accent)}
`;


build();
