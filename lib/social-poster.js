// Zero-dependency social auto-posting infrastructure.
//
// Posts a published blog article to Twitter/X, LinkedIn, Facebook, and Instagram
// using each platform's official HTTP API. No npm packages — uses Node 20's
// built-in global `fetch`.
//
// Each platform is independent: it only fires when its credentials are present
// in the environment, and a failure on one platform never blocks the others.
// With no credentials configured the whole module no-ops cleanly, so it is safe
// to call on every publish (including in CI before secrets are wired up).
//
// Required environment variables (per platform, all optional):
//   Twitter/X   : X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET
//   LinkedIn    : LINKEDIN_ACCESS_TOKEN, LINKEDIN_AUTHOR_URN (e.g. "urn:li:person:xxxx"
//                 or "urn:li:organization:xxxx")
//   Facebook    : FACEBOOK_PAGE_ID, FACEBOOK_PAGE_TOKEN
//   Instagram   : IG_USER_ID, IG_ACCESS_TOKEN   (requires post.image to be a public URL)

import crypto from "node:crypto";

const DRY_RUN = process.env.SOCIAL_DRY_RUN === "1";

// ---------------------------------------------------------------------------
// Caption builders — platform-appropriate text from a post object.
// post = { title, description, url, image?, keywords?: string[] }
// ---------------------------------------------------------------------------

function hashtags(post, max) {
  const tags = (post.keywords || [])
    .map((k) => "#" + String(k).replace(/[^a-z0-9]+/gi, ""))
    .filter((t) => t.length > 1);
  // De-dup while preserving order.
  const seen = new Set();
  const out = [];
  for (const t of tags) {
    const key = t.toLowerCase();
    if (!seen.has(key)) { seen.add(key); out.push(t); }
    if (out.length >= max) break;
  }
  return out;
}

function truncate(s, n) {
  s = String(s || "").trim();
  return s.length <= n ? s : s.slice(0, n - 1).trimEnd() + "…";
}

export function buildCaptions(post) {
  const tagsShort = hashtags(post, 2).join(" ");
  const tagsLong = hashtags(post, 5).join(" ");

  // Twitter/X: 280 chars incl. URL (t.co shortens to ~23). Keep headroom.
  const xBase = `${post.title}`;
  const xRoom = 280 - 24 /* url */ - (tagsShort ? tagsShort.length + 1 : 0) - 2;
  const twitter = `${truncate(xBase, xRoom)}\n\n${post.url}${tagsShort ? "\n" + tagsShort : ""}`;

  // LinkedIn: long-form, professional.
  const linkedin =
    `${post.title}\n\n${truncate(post.description, 600)}\n\nRead the full guide: ${post.url}` +
    (tagsLong ? `\n\n${tagsLong}` : "");

  // Facebook: conversational, link drives the preview card.
  const facebook =
    `${post.title}\n\n${truncate(post.description, 400)}\n\n${post.url}` +
    (tagsLong ? `\n\n${tagsLong}` : "");

  // Instagram: caption only (image carries the visual). No clickable links in
  // body, so we point at the bio.
  const instagram =
    `${post.title}\n\n${truncate(post.description, 800)}\n\n🔗 Full guide linked in bio.` +
    (tagsLong ? `\n\n${tagsLong} #blog #ai` : "");

  return { twitter, linkedin, facebook, instagram };
}

// ---------------------------------------------------------------------------
// Twitter / X — API v2 POST /2/tweets with OAuth 1.0a user-context signing.
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
  const paramString = Object.keys(oauth)
    .sort()
    .map((k) => `${enc(k)}=${enc(oauth[k])}`)
    .join("&");
  const baseString = [method.toUpperCase(), enc(url), enc(paramString)].join("&");
  const signingKey = `${enc(creds.apiSecret)}&${enc(creds.accessSecret)}`;
  const signature = crypto.createHmac("sha1", signingKey).update(baseString).digest("base64");
  const header =
    "OAuth " +
    Object.entries({ ...oauth, oauth_signature: signature })
      .sort()
      .map(([k, v]) => `${enc(k)}="${enc(v)}"`)
      .join(", ");
  return header;
}

async function postTwitter(captions) {
  if (DRY_RUN) return { platform: "twitter", status: "dry-run", preview: captions.twitter };
  const creds = {
    apiKey: process.env.X_API_KEY,
    apiSecret: process.env.X_API_SECRET,
    accessToken: process.env.X_ACCESS_TOKEN,
    accessSecret: process.env.X_ACCESS_SECRET,
  };
  if (!creds.apiKey || !creds.apiSecret || !creds.accessToken || !creds.accessSecret) {
    return { platform: "twitter", status: "skipped", reason: "missing credentials" };
  }
  const url = "https://api.twitter.com/2/tweets";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: oauth1Header("POST", url, creds),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: captions.twitter }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { platform: "twitter", status: "error", code: res.status, body };
  return { platform: "twitter", status: "ok", id: body?.data?.id };
}

// ---------------------------------------------------------------------------
// LinkedIn — UGC Posts API.
// ---------------------------------------------------------------------------

async function postLinkedIn(captions, post) {
  if (DRY_RUN) return { platform: "linkedin", status: "dry-run", preview: captions.linkedin };
  const token = process.env.LINKEDIN_ACCESS_TOKEN;
  const author = process.env.LINKEDIN_AUTHOR_URN;
  if (!token || !author) {
    return { platform: "linkedin", status: "skipped", reason: "missing credentials" };
  }
  const payload = {
    author,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text: captions.linkedin },
        shareMediaCategory: "ARTICLE",
        media: [
          {
            status: "READY",
            originalUrl: post.url,
            title: { text: truncate(post.title, 200) },
            description: { text: truncate(post.description, 300) },
          },
        ],
      },
    },
    visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
  };
  const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { platform: "linkedin", status: "error", code: res.status, body };
  return { platform: "linkedin", status: "ok", id: body?.id };
}

// ---------------------------------------------------------------------------
// Facebook — Graph API Page feed post.
// ---------------------------------------------------------------------------

async function postFacebook(captions, post) {
  if (DRY_RUN) return { platform: "facebook", status: "dry-run", preview: captions.facebook };
  const pageId = process.env.FACEBOOK_PAGE_ID;
  const token = process.env.FACEBOOK_PAGE_TOKEN;
  if (!pageId || !token) {
    return { platform: "facebook", status: "skipped", reason: "missing credentials" };
  }
  const url = `https://graph.facebook.com/v19.0/${encodeURIComponent(pageId)}/feed`;
  const params = new URLSearchParams({
    message: captions.facebook,
    link: post.url,
    access_token: token,
  });
  const res = await fetch(url, { method: "POST", body: params });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { platform: "facebook", status: "error", code: res.status, body };
  return { platform: "facebook", status: "ok", id: body?.id };
}

// ---------------------------------------------------------------------------
// Instagram — Graph API two-step (create media container, then publish).
// Requires a public image URL.
// ---------------------------------------------------------------------------

async function postInstagram(captions, post) {
  if (DRY_RUN) return { platform: "instagram", status: "dry-run", preview: captions.instagram };
  const igUserId = process.env.IG_USER_ID;
  const token = process.env.IG_ACCESS_TOKEN;
  if (!igUserId || !token) {
    return { platform: "instagram", status: "skipped", reason: "missing credentials" };
  }
  if (!post.image || !/^https?:\/\//.test(post.image)) {
    return { platform: "instagram", status: "skipped", reason: "no public image url" };
  }

  const base = `https://graph.facebook.com/v19.0/${encodeURIComponent(igUserId)}`;
  // 1. create container
  const createRes = await fetch(`${base}/media`, {
    method: "POST",
    body: new URLSearchParams({
      image_url: post.image,
      caption: captions.instagram,
      access_token: token,
    }),
  });
  const createBody = await createRes.json().catch(() => ({}));
  if (!createRes.ok || !createBody.id) {
    return { platform: "instagram", status: "error", code: createRes.status, body: createBody };
  }
  // 2. publish container
  const pubRes = await fetch(`${base}/media_publish`, {
    method: "POST",
    body: new URLSearchParams({ creation_id: createBody.id, access_token: token }),
  });
  const pubBody = await pubRes.json().catch(() => ({}));
  if (!pubRes.ok) return { platform: "instagram", status: "error", code: pubRes.status, body: pubBody };
  return { platform: "instagram", status: "ok", id: pubBody?.id };
}

// ---------------------------------------------------------------------------
// Orchestrator — fan out to all platforms, collect per-platform results.
// ---------------------------------------------------------------------------

export async function distribute(post) {
  if (!post || !post.title || !post.url) {
    throw new Error("distribute(post): post.title and post.url are required");
  }
  const captions = buildCaptions(post);
  const results = await Promise.all([
    postTwitter(captions).catch((e) => ({ platform: "twitter", status: "error", error: String(e) })),
    postLinkedIn(captions, post).catch((e) => ({ platform: "linkedin", status: "error", error: String(e) })),
    postFacebook(captions, post).catch((e) => ({ platform: "facebook", status: "error", error: String(e) })),
    postInstagram(captions, post).catch((e) => ({ platform: "instagram", status: "error", error: String(e) })),
  ]);
  return results;
}
