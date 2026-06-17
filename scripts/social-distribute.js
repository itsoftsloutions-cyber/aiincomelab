// CLI: distribute published post(s) to all social platforms.
//
//   node scripts/social-distribute.js            # most recent published post
//   node scripts/social-distribute.js <slug>     # a specific slug
//   SOCIAL_DRY_RUN=1 node scripts/social-distribute.js   # print captions, no API calls
//
// A de-dup ledger (data/social-log.json) records which slugs have already been
// posted so re-runs (e.g. repeated CI invocations) don't double-post.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseFrontmatter } from "../lib/markdown.js";
import { distribute } from "../lib/social-poster.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const POSTS_DIR = path.join(root, "content", "posts");
const STATE = path.join(root, "data", "state.json");
const SITE = path.join(root, "data", "site.json");
const LOG = path.join(root, "data", "social-log.json");

function readJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return fallback; }
}

function loadLog() { return readJson(LOG, { posted: [] }); }
function saveLog(log) {
  fs.mkdirSync(path.dirname(LOG), { recursive: true });
  fs.writeFileSync(LOG, JSON.stringify(log, null, 2) + "\n");
}

function postUrl(site, slug) {
  const base = String(site.url || "").replace(/\/+$/, "");
  return `${base}/posts/${slug}/`;
}

function loadPost(slug) {
  const file = path.join(POSTS_DIR, `${slug}.md`);
  if (!fs.existsSync(file)) throw new Error(`post not found: ${file}`);
  const { data, body } = parseFrontmatter(fs.readFileSync(file, "utf8"));
  const description =
    data.description ||
    body.replace(/^#.*$/gm, "").replace(/[*_>#`]/g, "").trim().split("\n").find((l) => l.trim())?.slice(0, 200) ||
    data.title;
  return {
    slug: data.slug || slug,
    title: data.title || slug,
    description,
    image: data.image || "",
    keywords: Array.isArray(data.keywords) ? data.keywords : [],
  };
}

async function main() {
  const site = readJson(SITE, { url: "" });
  const state = readJson(STATE, { published: [] });
  const arg = process.argv[2];

  let slug = arg;
  if (!slug) {
    const last = state.published[state.published.length - 1];
    if (!last) { console.error("No published posts in state.json."); process.exit(1); }
    slug = last.slug;
  }

  const log = loadLog();
  const force = process.env.SOCIAL_FORCE === "1";
  if (!force && log.posted.some((p) => p.slug === slug)) {
    console.log(`Already distributed: ${slug} (set SOCIAL_FORCE=1 to repost). Skipping.`);
    return;
  }

  const post = loadPost(slug);
  post.url = postUrl(site, post.slug);

  console.log(`Distributing: ${post.title}\n  → ${post.url}`);
  const results = await distribute(post);

  let anyOk = false;
  for (const r of results) {
    const detail = r.status === "ok" ? `id=${r.id}` :
      r.reason ? r.reason :
      r.code ? `HTTP ${r.code}` :
      r.error ? r.error : "";
    console.log(`  [${r.platform}] ${r.status}${detail ? " — " + detail : ""}`);
    if (r.status === "dry-run" && r.preview) {
      console.log(r.preview.split("\n").map((l) => "      | " + l).join("\n"));
    }
    if (r.status === "ok" || r.status === "dry-run") anyOk = true;
  }

  if (process.env.SOCIAL_DRY_RUN !== "1" && results.some((r) => r.status === "ok")) {
    log.posted.push({ slug, at: new Date().toISOString(), results: results.map((r) => ({ platform: r.platform, status: r.status })) });
    saveLog(log);
  }

  if (!anyOk) {
    console.log("\nNo platforms posted. Configure credentials as env vars / CI secrets to enable.");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
