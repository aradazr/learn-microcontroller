// Copies ../site into ../dist for GitHub Pages, which serves the site from a
// subpath (https://<user>.github.io/<repo>/) instead of from "/".
// Run with: node tools/make-pages.mjs /<repo>/
// Root-absolute URLs in HTML, CSS and the manifest get the base prefixed, and
// the bootstrap's language routing (/fa/, /es/, …) is taught about the base.
import fs from "node:fs";
import path from "node:path";

const base = process.argv[2] || "/";
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

for (const file of ["index.html", "fa/index.html", "es/index.html"]) {
  edit(file, (html) => html.replace(/(href|src|content)="(\/[^"]*)"/g, (m, a, v) => `${a}="${prefix(v)}"`));
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
