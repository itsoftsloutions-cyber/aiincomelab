# Google Analytics 4 + Search Console Setup

## Prerequisites
- Your blog is live at a real URL (`https://itsoftsloutions-cyber.github.io/aiincomelab`)
- You have a Google account with access to the AdSense account

---

## Part 1 — Google Analytics 4 (GA4)

### Step 1 — Create a GA4 property

1. Go to https://analytics.google.com
2. Sign in with your Google account
3. Click **Admin** (gear icon, bottom-left)
4. Under **Property** column, click **Create Property**
5. Enter:
   - **Property name:** `AIIncomeLab`
   - **Reporting time zone:** Your timezone
   - **Currency:** USD
6. Click **Next**
7. Select your **Industry category** (e.g., "Publishing / Media" or "Business / Marketing")
8. Select your **Business size** (e.g., "Small")
9. Click **Create**

### Step 2 — Get your Measurement ID

1. After property is created, go to **Admin → Data Streams**
2. Click **Web**
3. Enter your site URL: `https://itsoftsloutions-cyber.github.io/aiincomelab`
4. Enter stream name: `AIIncomeLab Web`
5. Click **Create stream**
6. Copy the **Measurement ID** (looks like `G-XXXXXXXX`)

### Step 3 — Configure the site

Open `data/site.json` and set:

```json
"analytics": {
  "ga4": "G-XXXXXXXX"
}
```

Replace `G-XXXXXXXX` with your real Measurement ID.

### Step 4 — Verify GA4 is live

1. Rebuild: `node build.js`
2. Deploy (push to GitHub — GitHub Actions builds automatically)
3. Visit your site and open DevTools → Network tab
4. Reload — you should see requests to `https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXX`
5. Check **Realtime** report in GA4 — you should see yourself within 30 seconds

---

## Part 2 — Google Search Console (GSC)

### Step 1 — Add your property to Search Console

1. Go to https://search.google.com/search-console
2. Sign in with your Google account
3. Click **Add property**
4. Choose **URL prefix** method
5. Enter: `https://itsoftsloutions-cyber.github.io/aiincomelab`
6. Click **Continue**

### Step 2 — Verify ownership (recommended: HTML meta tag)

1. On the verification page, select **HTML tag** method
2. Google shows you a meta tag like:
   ```html
   <meta name="google-site-verification" content="your-verification-code-here" />
   ```
3. Copy the `content` value only (the long string inside the quotes)

### Step 3 — Configure the site

Open `data/site.json` and set:

```json
"verification": {
  "google": "your-verification-code-here"
}
```

Replace `your-verification-code-here` with the content string from Step 2.

### Step 4 — Verify ownership

1. Rebuild: `node build.js`
2. Deploy (push to GitHub)
3. In Search Console, click **Verify**
4. If successful, you'll see "Ownership verified"

### Step 5 — Submit your sitemap

1. In Search Console, go to **Sitemaps**
2. Enter: `sitemap.xml`
3. Click **Submit**
4. Within a few days you'll see indexed pages in the report

---

## Part 3 — Verify Everything

| Item | How to check |
|---|---|
| GA4 tracking | Visit site → Network tab → look for `gtag/js?id=G-` requests |
| GA4 realtime | Open GA4 → Reports → Realtime → you should appear |
| GSC verification | Visit site → View page source → search for `google-site-verification` |
| GSC sitemap | Search Console → Sitemaps → status should show "Success" |
| Indexing | Search Console → Pages → see which URLs are indexed |

After verification, Search Console data appears within 48 hours and GA4 data within 24 hours.

---

## Enhanced Tracking (built in)

The site includes automatic enhanced GA4 event tracking:

| Event | Trigger |
|---|---|
| `scroll_depth` | User scrolls 25%, 50%, 75%, 90% of page |
| `outbound_click` | Click on external / affiliate links |
| `email_subscribe` | Newsletter form submission |

No extra configuration needed — these fire automatically when GA4 is active.
