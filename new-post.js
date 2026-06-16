// Publishes the next queued topic as a Markdown post.
// Run on a schedule (e.g. every 2 hours) via `npm run autopublish`.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = __dirname;
const POSTS_DIR = path.join(root, "content", "posts");
const TOPICS = path.join(root, "content", "topics.json");
const STATE = path.join(root, "data", "state.json");

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 70);
}
function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE, "utf8")); }
  catch { return { cursor: 0, published: [] }; }
}
function saveState(s) {
  fs.mkdirSync(path.dirname(STATE), { recursive: true });
  fs.writeFileSync(STATE, JSON.stringify(s, null, 2));
}

function expandPoints(points) {
  return points.map((p) => `- ${p}.`).join("\n");
}

function renderBody(topic, dateISO) {
  const kw = topic.keywords || [];
  const primary = kw[0] || topic.title.toLowerCase();
  const parts = [];

  parts.push(`If you are searching for **${primary}**, this guide gives you a practical, tested path — not hype. ${topic.intent || ""}`.trim());
  parts.push(`We keep it concrete: what to use, how to set it up, and what results are realistic. Everything below is written to be useful first and to stay accurate as tools change.`);

  for (const sec of topic.sections || []) {
    parts.push(`## ${sec.h}`);
    parts.push(`${sec.h} matters because it is where most people either gain an edge or waste time. Here is what to focus on:`);
    parts.push(expandPoints(sec.points || []));
  }

  // FAQ for SEO (FAQ-style content earns featured snippets)
  parts.push(`## Frequently asked questions`);
  parts.push(`**Is this realistic for a beginner?** Yes. Start with one tool and one goal, then expand only what works.`);
  parts.push(`**How long until results?** Most durable results take 1-3 months of consistent effort. Anyone promising overnight income is selling something.`);
  parts.push(`**Do I need to pay for tools?** No. Free tiers are enough to validate the idea before you spend anything.`);

  parts.push(`## The bottom line`);
  parts.push(`The winners in ${primary} are not the people with the most tools — they are the ones who pick one approach and stay consistent. Choose a single next step from this guide and do it today.`);
  parts.push(`*Last updated: ${dateISO}.*`);

  return parts.join("\n\n");
}

function main() {
  const topics = JSON.parse(fs.readFileSync(TOPICS, "utf8"));
  if (!topics.length) { console.error("No topics in queue."); process.exit(1); }
  const state = loadState();
  fs.mkdirSync(POSTS_DIR, { recursive: true });

  const dateISO = new Date().toISOString().slice(0, 10);
  const topic = topics[state.cursor % topics.length];
  const refreshRound = Math.floor(state.cursor / topics.length); // 0 first pass, then 1,2...

  let baseSlug = slugify(topic.title);
  let slug = baseSlug;
  // Avoid overwriting earlier passes: append year/refresh suffix when re-publishing.
  if (refreshRound > 0 || fs.existsSync(path.join(POSTS_DIR, `${slug}.md`))) {
    slug = `${baseSlug}-${dateISO}`;
  }

  const title = refreshRound > 0 ? `${topic.title} (Updated ${dateISO})` : topic.title;
  const fm = [
    "---",
    `title: "${title.replace(/"/g, "'")}"`,
    `description: "${(topic.description || "").replace(/"/g, "'")}"`,
    `slug: "${slug}"`,
    `category: "${topic.category}"`,
    `date: "${dateISO}"`,
    `keywords: [${(topic.keywords || []).map((k) => `"${k}"`).join(", ")}]`,
    "---",
    "",
  ].join("\n");

  const body = renderBody(topic, dateISO);
  const file = path.join(POSTS_DIR, `${slug}.md`);
  fs.writeFileSync(file, fm + body + "\n");

  state.cursor += 1;
  state.published.push({ slug, title, date: dateISO });
  saveState(state);

  console.log(`Published: ${slug}.md  (queue cursor now ${state.cursor})`);
}

main();
