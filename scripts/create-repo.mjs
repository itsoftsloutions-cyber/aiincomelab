// Creates the GitHub repo via API. Called by auto-deploy-now.bat.
import https from "node:https";

const [,, token, user, repo] = process.argv;
if (!token || !user || !repo) { console.error("Usage: create-repo.mjs TOKEN USER REPO"); process.exit(1); }

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

// Check if repo already exists
const check = await apiRequest("GET", `/repos/${user}/${repo}`);
if (check.status === 200) {
  console.log(`Repo already exists: https://github.com/${user}/${repo}`);
  process.exit(0);
}

// Create repo
const create = await apiRequest("POST", "/user/repos", {
  name: repo,
  description: "AI Tools, Productivity & Online Income — auto-publishing SEO blog",
  homepage: `https://${user}.github.io/${repo}/`,
  private: false,
  auto_init: false,
  has_issues: false,
  has_projects: false,
  has_wiki: false,
});

if (create.status === 201) {
  console.log(`Repo created: https://github.com/${user}/${repo}`);
} else if (create.status === 422) {
  console.log(`Repo already exists or name taken: ${JSON.stringify(create.body.errors)}`);
} else {
  console.error(`Repo creation failed (HTTP ${create.status}):`, JSON.stringify(create.body));
  process.exit(1);
}
