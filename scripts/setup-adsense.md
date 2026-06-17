# AdSense Setup — Step by Step (Free)

## Prerequisites
- Your blog is live at a real URL (e.g. yourusername.github.io/aiincomelab)
- You have at least 10-15 published posts (already done — you have 11)
- You have a Google account

## Step 1 — Update your domain in the config

Open `data/site.json` and set:
```json
"url": "https://YOUR_GITHUB_USERNAME.github.io/YOUR_REPO_NAME"
```

Rebuild: `node build.js` and push.

## Step 2 — Apply for AdSense

1. Go to https://adsense.google.com
2. Sign in with your Google account
3. Click **Get started**
4. Enter your blog URL and your country
5. Connect your Google account to AdSense

## Step 3 — Add the AdSense verification code

Google will give you a code like:
```
ca-pub-1234567890123456
```

Open `data/site.json` and set:
```json
"adsense": {
  "enabled": true,
  "client": "ca-pub-1234567890123456",
  ...
}
```

Rebuild and push. Google verifies automatically (takes 1-14 days).

## Step 4 — Get your ad slot IDs

After approval, in the AdSense dashboard:
- Ads → By ad unit → Create new ad unit (Display ad)
- Create 3 units: "Header", "In-Article", "Footer"
- Copy each numeric slot ID (e.g. `1234567890`)

Update `data/site.json`:
```json
"slots": {
  "header": "1234567890",
  "inArticle": "2345678901",
  "footer": "3456789012"
}
```

Rebuild and push. Ads appear within a few hours.

## Step 5 — Verify ads.txt

Visit `https://yoursite.com/ads.txt` — it should contain:
```
google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0
```

This file is auto-generated from your `client` value. It's required for AdSense payouts.

## Expected timeline

| Milestone | Typical timeframe |
|---|---|
| AdSense application | Day 1 |
| AdSense approval | 1-14 days |
| First ad impressions | Same day as approval |
| First payment ($100 threshold) | 3-12 months |
