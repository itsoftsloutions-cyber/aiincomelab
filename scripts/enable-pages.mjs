// Enables GitHub Pages with GitHub Actions source via API.
import https from "node:https";

const [,, token, user, repo] = process.argv;
if (!token || !user || !repo) { console.error("Usage: enable-pages.mjs TOKEN USER REPO"); process.exit(1); }

function apiRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: "api.github.com", path, method,
      headers: {
        "Authorization": `Bearer ${token}`,
        "User-Agent": "AIIncomeLab-Deploy/1.0",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}),
      },
    }, res => {
      let d = "";
      res.on("data", c => d += c);
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, body: d }); }
      });
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// Enable Pages with GitHub Actions source
const r = await apiRequest("POST", `/repos/${user}/${repo}/pages`, {
  build_type: "workflow",
  source: { branch: "master", path: "/" },
});

if (r.status === 201 || r.status === 200 || r.status === 409) {
  console.log(`GitHub Pages enabled: https://${user}.github.io/${repo}/`);
} else {
  // Try PATCH if POST fails (Pages already exists)
  const r2 = await apiRequest("PUT", `/repos/${user}/${repo}/pages`, { build_type: "workflow" });
  if (r2.status >= 200 && r2.status < 300) {
    console.log(`GitHub Pages updated to Actions source.`);
  } else {
    console.log(`Pages API returned HTTP ${r.status} — enable manually in repo Settings → Pages → GitHub Actions`);
  }
}
