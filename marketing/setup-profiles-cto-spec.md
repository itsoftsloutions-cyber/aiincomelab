# CTO Spec: CI Integration for Social Profile Setup

## Summary

Add a one-shot GitHub Actions workflow (`setup-social-profiles.yml`) that runs `npm run setup-profiles` to automate social media profile configuration across 4 platforms.

## Background

The automation script `scripts/setup-profiles.js` handles:
- **Twitter/X**: Update display name, bio, website URL, pinned tweet, profile/header images (via OAuth 1.0a + API v2)
- **LinkedIn**: Attempt company page update (if org admin token), otherwise documents limitation
- **Pinterest**: Update profile description + create 5 boards (if PINTEREST_ACCESS_TOKEN exists)
- **Instagram**: Checks current state, documents API limitations

Currently the only available credentials are the GitHub secrets in autopublish.yml. The script gracefully skips any platform whose credentials are missing.

## Required: New Workflow File

Create `.github/workflows/setup-social-profiles.yml`:

```yaml
name: Setup Social Media Profiles

on:
  workflow_dispatch:
    inputs:
      dry_run:
        description: "Preview only, no API calls"
        required: true
        default: "true"
        type: boolean

jobs:
  setup-profiles:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Configure social profiles
        continue-on-error: true
        env:
          DRY_RUN: ${{ github.event.inputs.dry_run == 'true' && '1' || '' }}
          X_API_KEY: ${{ secrets.X_API_KEY }}
          X_API_SECRET: ${{ secrets.X_API_SECRET }}
          X_ACCESS_TOKEN: ${{ secrets.X_ACCESS_TOKEN }}
          X_ACCESS_SECRET: ${{ secrets.X_ACCESS_SECRET }}
          LINKEDIN_ACCESS_TOKEN: ${{ secrets.LINKEDIN_ACCESS_TOKEN }}
          LINKEDIN_AUTHOR_URN: ${{ secrets.LINKEDIN_AUTHOR_URN }}
          # Pinterest token — add to secrets if available
          # PINTEREST_ACCESS_TOKEN: ${{ secrets.PINTEREST_ACCESS_TOKEN }}
          IG_USER_ID: ${{ secrets.IG_USER_ID }}
          IG_ACCESS_TOKEN: ${{ secrets.IG_ACCESS_TOKEN }}
        run: npm run setup-profiles
```

## To Run

1. Go to GitHub → Actions → "Setup Social Media Profiles" → "Run workflow"
2. For first run: set `dry_run` to `true` to preview changes
3. For actual execution: set `dry_run` to `false`
4. After run, verify profiles manually at each platform

## Known Limitations

- **Twitter/X profile/header images**: Requires `PROFILE_IMG` and `HEADER_IMG` env vars pointing to PNG files. Currently no images in repo. Need to generate or provide Canva assets.
- **LinkedIn Company Page**: Personal OAuth tokens can't create company pages. Only works if `LINKEDIN_AUTHOR_URN` is `urn:li:organization:xxxx`. Manual creation still needed for first-time setup.
- **Instagram profile name/bio**: Instagram Graph API doesn't support updating these fields. Must be done manually in the Instagram app.
- **Twitter scopes**: OAuth tokens need `users.write` scope for profile updates. Existing tokens may only have `tweet.write`. If PATCH /users/:id fails with "Forbidden", the token needs re-authorization with the additional scope.

## Priority

Low-urgency, one-time task. No profile data will be corrupted on failure — each platform is independent.
