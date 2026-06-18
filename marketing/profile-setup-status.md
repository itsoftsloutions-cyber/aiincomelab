# AIA-10: Social Media Profile Setup — Status Report

## Summary

| Platform | Handle/URL | Status | Setup Guide Match | Action Needed |
|----------|-----------|--------|-------------------|---------------|
| **Twitter/X** | @kanavy9ah / x.com/kanavy9ah | ✅ **Exists** | ❌ Major gaps | Profile config (name, bio, image, pinned tweet) |
| **LinkedIn** | Company Page: AIIncomeLab | ❌ **Not created** | ❌ Not started | Create Company Page from scratch |
| **Instagram** | @aiincomelab | ⚠️ **Exists (wrong owner)** | ❌ Wrong branding | Reclaim handle or create new one |
| **Pinterest** | @aiincomelab / pinterest.com/aiincomelab | ✅ **Exists** | ⚠️ Empty (no boards/pins) | Create 5 boards, add pins |
| **Reddit** | r/AIIncomeLab | ✅ **Exists** | N/A (community engagement) | Needs content/posts |
| **YouTube** | @AiIncome-Lab | ⚠️ **Exists (external)** | Out of scope (deferred) | Deferred per CEO decision |

---

## 1. Twitter/X — @kanavy9ah

**Status**: Profile exists but is essentially bare.

| Element | Required (Setup Guide) | Current | Gap |
|---------|----------------------|---------|-----|
| Display Name | "AIIncomeLab \| AI × Money" | "kanav" | ❌ Needs update |
| Bio | 160-char bio with link | Empty | ❌ Needs bio |
| Profile Image | Logo or headshot | None | ❌ Needs image |
| Header Image | Dark gradient 1500x500px | Default | ❌ Needs header |
| Pinned Tweet | "1 actionable AI tip..." | None | ❌ Needs pin |
| Website URL | aiincomelab.com with UTM | Not set | ❌ Needs URL |

**Action**: Manual profile editing required. All fields need to be populated per `marketing/profile-setup-guide.md`.

---

## 2. LinkedIn — Company Page: AIIncomeLab

**Status**: Not created.

The current config URL (`linkedin.com/in/kanav-sharma-aiincomelab/`) returns **404**. No AIIncomeLab Company Page exists on LinkedIn.

| Element | Required |
|---------|----------|
| Page Name | AIIncomeLab |
| Tagline | "Practical AI tools and strategies for building online income." |
| About | AIIncomeLab no-hype description (see setup guide) |
| Industry | Technology, Information and Internet |
| URL | aiincomelab.com with UTM tags |
| Featured | Pin 3 top blog posts |

**Action**: Create LinkedIn Company Page manually. See `marketing/profile-setup-guide.md` for full spec. Remove the broken personal profile URL from site.json (done).

---

## 3. Instagram — @aiincomelab

**Status**: The @aiincomelab handle exists on Instagram but has **wrong branding** — its bio says "Business Money AI" and it has 0 posts. This appears to be owned by a different entity/project. An alternative `@_aiincomelab` also exists but is empty.

| Handle | Status | Issue |
|--------|--------|-------|
| @aiincomelab | Exists, wrong branding | Needs to reclaim or create variant |
| @_aiincomelab | Exists, empty | Available alternative |
| @aiincomelab (needs creation) | Not under our control | |

**Options**:
1. Contact current @aiincomelab owner to reclaim
2. Use @_aiincomelab or create new handle like @aiincomelabofficial

**Not added to site.json** until we have a confirmed account under our control.

---

## 4. Pinterest — @aiincomelab

**Status**: Profile is created with correct brand identity ("AI INCOME LAB") but is empty.

| Element | Required | Current |
|---------|----------|---------|
| Username | aiincomelab | ✅ aiincomelab |
| Display Name | "AIIncomeLab \| AI Tools & Income" | "AI INCOME LAB" (close) |
| Bio | "Pin-worthy AI tools..." | ✅ Has bio (acceptable) |
| Profile Image | Same logo mark | ❌ Unknown |
| Boards | 5 initial boards (Best AI Tools, Make Money Online, AI Productivity, Blogging Tips, Side Hustles) | 0 boards ❌ |
| Pins | None yet | ❌ |

**Action**: Create 5 boards per setup guide. Add pins linking to blog posts. Added to site.json ✅.

---

## 5. Reddit — r/AIIncomeLab

**Status**: Community exists (created Feb 20, 2026). Not referenced in the setup guide directly but mentioned in community-engagement-guide.md. Verified via web search.

**Action**: Create first posts, engage with the community per community-engagement-guide.md.

---

## 6. site.json Updates Made

**Before**:
```json
"social": {
    "twitter": "https://x.com/kanavy9ah",
    "linkedin": "https://linkedin.com/in/kanav-sharma-aiincomelab/"
}
```

**After**:
```json
"social": {
    "twitter": "https://x.com/kanavy9ah",
    "pinterest": "https://www.pinterest.com/aiincomelab/"
}
```

**Changes**:
- Removed broken LinkedIn URL (404)
- Added verified Pinterest URL
- Instagram omitted until account under our control is confirmed

**Note**: The `sameAs` JSON-LD structured data in `build.js:336` automatically picks up all entries from this object, so adding Pinterest will strengthen our Organization schema and E-E-A-T signals on next build.

---

## Profiles Verified but Needing Manual Configuration

### Priority 1 — Do First
1. **Twitter/X profile makeover**: display name, bio, image, header, pinned tweet, website URL
2. **LinkedIn Company Page creation**: full page setup per profile-setup-guide.md

### Priority 2 — Do Next
3. **Instagram**: resolve handle conflict, then create profile per setup guide
4. **Pinterest**: create 5 boards with initial pins per setup guide

### Priority 3 — Ongoing
5. **Reddit r/AIIncomeLab**: start posting and engaging
6. **All platforms**: populate with Week 1 and Week 2 posts from `marketing/week1-posts.md` and `marketing/week2-posts.md`

---

## Recommendations for CEO

1. **Twitter/X**: Log into @kanavy9ah and update: display name, bio, profile/header images, pinned tweet, website URL with UTM tags. ~15 min task.
2. **LinkedIn**: Create AIIncomeLab Company Page. ~20 min task. Use the spec in `marketing/profile-setup-guide.md`.
3. **Instagram**: Decide on handle strategy. @aiincomelab is taken with wrong branding. @_aiincomelab is available but empty. Creating a new handle like @aiincomelab.ai or @aiincomelab_blog may be fastest.
4. **Pinterest**: Already created but empty. Someone with access needs to create 5 boards. ~10 min task.
5. **After profiles are configured**: The social auto-posting pipeline (`.github/workflows/autopublish.yml`) needs the corresponding secrets added for Instagram and Pinterest distributions — route this to CTO once accounts are ready.
