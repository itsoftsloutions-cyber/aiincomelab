import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const POSTS_DIR = path.join(__dirname, "..", "content", "posts");

// Unique Unsplash images for each post (curated free, no API key needed)
const POST_IMAGES = {
  "ai-affiliate-marketing-a-beginner-s-playbook": "https://images.unsplash.com/photo-1553729459-efe14ef6055d?w=800&q=80",
  "ai-email-marketing-build-newsletter-earns-money": "https://images.unsplash.com/photo-1596526131083-e8c633c948d2?w=800&q=80",
  "ai-freelancing-how-to-charge-50-150-hour-using-ai-tools": "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&q=80",
  "ai-productivity-workflow-do-8-hours-of-work-in-3": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80",
  "ai-tools-make-money-online-2026": "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&q=80",
  "best-ai-tools-for-passive-income-in-2026": "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&q=80",
  "best-free-ai-tools-you-can-use-today": "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80",
  "chatgpt-vs-claude-vs-gemini-which-ai-is-best-for-making-money": "https://images.unsplash.com/photo-1684163761883-8cba5e000e12?w=800&q=80",
  "google-adsense-approval-a-complete-beginner-guide": "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80",
  "how-to-make-500-month-with-an-ai-blog-realistic-guide": "https://images.unsplash.com/photo-1432888622747-4eb9a8eeeb1a?w=800&q=80",
  "how-to-make-money-with-chatgpt-10-proven-methods": "https://images.unsplash.com/photo-1684391314387-8c6d8b3b8b6f?w=800&q=80",
  "how-to-start-an-ai-blog-that-ranks-on-google": "https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=800&q=80",
  "midjourney-for-beginners-create-and-sell-ai-art": "https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=800&q=80",
  "midjourney-vs-dalle-vs-stable-diffusion-ai-image-generator-comparison": "https://images.unsplash.com/photo-1686191128892-3b370d4e298b?w=800&q=80",
  "seo-for-beginners-how-to-rank-your-first-blog-post-on-google": "https://images.unsplash.com/photo-1562577309-4932fdd64cd1?w=800&q=80",
  "youtube-automation-with-ai-earn-without-showing-your-face": "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&q=80",
};

// Process each post file
const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith(".md"));
let updated = 0;

for (const file of files) {
  const filePath = path.join(POSTS_DIR, file);
  const content = fs.readFileSync(filePath, "utf8");
  const slug = file.replace(/\.md$/, "");
  
  // Check if post already has an image field
  if (content.includes("image:")) {
    console.log(`⏭️  ${slug} already has image field`);
    continue;
  }
  
  // Get the unique image for this post
  const imageUrl = POST_IMAGES[slug];
  if (!imageUrl) {
    console.log(`⚠️  ${slug} no image mapping found`);
    continue;
  }
  
  // Add image field to frontmatter
  const updatedContent = content.replace(
    /^(---\n)/,
    `$1image: "${imageUrl}"\n`
  );
  
  fs.writeFileSync(filePath, updatedContent);
  console.log(`✅ ${slug} - added image`);
  updated++;
}

console.log(`\nDone! Updated ${updated} posts with unique images.`);
