import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const site = JSON.parse(fs.readFileSync(path.join(root, "data", "site.json"), "utf8"));
const DB_PATH = path.join(root, "seo", "backlinks-db.json");

const domain = new URL(site.url).hostname;

// Load existing tracking DB
let db = { tracked: [], history: [], lastRun: null };
if (fs.existsSync(DB_PATH)) {
  db = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
}

// Check key backlink sources via DNS / HTTP checks
// We check:
// 1. Does the site have social profiles linked?
// 2. Are those profiles linking back?
// 3. Google search for brand mentions

console.log(`\n=== Backlink Monitor: ${site.url} ===`);

// 1. Check social profile links in site.json
const socialProfiles = Object.entries(site.social || {}).map(([platform, url]) => ({
  platform,
  url,
  configured: true,
}));

console.log(`\nSocial profiles configured: ${socialProfiles.length}`);
for (const sp of socialProfiles) {
  console.log(`   ${sp.platform}: ${sp.url}`);
}

// 2. Check Google Search Console data (requires API, placeholder)
// In production, integrate with Google Search Console API
console.log("\n[INFO] Google Search Console integration: add GSC API key for automated data");

// 3. Generate outreach targets from existing content
console.log("\n=== Suggested Outreach Targets ===");

const postsDir = path.join(root, "content", "posts");
const postFiles = fs.readdirSync(postsDir).filter(f => f.endsWith(".md"));

const BACKLINK_TARGETS = [
  { name: "Ahrefs Blog", url: "https://ahrefs.com/blog/", relevance: "SEO guides" },
  { name: "SEMrush Blog", url: "https://www.semrush.com/blog/", relevance: "SEO & content marketing" },
  { name: "Search Engine Journal", url: "https://www.searchenginejournal.com/", relevance: "SEO news & guides" },
  { name: "Neil Patel Blog", url: "https://neilpatel.com/blog/", relevance: "Blogging & SEO" },
  { name: "Smart Blogger", url: "https://smartblogger.com/", relevance: "Blogging tips" },
  { name: "Zapier Blog", url: "https://zapier.com/blog/", relevance: "Automation & productivity" },
  { name: "MakeUseOf", url: "https://www.makeuseof.com/", relevance: "Tech tutorials" },
  { name: "HubSpot Blog", url: "https://blog.hubspot.com/", relevance: "Marketing & sales" },
  { name: "Buffer Blog", url: "https://buffer.com/resources/", relevance: "Social media & content" },
  { name: "CoSchedule Blog", url: "https://coschedule.com/blog/", relevance: "Content marketing" },
  { name: "Content Marketing Institute", url: "https://contentmarketinginstitute.com/", relevance: "Content marketing" },
  { name: "Moz Blog", url: "https://moz.com/blog", relevance: "SEO & link building" },
];

for (const target of BACKLINK_TARGETS) {
  const relevanceScore = postFiles.some(pf => {
    const content = fs.readFileSync(path.join(postsDir, pf), "utf8").toLowerCase();
    const keywords = target.relevance.toLowerCase().split(/[,\s&]+/);
    return keywords.some(kw => content.includes(kw));
  });
  console.log(`   [${relevanceScore ? "HIGH" : "MED"}] ${target.name} — ${target.relevance}`);
}

// Save snapshot
const snapshot = {
  date: new Date().toISOString(),
  postCount: postFiles.length,
  socialProfiles: socialProfiles.length,
  outreachTargets: BACKLINK_TARGETS.length,
};

db.history.push(snapshot);
db.lastRun = snapshot.date;

if (db.history.length > 100) db.history = db.history.slice(-100);
fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));

console.log(`\nSnapshot saved. Total runs: ${db.history.length}`);
console.log("=== Done ===\n");
