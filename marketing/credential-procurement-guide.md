# Social Media API Credential Procurement Guide

This guide documents how to create API credentials for each social platform used by the auto-posting pipeline (`lib/social-poster.js`). Created for [AIA-11](/AIA/issues/AIA-11).

## Priority Order

1. **Twitter/X** — high traffic potential, thread format matches blog content
2. **LinkedIn** — B2B/professional audience, good for long-form content
3. Facebook — deferred per board decision
4. Instagram — deferred per board decision

---

## 1. Twitter/X API Credentials

**Account:** @kanavy9ah (existing) or dedicated @AIIncomeLab

### Create a Project + App

1. Go to https://developer.twitter.com and sign in with @kanavy9ah
2. Click **Dashboard** → **Projects & Apps** → **Create Project**
3. Name: `AIIncomeLab Auto-Poster` (or similar)
4. Use case: "Posting content from our blog automatically"
5. App name: `aiincomelab-social-bot`

### Set Permissions

1. In your app settings → **User authentication settings** → **Set up**
2. App permissions: **Read and Write**
3. Type of App: **Web App, Automated App or Bot**
4. Callback URI / Website URL: `https://aiincomelab.com`

### Generate Credentials

Under **Keys and Tokens** tab:

| Secret Name | GitHub Key | Where to find it |
|------------|-----------|------------------|
| API Key | `X_API_KEY` | Keys and Tokens → Consumer Keys → API Key |
| API Secret | `X_API_SECRET` | Keys and Tokens → Consumer Keys → API Secret |
| Access Token | `X_ACCESS_TOKEN` | Keys and Tokens → Authentication Tokens → Access Token |
| Access Secret | `X_ACCESS_SECRET` | Keys and Tokens → Authentication Tokens → Access Token Secret |

**Important:** Copy the Access Token + Secret immediately — Twitter only shows them once.

### Rate Limits

- 300 tweets per 3 hours (per-app, read-write)
- Pipeline posts once per published article (well within limits)

---

## 2. LinkedIn API Credentials

**Account:** Create/create from personal account, then create LinkedIn Company Page: AIIncomeLab

### Create a LinkedIn Developer App

1. Go to https://www.linkedin.com/developers/apps → **Create App**
2. App name: `AIIncomeLab Social Publisher`
3. LinkedIn Page: Select your personal profile (company page association optional initially)
4. App logo: Use AIIncomeLab logo mark

### Configure Permissions

1. In **Products** tab, add **Sign In with LinkedIn** (may need to request **Share on LinkedIn** / `w_member_social`)
2. In **Auth** tab, add redirect URL: `https://aiincomelab.com/linkedin-callback`

### Generate Access Token

The UGC Posts API requires a user access token:

1. Go to https://www.linkedin.com/developers/tools/oauth/token-generator
2. Select scopes: `w_member_social`, `r_liteprofile`
3. Click **Generate token**
4. Copy the token immediately

### Find Your Author URN

1. Call: `GET https://api.linkedin.com/v2/userinfo` with the token
2. The response includes `sub` — your LinkedIn member ID
3. Author URN format: `urn:li:person:{sub}`
4. For a Company Page: `urn:li:organization:{companyPageId}`

| Secret Name | GitHub Key | Value |
|------------|-----------|-------|
| Access Token | `LINKEDIN_ACCESS_TOKEN` | Token from developer tools |
| Author URN | `LINKEDIN_AUTHOR_URN` | e.g., `urn:li:person:abc123` |

### Rate Limits

- UGC Posts: 100,000 calls per day per user
- Well within limits for daily blog posts

---

## 3. GitHub Secrets Setup (for CTO)

Each credential must be set as a GitHub Actions secret in the repository:

- Repo: `https://github.com/itsoftsloutions-cyber/aiincomelab`
- Secrets location: Settings → Secrets and variables → Actions → New repository secret

Use the script at `scripts/set-github-secrets.ps1` to inject all credentials at once via the GitHub API.

---

## 4. Verification

After credentials are set, verify the pipeline works:

```bash
SOCIAL_DRY_RUN=1 npm run social
# Should show platform-tailored captions for the latest post
```

Then for a real test (on a non-critical post or a new post):

```bash
SOCIAL_FORCE=1 node scripts/social-distribute.js
# Check each platform for the post
```

---

## Appendix: LinkedIn Access Token Refresh

LinkedIn access tokens expire after **12 months** (if using the token generator tool) or after **60 days** (if using OAuth 2.0 flow). Set a calendar reminder to refresh every 6 months. The pipeline will continue to function — it logs a clear "missing credentials" skip message if the token expires.
