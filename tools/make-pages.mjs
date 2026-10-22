// Copies ../site into ../dist for GitHub Pages, which serves the site from a
// subpath (https://<user>.github.io/<repo>/) instead of from "/".
// Run with: node tools/make-pages.mjs /<repo>/ https://<user>.github.io
// Root-absolute URLs in HTML, CSS and the manifest get the base prefixed, and
// the bootstrap's language routing (/fa/, /es/, …) is taught about the base.
import fs from "node:fs";
import path from "node:path";

const base = process.argv[2] || "/";
// e.g. https://aradazr.github.io; link previews need absolute image URLs
const origin = (process.argv[3] || "").replace(/\/$/, "");
if (!/^\/([\w.-]+\/)*$/.test(base)) throw new Error("base must look like /repo/: " + base);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const site = path.join(root, "site");
const dist = path.join(root, "dist");

fs.rmSync(dist, { recursive: true, force: true });
fs.cpSync(site, dist, { recursive: true });

const edit = (file, fn) => {
  const p = path.join(dist, file);
  fs.writeFileSync(p, fn(fs.readFileSync(p, "utf8")));
};
// "/x" → base + "x"; protocol-relative "//host" is left alone
const prefix = (s) => s.replace(/^\/(?!\/)/, base);

// "/" redirects to /fa/, but link previews (Telegram, …) read "/" itself,
// so it gets the Persian page's title, description and preview tags
const head = (html) => html.match(/ *<title>[\s\S]*?(?= *<!-- linked here)/)[0];
edit("index.html", (html) => html.replace(head(html), head(fs.readFileSync(path.join(dist, "fa/index.html"), "utf8"))));
edit("site.webmanifest", (json) => {
  const m = JSON.parse(json);
  m.name = "آموزش میکروکنترلر — درس‌های تعاملی سه‌بعدی";
  m.short_name = "آموزش میکروکنترلر";
  m.description = "LED، دکمه، سنسور، موتور و سروو را روی یک برد میکروکنترلر سه‌بعدی سیم‌کشی کنید، سپس کد را اجرا کنید و کارکردش را ببینید.";
  m.lang = "fa";
  m.dir = "rtl";
  return JSON.stringify(m, null, 2) + "\n";
});

for (const file of ["index.html", "fa/index.html", "es/index.html"]) {
  edit(file, (html) =>
    html
      .replace(/(href|src|content)="(\/[^"]*)"/g, (m, a, v) => `${a}="${prefix(v)}"`)
      .replace(/(<meta (?:property|name)="(?:og|twitter):image" content=")(\/[^"]*)"/g, (m, a, v) => `${a}${origin}${v}"`)
  );
}
for (const file of fs.readdirSync(path.join(dist, "assets")).filter((f) => f.endsWith(".css"))) {
  edit("assets/" + file, (css) => css.replace(/url\((\/[^)]*)\)/g, (m, v) => `url(${prefix(v)})`));
}
edit("site.webmanifest", (json) => json.replace(/"(start_url|scope|src)": "(\/[^"]*)"/g, (m, k, v) => `"${k}": "${prefix(v)}"`));

edit("assets/index-BodLthS6.js", (js) => {
  const B = JSON.stringify(base);
  const patch = (from, to) => {
    if (!js.includes(from)) throw new Error("bootstrap patch not found: " + from.slice(0, 60));
    js = js.split(from).join(to);
  };
  // preload URLs for lazily imported chunks
  patch("n=function(e){return`/`+e}", `n=function(e){return${B}+e}`);
  // language from the path, read after the base
  patch("let t=e.match(/^\\/([a-z]{2})(\\/|$)/)", `let t=("/"+e.slice(${B}.length)).match(/^\\/([a-z]{2})(\\/|$)/)`);
  // language → path, and the "/" that redirects to the saved or default language
  patch("(e===`en`?`/`:`/${e}/`)", `(e===\`en\`?${B}:${B}+e+"/")`);
  patch("location.pathname===`/`", `location.pathname===${B}`);
  return js;
});

console.log("pages build done:", base);
