# Social Auto-Posting — Setup Guide

The blog ships with a zero-dependency auto-posting pipeline that shares every new
post to **Twitter/X, LinkedIn, Facebook, and Instagram** automatically.

- Code: `lib/social-poster.js` (platform API clients) + `scripts/social-distribute.js` (CLI runner)
- CI: wired into `.github/workflows/autopublish.yml` — fires after each scheduled publish
- De-dup: `data/social-log.json` records distributed slugs so re-runs never double-post

Each platform is **independent and opt-in**: a platform only posts when its
credentials are present. With no credentials configured, the pipeline no-ops
cleanly and never fails the build. Wire up platforms one at a time.

## Quick test (no credentials needed)

```bash
# Preview the captions that would be posted for the latest article:
SOCIAL_DRY_RUN=1 npm run social

# Distribute a specific slug:
SOCIAL_DRY_RUN=1 node scripts/social-distribute.js how-to-make-money-with-chatgpt-10-proven-methods
```

## Going live

Set the secrets below in **GitHub repo → Settings → Secrets and variables → Actions**.
The workflow already maps them into the "Distribute to social media" step.

### Twitter / X  (API v2, OAuth 1.0a user context)
Create an app at developer.twitter.com with **Read and Write** permissions, then add:
- `X_API_KEY`
- `X_API_SECRET`
- `X_ACCESS_TOKEN`
- `X_ACCESS_SECRET`

### LinkedIn  (UGC Posts API)
Create an app at linkedin.com/developers with the `w_member_social` scope, then add:
- `LINKEDIN_ACCESS_TOKEN`
- `LINKEDIN_AUTHOR_URN` — e.g. `urn:li:person:abc123` or `urn:li:organization:456`

### Facebook  (Graph API Page feed)
Create a Page + app at developers.facebook.com, generate a long-lived Page token, then add:
- `FACEBOOK_PAGE_ID`
- `FACEBOOK_PAGE_TOKEN`

### Instagram  (Graph API — Business/Creator account linked to the FB Page)
Requires the post's `image:` frontmatter to be a public URL (all posts already have one).
- `IG_USER_ID`
- `IG_ACCESS_TOKEN`

## How it runs

1. `new-post.js` publishes the next queued post and appends it to `data/state.json`.
2. `scripts/social-distribute.js` reads the most recent published slug, builds
   platform-tailored captions, and posts to every configured platform in parallel.
3. The slug is logged to `data/social-log.json`; subsequent runs skip it
   (override with `SOCIAL_FORCE=1`).

## Manual use

```bash
npm run social                      # distribute the latest published post
node scripts/social-distribute.js <slug>   # distribute a specific post
SOCIAL_FORCE=1 npm run social       # repost even if already logged
```
