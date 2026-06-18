// Browser automation script for AIIncomeLab social media credential procurement.
//
// Uses Playwright to automate Twitter/X and LinkedIn developer portal flows,
// creates a GitHub PAT, and injects all credentials into GitHub Actions secrets.
//
// Setup:
//   npm install playwright
//   npx playwright install chromium
//
// Usage:
//   set "TWITTER_USERNAME=@kanavy9ah" && set "TWITTER_PASSWORD=..." && node scripts/auto-procure-credentials.mjs
//
// Environment variables (all required for the platforms you want):
//   TWITTER_USERNAME, TWITTER_PASSWORD, TWITTER_EMAIL (optional—Twitter email verification)
//   LINKEDIN_EMAIL, LINKEDIN_PASSWORD
//   GITHUB_USERNAME, GITHUB_PASSWORD
//
// Flags:
//   SKIP_TWITTER=1     — skip Twitter/X credential creation
//   SKIP_LINKEDIN=1    — skip LinkedIn credential creation
//   SKIP_GITHUB=1      — skip GitHub PAT creation
//   HEADLESS=1         — run browser headless (default: visible)
//   SLOW_MO=500        — slow down interactions by ms (default: 300)
//   CREDENTIALS_OUT=   — path to save credentials JSON (default: data/credentials.json)

import { chromium } from "playwright";
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const ENV = process.env;
const HEADLESS = ENV.HEADLESS === "1";
const SLOW_MO = parseInt(ENV.SLOW_MO || "300", 10);
const CREDENTIALS_PATH = ENV.CREDENTIALS_OUT || resolve(ROOT, "data", "credentials.json");

const credentials = {};

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function log(step, msg) {
  console.log(`[${step}] ${msg}`);
}

async function screenshot(page, name) {
  const dir = resolve(ROOT, "data", "screenshots");
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: resolve(dir, `${name}.png`), fullPage: false });
  log("SCREENSHOT", `saved: ${name}.png`);
}

async function typeSafe(page, selector, value) {
  await page.waitForSelector(selector, { timeout: 15000 });
  await page.click(selector, { clickCount: 3 });
  await page.fill(selector, "");
  await page.type(selector, value, { delay: 50 });
}

function runPowerShell(scriptPath, envVars) {
  return new Promise((resolve, reject) => {
    const child = spawn("powershell.exe", [
      "-NoProfile", "-NonInteractive",
      "-ExecutionPolicy", "Bypass",
      "-File", scriptPath,
    ], {
      cwd: ROOT,
      env: { ...process.env, ...envVars },
      stdio: ["inherit", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => { stdout += d.toString(); process.stdout.write(d); });
    child.stderr.on("data", (d) => { stderr += d.toString(); process.stderr.write(d); });
    child.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`PowerShell exited ${code}: ${stderr}`));
    });
    child.on("error", reject);
  });
}

async function procureTwitter(page) {
  log("TWITTER", "Starting Twitter/X credential procurement...");

  const username = ENV.TWITTER_USERNAME;
  const password = ENV.TWITTER_PASSWORD;
  const email = ENV.TWITTER_EMAIL;

  if (!username || !password) {
    log("TWITTER", "SKIP: TWITTER_USERNAME or TWITTER_PASSWORD not set");
    return;
  }

  // 1. Login to developer.twitter.com
  log("TWITTER", "Navigating to developer.twitter.com...");
  await page.goto("https://developer.twitter.com", { waitUntil: "networkidle" });
  await screenshot(page, "twitter-01-home");

  // Click "Sign in" button
  try {
    await page.click('a[href*="login"], a:has-text("Sign in"), a:has-text("Sign In")', { timeout: 10000 });
  } catch {
    // Already on login page or already logged in
  }
  await sleep(2000);

  // Check if already logged in
  const currentUrl = page.url();
  if (currentUrl.includes("developer.twitter.com") && !currentUrl.includes("login")) {
    log("TWITTER", "Already logged in to Twitter/X");
  } else {
    // Fill login form
    log("TWITTER", "Filling Twitter/X login...");
    await sleep(2000);

    try {
      await page.waitForSelector('input[name="text"], input[autocomplete="username"]', { timeout: 15000 });
      await page.fill('input[name="text"], input[autocomplete="username"]', username.replace("@", ""));
      await page.click('button:has-text("Next"), button:has-text("Sign in")');
      await sleep(2000);
    } catch {
      log("TWITTER", "Username field not found, maybe already on password step");
    }

    // Handle email verification if prompted
    try {
      await page.waitForSelector('input[name="text"]', { timeout: 5000 });
      if (email) {
        log("TWITTER", "Twitter asking for email verification...");
        await page.fill('input[name="text"]', email);
        await page.click('button:has-text("Next"), button:has-text("Verify")');
        await sleep(2000);
      }
    } catch {
      // No email verification needed
    }

    // Enter password
    try {
      await page.waitForSelector('input[name="password"], input[type="password"]', { timeout: 15000 });
      await page.fill('input[name="password"], input[type="password"]', password);
      await page.click('button:has-text("Log in"), button[type="submit"]');
      await sleep(5000);
    } catch (e) {
      log("TWITTER", `Password entry failed: ${e.message}`);
    }
  }

  await screenshot(page, "twitter-02-after-login");
  await sleep(3000);

  // 2. Navigate to Projects & Apps
  log("TWITTER", "Navigating to Projects & Apps...");
  await page.goto("https://developer.twitter.com/en/portal/projects-and-apps", { waitUntil: "networkidle" });
  await screenshot(page, "twitter-03-projects");
  await sleep(2000);

  // Check if we need to accept developer terms
  try {
    const termsBtn = await page.$('button:has-text("Accept"), button:has-text("Agree")');
    if (termsBtn) {
      log("TWITTER", "Accepting developer terms...");
      await termsBtn.click();
      await sleep(3000);
      await screenshot(page, "twitter-03b-terms-accepted");
    }
  } catch {
    // No terms needed
  }

  // 3. Create Project
  log("TWITTER", "Looking for Create Project button...");
  try {
    let createBtn = await page.$('a:has-text("Create Project"), button:has-text("Create Project"), a:has-text("Create project"), button:has-text("Add App")');
    if (!createBtn) {
      createBtn = await page.$('a[href*="new-project"], a[href*="create"]');
    }
    if (createBtn) {
      await createBtn.click();
      await sleep(3000);
      await screenshot(page, "twitter-04-create-project");
    } else {
      log("TWITTER", "Create Project button not found, trying alternative approach");
      await page.goto("https://developer.twitter.com/en/portal/projects/new", { waitUntil: "networkidle" });
      await sleep(3000);
    }
  } catch (e) {
    log("TWITTER", `Create project navigation: ${e.message}`);
  }

  // 4. Fill project details
  try {
    log("TWITTER", "Filling project details...");
    const nameField = await page.$('input[name*="name"], input[placeholder*="Name"], input[placeholder*="Project"]');
    if (nameField) {
      await nameField.click({ clickCount: 3 });
      await nameField.fill("AIIncomeLab Auto-Poster");
      await screenshot(page, "twitter-05-project-form");
    }
  } catch {
    log("TWITTER", "Could not fill project name, continuing...");
  }

  // 5. Fill use case and submit
  try {
    const useCaseField = await page.$('textarea, input[placeholder*="Use case"], input[placeholder*="purpose"]');
    if (useCaseField) {
      await useCaseField.fill("Posting blog content automatically from our site");
    }
  } catch {
    // Continue
  }

  // Try to submit
  try {
    const submitBtn = await page.$('button[type="submit"], button:has-text("Next"), button:has-text("Create"), button:has-text("Continue")');
    if (submitBtn) {
      await submitBtn.click();
      await sleep(3000);
    }
  } catch {
    log("TWITTER", "Submit button not found");
  }

  await screenshot(page, "twitter-06-after-project-create");

  // 5b. If prompted to create app within project, fill app name
  try {
    const appNameField = await page.$('input[placeholder*="App Name"], input[placeholder*="app name"], input[name*="app"]');
    if (appNameField) {
      await appNameField.fill("aiincomelab-social-bot");
      const createBtn = await page.$('button:has-text("Create"), button[type="submit"]');
      if (createBtn) await createBtn.click();
      await sleep(3000);
    }
  } catch {
    // Continue
  }

  await screenshot(page, "twitter-07-keys-page");

  // 6. Navigate to Keys and Tokens tab
  log("TWITTER", "Navigating to Keys and Tokens...");
  try {
    const keysTab = await page.$('a:has-text("Keys and Tokens"), button:has-text("Keys and Tokens"), a[href*="keys"]');
    if (keysTab) {
      await keysTab.click();
      await sleep(3000);
    } else {
      // Try direct URL
      const appKeysUrl = await page.evaluate(() => {
        const match = window.location.href.match(/\/apps\/(\d+)/);
        return match ? `https://developer.twitter.com/en/portal/apps/${match[1]}/keys` : null;
      });
      if (appKeysUrl) {
        await page.goto(appKeysUrl, { waitUntil: "networkidle" });
        await sleep(2000);
      }
    }
  } catch (e) {
    log("TWITTER", `Navigating to keys: ${e.message}`);
  }

  await screenshot(page, "twitter-08-keys-tab");

  // 7. Extract API Key and Secret
  log("TWITTER", "Extracting API credentials...");
  try {
    // API Key
    const apiKeyField = await page.$('input[value]:not([type="hidden"]):not([name*="token"])', { timeout: 5000 });
    if (apiKeyField) {
      const apiKey = await apiKeyField.inputValue();
      if (apiKey && apiKey.length > 10) {
        credentials.X_API_KEY = apiKey;
        log("TWITTER", `Found API Key: ${apiKey.substring(0, 8)}...`);
      }
    }

    // Try to show and extract API Secret
    const showSecretBtns = await page.$$('button:has-text("Show"), button:has-text("Regenerate")');
    for (const btn of showSecretBtns) {
      try {
        await btn.click();
        await sleep(1000);
      } catch {}
    }

    // Extract all input values
    const allInputs = await page.$$('input[type="text"], input[type="password"]');
    for (const input of allInputs) {
      const id = await input.getAttribute("id") || "";
      const name = await input.getAttribute("name") || "";
      const value = await input.inputValue();
      if (value && value.length > 10) {
        if (id.includes("apiKey") || name.includes("api_key") || name.includes("consumer_key")) {
          credentials.X_API_KEY = value;
        } else if (id.includes("apiSecret") || name.includes("api_secret") || name.includes("consumer_secret")) {
          credentials.X_API_SECRET = value;
        } else if (id.includes("accessToken") || name.includes("access_token")) {
          credentials.X_ACCESS_TOKEN = value;
        } else if (id.includes("accessSecret") || name.includes("access_secret") || name.includes("access_token_secret")) {
          credentials.X_ACCESS_SECRET = value;
        }
      }
    }

    // Generate new token if needed
    if (!credentials.X_ACCESS_TOKEN) {
      log("TWITTER", "Access token not found, attempting to generate...");
      const generateBtns = await page.$$('button:has-text("Generate"), a:has-text("Generate")');
      for (const btn of generateBtns) {
        const text = await btn.textContent();
        if (text?.toLowerCase().includes("access token") || text?.toLowerCase().includes("token")) {
          await btn.click();
          await sleep(3000);
          break;
        }
      }
      await screenshot(page, "twitter-09-token-generated");

      // Try to read the generated token
      const tokenInput = await page.$('input[value*=""], input:not([value=""])');
      if (tokenInput) {
        const val = await tokenInput.inputValue();
        if (val && val.length > 10) {
          // Determine which field we're on
          const label = await page.evaluate((el) => {
            const lbl = document.querySelector(`label[for="${el.id}"]`);
            return lbl ? lbl.textContent : "";
          }, tokenInput);
          if (label.toLowerCase().includes("access token") && !label.toLowerCase().includes("secret")) {
            credentials.X_ACCESS_TOKEN = val;
          } else if (label.toLowerCase().includes("secret")) {
            credentials.X_ACCESS_SECRET = val;
          }
        }
      }
    }

    await screenshot(page, "twitter-10-credentials-extracted");

  } catch (e) {
    log("TWITTER", `Error extracting credentials: ${e.message}`);
    await screenshot(page, "twitter-error");
  }

  log("TWITTER", `Extracted: ${Object.keys(credentials).filter(k => k.startsWith("X_")).length > 0 ? Object.keys(credentials).filter(k => k.startsWith("X_")).join(", ") : "none"}`);
  await sleep(500);
}

async function procureLinkedIn(page) {
  log("LINKEDIN", "Starting LinkedIn credential procurement...");

  const email = ENV.LINKEDIN_EMAIL;
  const password = ENV.LINKEDIN_PASSWORD;

  if (!email || !password) {
    log("LINKEDIN", "SKIP: LINKEDIN_EMAIL or LINKEDIN_PASSWORD not set");
    return;
  }

  // 1. Login to LinkedIn
  log("LINKEDIN", "Navigating to linkedin.com...");
  await page.goto("https://www.linkedin.com/login", { waitUntil: "networkidle" });
  await screenshot(page, "linkedin-01-login");
  await sleep(2000);

  try {
    await page.fill('input[name="session_key"], input#username', email);
    await page.fill('input[name="session_password"], input#password', password);
    await page.click('button[type="submit"]');
    await sleep(5000);
    await screenshot(page, "linkedin-02-after-login");
  } catch (e) {
    log("LINKEDIN", `Login failed: ${e.message}`);
    return;
  }

  // 2. Navigate to developer apps
  log("LINKEDIN", "Navigating to developer apps...");
  await page.goto("https://www.linkedin.com/developers/apps", { waitUntil: "networkidle" });
  await screenshot(page, "linkedin-03-apps");
  await sleep(2000);

  // 3. Create App
  log("LINKEDIN", "Creating app...");
  try {
    const createBtn = await page.$('a:has-text("Create App"), button:has-text("Create app")');
    if (createBtn) {
      await createBtn.click();
      await sleep(3000);
    } else {
      await page.goto("https://www.linkedin.com/developers/apps/new", { waitUntil: "networkidle" });
      await sleep(2000);
    }
  } catch {
    await page.goto("https://www.linkedin.com/developers/apps/new", { waitUntil: "networkidle" });
    await sleep(2000);
  }

  await screenshot(page, "linkedin-04-create-app-form");

  // Fill app details
  try {
    const nameField = await page.$('input[name*="app_name"], input[name*="name"], input[placeholder*="App Name"]');
    if (nameField) {
      await nameField.click({ clickCount: 3 });
      await nameField.fill("AIIncomeLab Social Publisher");
    }

    // Company / profile page selection
    const pageSelect = await page.$('select[name*="page"], select[name*="company"]');
    if (pageSelect) {
      await pageSelect.selectOption({ index: 1 });
    }

    const privacyField = await page.$('input[type="url"], input[name*="privacy"]');
    if (privacyField) {
      await privacyField.fill("https://aiincomelab.com/privacy");
    }

    const logoField = await page.$('input[type="file"]');
    if (logoField) {
      // Skip logo upload - can be done manually
      log("LINKEDIN", "Logo upload field found - skipping (can be added manually)");
    }

    const agreeCheckbox = await page.$('input[type="checkbox"]');
    if (agreeCheckbox) {
      await agreeCheckbox.check();
    }

    await screenshot(page, "linkedin-05-create-form-filled");

    const submitBtn = await page.$('button[type="submit"], button:has-text("Create")');
    if (submitBtn) {
      await submitBtn.click();
      await sleep(5000);
    }
  } catch (e) {
    log("LINKEDIN", `App creation form error: ${e.message}`);
    await screenshot(page, "linkedin-error");
  }

  await screenshot(page, "linkedin-06-after-create");

  // 4. Get app ID from URL
  const appId = await page.evaluate(() => {
    const match = window.location.href.match(/\/apps\/(\d+)/);
    return match ? match[1] : null;
  });
  log("LINKEDIN", `App ID: ${appId || "unknown"}`);

  // 5. Add product w_member_social
  if (appId) {
    try {
      log("LINKEDIN", "Adding w_member_social product...");
      const productsTab = await page.$('a:has-text("Products"), a[href*="products"]');
      if (productsTab) {
        await productsTab.click();
        await sleep(2000);
      }
      await page.goto(`https://www.linkedin.com/developers/apps/${appId}/products`, { waitUntil: "networkidle" });
      await sleep(2000);
      await screenshot(page, "linkedin-07-products");

      const shareBtn = await page.$('button:has-text("Add"), button:has-text("Request")');
      if (shareBtn) {
        await shareBtn.click();
        await sleep(2000);
      }
    } catch (e) {
      log("LINKEDIN", `Add product error: ${e.message}`);
    }
  }

  // 6. Navigate to OAuth Token Generator
  log("LINKEDIN", "Generating access token...");
  await page.goto("https://www.linkedin.com/developers/tools/oauth/token-generator", { waitUntil: "networkidle" });
  await screenshot(page, "linkedin-08-token-generator");
  await sleep(2000);

  try {
    // Select scopes
    const scopeCheckboxes = await page.$$('input[type="checkbox"]');
    for (const cb of scopeCheckboxes) {
      const label = await page.evaluate((el) => {
        const lbl = document.querySelector(`label[for="${el.id}"]`);
        return lbl ? lbl.textContent : el.id || "";
      }, cb);
      if (label.includes("w_member_social") || label.includes("r_liteprofile")) {
        const checked = await cb.isChecked();
        if (!checked) await cb.check();
      }
    }

    // Select app - we need the developer app to be selected
    const appSelect = await page.$('select');
    if (appSelect) {
      const options = await appSelect.$$('option');
      for (const opt of options) {
        const text = await opt.textContent();
        if (text.includes("AIIncomeLab")) {
          await opt.click();
          break;
        }
      }
    }

    const generateBtn = await page.$('button:has-text("Generate"), button:has-text("Get token"), button[type="submit"]');
    if (generateBtn) {
      await generateBtn.click();
      await sleep(5000);
    }

    await screenshot(page, "linkedin-09-token-result");

    // Extract token from the page
    const tokenInput = await page.$('textarea, input[value*=""]');
    if (tokenInput) {
      let tokenValue = await tokenInput.inputValue();
      if (!tokenValue) {
        tokenValue = await page.evaluate((el) => el.textContent, tokenInput);
      }
      if (tokenValue && tokenValue.length > 20) {
        credentials.LINKEDIN_ACCESS_TOKEN = tokenValue;
        log("LINKEDIN", `Access token extracted: ${tokenValue.substring(0, 10)}...`);

        // Get author URN by calling API
        try {
          log("LINKEDIN", "Fetching author URN...");
          const response = await page.evaluate(async (t) => {
            const resp = await fetch("https://api.linkedin.com/v2/userinfo", {
              headers: { Authorization: `Bearer ${t}` }
            });
            return await resp.json();
          }, tokenValue);
          if (response.sub) {
            credentials.LINKEDIN_AUTHOR_URN = `urn:li:person:${response.sub}`;
            log("LINKEDIN", `Author URN: ${credentials.LINKEDIN_AUTHOR_URN}`);
          }
        } catch (e) {
          log("LINKEDIN", `Failed to get author URN: ${e.message}`);
        }
      }
    }
  } catch (e) {
    log("LINKEDIN", `Token generation error: ${e.message}`);
  }

  await screenshot(page, "linkedin-10-done");
}

async function createGitHubPAT(page) {
  log("GITHUB", "Starting GitHub PAT creation...");

  const username = ENV.GITHUB_USERNAME;
  const password = ENV.GITHUB_PASSWORD;

  if (!username || !password) {
    log("GITHUB", "SKIP: GITHUB_USERNAME or GITHUB_PASSWORD not set");
    return;
  }

  // 1. Login
  log("GITHUB", "Logging into GitHub...");
  await page.goto("https://github.com/login", { waitUntil: "networkidle" });
  await screenshot(page, "github-01-login");

  try {
    await page.fill('input[name="login"]', username);
    await page.fill('input[name="password"]', password);
    await page.click('input[type="submit"], button[type="submit"]');
    await sleep(5000);
    await screenshot(page, "github-02-after-login");

    // Handle 2FA if prompted
    const otpField = await page.$('input[name="otp"], input#otp', { timeout: 5000 }).catch(() => null);
    if (otpField) {
      log("GITHUB", "2FA required - please enter OTP code manually");
      console.log("======================================================");
      console.log("2FA is enabled on this GitHub account.");
      console.log("Enter the OTP code from your authenticator app.");
      console.log("The script will wait up to 60 seconds for your input.");
      console.log("======================================================");
      await screenshot(page, "github-2fa-prompt");
      // Wait for manual input
      await page.waitForFunction(
        () => document.querySelector('input[name="otp"]')?.value?.length > 0,
        { timeout: 60000 }
      ).catch(() => log("GITHUB", "2FA wait timeout - continuing"));
      const otp = await otpField.inputValue();
      if (otp) {
        await page.click('button[type="submit"]');
        await sleep(3000);
      }
    }
  } catch (e) {
    log("GITHUB", `Login error: ${e.message}`);
    return;
  }

  // 2. Navigate to PAT creation
  log("GITHUB", "Navigating to token settings...");
  await page.goto("https://github.com/settings/tokens", { waitUntil: "networkidle" });
  await screenshot(page, "github-03-tokens");
  await sleep(2000);

  try {
    // Click "Generate new token" button
    const genBtn = await page.$('a:has-text("Generate new token"), button:has-text("Generate new token")');
    if (genBtn) {
      await genBtn.click();
      await sleep(1000);
    }

    // Select "Classic" if prompted
    const classicBtn = await page.$('a:has-text("classic"), a[href*="classic"]');
    if (classicBtn) {
      await classicBtn.click();
      await sleep(2000);
    }
  } catch (e) {
    log("GITHUB", `Token nav error: ${e.message}`);
  }

  await screenshot(page, "github-04-new-token-form");

  // 3. Fill token form
  try {
    // Token name
    const nameField = await page.$('input[name*="description"], input[name*="note"], input#token_description');
    if (nameField) {
      await nameField.fill("AIIncomeLab Social Auto-Poster");
    }

    // Expiration: select "No expiration" if available, or 90 days
    const expirySelect = await page.$('select[name*="expiration"], select#expiration');
    if (expirySelect) {
      const options = await expirySelect.$$('option');
      // Prefer "No expiration", otherwise longest available
      let selected = false;
      for (const opt of options) {
        const text = await opt.textContent();
        if (text?.toLowerCase().includes("no expiration")) {
          await opt.click();
          selected = true;
          break;
        }
      }
      if (!selected) {
        // Select last option (usually longest period)
        await options[options.length - 1].click();
      }
    }

    // Select repo scope
    const repoCheckbox = await page.$('input[value="repo"]');
    if (repoCheckbox) {
      await repoCheckbox.check();
    }

    await screenshot(page, "github-05-form-filled");

    // Scroll down and click generate
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await sleep(500);

    const genTokenBtn = await page.$('button:has-text("Generate token"), button[type="submit"]');
    if (genTokenBtn) {
      await genTokenBtn.click();
      await sleep(5000);
    }
  } catch (e) {
    log("GITHUB", `Token form error: ${e.message}`);
  }

  await screenshot(page, "github-06-token-created");

  // 4. Extract the generated token
  try {
    const tokenField = await page.$('input#new-oauth-token, input[value*="ghp_"], input[value*="github_pat_"]');
    if (tokenField) {
      const pat = await tokenField.inputValue();
      if (pat) {
        credentials.GH_PAT = pat;
        log("GITHUB", `PAT created: ${pat.substring(0, 10)}...`);
      }
    }

    // Fallback: look for any input with ghp_ or github_pat_ value
    if (!credentials.GH_PAT) {
      const allInputs = await page.$$('input');
      for (const input of allInputs) {
        const val = await input.inputValue();
        if (val && (val.startsWith("ghp_") || val.startsWith("github_pat_"))) {
          credentials.GH_PAT = val;
          log("GITHUB", `PAT found via fallback: ${val.substring(0, 10)}...`);
          break;
        }
      }
    }
  } catch (e) {
    log("GITHUB", `Token extraction error: ${e.message}`);
  }
}

async function saveCredentials() {
  const keys = Object.keys(credentials);
  if (keys.length === 0) {
    log("SAVE", "No credentials to save");
    return false;
  }

  mkdirSync(dirname(CREDENTIALS_PATH), { recursive: true });
  writeFileSync(CREDENTIALS_PATH, JSON.stringify(credentials, null, 2));
  log("SAVE", `Credentials saved to ${CREDENTIALS_PATH}`);
  log("SAVE", `Keys: ${keys.join(", ")}`);
  return true;
}

async function injectSecrets() {
  if (!credentials.GH_PAT) {
    log("INJECT", "SKIP: No GitHub PAT available for injection");
    return false;
  }

  const psScript = resolve(ROOT, "scripts", "set-github-secrets.ps1");
  if (!existsSync(psScript)) {
    log("INJECT", `SKIP: ${psScript} not found`);
    return false;
  }

  log("INJECT", "Running secrets injection script...");
  try {
    const envVars = { ...credentials };
    // GH_PAT needs to be set as the env var that the PS script expects
    envVars.GH_PAT = credentials.GH_PAT;
    // Also set individual creds as env vars for the script
    if (credentials.X_API_KEY) envVars.X_API_KEY = credentials.X_API_KEY;
    if (credentials.X_API_SECRET) envVars.X_API_SECRET = credentials.X_API_SECRET;
    if (credentials.X_ACCESS_TOKEN) envVars.X_ACCESS_TOKEN = credentials.X_ACCESS_TOKEN;
    if (credentials.X_ACCESS_SECRET) envVars.X_ACCESS_SECRET = credentials.X_ACCESS_SECRET;
    if (credentials.LINKEDIN_ACCESS_TOKEN) envVars.LINKEDIN_ACCESS_TOKEN = credentials.LINKEDIN_ACCESS_TOKEN;
    if (credentials.LINKEDIN_AUTHOR_URN) envVars.LINKEDIN_AUTHOR_URN = credentials.LINKEDIN_AUTHOR_URN;

    await runPowerShell(psScript, envVars);
    log("INJECT", "Secrets injected successfully");
    return true;
  } catch (e) {
    log("INJECT", `Injection failed: ${e.message}`);
    log("INJECT", "You can run the script manually:");
    log("INJECT", `  $env:GH_PAT = "${credentials.GH_PAT?.substring(0, 10) || '...'}..."`);
    log("INJECT", `  .\\scripts\\set-github-secrets.ps1`);
    return false;
  }
}

async function main() {
  console.log("========================================");
  console.log("AIIncomeLab - Credential Auto-Procurement");
  console.log("========================================\n");

  const flags = [];
  if (ENV.SKIP_TWITTER) flags.push("Twitter/X");
  if (ENV.SKIP_LINKEDIN) flags.push("LinkedIn");
  if (ENV.SKIP_GITHUB) flags.push("GitHub PAT");
  if (flags.length > 0) {
    console.log(`Skipping: ${flags.join(", ")}\n`);
  }

  const browser = await chromium.launch({
    headless: HEADLESS,
    slowMo: SLOW_MO,
    args: ["--disable-blink-features=AutomationControlled"],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  });

  let saved = false;
  try {
    // Twitter/X
    if (!ENV.SKIP_TWITTER) {
      const twitterPage = await context.newPage();
      await procureTwitter(twitterPage);
      await twitterPage.close();
    }

    // LinkedIn
    if (!ENV.SKIP_LINKEDIN) {
      const linkedinPage = await context.newPage();
      await procureLinkedIn(linkedinPage);
      await linkedinPage.close();
    }

    // GitHub PAT
    if (!ENV.SKIP_GITHUB) {
      const githubPage = await context.newPage();
      await createGitHubPAT(githubPage);
      await githubPage.close();
    }

    // Save credentials
    saved = await saveCredentials();

    // Inject into GitHub
    if (saved && credentials.GH_PAT) {
      console.log("\n--- Injecting secrets into GitHub ---");
      await injectSecrets();
    }

  } catch (e) {
    console.error("\nFATAL:", e.message);
    await saveCredentials();
  } finally {
    await browser.close();
  }

  // Summary
  console.log("\n========================================");
  console.log("Credential Procurement Summary");
  console.log("========================================");
  const hasTwitter = credentials.X_API_KEY && credentials.X_API_SECRET && credentials.X_ACCESS_TOKEN && credentials.X_ACCESS_SECRET;
  const hasLinkedIn = credentials.LINKEDIN_ACCESS_TOKEN && credentials.LINKEDIN_AUTHOR_URN;
  const hasGitHub = credentials.GH_PAT;
  console.log(`Twitter/X:  ${hasTwitter ? "✓ READY" : "✗ MISSING"}`);
  console.log(`LinkedIn:   ${hasLinkedIn ? "✓ READY" : "✗ MISSING"}`);
  console.log(`GitHub PAT: ${hasGitHub ? "✓ READY" : "✗ MISSING"}`);
  console.log("");

  if (hasTwitter && hasLinkedIn && hasGitHub) {
    console.log("All credentials procured and injected!");
    console.log("Next: verify with: npm run social");
  } else if (saved) {
    console.log(`Credentials saved to: ${CREDENTIALS_PATH}`);
    console.log("Inject with: .\\scripts\\set-github-secrets.ps1");
  } else {
    console.log("No credentials were obtained. Check screenshots in data/screenshots/");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
