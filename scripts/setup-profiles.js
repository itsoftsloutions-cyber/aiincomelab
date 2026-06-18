// Social media profile setup script.
// Automates profile configuration for Twitter/X, LinkedIn, Pinterest, and Instagram
// using each platform's official HTTP API when credentials are available.
//
// Usage:
//   node scripts/setup-profiles.js            # full run (requires credentials)
//   DRY_RUN=1 node scripts/setup-profiles.js  # preview only, no API calls
//
// Required env vars (per platform, all optional — platform is skipped when missing):
//   Twitter/X : X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET
//   LinkedIn  : LINKEDIN_ACCESS_TOKEN, LINKEDIN_AUTHOR_URN
//   Pinterest : PINTEREST_ACCESS_TOKEN
//   Instagram : IG_USER_ID, IG_ACCESS_TOKEN
//   Images    : PROFILE_IMG (path to profile image PNG/JPG),
//               HEADER_IMG (path to header image PNG/JPG for Twitter)

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const DRY_RUN = process.env.DRY_RUN === "1";

// ---------------------------------------------------------------------------
// Profile content per marketing/profile-setup-guide.md
// ---------------------------------------------------------------------------

const PROFILES = {
  twitter: {
    name: "AIIncomeLab | AI × Money",
    description: "Practical AI strategies for real income. No fluff, no get-rich-quick. I test tools & share what works. aiincomelab.com",
    url: "https://aiincomelab.com/?utm_source=twitter&utm_medium=social&utm_campaign=profile",
    pinnedTweetText: "1 actionable AI tip for making money, daily. Follow for tools that actually work.",
  },
  linkedin: {
    name: "AIIncomeLab",
    tagline: "Practical AI tools and strategies for building online income.",
    description: "AIIncomeLab is your no-hype guide to using artificial intelligence for real income. We test AI tools, build automated workflows, and share transparent income reports so you can skip the trial-and-error.",
    industry: "Technology, Information and Internet",
    url: "https://aiincomelab.com/?utm_source=linkedin&utm_medium=social&utm_campaign=profile",
  },
  pinterest: {
    name: "AIIncomeLab | AI Tools & Income",
    description: "Pin-worthy AI tools and income strategies. Save guides that actually work.",
    url: "https://aiincomelab.com/?utm_source=pinterest&utm_medium=social&utm_campaign=profile",
    boards: [
      { name: "Best AI Tools", description: "Tool comparisons, reviews, free tools" },
      { name: "Make Money Online", description: "Income strategies, blueprints" },
      { name: "AI Productivity", description: "Workflow automation tips" },
      { name: "Blogging Tips", description: "SEO, content strategy, traffic growth" },
      { name: "Side Hustles", description: "Beginner-friendly income ideas" },
    ],
  },
  instagram: {
    name: "AIIncomeLab",
    bio: "Practical AI strategies for real income 💰\nNo hype, no fluff. Tools that actually work.\n👇 aiincomelab.com",
    url: "https://aiincomelab.com/?utm_source=instagram&utm_medium=social&utm_campaign=profile",
  },
};

const BRAND_COLORS = {
  primary: "#0d1117",
  accent: "#58a6ff",
  text: "#c9d1d9",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(platform, status, detail) {
  const d = detail ? ` — ${detail}` : "";
  console.log(`  [${platform}] ${status}${d}`);
}

function imgPath(name) {
  const p = process.env[name];
  if (!p) return null;
  const resolved = path.resolve(root, p);
  if (!fs.existsSync(resolved)) {
    console.warn(`  [warn] Image not found: ${resolved}`);
    return null;
  }
  return resolved;
}

// ---------------------------------------------------------------------------
// Twitter/X — API v2 profile update + OAuth 1.0a
// ---------------------------------------------------------------------------

function oauth1Header(method, url, creds) {
  const oauth = {
    oauth_consumer_key: creds.apiKey,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: creds.accessToken,
    oauth_version: "1.0",
  };
  const enc = encodeURIComponent;
  const paramString = Object.keys(oauth).sort().map((k) => `${enc(k)}=${enc(oauth[k])}`).join("&");
  const baseString = [method.toUpperCase(), enc(url), enc(paramString)].join("&");
  const signingKey = `${enc(creds.apiSecret)}&${enc(creds.accessSecret)}`;
  const signature = crypto.createHmac("sha1", signingKey).update(baseString).digest("base64");
  const header =
    "OAuth " +
    Object.entries({ ...oauth, oauth_signature: signature }).sort().map(([k, v]) => `${enc(k)}="${enc(v)}"`).join(", ");
  return header;
}

async function setupTwitter() {
  const creds = {
    apiKey: process.env.X_API_KEY,
    apiSecret: process.env.X_API_SECRET,
    accessToken: process.env.X_ACCESS_TOKEN,
    accessSecret: process.env.X_ACCESS_SECRET,
  };
  if (!creds.apiKey || !creds.apiSecret || !creds.accessToken || !creds.accessSecret) {
    return log("twitter", "skipped", "missing credentials (X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET)");
  }

  const profile = PROFILES.twitter;
  const auth = (method, url) => oauth1Header(method, url, creds);

  // 1. Get user ID
  const meUrl = "https://api.twitter.com/2/users/me";
  if (DRY_RUN) {
    log("twitter", "dry-run", `Would update profile: name="${profile.name}", bio="${profile.description}"`);
    return;
  }

  let userId;
  try {
    const meRes = await fetch(meUrl, { headers: { Authorization: auth("GET", meUrl) } });
    const meBody = await meRes.json();
    if (!meRes.ok) { log("twitter", "error", `GET /users/me failed: ${meRes.status}`); return; }
    userId = meBody.data?.id;
    if (!userId) { log("twitter", "error", "could not determine user ID"); return; }
    log("twitter", "ok", `user ID: ${userId}`);
  } catch (e) {
    return log("twitter", "error", `GET /users/me exception: ${e.message}`);
  }

  // 2. Update profile (name, description, url)
  const updateUrl = `https://api.twitter.com/2/users/${userId}`;
  try {
    const updateRes = await fetch(updateUrl, {
      method: "PATCH",
      headers: {
        Authorization: auth("PATCH", updateUrl),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: profile.name,
        description: profile.description,
        url: profile.url,
      }),
    });
    const updateBody = await updateRes.json();
    if (!updateRes.ok) {
      const errors = updateBody?.errors?.map((e) => e.detail).join("; ") || JSON.stringify(updateBody);
      log("twitter", "error", `PATCH /users/:id failed: ${updateRes.status} — ${errors}`);
      return;
    }
    log("twitter", "ok", "profile name, bio, and URL updated");
  } catch (e) {
    return log("twitter", "error", `PATCH /users/:id exception: ${e.message}`);
  }

  // 3. Upload profile image (via v1.1 media/upload, requires PROFILE_IMG env)
  const profileImg = imgPath("PROFILE_IMG");
  if (profileImg) {
    try {
      const ext = path.extname(profileImg).toLowerCase();
      const contentType = ext === ".png" ? "image/png" : "image/jpeg";
      const buf = fs.readFileSync(profileImg);
      const boundary = `----${crypto.randomBytes(16).toString("hex")}`;
      const parts = [
        `--${boundary}`,
        `Content-Disposition: form-data; name="media"; filename="${path.basename(profileImg)}"`,
        `Content-Type: ${contentType}`,
        "",
        buf.toString("base64"),
        `--${boundary}--`,
      ].join("\r\n");
      const uploadUrl = "https://upload.twitter.com/1.1/media/upload.json?media_category=pfp";
      const uploadRes = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          Authorization: auth("POST", uploadUrl),
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
        },
        body: parts,
      });
      const uploadBody = await uploadRes.json();
      if (!uploadRes.ok) {
        log("twitter", "warn", `profile image upload failed: ${uploadRes.status}`);
      } else {
        log("twitter", "ok", "profile image uploaded");
        // Use the media ID to set profile image
        const mediaId = uploadBody.media_id_string;
        const profileUpdateUrl = "https://api.twitter.com/1.1/account/update_profile_image.json";
        const puRes = await fetch(`${profileUpdateUrl}?image=${mediaId}`, {
          method: "POST",
          headers: { Authorization: auth("POST", profileUpdateUrl) },
        });
        if (puRes.ok) log("twitter", "ok", "profile image set");
        else log("twitter", "warn", "could not set profile image via v1.1");
      }
    } catch (e) {
      log("twitter", "warn", `profile image upload error: ${e.message}`);
    }
  }

  // 4. Upload header image (via v1.1, requires HEADER_IMG env)
  const headerImg = imgPath("HEADER_IMG");
  if (headerImg) {
    try {
      const ext = path.extname(headerImg).toLowerCase();
      const contentType = ext === ".png" ? "image/png" : "image/jpeg";
      const buf = fs.readFileSync(headerImg);
      const boundary = `----${crypto.randomBytes(16).toString("hex")}`;
      const parts = [
        `--${boundary}`,
        `Content-Disposition: form-data; name="media"; filename="${path.basename(headerImg)}"`,
        `Content-Type: ${contentType}`,
        "",
        buf.toString("base64"),
        `--${boundary}--`,
      ].join("\r\n");
      const uploadUrl = "https://upload.twitter.com/1.1/media/upload.json?media_category=header";
      const uploadRes = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          Authorization: auth("POST", uploadUrl),
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
        },
        body: parts,
      });
      const uploadBody = await uploadRes.json();
      if (!uploadRes.ok) {
        log("twitter", "warn", `header image upload failed: ${uploadRes.status}`);
      } else {
        const mediaId = uploadBody.media_id_string;
        const headerUpdateUrl = "https://api.twitter.com/1.1/account/update_profile_banner.json";
        const hRes = await fetch(`${headerUpdateUrl}?media_id=${mediaId}`, {
          method: "POST",
          headers: { Authorization: auth("POST", headerUpdateUrl) },
        });
        if (hRes.ok) log("twitter", "ok", "header image set");
        else log("twitter", "warn", "could not set header image");
      }
    } catch (e) {
      log("twitter", "warn", `header image upload error: ${e.message}`);
    }
  }

  // 5. Post and pin the introductory tweet
  try {
    const tweetUrl = "https://api.twitter.com/2/tweets";
    const tweetRes = await fetch(tweetUrl, {
      method: "POST",
      headers: {
        Authorization: auth("POST", tweetUrl),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: profile.pinnedTweetText }),
    });
    const tweetBody = await tweetRes.json();
    if (!tweetRes.ok) {
      log("twitter", "warn", `could not post pinned tweet: ${tweetRes.status}`);
    } else {
      const tweetId = tweetBody?.data?.id;
      if (tweetId) {
        const pinUrl = `https://api.twitter.com/2/users/${userId}/pinned_lists`;
        const pinRes = await fetch(pinUrl, {
          method: "POST",
          headers: {
            Authorization: auth("POST", pinUrl),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ tweet_id: tweetId }),
        });
        if (pinRes.ok) log("twitter", "ok", "pinned tweet set");
        else log("twitter", "warn", "could not pin tweet (may need users.read scope)");
      }
    }
  } catch (e) {
    log("twitter", "warn", `pinned tweet error: ${e.message}`);
  }
}

// ---------------------------------------------------------------------------
// LinkedIn — Company Page creation
// Note: Company page creation requires the LinkedIn Organization API with
// r_organization_social and w_organization_social scopes. A personal token
// with r_liteprofile/w_member_social cannot create company pages.
// ---------------------------------------------------------------------------

async function setupLinkedIn() {
  const token = process.env.LINKEDIN_ACCESS_TOKEN;
  const author = process.env.LINKEDIN_AUTHOR_URN;

  if (!token || !author) {
    return log("linkedin", "skipped", "missing credentials (LINKEDIN_ACCESS_TOKEN, LINKEDIN_AUTHOR_URN)");
  }

  const profile = PROFILES.linkedin;
  if (DRY_RUN) {
    log("linkedin", "dry-run", `Would create company page: "${profile.name}"`);
    return;
  }

  // Check if the author is an organization
  const isOrg = author.includes("organization");

  if (!isOrg) {
    log("linkedin", "info", `Author URN (${author}) appears to be a personal profile.`);
    log("linkedin", "info", "Company page creation requires an organization admin token.");
    log("linkedin", "info", "Create manually at https://linkedin.com/company/setup/ and update site.json");
    log("linkedin", "skipped", "cannot create company page with personal token");
    return;
  }

  // Create an organization post or update company page info if org token
  try {
    const res = await fetch("https://api.linkedin.com/v2/organizations?q=role&role=ADMINISTRATOR", {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Restli-Protocol-Version": "2.0.0",
      },
    });
    const body = await res.json();
    if (!res.ok) {
      log("linkedin", "error", `could not list orgs: ${res.status}`);
      return;
    }
    const orgs = body?.elements || [];
    if (orgs.length === 0) {
      log("linkedin", "info", "no organizations found for this admin token");
      return;
    }
    log("linkedin", "ok", `found ${orgs.length} organization(s) you admin`);
    for (const org of orgs) {
      log("linkedin", "info", `  - ${org.name} (${org.id})`);
    }

    // Update the first org's company page description
    const orgId = orgs[0].id;
    const updateRes = await fetch(`https://api.linkedin.com/v2/organizations/${orgId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify({
        description: { text: profile.description },
      }),
    });
    if (updateRes.ok) log("linkedin", "ok", `updated description for org ${orgId}`);
    else log("linkedin", "warn", `could not update org ${orgId}: ${updateRes.status}`);
  } catch (e) {
    log("linkedin", "error", `org setup exception: ${e.message}`);
  }
}

// ---------------------------------------------------------------------------
// Pinterest — Board creation via API v5
// Requires: PINTEREST_ACCESS_TOKEN
// ---------------------------------------------------------------------------

async function setupPinterest() {
  const token = process.env.PINTEREST_ACCESS_TOKEN;
  if (!token) {
    return log("pinterest", "skipped", "missing credentials (PINTEREST_ACCESS_TOKEN)");
  }

  const profile = PROFILES.pinterest;
  if (DRY_RUN) {
    log("pinterest", "dry-run", `Would create ${profile.boards.length} boards and update profile`);
    profile.boards.forEach((b) => log("pinterest", "dry-run", `  board: "${b.name}"`));
    return;
  }

  // Update profile description
  try {
    const descRes = await fetch("https://api.pinterest.com/v5/user_account", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        profile_image: null,
        username: null,
        website_url: profile.url,
        about: profile.description,
      }),
    });
    if (descRes.ok) log("pinterest", "ok", "profile description updated");
    else {
      const b = await descRes.json().catch(() => ({}));
      log("pinterest", "warn", `profile update: ${descRes.status} ${b.message || ""}`);
    }
  } catch (e) {
    log("pinterest", "warn", `profile update exception: ${e.message}`);
  }

  // Create boards
  for (const board of profile.boards) {
    try {
      const res = await fetch("https://api.pinterest.com/v5/boards", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: board.name,
          description: board.description,
          privacy: "PUBLIC",
        }),
      });
      const body = await res.json();
      if (res.ok) log("pinterest", "ok", `board created: "${board.name}" (${body.id || "ok"})`);
      else log("pinterest", "warn", `board "${board.name}": ${res.status} ${body.message || ""}`);
    } catch (e) {
      log("pinterest", "warn", `board "${board.name}" exception: ${e.message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Instagram — Profile setup via Graph API
// Requires: IG_USER_ID, IG_ACCESS_TOKEN (must be a Business/Creator account
// connected to a Facebook Page)
// ---------------------------------------------------------------------------

async function setupInstagram() {
  const igUserId = process.env.IG_USER_ID;
  const token = process.env.IG_ACCESS_TOKEN;

  if (!igUserId || !token) {
    return log("instagram", "skipped", "missing credentials (IG_USER_ID, IG_ACCESS_TOKEN)");
  }

  const profile = PROFILES.instagram;
  if (DRY_RUN) {
    log("instagram", "dry-run", `Would update profile: name="${profile.name}", bio="${profile.bio}"`);
    return;
  }

  // Instagram profile updates (name, bio) go through the Facebook Page's
  // Instagram Business Account API.
  try {
    const base = `https://graph.facebook.com/v19.0/${encodeURIComponent(igUserId)}`;

    // Update profile info
    const updateRes = await fetch(`${base}?fields=name,biography&access_token=${token}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    const current = await updateRes.json();
    if (updateRes.ok) {
      log("instagram", "info", `current: name="${current.name}", bio="${(current.biography || "").slice(0, 40)}..."`);
    }

    // Note: Instagram Graph API doesn't support PATCH for profile fields
    // directly. Name and bio must be updated through the Instagram app or
    // the Facebook Page settings. We document this limitation.
    log("instagram", "info", "Instagram profile name/bio cannot be updated via the Graph API.");
    log("instagram", "info", "Update manually in the Instagram app, or use the Facebook Page");
    log("instagram", "info", "composer to set the Instagram bio for Business accounts.");
  } catch (e) {
    log("instagram", "warn", `check exception: ${e.message}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("AIIncomeLab — Social Media Profile Setup");
  console.log(`Dry-run: ${DRY_RUN ? "YES (no API calls)" : "NO (live)"}`);
  console.log("");

  // Verify profile images for non-dry mode
  if (!DRY_RUN) {
    const pi = imgPath("PROFILE_IMG");
    const hi = imgPath("HEADER_IMG");
    if (!pi) console.log("  [info] PROFILE_IMG not set — skipping profile image upload");
    if (!hi) console.log("  [info] HEADER_IMG not set — skipping header image upload");
    console.log("");
  }

  await setupTwitter();
  await setupLinkedIn();
  await setupPinterest();
  await setupInstagram();

  console.log("");
  if (process.env.DRY_RUN === "1") {
    console.log("Dry-run complete. Set env vars and remove DRY_RUN to execute.");
  } else {
    console.log("Done. Verify profiles at:");
    console.log("  Twitter/X  : https://x.com/kanavy9ah");
    console.log("  LinkedIn   : https://linkedin.com/company/aiincomelab (needs creation)");
    console.log("  Pinterest  : https://pinterest.com/aiincomelab");
    console.log("  Instagram  : https://instagram.com/aiincomelab");
  }
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
