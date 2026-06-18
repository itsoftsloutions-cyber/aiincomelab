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
function escapeRegex(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
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
  if (post.svgImage) return b(`/assets/post-svg/${post.slug}.svg`);
  return UNSPLASH_COVERS[post.category] || UNSPLASH_COVERS["guides"];
}
// Absolute URL form for crawlers/structured data (og, JSON-LD, sitemap).
const SITE_ORIGIN = (() => { try { return new URL(site.url).origin; } catch { return ""; } })();
function coverImageAbs(post) {
  const u = coverImage(post);
  return u && u.startsWith("/") ? SITE_ORIGIN + u : u;
}

// ── Deterministic SVG hero generator ────────────────────────────────────────
// Creates a unique, visually distinct SVG per post slug — no external images,
// no copyright risk. Hash determines color palette, shapes, and layout.
function hashStr(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
}
function hslFromHash(h, offset = 0) {
  const hue = (h + offset) % 360;
  return `hsl(${hue}, 65%, 55%)`;
}
function generatePostSvg(slug, title) {
  const h = hashStr(slug);
  const c1 = hslFromHash(h, 0);
  const c2 = hslFromHash(h, 120);
  const c3 = hslFromHash(h, 240);
  const c4 = hslFromHash(h, 60);
  const angle = (h % 360);
  const r1 = 30 + (h % 40);
  const r2 = 20 + ((h >> 4) % 30);
  const cx1 = 100 + (h % 600);
  const cy1 = 50 + ((h >> 3) % 300);
  const cx2 = 200 + ((h >> 2) % 500);
  const cy2 = 100 + ((h >> 5) % 250);
  const nCircles = 3 + (h % 5);
  const circles = [];
  for (let n = 0; n < nCircles; n++) {
    const nh = hashStr(slug + n);
    const cx = nh % 800;
    const cy = (nh >> 4) % 450;
    const r = 15 + (nh % 60);
    const col = hslFromHash(nh, n * 90);
    const op = 0.12 + ((nh >> 8) % 8) * 0.04;
    circles.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${col}" opacity="${op}"/>`);
  }
  const nRects = 2 + ((h >> 6) % 3);
  const rects = [];
  for (let n = 0; n < nRects; n++) {
    const nh = hashStr(slug + "r" + n);
    const rx = nh % 700;
    const ry = (nh >> 4) % 350;
    const rw = 40 + (nh % 120);
    const rh = 20 + ((nh >> 6) % 60);
    const rot = (nh >> 3) % 360;
    const col = hslFromHash(nh, n * 60 + 30);
    const op = 0.08 + ((nh >> 9) % 6) * 0.03;
    rects.push(`<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" rx="8" fill="${col}" opacity="${op}" transform="rotate(${rot} ${rx + rw / 2} ${ry + rh / 2})"/>`);
  }
  const nLines = 2 + ((h >> 8) % 4);
  const lines = [];
  for (let n = 0; n < nLines; n++) {
    const nh = hashStr(slug + "l" + n);
    const x1 = nh % 800;
    const y1 = (nh >> 4) % 450;
    const x2 = (nh >> 2) % 800;
    const y2 = (nh >> 6) % 450;
    lines.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${hslFromHash(nh, n * 45)}" stroke-width="2" opacity="0.18"/>`);
  }
  const escTitle = escapeHtml(title || slug);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" width="800" height="450">
  <defs>
    <linearGradient id="bg-${slug}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="50%" stop-color="${c2}"/>
      <stop offset="100%" stop-color="${c3}"/>
    </linearGradient>
    <linearGradient id="accent-${slug}" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${c4}" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="${c1}" stop-opacity="0.05"/>
    </linearGradient>
  </defs>
  <rect width="800" height="450" fill="url(#bg-${slug})"/>
  <rect width="800" height="450" fill="url(#accent-${slug})"/>
  ${circles.join("\n  ")}
  ${rects.join("\n  ")}
  ${lines.join("\n  ")}
  <circle cx="${cx1}" cy="${cy1}" r="${r1}" fill="${c4}" opacity="0.15"/>
  <circle cx="${cx2}" cy="${cy2}" r="${r2}" fill="${c1}" opacity="0.18"/>
  <text x="400" y="225" text-anchor="middle" fill="white" font-family="Inter,system-ui,sans-serif" font-size="32" font-weight="800" opacity="0.9">${escTitle.length > 40 ? escTitle.slice(0, 37) + "..." : escTitle}</text>
</svg>`;
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

// GA4 custom-event tracking — measures the actions that drive revenue:
// outbound/affiliate clicks, newsletter (CTA) signups, and scroll depth.
// All events no-op gracefully when GA4 is not configured (gtag undefined).
function eventTrackingScript() {
  const id = site.analytics && site.analytics.ga4;
  if (!id || /X{4,}/.test(id)) return "";
  return `<script>
(function(){
  function track(name,params){ if(typeof gtag==='function'){ try{ gtag('event',name,params||{}); }catch(e){} } }
  var host=location.hostname;
  // ── Outbound + affiliate click tracking ──
  document.addEventListener('click',function(e){
    var a=e.target.closest && e.target.closest('a[href]');
    if(!a) return;
    var href=a.getAttribute('href')||'';
    if(/^(mailto:|tel:|#)/i.test(href)) { if(href.indexOf('mailto:')===0) track('contact_click',{link_url:href}); return; }
    var url; try{ url=new URL(a.href, location.href); }catch(_){ return; }
    if(url.hostname && url.hostname!==host){
      var rel=(a.getAttribute('rel')||'').toLowerCase();
      var isAff=/nofollow|sponsored/.test(rel)||a.matches('.aff-item,.inline-aff,.aff-card,.aff-tools a');
      track(isAff?'affiliate_click':'outbound_click',{
        link_url:url.href, link_domain:url.hostname,
        link_text:(a.textContent||'').trim().slice(0,90),
        affiliate: isAff?1:0
      });
    }
  },{passive:true});
  // ── CTA: newsletter signups + header/top-bar CTAs ──
  document.addEventListener('submit',function(e){
    var f=e.target;
    if(f && f.matches && f.matches('.email-form,.email-form-inline')){
      track('newsletter_signup',{form_location:f.closest('.email-box')?'inline':'compact'});
    }
  },true);
  document.addEventListener('click',function(e){
    var c=e.target.closest && e.target.closest('.header-cta,.top-bar-cta');
    if(c) track('cta_click',{cta_text:(c.textContent||'').trim().slice(0,60)});
  },{passive:true});
  // ── Scroll depth (25/50/75/100) — fired once per milestone ──
  var fired={}, marks=[25,50,75,100];
  function onScroll(){
    var d=document.documentElement, h=d.scrollHeight-d.clientHeight;
    if(h<=0) return;
    var pct=(d.scrollTop/h)*100;
    for(var i=0;i<marks.length;i++){
      var m=marks[i];
      if(pct>=m && !fired[m]){ fired[m]=1; track('scroll_depth',{percent_scrolled:m}); }
    }
    if(fired[100]) window.removeEventListener('scroll',onScroll);
  }
  window.addEventListener('scroll',onScroll,{passive:true});
})();
</script>`;
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
  // Use Formsubmit.co as newsletter backend — works with no account or API key
  const action = "https://formsubmit.co/itsoftsloutions@gmail.com";
  if (compact) return `<div class="email-compact">
  <p>${escapeHtml(money.newsletterText || "Get free AI income tips weekly.")}</p>
  <form action="${action}" method="POST" class="email-form-inline">
    <input type="hidden" name="_subject" value="AIIncomeLab Newsletter Subscribe">
    <input type="hidden" name="_captcha" value="false">
    <input type="hidden" name="_next" value="${site.url}/?subscribed=1">
    <input type="email" name="email" placeholder="Your email" required>
    <button type="submit">Subscribe →</button>
  </form>
</div>`;
  return `<div class="email-box">
  <div class="email-icon">✉️</div>
  <h3>Free weekly AI income tips</h3>
  <p>${escapeHtml(money.newsletterText || "Get weekly AI tool picks & income strategies — free.")}</p>
  <form action="${action}" method="POST" class="email-form">
    <input type="hidden" name="_subject" value="AIIncomeLab Newsletter Subscribe">
    <input type="hidden" name="_captcha" value="false">
    <input type="hidden" name="_next" value="${site.url}/?subscribed=1">
    <input type="email" name="email" placeholder="Your best email" required>
    <button type="submit">Subscribe free →</button>
  </form>
  <p class="email-fine">No spam. Unsubscribe any time.</p>
</div>`;
}
function supportWidget() {
  return "";
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

// Structured in-article affiliate block — a scannable "recommended tools" card grid
// drawn from monetization.topAffiliateBanners (+ optional Amazon gear). Higher RPM than
// a plain inline link row, and FTC-compliant via the inline disclosure line.
function affiliateToolsBlock(limit = 4) {
  const tools = (money.topAffiliateBanners || []).slice(0, limit);
  const amazon = (money.amazonProducts || []).slice(0, 2).map((p) => {
    const tag = money.amazonTag ? `?tag=${encodeURIComponent(money.amazonTag)}` : "";
    return { label: p.label, badge: p.badge, href: `https://www.amazon.com/dp/${encodeURIComponent(p.asin)}/${tag}` };
  });
  const all = tools.concat(amazon);
  if (!all.length) return "";
  const cards = all.map((t) => `
    <a class="aff-card" href="${t.href}" target="_blank" rel="noopener nofollow sponsored">
      ${t.badge ? `<span class="aff-card-badge">${escapeHtml(t.badge)}</span>` : ""}
      <span class="aff-card-label">${escapeHtml(t.label)}</span>
      <span class="aff-card-cta">Check it out →</span>
    </a>`).join("");
  return `<aside class="aff-tools" aria-label="Recommended tools">
  <div class="aff-tools-head"><span class="aff-tools-title">🛠️ Tools I recommend for this</span><span class="aff-tools-note">Affiliate links — I may earn a commission at no cost to you.</span></div>
  <div class="aff-tools-grid">${cards}</div>
</aside>`;
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
    logo: { "@type": "ImageObject", url: site.url + "/assets/logo.svg", width: 200, height: 60 },
    description: site.description,
    ...(sameAs.length ? { sameAs } : {}),
  })}</script>`;
}

function layout({ title, description, canonical, head = "", body, jsonld = "", fullWidth = false, isArticle = false, articleDate = "", articleImage = "", noAds = false }) {
  const fullTitle = title === site.name ? `${site.name} — ${site.tagline}` : `${title} | ${site.name}`;
  const ogType = isArticle ? "article" : "website";
  const ogOrigin = (() => { try { return new URL(site.url).origin; } catch { return ""; } })();
  const absImg = (u) => (u && u.startsWith("/") ? ogOrigin + u : u);
  const ogImage = absImg(articleImage) || `${site.url}/assets/og-default.svg`;
  return `<!doctype html>
<html lang="${site.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<script>if(localStorage.getItem('theme')==='dark')document.documentElement.setAttribute('data-theme','dark');</script>
<title>${escapeHtml(fullTitle)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${canonical}">
<meta name="theme-color" content="${site.themeColor}">
<meta name="robots" content="${noAds ? "noindex, follow" : "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1"}">
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
${site.social && site.social.twitter ? `<link rel="me" href="${site.social.twitter}">` : ""}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preconnect" href="https://pagead2.googlesyndication.com">
<link rel="preconnect" href="https://www.googletagmanager.com">
<link rel="preconnect" href="https://formsubmit.co">
<link rel="dns-prefetch" href="https://fonts.googleapis.com">
<link rel="dns-prefetch" href="https://pagead2.googlesyndication.com">
<link rel="dns-prefetch" href="https://www.googletagmanager.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:wght@700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${b('/assets/style.css')}">
<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<link rel="alternate" href="${canonical}" hreflang="${site.lang.split("-")[0]}" />
<link rel="alternate" href="${canonical}" hreflang="x-default" />
${ad.enabled ? `<meta name="google-adsense-account" content="${ad.client}">` : ""}
${site.verification && site.verification.google ? `<meta name="google-site-verification" content="${escapeHtml(site.verification.google)}">` : ""}
${noAds ? "" : adScriptTag()}
${analyticsTag()}
${orgSchema()}
${jsonld}
${head}
</head>
<body>
<div id="read-progress"></div>
<button id="back-top" aria-label="Back to top" onclick="window.scrollTo({top:0,behavior:'smooth'})">↑</button>
${cookieBanner()}
${topBar()}
${header()}
<main class="site-main${fullWidth ? " full-width" : ""}">
${body}
</main>
${footer(noAds)}
<script>
(function(){
  // ── Theme ──
  var saved=localStorage.getItem('theme')||'light';
  var html=document.documentElement;
  var tog=document.getElementById('themeToggle');
  function applyTheme(t){
    if(t==='dark'){html.setAttribute('data-theme','dark');if(tog)tog.textContent='🌙';}
    else{html.removeAttribute('data-theme');if(tog)tog.textContent='☀️';}
  }
  applyTheme(saved);
  if(tog)tog.addEventListener('click',function(){
    var next=html.getAttribute('data-theme')==='dark'?'light':'dark';
    localStorage.setItem('theme',next);
    applyTheme(next);
  });
  // ── Read progress ──
  var bar=document.getElementById('read-progress');
  var btn=document.getElementById('back-top');
  function upd(){
    var s=document.documentElement;
    var pct=(s.scrollTop/(s.scrollHeight-s.clientHeight))*100;
    if(bar)bar.style.width=Math.min(100,pct)+'%';
    if(btn){if(s.scrollTop>400)btn.classList.add('visible');else btn.classList.remove('visible');}
  }
  window.addEventListener('scroll',upd,{passive:true});
  // ── Mobile nav ──
  document.querySelector('.nav-toggle')?.addEventListener('click',function(){
    document.getElementById('mobileNav').classList.toggle('open');
  });
  // ── Mermaid diagrams ──
  if(document.querySelector('.mermaid')){
    var mTheme=document.documentElement.getAttribute('data-theme')==='dark'?'dark':'default';
    mermaid.initialize({startOnLoad:true,theme:mTheme});
  }
  // ── Forms: AJAX submit with inline feedback (progressive enhancement) ──
  // Plain POST still works without JS. For FormSubmit.co we POST to the /ajax/
  // endpoint so users get immediate on-page confirmation instead of being
  // redirected off-site (which looked broken in local preview).
  document.querySelectorAll('.contact-form,.email-form,.email-form-inline').forEach(function(form){
    form.addEventListener('submit',function(e){
      var action=form.getAttribute('action')||'';
      var m=action.match(/formsubmit\\.co\\/(?:ajax\\/)?(.+)$/);
      if(!m)return; // unknown backend — let native submit proceed
      e.preventDefault();
      var btn=form.querySelector('button[type="submit"],button:not([type])');
      var label=btn?btn.textContent:'';
      if(btn){btn.disabled=true;btn.textContent='Sending…';}
      var fd=new FormData(form);
      fetch('https://formsubmit.co/ajax/'+m[1],{method:'POST',headers:{'Accept':'application/json'},body:fd})
        .then(function(r){return r.json();})
        .then(function(){
          var ok=document.createElement('p');
          ok.className='form-status form-status-ok';
          ok.textContent='✓ Thanks! Your message was sent.';
          form.replaceWith(ok);
        })
        .catch(function(){
          if(btn){btn.disabled=false;btn.textContent=label;}
          var err=form.querySelector('.form-status-err')||document.createElement('p');
          err.className='form-status form-status-err';
          err.textContent='Something went wrong — please email itsoftsloutions@gmail.com directly.';
          if(!err.parentNode)form.appendChild(err);
        });
    });
  });
})();
</script>
${eventTrackingScript()}
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
    <button class="theme-toggle" id="themeToggle" aria-label="Toggle theme" title="Switch light/dark">☀️</button>
    <button class="nav-toggle" aria-label="Menu">☰</button>
  </div>
</header>
<nav class="mobile-nav" id="mobileNav">
  ${(site.nav || []).map((n) => `<a href="${b(n.href)}">${escapeHtml(n.label)}</a>`).join("")}
</nav>`;
}

function footer(noAds = false) {
  const cats = (site.nav || []).filter(n => !n.href.includes('/contact')).map((n) => `<a href="${b(n.href)}">${escapeHtml(n.label)}</a>`).join("\n");
  const socials = Object.entries(site.social || {}).filter(([, v]) => v && v.trim()).map(([k, v]) => `<a href="${v}" target="_blank" rel="noopener">${k.charAt(0).toUpperCase() + k.slice(1)}</a>`).join(" · ");
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
    ${noAds ? "" : adUnit("footer")}
    <div class="footer-bottom">
      <p class="footer-fine">&copy; ${year} ${escapeHtml(site.name)} — AI Tools, Productivity &amp; Online Income.</p>
      <p class="footer-fine">Affiliate disclosure: some links earn us a commission at no extra cost to you. We only recommend tools we have personally tested.</p>
      <nav class="footer-legal"><a href="${b('/privacy/')}">Privacy Policy</a> · <a href="${b('/terms/')}">Terms of Service</a> · <a href="${b('/about/')}">About</a> · <a href="${b('/contact/')}">Contact</a></nav>
    </div>
  </div>
</footer>`;
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

const INTERNAL_LINK_STOP = new Set([
  "make money", "ai tools", "best ai", "with ai", "using ai", "for beginners",
  "how to", "make money with", "best ai tools", "ai tools to", "online 2026",
]);
// Function words that make weak/awkward anchor text at a phrase boundary.
const INTERNAL_LINK_FN = new Set([
  "a", "an", "the", "with", "for", "and", "or", "of", "to", "in", "on", "your",
  "my", "this", "that", "how", "what", "why", "is", "are", "best", "use", "using", "no",
]);
// Expand a keyword into contiguous 2–3 word sub-phrases so we can link the natural way a
// phrase appears in prose ("affiliate marketing") rather than only the exact long-tail
// keyword ("ai affiliate marketing 2026"). Rejects fragments that start/end on a function
// word or a year, which keeps anchor text descriptive (good for SEO, not spammy).
function phraseVariants(s) {
  const words = String(s).toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  const out = new Set();
  for (let n = Math.min(3, words.length); n >= 2; n--) {
    for (let i = 0; i + n <= words.length; i++) {
      const seg = words.slice(i, i + n);
      const first = seg[0], last = seg[seg.length - 1];
      if (INTERNAL_LINK_FN.has(first) || INTERNAL_LINK_FN.has(last)) continue;
      if (/^\d{4}$/.test(last)) continue;
      out.add(seg.join(" "));
    }
  }
  return [...out].filter((p) => p.length >= 12 && !INTERNAL_LINK_STOP.has(p));
}
// Auto internal-linking: link the first mention of another post's keyword/title phrase
// to that post. Only touches plain body text — never inside existing anchors, headings,
// code/pre, so it can't break markup or double-link. Capped to keep it natural.
function injectInternalLinks(html, post, allPosts) {
  const candidates = [];
  const seenPhrase = new Set();
  for (const o of allPosts) {
    if (o.slug === post.slug) continue;
    const url = b(`/posts/${o.slug}/`);
    for (const src of (o.keywords || [])) {
      for (const ph of phraseVariants(src)) {
        if (seenPhrase.has(ph)) continue; // a given phrase links to one post only
        seenPhrase.add(ph);
        candidates.push({ phrase: ph, url, title: o.title });
      }
    }
  }
  candidates.sort((a, b) => b.phrase.length - a.phrase.length);
  const usedUrls = new Set(), usedPhrases = new Set();
  let linkCount = 0;
  const MAX = 5;
  const parts = html.split(/(<[^>]+>)/);
  let inAnchor = 0, inHeading = 0, inCode = 0;
  for (let i = 0; i < parts.length; i++) {
    const tok = parts[i];
    if (tok.startsWith("<")) {
      const t = tok.toLowerCase();
      if (/^<a[\s>]/.test(t)) inAnchor++;
      else if (/^<\/a>/.test(t)) inAnchor = Math.max(0, inAnchor - 1);
      else if (/^<h[1-6][\s>]/.test(t)) inHeading++;
      else if (/^<\/h[1-6]>/.test(t)) inHeading = Math.max(0, inHeading - 1);
      else if (/^<(code|pre)[\s>]/.test(t)) inCode++;
      else if (/^<\/(code|pre)>/.test(t)) inCode = Math.max(0, inCode - 1);
      continue;
    }
    if (inAnchor || inHeading || inCode || linkCount >= MAX || !tok.trim()) continue;
    let text = tok;
    for (const c of candidates) {
      if (linkCount >= MAX) break;
      if (usedUrls.has(c.url) || usedPhrases.has(c.phrase)) continue;
      const re = new RegExp("\\b(" + escapeRegex(c.phrase) + ")\\b", "i");
      if (re.test(text)) {
        text = text.replace(re, (m) => `<a class="internal-link" href="${c.url}" title="${escapeHtml(c.title)}">${m}</a>`);
        usedUrls.add(c.url); usedPhrases.add(c.phrase); linkCount++;
      }
    }
    parts[i] = text;
  }
  return parts.join("");
}

function renderArticleBody(post, allPosts) {
  let html = markdownToHtml(post.body);
  if (allPosts && allPosts.length) html = injectInternalLinks(html, post, allPosts);
  let count = 0;
  html = html.replace(/<\/p>/g, (m) => {
    count++;
    if (count === 2) return `</p>\n${adUnit("inArticle")}\n${affiliateBannerInline()}`;
    if (count === 4) return `</p>\n${affiliateToolsBlock()}\n`;
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
      image: { "@type": "ImageObject", url: coverImageAbs(post), width: 800, height: 450 },
      datePublished: post.date + "T08:00:00+00:00",
      dateModified: post.date + "T08:00:00+00:00",
      author: { "@type": "Person", name: post.author || site.author, url: site.url + "/about/" },
      publisher: { "@type": "Organization", name: site.name, url: site.url + "/",
        logo: { "@type": "ImageObject", url: site.url + "/assets/logo.svg", width: 200, height: 60 } },
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

// Pull Q/A pairs out of a post's FAQ section for FAQPage schema. Handles both the
// heading style (### Question) and the bold-paragraph style (**Question?**) that the
// auto-publisher actually emits, and stops at the next H2 section so the conclusion
// never leaks into the last answer.
function extractFaqPairs(body) {
  const pairs = [];
  const lines = body.split("\n");
  let inFaq = false, curQ = "", curA = [];
  const flush = () => { if (curQ && curA.length) pairs.push([curQ, curA.join(" ").trim()]); curQ = ""; curA = []; };
  for (const line of lines) {
    if (/^#{1,3}\s*(faq|frequently asked)/i.test(line)) { inFaq = true; continue; }
    if (!inFaq) continue;
    // A new H2 (non-FAQ) heading ends the FAQ block (e.g. "## Final thoughts").
    if (/^#{1,2}\s+\S/.test(line)) { flush(); inFaq = false; continue; }
    // A horizontal rule ends the FAQ block and never belongs in an answer.
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { flush(); inFaq = false; continue; }
    const headingQ = line.match(/^#{3,4}\s+(.+)/);
    // Bold question, optionally with the answer on the same line: **Q?** answer text
    const boldQ = line.match(/^\*\*(.+?)\*\*\s*(.*)$/);
    if (headingQ || boldQ) {
      flush();
      if (headingQ) {
        curQ = headingQ[1].replace(/\*\*/g, "").trim();
      } else {
        curQ = boldQ[1].replace(/\*\*/g, "").trim();
        const rest = boldQ[2].trim();
        if (rest) curA.push(rest.replace(/[*_`#]/g, "").trim());
      }
    } else if (curQ && line.trim()) {
      curA.push(line.replace(/[*_`#]/g, "").trim());
    }
  }
  flush();
  return pairs.slice(0, 5);
}
function postBreadcrumbJsonLd(post) {
  return `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: site.url + "/" },
      { "@type": "ListItem", position: 2, name: catLabel(post.category), item: `${site.url}/category/${post.category}/` },
      { "@type": "ListItem", position: 3, name: post.title, item: post.url },
    ],
  })}</script>`;
}

function pageBreadcrumbJsonLd(name, url) {
  return `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: site.url + "/" },
      { "@type": "ListItem", position: 2, name: name, item: url },
    ],
  })}</script>`;
}

function categoryBreadcrumbJsonLd(name, url) {
  return pageBreadcrumbJsonLd(name, url);
}

function pageJsonLd(type, name, description, url) {
  return `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org", "@type": type, name, description, url,
    breadcrumb: { "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: site.url + "/" },
      { "@type": "ListItem", position: 2, name, item: url },
    ]},
  })}</script>`;
}

function collectionPageJsonLd(category, posts) {
  return `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org", "@type": "CollectionPage",
    name: catLabel(category), description: `${catLabel(category)} articles — ${site.name}`,
    url: `${site.url}/category/${category}/`,
    breadcrumb: { "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: site.url + "/" },
      { "@type": "ListItem", position: 2, name: catLabel(category), item: `${site.url}/category/${category}/` },
    ]},
    mainEntity: { "@type": "ItemList", itemListElement: posts.map((p, i) => ({
      "@type": "ListItem", position: i + 1, url: p.url, name: p.title,
    }))},
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

  // ── Generate SVG hero images for posts without frontmatter images ──
  for (const p of posts) {
    if (!p.image) {
      p.svgImage = true;
      write(`assets/post-svg/${p.slug}.svg`, generatePostSvg(p.slug, p.title));
    }
  }

  // ── Generate site branding assets ──
  write("assets/logo.svg", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60" width="200" height="60">
  <rect width="200" height="60" rx="8" fill="#0969da"/>
  <text x="100" y="38" text-anchor="middle" fill="white" font-family="Inter,system-ui,sans-serif" font-size="22" font-weight="800">AIIncomeLab</text>
</svg>`);
  write("assets/og-default.svg", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <linearGradient id="og-bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0969da"/>
      <stop offset="100%" stop-color="#0d1117"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#og-bg)"/>
  <text x="600" y="290" text-anchor="middle" fill="white" font-family="Inter,system-ui,sans-serif" font-size="60" font-weight="800">AIIncomeLab</text>
  <text x="600" y="350" text-anchor="middle" fill="rgba(255,255,255,.65)" font-family="Inter,system-ui,sans-serif" font-size="24">AI Tools, Productivity &amp; Online Income</text>
</svg>`);

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
      breadcrumb: { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: site.url + "/" },
      ]},
    })}</script>
<script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org", "@type": "ItemList",
      name: "Latest Articles", description: site.description,
      url: site.url + "/", numberOfItems: posts.length,
      itemListElement: posts.slice(0, 12).map((p, i) => ({
        "@type": "ListItem", position: i + 1, url: p.url, name: p.title,
      })),
    })}</script>`,
  }));

  // ── Post pages ──
  for (const p of posts) {
    const related = posts.filter((o) => o.category === p.category && o.slug !== p.slug).slice(0, 3);
    const relatedHtml = related.length
      ? `<section class="related"><h3>Related Articles</h3><div class="grid grid-sm">${related.map((r) => postCard(r)).join("")}</div></section>`
      : "";
    function socialShareHtml(title, url) {
      const encodedUrl = encodeURIComponent(url);
      const encodedTitle = encodeURIComponent(title);
      return `<div class="social-share">
  <span class="social-share-label">Share this post</span>
  <div class="social-share-btns">
    <a class="share-btn share-x" href="https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}" target="_blank" rel="noopener" title="Share on X">X</a>
    <a class="share-btn share-fb" href="https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}" target="_blank" rel="noopener" title="Share on Facebook">FB</a>
    <a class="share-btn share-li" href="https://www.linkedin.com/shareArticle?mini=true&url=${encodedUrl}&title=${encodedTitle}" target="_blank" rel="noopener" title="Share on LinkedIn">in</a>
    <a class="share-btn share-rd" href="https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}" target="_blank" rel="noopener" title="Share on Reddit">RD</a>
    <button class="share-btn share-cp" onclick="navigator.clipboard.writeText('${url}');this.textContent='Copied!';setTimeout(()=>this.textContent='Copy',2000)" title="Copy link">Copy</button>
  </div>
</div>`;
    }
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
    <div class="content">${renderArticleBody(p, posts)}</div>
    ${socialShareHtml(p.title, p.url)}
    ${relatedHtml}
  </article>
  ${sidebar(posts)}
</div>`;
    const heroImg = coverImage(p);
    const heroPreload = `<link rel="preload" as="image" href="${heroImg}" fetchpriority="high">`;
    write(`posts/${p.slug}/index.html`, layout({
      title: p.title, description: p.description, canonical: p.url,
      isArticle: true, articleDate: p.date, articleImage: heroImg,
      head: heroPreload + (p.keywords.length
        ? `<meta name="keywords" content="${escapeHtml(p.keywords.join(", "))}">
<meta name="news_keywords" content="${escapeHtml(p.keywords.join(", "))}">
${p.keywords.map((k) => `<meta property="article:tag" content="${escapeHtml(k)}">`).join("\n")}
<meta property="article:section" content="${escapeHtml(catLabel(p.category))}">`
        : `<meta property="article:section" content="${escapeHtml(catLabel(p.category))}">`),
      body,
      jsonld: articleJsonLd(p) + postBreadcrumbJsonLd(p),
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
      jsonld: collectionPageJsonLd(c, list) + categoryBreadcrumbJsonLd(catLabel(c), `${site.url}/category/${c}/`),
    }));
  }

  // ── Static pages ──
  const aboutUrl = `${site.url}/about/`;
  write("about/index.html", layout({
    title: "About", description: `About ${site.name} — hands-on AI tools guides, productivity tips, and proven ways to earn money online.`, canonical: aboutUrl,
    body: `<div class="wrap-wide"><article class="post-content static-page"><h1>About ${escapeHtml(site.name)}</h1><div class="content">${markdownToHtml(ABOUT_MD)}</div></article></div>`,
    jsonld: pageBreadcrumbJsonLd("About", aboutUrl) + pageJsonLd("AboutPage", "About", `About ${site.name}`, aboutUrl),
  }));
  const privacyUrl = `${site.url}/privacy/`;
  write("privacy/index.html", layout({
    title: "Privacy Policy & Affiliate Disclosure", description: `Privacy policy, cookie policy, and affiliate disclosure for ${site.name}.`, canonical: privacyUrl,
    body: `<div class="wrap-wide"><article class="post-content static-page"><h1>Privacy Policy &amp; Disclosure</h1><div class="content">${markdownToHtml(PRIVACY_MD)}</div></article></div>`,
    jsonld: pageBreadcrumbJsonLd("Privacy Policy", privacyUrl),
  }));
  const contactUrl = `${site.url}/contact/`;
  const termsUrl = `${site.url}/terms/`;
  write("contact/index.html", layout({
    title: "Contact Us", description: `Contact Kanav Sharma at ${site.name} — questions, sponsorships, content corrections, or advertising enquiries.`, canonical: contactUrl,
    body: `<div class="wrap-wide"><article class="post-content static-page">
<h1>Contact Us</h1>
<div class="contact-grid">
  <div class="contact-info">
    <div class="contact-card"><span class="contact-icon">👤</span><div><strong>Author / Editor</strong><p>Kanav Sharma</p></div></div>
    <div class="contact-card"><span class="contact-icon">✉️</span><div><strong>Email</strong><p><a href="mailto:itsoftsloutions@gmail.com">itsoftsloutions@gmail.com</a></p></div></div>
    <div class="contact-card"><span class="contact-icon">📣</span><div><strong>Sponsorships &amp; Advertising</strong><p>Starting from $150 per sponsored post.<br>Email: <a href="mailto:itsoftsloutions@gmail.com?subject=Sponsorship">itsoftsloutions@gmail.com</a></p></div></div>
    <div class="contact-card"><span class="contact-icon">🔗</span><div><strong>Follow on X / Twitter</strong><p><a href="https://x.com/kanavy9ah" target="_blank" rel="noopener me">@kanavy9ah on X →</a></p></div></div>
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
  write("terms/index.html", layout({
    title: "Terms of Service", description: `Terms of service for ${site.name}.`, canonical: termsUrl,
    body: `<div class="wrap-wide"><article class="post-content static-page"><h1>Terms of Service</h1><div class="content">${markdownToHtml(TERMS_MD)}</div></article></div>`,
    jsonld: pageBreadcrumbJsonLd("Terms of Service", termsUrl),
  }));
  write("404.html", layout({
    title: "Not Found", description: "Page not found.", canonical: `${site.url}/404.html`,
    noAds: true,
    body: `<div class="wrap-wide" style="padding:80px 0 120px;text-align:center"><h1 style="font-size:80px;margin:0">404</h1><p style="font-size:20px;color:var(--muted)">That page doesn't exist. <a href="${b('/')}">Go home →</a></p></div>`,
  }));

  // ── Rich Text Editor page ──
  const editorUrl = `${site.url}/editor/`;
  const catOptions = cats.map((c) => `<option value="${c}">${escapeHtml(catLabel(c))}</option>`).join("");
  write("editor/index.html", layout({
    title: "Post Editor", description: `Rich text editor for creating and editing blog posts — ${site.name}.`,
    canonical: editorUrl, fullWidth: true, noAds: true,
    head: `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/easymde@2.18/dist/easymde.min.css">
<script src="https://cdn.jsdelivr.net/npm/easymde@2.18/dist/easymde.min.js"></script>`,
    body: `<div class="wrap-wide" style="padding:40px 0 80px">
<article class="post-content">
  <h1>Blog Post Editor</h1>
  <p style="color:var(--muted);margin-bottom:24px">Write, edit, and preview posts with support for Mermaid flow diagrams, step-by-step guides, and callout blocks. Save drafts locally and download ready-to-publish markdown.</p>
  <div class="editor-meta">
    <label class="editor-label">Title<input type="text" id="editorTitle" placeholder="Enter post title..." class="editor-input"></label>
    <label class="editor-label">Category<select id="editorCategory" class="editor-input">${catOptions}</select></label>
    <label class="editor-label">Keywords (comma separated)<input type="text" id="editorKeywords" placeholder="ai tools, make money, blog" class="editor-input"></label>
  </div>
  <div class="editor-frontmatter-hint">Frontmatter is auto-generated from the fields above.</div>
  <textarea id="editorBody"></textarea>
  <div class="editor-actions">
    <button onclick="editorSave()" class="editor-btn editor-btn-save">Save Draft</button>
    <button onclick="editorDownload()" class="editor-btn editor-btn-download">Download .md</button>
    <button onclick="editorClear()" class="editor-btn editor-btn-clear">New Post</button>
    <span id="editorStatus" class="editor-status"></span>
  </div>
</article>
<div class="editor-help">
  <h3>Markdown Extensions</h3>
  <div class="editor-help-grid">
    <div class="editor-help-item"><strong>Flow Diagrams</strong><pre class="editor-code">\\\`\\\`\\\`mermaid
graph TD
  A[Start] --> B[Step]
  B --> C[Done]
\\\`\\\`\\\`</pre></div>
    <div class="editor-help-item"><strong>Step-by-Step</strong><pre class="editor-code">\\\`\\\`\\\`steps
1. First do this
2. Then do that
3. Finally done
\\\`\\\`\\\`</pre></div>
    <div class="editor-help-item"><strong>Callout Blocks</strong><pre class="editor-code">::: tip
This is a helpful tip
:::

::: warning
Be careful with this
:::</pre></div>
    <div class="editor-help-item"><strong>SVG Images</strong><p>Every post gets a unique auto-generated SVG hero image. No action needed — it just works!</p></div>
  </div>
</div>
</div>
<script>
var easyMDE=new EasyMDE({element:document.getElementById("editorBody"),spellChecker:false,placeholder:"Write your post here...\\n\\nUse \\\\\`\\\\\`\\\\\`mermaid for flow diagrams\\nUse \\\\\`\\\\\`\\\\\`steps for step-by-step guides\\nUse ::: tip, ::: warning, ::: info for callout blocks",toolbar:[["bold","italic","heading","|","quote","unordered-list","ordered-list","|","link","image","table","horizontal-rule","|","preview","side-by-side","fullscreen","|","guide"]],status:false,unorderedListStyle:"-"});
function slugify(s){return s.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"").slice(0,70)}
function editorSave(){
  var d={title:document.getElementById("editorTitle").value,category:document.getElementById("editorCategory").value,keywords:document.getElementById("editorKeywords").value,body:easyMDE.value(),ts:Date.now()};
  localStorage.setItem("aia-draft",JSON.stringify(d));
  document.getElementById("editorStatus").textContent="Draft saved at "+new Date().toLocaleTimeString();
}
function editorDownload(){
  var title=document.getElementById("editorTitle").value||"untitled-post";
  var cat=document.getElementById("editorCategory").value||"guides";
  var kw=document.getElementById("editorKeywords").value||"";
  var kwArr=kw.split(",").map(function(s){return s.trim()}).filter(Boolean);
  var slug=slugify(title);
  var date=new Date().toISOString().slice(0,10);
  var fm=["---",'title: "'+title.replace(/"/g,"'"+'"')+'"',  'description: ""','slug: "'+slug+'"','category: "'+cat+'"','date: "'+date+'"','keywords: ['+kwArr.map(function(k){return '"'+k+'"'}).join(", ")+']',"---"].join("\\n");
  var full=fm+"\\n\\n"+easyMDE.value();
  var blob=new Blob([full],{type:"text/markdown"});
  var a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=slug+".md";a.click();
  document.getElementById("editorStatus").textContent="Downloaded "+slug+".md";
}
function editorClear(){
  if(!confirm("Start a new post? Unsaved changes will be lost."))return;
  document.getElementById("editorTitle").value="";
  document.getElementById("editorCategory").selectedIndex=0;
  document.getElementById("editorKeywords").value="";
  easyMDE.value("");
  localStorage.removeItem("aia-draft");
  document.getElementById("editorStatus").textContent="";
}
(function(){
  var saved=localStorage.getItem("aia-draft");
  if(saved){try{var d=JSON.parse(saved);document.getElementById("editorTitle").value=d.title||"";document.getElementById("editorCategory").value=d.category||"guides";document.getElementById("editorKeywords").value=d.keywords||"";easyMDE.value(d.body||"");document.getElementById("editorStatus").textContent="Draft restored from "+new Date(d.ts).toLocaleTimeString()}catch{}}
})();
</script>`,
    jsonld: pageBreadcrumbJsonLd("Post Editor", editorUrl),
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
  <div class="resource-card"><a href="https://gumroad.com" target="_blank" rel="noopener"><span class="res-badge">0% fee</span><strong>Gumroad — sell digital products</strong></a></div>
  <div class="resource-card"><a href="https://www.amazon.com/associates" target="_blank" rel="noopener"><span class="res-badge">Affiliate</span><strong>Amazon Associates — product links</strong></a></div>
</div>
<h2>Start Your Own Blog</h2>
<div class="resource-grid">
  <div class="resource-card"><a href="https://www.hostinger.com/web-hosting?ref=aiincomelab" target="_blank" rel="noopener nofollow"><span class="res-badge">$2.99/mo</span><strong>Hostinger — cheapest reliable hosting</strong></a></div>
  <div class="resource-card"><a href="https://github.com/pages" target="_blank" rel="noopener"><span class="res-badge">Free</span><strong>GitHub Pages — free static hosting</strong></a></div>
</div>
<div class="consult-banner"><h3>Questions or want to work together?</h3><p>Reach out via our <a href="${b('/contact/')}">contact page</a> — we respond within 2 business days.</p><a href="${b('/contact/')}" class="consult-btn">Contact us →</a></div>
</article></div>`;
  const resourcesUrl = `${site.url}/resources/`;
  write("resources/index.html", layout({
    title: "Best AI Tools & Resources", description: `Tested tools and resources for AI blogging, SEO, and online income — ${site.name}.`,
    canonical: resourcesUrl,
    body: resourceBody,
    jsonld: pageBreadcrumbJsonLd("Resources", resourcesUrl),
  }));

  // ── SEO files ──
  // Sitemap with lastmod/changefreq/priority. lastmod helps Google schedule recrawls.
  const latestDate = (posts[0] && posts[0].date) || new Date().toISOString().slice(0, 10);
  const catLastmod = (c) => {
    const p = posts.find((x) => x.category === c);
    return (p && p.date) || latestDate;
  };
  function isoDate(d) { return d + "T08:00:00+00:00"; }
  const sitemapEntries = [
    { loc: site.url + "/", lastmod: isoDate(latestDate), changefreq: "daily", priority: "1.0", image: "" },
    ...cats.map((c) => ({ loc: `${site.url}/category/${c}/`, lastmod: isoDate(catLastmod(c)), changefreq: "weekly", priority: "0.8", image: "" })),
    { loc: `${site.url}/resources/`, lastmod: isoDate(latestDate), changefreq: "weekly", priority: "0.7", image: "" },
    { loc: `${site.url}/about/`, lastmod: isoDate(latestDate), changefreq: "monthly", priority: "0.5", image: "" },
    { loc: `${site.url}/contact/`, lastmod: isoDate(latestDate), changefreq: "monthly", priority: "0.4", image: "" },
    { loc: `${site.url}/privacy/`, lastmod: isoDate(latestDate), changefreq: "yearly", priority: "0.3", image: "" },
    { loc: `${site.url}/terms/`, lastmod: isoDate(latestDate), changefreq: "yearly", priority: "0.3", image: "" },
    { loc: `${site.url}/404.html`, lastmod: isoDate(latestDate), changefreq: "yearly", priority: "0.1", image: "" },
    { loc: `${site.url}/editor/`, lastmod: isoDate(latestDate), changefreq: "monthly", priority: "0.3", image: "" },
    { loc: `${site.url}/rss.xml`, lastmod: isoDate(latestDate), changefreq: "daily", priority: "0.3", image: "" },
    ...posts.map((p) => ({ loc: p.url, lastmod: isoDate(p.date), changefreq: "monthly", priority: "0.7", image: coverImageAbs(p) })),
  ];
  write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${sitemapEntries.map((e) => {
  const img = e.image ? `\n    <image:image><image:loc>${escapeHtml(e.image)}</image:loc><image:caption>${escapeHtml(site.name)}</image:caption></image:image>` : "";
  return `  <url><loc>${e.loc}</loc><lastmod>${e.lastmod}</lastmod><changefreq>${e.changefreq}</changefreq><priority>${e.priority}</priority>${img}</url>`;
}).join("\n")}
</urlset>`);
  write("robots.txt", `User-agent: *
Allow: /
Crawl-delay: 10
Disallow: /*?*
Disallow: /*.json$
Disallow: /*.xml$
Allow: /sitemap.xml$
Allow: /rss.xml$

Sitemap: ${site.url}/sitemap.xml
`);
  if (ad.enabled) write("ads.txt", `google.com, ${ad.client.replace(/^ca-/, "")}, DIRECT, f08c47fec0942fa0\n`);

  function renderPostBodyToHtml(post) {
    return renderArticleBody(post);
  }

  const rssItems = posts.slice(0, 50).map((p) => {
    const cats = p.keywords.length
      ? p.keywords.map((k) => `    <category>${escapeHtml(k)}</category>`).join("\n") + "\n"
      : "";
    const img = coverImageAbs(p);
    const imgType = img.endsWith(".svg") ? "image/svg+xml" : "image/jpeg";
    const htmlBody = renderPostBodyToHtml(p);
    const isoStr = new Date(p.date).toISOString();
    return `  <item>
    <title>${escapeHtml(p.title)}</title>
    <link>${p.url}</link>
    <guid isPermaLink="true">${p.url}</guid>
    <pubDate>${new Date(p.date).toUTCString()}</pubDate>
    <dc:creator><![CDATA[${escapeHtml(p.author || site.author)}]]></dc:creator>
    <description>${escapeHtml(p.description)}</description>
    <content:encoded><![CDATA[${htmlBody}]]></content:encoded>
    <media:content url="${img}" width="800" height="450" medium="image" type="${imgType}"></media:content>
    <media:thumbnail url="${img}" width="800" height="450"/>
${cats}\
  </item>`;
  }).join("\n");

  write("rss.xml", `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel>
  <title>${escapeHtml(site.name)}</title>
  <link>${site.url}/</link>
  <description>${escapeHtml(site.description)}</description>
  <language>${site.lang}</language>
  <lastBuildDate>${new Date(posts[0] ? posts[0].date : new Date().toISOString().slice(0, 10)).toUTCString()}</lastBuildDate>
  <atom:link href="${site.url}/rss.xml" rel="self" type="application/rss+xml"/>
  <image>
    <url>${site.url}/assets/logo.svg</url>
    <title>${escapeHtml(site.name)}</title>
    <link>${site.url}/</link>
    <width>200</width>
    <height>60</height>
  </image>
${rssItems}
</channel>
</rss>`);
  write("site.webmanifest", JSON.stringify({ name: site.name, short_name: site.logoText, start_url: b("/"), display: "standalone", background_color: site.themeColor, theme_color: site.themeColor }, null, 2));

  // ── IndexNow ──
  const indexnowPath = path.join(root, "data", "indexnow.json");
  let indexnowKey = "";
  try { const d = JSON.parse(fs.readFileSync(indexnowPath, "utf8")); indexnowKey = d.indexnow_key || ""; } catch {}
  if (!indexnowKey) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    indexnowKey = Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    fs.writeFileSync(indexnowPath, JSON.stringify({ indexnow_key: indexnowKey }, null, 2));
  }
  write(indexnowKey + ".txt", indexnowKey);

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
- **Sponsored content** — clearly labelled posts from brands we vet

Our commercial relationships never influence editorial recommendations. We only link to tools we have personally tested.

## Our commitment

We update articles when tools change. We correct errors quickly. We do not publish AI-generated content without human review and editing.`;

const PRIVACY_MD = `**Last updated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}**

This Privacy Policy explains how AIIncomeLab ("we", "us", "our") collects, uses, and protects information when you visit **${site.url}/**. We are committed to protecting your privacy and complying with applicable data protection laws including GDPR and CCPA.

## 1. Information We Collect

### 1a. Information you provide voluntarily

- **Contact form**: When you contact us via our contact form, we receive your name, email address, and message. This data is sent directly to itsoftsloutions@gmail.com via Formsubmit.co and is used solely to respond to your enquiry.
- **Newsletter signup**: If you subscribe to our newsletter, we receive your email address. We use this to send you AI income guides and updates. You can unsubscribe at any time using the link in any email.

### 1b. Information collected automatically

- **Analytics data**: We use Google Analytics 4 to collect aggregated, non-personally-identifiable data including pages visited, time on site, device type, and general geographic location (country/city level). No personally identifiable information is stored.
- **Log data**: Our hosting provider (GitHub Pages) may collect standard server log data including your IP address, browser type, and the pages you request. This data is held by GitHub and governed by [GitHub's Privacy Policy](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement).

## 2. Cookies and Tracking Technologies

This website uses cookies for the following purposes:

### Strictly necessary cookies
- **Cookie consent** — we store your cookie consent choice in your browser's localStorage. No data is sent to a server.
- **Theme preference** — we store your light/dark mode choice locally in your browser.

### Advertising cookies (Google AdSense)
This site uses **Google AdSense** to display advertisements. Google AdSense uses cookies, web beacons, and similar tracking technologies to:
- Serve ads based on your prior visits to this website and other websites
- Measure ad performance and prevent fraud

Google's use of advertising cookies enables it and its partners to serve ads based on your visits to our site and other sites on the Internet. You may opt out of personalised advertising by visiting:
- [Google Ads Settings](https://www.google.com/settings/ads)
- [Network Advertising Initiative opt-out](https://optout.networkadvertising.org/)
- [About Ads opt-out](https://optout.aboutads.info/)

For more information on how Google uses data, see: [google.com/policies/privacy/partners](https://www.google.com/policies/privacy/partners/)

### Analytics cookies (Google Analytics)
We use **Google Analytics 4** to understand how visitors interact with our website. Analytics cookies collect information anonymously. No personally identifiable information is shared with Google Analytics. You may opt out using the [Google Analytics Opt-out Browser Add-on](https://tools.google.com/dlpage/gaoptout).

## 3. Affiliate Disclosure

Some links on this website are **affiliate links**. This means if you click on a link and make a purchase, we may receive a small commission — at no additional cost to you. We only recommend products and services that we have personally tested and believe provide genuine value.

All affiliate links include the attribute \`rel="nofollow"\` or \`rel="noopener nofollow"\` as required. Our editorial recommendations are never influenced by commercial relationships.

This affiliate disclosure complies with the [FTC's guidelines on endorsements and testimonials](https://www.ftc.gov/legal-library/browse/rules/guides-use-endorsements-testimonials-advertising).

## 4. How We Use Your Information

We use the information we collect to:
- Respond to your enquiries and messages
- Send newsletters you have opted into
- Understand how our content is being used to improve it
- Display relevant advertisements via Google AdSense
- Comply with legal obligations

We do **not** sell, rent, or trade your personal information to any third party.

## 5. Third-Party Services

| Service | Purpose | Privacy Policy |
|---------|---------|---------------|
| Google AdSense | Display advertising | [policies.google.com](https://policies.google.com/privacy) |
| Google Analytics | Site analytics | [policies.google.com](https://policies.google.com/privacy) |
| Formsubmit.co | Contact form delivery | [formsubmit.co/privacy](https://formsubmit.co/privacy) |
| GitHub Pages | Website hosting | [docs.github.com](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement) |
| Unsplash | Stock photography | [unsplash.com/privacy](https://unsplash.com/privacy) |

## 6. Data Retention

- **Contact form submissions**: Retained in our email inbox for up to 2 years, then deleted.
- **Analytics data**: Google Analytics retains data for 14 months by default.
- **Cookie consent**: Stored in your browser's localStorage until you clear it.

## 7. Your Rights

Depending on your location, you may have the following rights regarding your personal data:

- **Access**: Request a copy of the personal data we hold about you
- **Rectification**: Request correction of inaccurate data
- **Erasure**: Request deletion of your personal data
- **Objection**: Object to processing of your personal data
- **Portability**: Request transfer of your data to another service
- **Withdraw consent**: Withdraw consent at any time where processing is based on consent

To exercise any of these rights, contact us at **itsoftsloutions@gmail.com**. We will respond within **30 days**.

If you are in the EU/EEA and believe we have not handled your data correctly, you have the right to lodge a complaint with your local supervisory authority.

## 8. Children's Privacy

This website is not directed at children under the age of 13. We do not knowingly collect personal information from children under 13. If you believe a child has provided us with personal information, please contact us immediately at itsoftsloutions@gmail.com.

## 9. Do Not Track

Some browsers send "Do Not Track" signals. We do not currently respond to DNT signals as there is no industry-standard approach to these signals. Third-party services (Google AdSense, Google Analytics) have their own DNT policies.

## 10. Security

We implement reasonable technical and organisational measures to protect your information. However, no method of transmission over the internet is 100% secure. We cannot guarantee absolute security.

## 11. Changes to This Policy

We may update this Privacy Policy periodically. We will notify users by updating the "Last updated" date at the top of this page. We recommend reviewing this page periodically. Continued use of the site after changes constitutes acceptance of the updated policy.

## 12. Contact Us

If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact:

**Kanav Sharma**
**Email**: [itsoftsloutions@gmail.com](mailto:itsoftsloutions@gmail.com)
**Website**: ${site.url}/
**Response time**: Within 2 business days`;

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

## Follow us

Stay updated with new AI income guides:

- X / Twitter: [@kanavy9ah](https://x.com/kanavy9ah)`;

const TERMS_MD = `**Last updated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}**

## 1. Acceptance of Terms

By accessing and using ${site.name} (the "Website"), you accept and agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Website.

## 2. Use of the Website

You may use the Website for lawful purposes only. You agree not to:

- Use the Website in any way that violates any applicable law or regulation
- Attempt to gain unauthorized access to any portion of the Website
- Use automated systems to access or collect data from the Website without our written permission
- Interfere with or disrupt the Website or servers

## 3. Content

### Our Content

All content on this Website, including articles, guides, images, and graphics, is owned by or licensed to ${site.name}. You may not reproduce, distribute, or create derivative works without our written permission.

### User-Generated Content

If you submit comments or other content, you grant us a non-exclusive, royalty-free, perpetual, irrevocable, and fully sublicensable right to use, reproduce, modify, adapt, publish, translate, create derivative works from, distribute, and display such content.

## 4. Accuracy of Information

We strive to provide accurate and up-to-date information, but we make no warranties or representations about the accuracy, reliability, completeness, or timeliness of the content. The information on this Website is provided for general informational purposes only.

## 5. Affiliate Disclosure

This Website contains affiliate links. If you purchase through these links, we may earn a commission at no additional cost to you. See our [Privacy Policy](/privacy/) for more details on our affiliate relationships.

## 6. Limitation of Liability

To the fullest extent permitted by law, ${site.name} shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses resulting from:

- Your use of or inability to use the Website
- Any unauthorized access to or use of our servers
- Any interruption or cessation of transmission
- Any bugs, viruses, or other harmful code

## 7. Indemnification

You agree to indemnify, defend, and hold harmless ${site.name}, its officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, and expenses arising out of your use of the Website or violation of these Terms.

## 8. Changes to Terms

We reserve the right to modify these Terms at any time. Changes will be effective immediately upon posting on this page. Your continued use of the Website after any changes constitutes acceptance of the new Terms.

## 9. Governing Law

These Terms are governed by and construed in accordance with applicable laws, without regard to conflict of law principles.

## 10. Contact

If you have questions about these Terms, please contact us at [itsoftsloutions@gmail.com](mailto:itsoftsloutions@gmail.com).`;

// ── Premium CSS ───────────────────────────────────────────────────────────────
const PREMIUM_CSS = `
/* ─── Design tokens — Light (default) ─── */
:root{
  --bg:#f6f8fa;
  --surface:#ffffff;
  --surface2:#f0f2f5;
  --border:#d0d7de;
  --ink:#1a1f2e;
  --muted:#636e7b;
  --accent:#0969da;
  --accent2:#1a7f37;
  --hero-gradient:linear-gradient(135deg,#dff0ff 0%,#f6f8fa 60%,#e8f5e9 100%);
  --card-hover:#f0f2f5;
  --radius:12px;
  --radius-lg:20px;
  --shadow:0 4px 24px rgba(0,0,0,.08);
  --shadow-card:0 2px 12px rgba(0,0,0,.06);
  --font-sans:'Inter',system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
  --font-serif:'Playfair Display',Georgia,serif;
  --transition:.18s ease;
}
/* ─── Dark theme ─── */
[data-theme="dark"]{
  --bg:#0d1117;
  --surface:#161b22;
  --surface2:#1c2330;
  --border:#30363d;
  --ink:#e6edf3;
  --muted:#8b949e;
  --accent:#58a6ff;
  --accent2:#3fb950;
  --hero-gradient:linear-gradient(135deg,#0d1117 0%,#162032 50%,#0d1117 100%);
  --card-hover:#1c2330;
  --shadow:0 4px 24px rgba(0,0,0,.4);
  --shadow-card:0 2px 12px rgba(0,0,0,.3);
}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{background:var(--bg);color:var(--ink);font-family:var(--font-sans);font-size:16px;line-height:1.7;-webkit-font-smoothing:antialiased;transition:background var(--transition),color var(--transition)}
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
.top-bar{background:var(--accent);border-bottom:1px solid var(--border);padding:8px 0;font-size:13px;color:#fff}
.top-bar .wrap-wide{display:flex;justify-content:space-between;align-items:center;gap:12px}
.top-bar a{color:#fff;font-weight:600}
.top-bar-cta{background:rgba(255,255,255,.2);color:#fff!important;padding:3px 12px;border-radius:20px;font-weight:700;font-size:12px;border:1px solid rgba(255,255,255,.4)}

/* ─── Header ─── */
.site-header{position:sticky;top:0;z-index:100;background:rgba(246,248,250,.95);backdrop-filter:blur(12px);border-bottom:1px solid var(--border)}
[data-theme="dark"] .site-header{background:rgba(13,17,23,.95)}
.header-inner{display:flex;align-items:center;gap:20px;padding-top:14px;padding-bottom:14px}
.brand{display:flex;align-items:center;gap:8px;color:var(--ink)!important;font-weight:800;font-size:20px}
.brand-icon{font-size:22px}
.site-nav{display:flex;gap:4px;margin-left:auto}
.site-nav a{color:var(--muted);font-size:14px;font-weight:500;padding:6px 10px;border-radius:6px;transition:background var(--transition),color var(--transition)}
.site-nav a:hover{color:var(--ink);background:var(--surface2)}
.header-cta{background:var(--accent);color:#fff!important;padding:7px 16px;border-radius:8px;font-weight:700;font-size:13px;white-space:nowrap}
.header-cta:hover{opacity:.88;text-decoration:none}
.nav-toggle{display:none;background:none;border:1px solid var(--border);color:var(--ink);padding:6px 10px;border-radius:6px;cursor:pointer;font-size:18px}
.mobile-nav{display:none;flex-direction:column;background:var(--surface);border-bottom:1px solid var(--border);box-shadow:var(--shadow)}
.mobile-nav.open{display:flex}
.mobile-nav a{padding:14px 24px;border-bottom:1px solid var(--border);color:var(--ink);font-weight:500}
@media(max-width:768px){.site-nav,.header-cta{display:none}.nav-toggle{display:block}}

/* ─── Hero ─── */
.hero{background:var(--hero-gradient);border-bottom:1px solid var(--border);padding:60px 0}
.hero-inner{display:grid;grid-template-columns:1fr 420px;gap:48px;align-items:center}
@media(max-width:900px){.hero-inner{grid-template-columns:1fr}}
.hero-badge{display:inline-block;background:rgba(63,185,80,.15);color:var(--accent2);border:1px solid rgba(63,185,80,.3);padding:4px 12px;border-radius:20px;font-size:13px;font-weight:600;margin-bottom:16px}
.hero h1{font-family:var(--font-serif);font-size:clamp(30px,4vw,48px);font-weight:800;line-height:1.15;margin-bottom:16px;background:linear-gradient(135deg,var(--ink),var(--accent));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
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
.content h3{font-size:20px;margin:28px 0 10px;color:var(--accent)}
.content p{margin:16px 0;color:var(--ink);line-height:1.8;opacity:.88}
.content a{color:var(--accent);border-bottom:1px solid rgba(9,105,218,.25)}
[data-theme="dark"] .content a{border-bottom-color:rgba(88,166,255,.3)}
.content a:hover{border-color:var(--accent)}
.content ul,.content ol{margin:16px 0;padding-left:24px;color:var(--ink);opacity:.88}
.content li{margin:8px 0}
.content blockquote{margin:24px 0;padding:16px 20px;border-left:3px solid var(--accent);background:var(--surface2);border-radius:0 var(--radius) var(--radius) 0}
.content blockquote p{margin:0;color:var(--muted);opacity:1}
.content pre{background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);padding:18px;overflow:auto;margin:20px 0}
.content code{background:var(--surface2);border:1px solid var(--border);border-radius:5px;padding:2px 6px;font-size:13px;font-family:'JetBrains Mono',Consolas,monospace}
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

/* ─── Structured affiliate tools block ─── */
.aff-tools{margin:32px 0;padding:20px;border:1px solid var(--border);border-radius:var(--radius-lg);background:var(--surface2)}
.aff-tools-head{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:6px;margin-bottom:14px}
.aff-tools-title{font-weight:800;font-size:15px;color:var(--ink)}
.aff-tools-note{font-size:11px;color:var(--muted)}
.aff-tools-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
.aff-card{position:relative;display:flex;flex-direction:column;gap:8px;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px 16px;text-decoration:none;transition:border-color var(--transition),transform var(--transition)}
.aff-card:hover{border-color:var(--accent);transform:translateY(-2px);text-decoration:none}
.aff-card-badge{align-self:flex-start;background:var(--accent);color:#0d1117;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;text-transform:uppercase;letter-spacing:.3px}
.aff-card-label{font-weight:700;font-size:14px;color:var(--ink);line-height:1.35}
.aff-card-cta{font-size:12px;font-weight:700;color:var(--accent)}
.internal-link{color:var(--accent);text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:2px}
.internal-link:hover{text-decoration-thickness:2px}

/* ─── Email capture ─── */
.email-box{background:linear-gradient(135deg,var(--accent),#0d47a1);border:none;border-radius:var(--radius-lg);padding:28px;text-align:center;margin:32px 0;color:#fff}
.email-box h3,.email-box p{color:#fff!important}
[data-theme="dark"] .email-box{background:linear-gradient(135deg,#1a3a5c,#162032);border:1px solid rgba(88,166,255,.3)}
.email-icon{font-size:36px;margin-bottom:10px}
.email-box h3{font-family:var(--font-serif);font-size:22px;margin-bottom:8px}
.email-box p{color:var(--muted);margin-bottom:16px}
.email-form,.email-form-inline{display:flex;gap:8px;flex-wrap:wrap}
.email-form{flex-direction:column}
.email-form input,.email-form-inline input{flex:1;min-width:0;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.4);color:#fff;padding:10px 14px;border-radius:8px;font-size:14px;outline:none}
.email-form input::placeholder,.email-form-inline input::placeholder{color:rgba(255,255,255,.7)}
.email-form input:focus,.email-form-inline input:focus{border-color:#fff;background:rgba(255,255,255,.2)}
.email-compact .email-form-inline input{background:var(--surface2);border:1px solid var(--border);color:var(--ink)}
.email-compact .email-form-inline input::placeholder{color:var(--muted)}
.email-form button,.email-form-inline button{background:#fff;color:var(--accent);border:none;padding:10px 20px;border-radius:8px;font-weight:700;font-size:14px;cursor:pointer;white-space:nowrap}
.email-form button:hover,.email-form-inline button:hover{background:#f0f2f5}
.email-compact .email-form-inline button{background:var(--accent);color:#fff}
.email-fine{font-size:12px;color:var(--muted);margin-top:8px!important}
.form-status{padding:12px 16px;border-radius:var(--radius);font-size:14px;font-weight:600;margin:8px 0}
.form-status-ok{background:rgba(63,185,80,.12);color:#1a7f37;border:1px solid rgba(63,185,80,.4)}
.form-status-err{background:rgba(207,34,46,.1);color:#cf222e;border:1px solid rgba(207,34,46,.35)}
.email-compact{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px}
.email-compact p{font-size:13px;color:var(--muted);margin-bottom:10px}

/* ─── Support widget ─── */
.widget-support a{display:inline-block;font-size:13px;color:var(--accent);margin:4px 0}

/* ─── Ads ─── */
.ad-wrap{margin:24px 0;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);padding:12px;min-height:90px}
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
.consult-btn{display:inline-block;background:#fff;color:var(--accent)!important;padding:8px 16px;border-radius:8px;font-weight:700;font-size:13px;transition:background var(--transition)}
.consult-btn:hover{background:#f0f2f5;text-decoration:none}
.consult-banner{background:linear-gradient(135deg,var(--accent),#0d47a1);border:none;border-radius:var(--radius-lg);padding:28px;text-align:center;margin:32px 0;color:#fff}
.consult-banner h3,.consult-banner p{color:#fff!important}
[data-theme="dark"] .consult-banner{background:linear-gradient(135deg,#1a3a5c,#162032);border:1px solid rgba(88,166,255,.3)}
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
.contact-form input,.contact-form select,.contact-form textarea{background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--ink);padding:10px 14px;font-size:14px;font-family:var(--font-sans);outline:none;transition:border-color var(--transition)}
.contact-form input:focus,.contact-form select:focus,.contact-form textarea:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(9,105,218,.1)}
[data-theme="dark"] .contact-form input:focus,[data-theme="dark"] .contact-form textarea:focus{box-shadow:0 0 0 3px rgba(88,166,255,.15)}
[data-theme="dark"] .step-guide li{background:var(--surface);border-color:var(--border)}
[data-theme="dark"] .step-guide li:hover{border-color:var(--accent)}
[data-theme="dark"] .callout{background:var(--surface);border-color:var(--border)}
[data-theme="dark"] .callout-tip{background:rgba(63,185,80,.08);border-left-color:var(--accent2)}
[data-theme="dark"] .callout-warning{background:rgba(210,153,34,.08)}
[data-theme="dark"] .callout-info{background:rgba(88,166,255,.08);border-left-color:var(--accent)}
[data-theme="dark"] .mermaid{background:var(--surface);border-color:var(--border)}

/* ─── Rich Text Editor ─── */
.editor-meta{display:grid;grid-template-columns:1fr 200px 1fr;gap:16px;margin-bottom:20px}
@media(max-width:768px){.editor-meta{grid-template-columns:1fr}}
.editor-label{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}
.editor-input{background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--ink);padding:10px 14px;font-size:14px;font-family:var(--font-sans);outline:none;transition:border-color var(--transition)}
.editor-input:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(9,105,218,.1)}
[data-theme="dark"] .editor-input:focus{box-shadow:0 0 0 3px rgba(88,166,255,.15)}
.editor-frontmatter-hint{font-size:12px;color:var(--muted);margin-bottom:16px}
.editor-actions{display:flex;gap:10px;align-items:center;margin-top:20px;flex-wrap:wrap}
.editor-btn{border:none;padding:10px 20px;border-radius:8px;font-weight:700;font-size:14px;cursor:pointer;font-family:var(--font-sans);transition:opacity var(--transition)}
.editor-btn:hover{opacity:.85}
.editor-btn-save{background:var(--accent);color:#fff}
.editor-btn-download{background:var(--accent2);color:#fff}
.editor-btn-clear{background:var(--surface2);color:var(--ink);border:1px solid var(--border)}
.editor-status{font-size:13px;color:var(--muted);margin-left:auto}
.editor-help{margin-top:48px;padding-top:32px;border-top:1px solid var(--border)}
.editor-help h3{font-family:var(--font-serif);font-size:22px;margin-bottom:20px}
.editor-help-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px}
.editor-help-item{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:18px}
.editor-help-item strong{display:block;margin-bottom:8px;color:var(--accent)}
.editor-help-item p{font-size:14px;color:var(--muted);margin:0}
.editor-code{background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:10px 14px;font-size:12px;font-family:'JetBrains Mono',Consolas,monospace;margin:0;white-space:pre-wrap;color:var(--ink)}
.EasyMDEContainer{--bg:var(--surface);--border:var(--border)}
.EasyMDEContainer .editor-toolbar{background:var(--surface2);border:1px solid var(--border);border-radius:8px 8px 0 0}
.EasyMDEContainer .editor-toolbar button{color:var(--ink)}
.EasyMDEContainer .CodeMirror{background:var(--surface);color:var(--ink);border:1px solid var(--border);border-top:none;border-radius:0 0 8px 8px;font-family:'JetBrains Mono',Consolas,monospace;font-size:14px}
.EasyMDEContainer .CodeMirror-cursor{border-left-color:var(--accent)}
.EasyMDEContainer .editor-preview{background:var(--surface);padding:20px;border:1px solid var(--border);border-top:none}
.EasyMDEContainer .editor-preview-side{border-left:1px solid var(--border)}
[data-theme="dark"] .EasyMDEContainer .editor-toolbar{background:var(--surface2)}
[data-theme="dark"] .EasyMDEContainer .CodeMirror{background:var(--surface);color:var(--ink)}
.contact-form textarea{resize:vertical}
.contact-submit{background:var(--accent);color:#fff;border:none;padding:12px 24px;border-radius:8px;font-weight:700;font-size:15px;cursor:pointer;align-self:flex-start;transition:opacity var(--transition)}
.contact-submit:hover{opacity:.88}

/* ─── Theme toggle button ─── */
.theme-toggle{background:none;border:1px solid var(--border);color:var(--ink);width:34px;height:34px;border-radius:8px;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;transition:border-color var(--transition),background var(--transition);flex-shrink:0}
.theme-toggle:hover{background:var(--surface2);border-color:var(--accent)}

/* ─── Reading progress bar ─── */
#read-progress{position:fixed;top:0;left:0;height:3px;width:0%;background:linear-gradient(90deg,#58a6ff,#3fb950);z-index:9999;transition:width .1s linear;border-radius:0 2px 2px 0}

/* ─── Back to top ─── */
#back-top{position:fixed;bottom:24px;right:24px;z-index:999;background:var(--accent);color:#fff;border:none;width:40px;height:40px;border-radius:50%;font-size:18px;cursor:pointer;display:none;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(9,105,218,.25);transition:opacity var(--transition),transform var(--transition)}
#back-top:hover{opacity:.88;transform:translateY(-2px)}
#back-top.visible{display:flex}

/* ─── Cookie banner ─── */
.cookie-banner{position:fixed;bottom:0;left:0;right:0;z-index:9999;background:var(--surface);border-top:1px solid var(--border);padding:14px 24px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;box-shadow:0 -4px 20px rgba(0,0,0,.4)}
.cookie-banner p{margin:0;font-size:13px;color:var(--muted);flex:1}
.cookie-banner p a{color:var(--accent)}
.cookie-btns{display:flex;gap:10px;align-items:center;flex-shrink:0}
.cookie-accept{background:var(--accent);color:#fff;border:none;padding:7px 18px;border-radius:8px;font-weight:700;font-size:13px;cursor:pointer}
.cookie-accept:hover{opacity:.88}
.cookie-more{font-size:12px;color:var(--muted)}

/* ─── Footer improvements ─── */
.footer-desc{font-size:12px;color:var(--muted);margin-top:4px!important;margin-bottom:12px!important;line-height:1.5}
.footer-nav-col{display:flex;flex-direction:column;gap:8px}
.footer-nav-col a{color:var(--muted);font-size:13px;transition:color var(--transition)}
.footer-nav-col a:hover{color:var(--ink)}
.footer-bottom{border-top:1px solid var(--border);padding:20px 0;text-align:center}

/* ─── Social Share ─── */
.social-share{margin:32px 0 24px;padding:20px 24px;background:var(--surface2);border-radius:var(--radius);display:flex;align-items:center;gap:16px;flex-wrap:wrap}
.social-share-label{font-size:13px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.5px}
.social-share-btns{display:flex;gap:8px;flex-wrap:wrap}
.share-btn{display:inline-flex;align-items:center;justify-content:center;min-width:44px;padding:8px 14px;font-size:13px;font-weight:600;border-radius:6px;border:1px solid var(--border);background:var(--surface);color:var(--ink);cursor:pointer;transition:all var(--transition);font-family:var(--font-sans)}
.share-btn:hover{background:var(--accent);color:#fff;border-color:var(--accent)}
.share-cp{font-size:12px}
@media(max-width:600px){.social-share{flex-direction:column;align-items:flex-start;gap:12px}}
.footer-legal{margin-top:8px;font-size:12px}
.footer-legal a{color:var(--muted)}
.footer-legal a:hover{color:var(--accent)}

/* ─── Mermaid flow diagrams ─── */
.mermaid{margin:24px 0;padding:24px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);overflow:auto;text-align:center}
.mermaid svg{max-width:100%;height:auto}

/* ─── Step-by-step guides ─── */
.step-guide{counter-reset:step;list-style:none;padding:0;margin:28px 0}
.step-guide li{counter-increment:step;position:relative;padding:16px 20px 16px 56px;margin-bottom:12px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);font-size:15px;line-height:1.7;transition:border-color var(--transition),box-shadow var(--transition)}
.step-guide li::before{content:counter(step);position:absolute;left:0;top:0;bottom:0;width:40px;display:flex;align-items:center;justify-content:center;background:var(--accent);color:#fff;font-weight:800;font-size:16px;border-radius:var(--radius) 0 0 var(--radius)}
.step-guide li:hover{border-color:var(--accent);box-shadow:var(--shadow-card)}
.step-guide li strong{color:var(--accent)}

/* ─── Callout blocks (::: tip, ::: warning, etc.) ─── */
.callout{display:flex;gap:14px;padding:18px 20px;margin:24px 0;border-radius:var(--radius);border:1px solid var(--border);background:var(--surface)}
.callout-icon{font-size:24px;flex-shrink:0;margin-top:2px}
.callout-body{flex:1;min-width:0}
.callout-body p{margin:6px 0}
.callout-tip{border-left:4px solid var(--accent2);background:rgba(63,185,80,.06)}
.callout-warning{border-left:4px solid #d29922;background:rgba(210,153,34,.06)}
.callout-info{border-left:4px solid var(--accent);background:rgba(9,105,218,.06)}
.callout-danger{border-left:4px solid #cf222e;background:rgba(207,34,46,.06)}
.callout-note{border-left:4px solid var(--muted);background:var(--surface2)}

/* ─── SVG hero images ─── */
.post-hero-svg{min-height:340px;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden}
.post-hero-svg img{width:100%;height:340px;object-fit:cover;border-radius:0}
.post-hero-svg .post-hero-overlay{position:absolute;inset:0;background:linear-gradient(to top,rgba(13,17,23,.92) 0%,rgba(13,17,23,.45) 100%);display:flex;align-items:flex-end}
.post-hero-svg .post-hero-overlay>div{padding-bottom:36px;width:100%}
`;


build();
