// Publishes the next queued topic as a Markdown post.
// Run on a schedule (e.g. every 2 hours) via GitHub Actions.
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

// Natural intro pool — each reads like a person wrote it for this specific topic
function pickIntro(topic) {
  const kw = (topic.keywords || [])[0] || topic.title.toLowerCase();
  const pool = [
    `I have spent time testing different approaches to **${kw}**, and the honest answer is that most advice out there sounds right but misses the practical details. This guide covers what I actually found useful — the specific steps, the gotchas, and what to expect.`,
    `If you have been reading up on **${kw}**, you have probably noticed most guides either oversimplify or overcomplicate it. I wanted to write something in between: detailed enough to be useful, direct enough to finish in one sitting.`,
    `A reader asked me recently about **${kw}**. After explaining it a few times, I realized I should just put everything in one place. Here is the full breakdown — no fluff, no gatekeeping, just what works.`,
    `Here is what I wish someone had told me about **${kw}** when I started: it is simpler than the internet makes it seem, but harder than a five-step list suggests. The difference between success and frustration comes down to a few specific decisions.`,
    `I see people overcomplicate **${kw}** all the time — buying expensive tools before they have a working process, planning for months instead of starting small. This guide takes the opposite approach: do what works first, then optimize.`,
  ];
  return pool[topic.keywords.length % pool.length];
}

function renderFaq(faqs) {
  const parts = [`## Frequently asked questions`];
  for (const faq of faqs) {
    parts.push(`**${faq.q}**\n\n${faq.a}`);
  }
  return parts.join("\n\n");
}

function renderBody(topic, dateISO, cursorPos) {
  const parts = [];

  // Natural intro
  parts.push(pickIntro(topic));

  // Main sections — render the detailed section content as-is
  for (const sec of topic.sections || []) {
    const sectionParts = [`## ${sec.h}`];
    for (const point of sec.points || []) {
      sectionParts.push(point);
    }
    parts.push(sectionParts.join("\n\n"));
  }

  // Per-topic FAQ with category fallback
  const cat = topic.category || "guides";
  let faqs = topic.faqs;
  if (!faqs || !faqs.length) {
    const fallback = {
      "make-money": [
        { q: "How long does it realistically take to earn money?", a: "For most people: 2–4 weeks to set up, 1–3 months to see consistent traffic, and 3–6 months to reach $100+/month if publishing at least two posts per week." },
        { q: "Do I need to invest money to start?", a: "You can start with free tools: GitHub Pages for hosting, Google Search Console for SEO, and Google AdSense for monetization. Paid tools help but are not necessary in the first three months." },
        { q: "Which income stream should I start with first?", a: "Start with AdSense — it requires no selling and pays passively on traffic. Add affiliate links once you have steady monthly visitors." },
      ],
      "ai-tools": [
        { q: "Are free AI tools good enough for a blog?", a: "For most beginners, yes. ChatGPT (free tier), Gemini, and Claude all produce usable first drafts. The important part is editing for your own voice." },
        { q: "Will Google penalize AI-generated content?", a: "Google penalizes thin, unhelpful content — not content made with AI. Posts that are well-edited, fact-checked, and genuinely helpful rank regardless of how they were drafted." },
        { q: "Which AI tool is best for blogging?", a: "Claude and ChatGPT for long-form content, Canva for images, and Otter.ai for transcription. Pick one writing tool and learn it well." },
      ],
      "productivity": [
        { q: "How much time can AI productivity tools actually save?", a: "Most people who integrate AI into their workflow report saving 4–8 hours per week. The biggest gains come from automating research, drafting, and scheduling." },
        { q: "Can AI help me publish more consistently?", a: "Yes — batch-creating outlines and first drafts with AI means you always have something to edit. The bottleneck becomes editing, not starting from scratch." },
      ],
      "guides": [
        { q: "Where should a complete beginner start?", a: "Pick one topic, write 10 posts, publish them on a free site, and submit your sitemap to Google Search Console. Do this before buying any tools or courses." },
        { q: "How do I know if my blog is working?", a: "Watch three metrics: impressions in Search Console (SEO traction), time-on-page (content quality), and email subscribers (audience trust)." },
      ],
    };
    faqs = fallback[cat] || fallback["guides"];
  }
  parts.push(renderFaq(faqs));

  // Conclusion — per-topic if available, otherwise per-category fallback
  const conclusions = {
    "make-money": `The people making real money from **${(topic.keywords || [])[0] || topic.title.toLowerCase()}** are not doing anything you cannot do. They picked one method, stuck with it for 90 days, and adjusted along the way. Pick one approach from this guide and start today — even if it is imperfect.`,
    "ai-tools": `The best **${(topic.keywords || [])[0] || topic.title.toLowerCase()}** setup depends entirely on what you are trying to build. Start with free versions, learn the limitations, and upgrade only when you hit a specific bottleneck.`,
    "productivity": `The biggest productivity gains come from your first change, not your tenth. Pick the single most impactful idea from this guide and implement it this week before adding anything else.`,
    "guides": `You now have a solid understanding of **${(topic.keywords || [])[0] || topic.title.toLowerCase()}**. The gap between knowing and doing is where most people get stuck — so close this tab, open a document, and write the first few hundred words.`,
  };
  const conclusion = topic.conclusion || conclusions[cat] || conclusions["guides"];
  parts.push(`## Final thoughts`);
  parts.push(conclusion);
  parts.push(`*Last updated: ${dateISO}. I review and update this guide regularly to keep it accurate.*`);

  return parts.join("\n\n");
}

function main() {
  const topics = JSON.parse(fs.readFileSync(TOPICS, "utf8"));
  if (!topics.length) { console.error("No topics in queue."); process.exit(1); }
  const state = loadState();
  fs.mkdirSync(POSTS_DIR, { recursive: true });

  const dateISO = new Date().toISOString().slice(0, 10);
  const cursorPos = state.cursor;
  const topic = topics[cursorPos % topics.length];
  const refreshRound = Math.floor(cursorPos / topics.length);

  let baseSlug = slugify(topic.title);
  let slug = baseSlug;
  if (refreshRound > 0 || fs.existsSync(path.join(POSTS_DIR, `${slug}.md`))) {
    slug = `${baseSlug}-${dateISO}`;
  }

  const title = refreshRound > 0 ? `${topic.title}: Updated Guide for ${dateISO.slice(0, 4)}` : topic.title;
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

  const body = renderBody(topic, dateISO, cursorPos);
  const file = path.join(POSTS_DIR, `${slug}.md`);
  fs.writeFileSync(file, fm + body + "\n");

  state.cursor += 1;
  state.published.push({ slug, title, date: dateISO });
  saveState(state);

  console.log(`Published: ${slug}.md  (queue cursor now ${state.cursor})`);
}

main();
