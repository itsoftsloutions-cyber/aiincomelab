// Tiny zero-dependency static file server for previewing the built site.
// Usage: node serve.js  (then open http://localhost:8080)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "public");
const PORT = process.env.PORT || 8080;

const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript",
  ".xml": "application/xml", ".json": "application/json", ".txt": "text/plain",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json",
};

http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split("?")[0]);
  let file = path.join(ROOT, urlPath);
  if (urlPath.endsWith("/")) file = path.join(file, "index.html");
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end("Forbidden"); }
  fs.stat(file, (err, st) => {
    if (err || st.isDirectory()) {
      const alt = path.join(ROOT, urlPath, "index.html");
      return fs.readFile(alt, (e, buf) => {
        if (e) { res.writeHead(404, { "Content-Type": "text/html" });
          return fs.readFile(path.join(ROOT, "404.html"), (_, n) => res.end(n || "Not found")); }
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(buf);
      });
    }
    fs.readFile(file, (e, buf) => {
      if (e) { res.writeHead(404); return res.end("Not found"); }
      res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
      res.end(buf);
    });
  });
}).listen(PORT, () => console.log(`Serving public/ at http://localhost:${PORT}`));
