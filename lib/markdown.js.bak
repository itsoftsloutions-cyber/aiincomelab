// Minimal, dependency-free Markdown -> HTML converter.
// Supports: headings, paragraphs, bold, italic, inline code, links, images,
// unordered/ordered lists, blockquotes, fenced code blocks, horizontal rules.

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function inline(text) {
  // images first, then links
  let out = escapeHtml(text);
  out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g,
    (_, alt, src) => `<img src="${src}" alt="${alt}" loading="lazy">`);
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g,
    (_, label, href) => {
      const ext = /^https?:\/\//.test(href);
      const rel = ext ? ' target="_blank" rel="noopener nofollow"' : "";
      return `<a href="${href}"${rel}>${label}</a>`;
    });
  out = out.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
  out = out.replace(/\*\*([^*]+)\*\*/g, (_, b) => `<strong>${b}</strong>`);
  out = out.replace(/(^|[^*])\*([^*]+)\*/g, (_, p, i) => `${p}<em>${i}</em>`);
  return out;
}

export function markdownToHtml(md) {
  const lines = String(md).replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let i = 0;
  let para = [];

  const flushPara = () => {
    if (para.length) {
      html.push(`<p>${inline(para.join(" "))}</p>`);
      para = [];
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    if (/^```/.test(line)) {
      flushPara();
      const lang = line.replace(/^```/, "").trim();
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++; // closing fence
      const cls = lang ? ` class="language-${lang}"` : "";
      html.push(`<pre><code${cls}>${escapeHtml(buf.join("\n"))}</code></pre>`);
      continue;
    }

    if (/^\s*$/.test(line)) { flushPara(); i++; continue; }

    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      flushPara();
      const level = h[1].length;
      const id = h[2].toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      html.push(`<h${level} id="${id}">${inline(h[2])}</h${level}>`);
      i++;
      continue;
    }

    if (/^(-{3,}|\*{3,})\s*$/.test(line)) { flushPara(); html.push("<hr>"); i++; continue; }

    // GFM table: header row + separator row of dashes
    if (line.includes("|") && i + 1 < lines.length && /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(lines[i + 1]) && lines[i + 1].includes("-")) {
      flushPara();
      const splitRow = (r) => r.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());
      const headers = splitRow(line);
      i += 2; // skip header + separator
      const rows = [];
      while (i < lines.length && lines[i].includes("|") && !/^\s*$/.test(lines[i])) {
        rows.push(splitRow(lines[i])); i++;
      }
      const thead = `<thead><tr>${headers.map((h) => `<th>${inline(h)}</th>`).join("")}</tr></thead>`;
      const tbody = `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody>`;
      html.push(`<table>${thead}${tbody}</table>`);
      continue;
    }

    if (/^>\s?/.test(line)) {
      flushPara();
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ""));
      html.push(`<blockquote>${inline(buf.join(" "))}</blockquote>`);
      continue;
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      flushPara();
      const buf = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i]))
        buf.push(lines[i++].replace(/^\s*[-*+]\s+/, ""));
      html.push(`<ul>${buf.map((b) => `<li>${inline(b)}</li>`).join("")}</ul>`);
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      flushPara();
      const buf = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i]))
        buf.push(lines[i++].replace(/^\s*\d+\.\s+/, ""));
      html.push(`<ol>${buf.map((b) => `<li>${inline(b)}</li>`).join("")}</ol>`);
      continue;
    }

    para.push(line.trim());
    i++;
  }
  flushPara();
  return html.join("\n");
}

export function parseFrontmatter(raw) {
  const text = String(raw).replace(/\r\n/g, "\n");
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: text };
  const data = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!kv) continue;
    let val = kv[2].trim();
    if (/^\[.*\]$/.test(val)) {
      val = val.slice(1, -1).split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
    } else {
      val = val.replace(/^["']|["']$/g, "");
    }
    data[kv[1]] = val;
  }
  return { data, body: m[2] };
}
