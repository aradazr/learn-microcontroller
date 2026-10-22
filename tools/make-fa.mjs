// Builds the Persian (fa) version on top of the mirrored site in ../site.
// Run with: node tools/make-fa.mjs
// Inputs: i18n/fa.json (English → Persian), i18n/original-index.html and
// i18n/original-index-BodLthS6.js (untouched copies of the deployed files).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const site = path.join(root, "site");
// Numbers with units, ranges and formulas ("1.8–3.2 V", "≈ (5 − 2) ÷ 220") get
// reordered inside Persian text, so each such run is wrapped in an LTR
// isolate (U+2066 … U+2069). Tags and <code> are left alone.
const NUMERIC_SLOTS = /\{(n|v|limit|ms|p|total|done)\}/g;
const RUN = /[0-9A-Za-z~≈±−\-–.\/×÷()°µΩ%²³+<>=·_ {}′″]+/g;
function isolateRun(run) {
  // sentence punctuation and parentheses that open or close outside the run stay outside
  const lead = run.match(/^[\s).·]*/)[0];
  const trail = run.slice(lead.length).match(/[\s(.·]*$/)[0];
  const core = run.slice(lead.length, run.length - trail.length);
  if (!core) return run;
  const opens = (core.match(/\(/g) || []).length, closes = (core.match(/\)/g) || []).length;
  if (opens !== closes) return run;
  const plain = core.replace(NUMERIC_SLOTS, "0");
  if (/\{\w+\}/.test(plain)) return run; // text slots ({title}, {note}, …)
  if (!/[0-9A-Za-z]/.test(plain) || !/[\s\-–−\/×÷≈]/.test(core)) return run;
  return lead + "⁦" + core + "⁩" + trail;
}
function isolate(value) {
  let inCode = 0;
  return value
    .split(/(<[^>]+>)/)
    .map((part) => {
      if (part.startsWith("<")) {
        if (/^<code\b/.test(part)) inCode++;
        if (/^<\/code>/.test(part)) inCode--;
        return part;
      }
      return inCode ? part : part.replace(RUN, isolateRun);
    })
    .join("");
}
const dict = Object.fromEntries(
  Object.entries(JSON.parse(fs.readFileSync(path.join(root, "i18n/fa.json"), "utf8"))).map(([k, v]) => [k, isolate(v)])
);
const t = (s) => dict[s] ?? s;

// 1. The locale module the app imports for /fa/
const js = "var e=" + JSON.stringify(dict) + ";export{e as default};\n";
fs.writeFileSync(path.join(site, "assets/fa.js"), js);

// 2. Bootstrap: register fa, load its module, set dir="rtl", make fa the default at "/"
let boot = fs.readFileSync(path.join(root, "i18n/original-index-BodLthS6.js"), "utf8");
const patch = (from, to) => {
  if (!boot.includes(from)) throw new Error("bootstrap patch not found: " + from.slice(0, 60));
  boot = boot.replace(from, to);
};
patch("s=[{code:`en`,name:`English`,locale:`en_US`},", "s=[{code:`fa`,name:`فارسی`,locale:`fa_IR`,dir:`rtl`},{code:`en`,name:`English`,locale:`en_US`},");
patch('"./locales/de.js":', '"./locales/fa.js":()=>o(()=>import(`./fa.js`),[]),"./locales/de.js":');
patch("let e=_()??v();", "let e=_()??`fa`;");
patch("return document.documentElement.lang=c(f),!0}", "return document.documentElement.lang=c(f),document.documentElement.dir=s.find(e=>e.code===f)?.dir??`ltr`,!0}");
fs.writeFileSync(path.join(site, "assets/index-BodLthS6.js"), boot);

// 3. Pre-rendered /fa/index.html (what shows before the JS runs, and for link previews)
let html = fs.readFileSync(path.join(root, "i18n/original-index.html"), "utf8");
const esc = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
html = html.replace('<html lang="en" class="is-loading">', '<html lang="fa" dir="rtl" class="is-loading">');
// Absolute links to the original deployment don't belong on this copy
html = html.replace(/\s*<link rel="(canonical|alternate)"[^>]*>/g, "");
html = html.replace(/\s*<meta property="og:(url|locale:alternate)"[^>]*>/g, "");
html = html.replace('content="en_US"', 'content="fa_IR"');
html = html.replace(/https:\/\/learn-arduino-red\.vercel\.app\//g, "/");
// Persian link-preview image
html = html.replace(/"\/og-image\.png"/g, '"/og-image-fa.png"');
// Persian font (Peyda, declared in fa-rtl.css), plus the RTL fixes (versioned so browsers pick up edits)
const cssVersion = crypto.createHash("sha1").update(fs.readFileSync(path.join(site, "assets/fa-rtl.css"))).digest("hex").slice(0, 8);
html = html.replace(
  "</head>",
  '    <link rel="preload" href="/assets/fonts/Peyda-Medium.woff2" as="font" type="font/woff2" crossorigin />\n' +
    '    <link rel="preload" href="/assets/fonts/Peyda-SemiBold.woff2" as="font" type="font/woff2" crossorigin />\n' +
    `    <link rel="stylesheet" href="/assets/fa-rtl.css?v=${cssVersion}" />\n  </head>`
);
// Attribute values (meta content, aria-label, title, alt)
html = html.replace(/(content|aria-label|title|alt)="([^"]*)"/g, (m, a, v) => {
  const raw = v.replace(/&quot;/g, '"').replace(/&amp;/g, "&");
  return dict[raw] ? `${a}="${esc(dict[raw])}"` : m;
});
// JSON-LD: name, description, language and lesson titles
html = html.replace(/<script type="application\/ld\+json">(.*?)<\/script>/s, (m, j) => {
  const o = JSON.parse(j);
  o.name = t(o.name);
  o.description = t(o.description);
  o.inLanguage = "fa";
  o.teaches = o.teaches.map(t);
  o.about = o.about.filter((a) => a !== "Arduino");
  return `<script type="application/ld+json">${JSON.stringify(o)}</script>`;
});
// noscript lesson list: "<b>N. Title</b> — first sentence." from the full lesson intros
const intros = Object.keys(dict).filter((k) => /^\d+\. /.test(k) === false);
html = html.replace(/<li><b>(\d+)\. ([^<]+)<\/b> — ([^<]+)<\/li>/g, (m, n, title, first) => {
  const full = intros.find((k) => k.startsWith(first));
  const faFirst = full ? dict[full].split(/(?<=[.!؟])\s/)[0] : first;
  const num = String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);
  return `<li><b>${num}. ${t(title)}</b> — ${faFirst}</li>`;
});
// Plain text between tags (title, headings, tabs, labels)
html = html.replace(/>([^<>]+)</g, (m, text) => {
  const s = text.trim();
  return s && dict[s] ? m.replace(s, dict[s]) : m;
});
// "Explore · Understand · Build"
html = html.replace(/<p>Explore <i>·<\/i> Understand <i>·<\/i> Build<\/p>/, `<p>${t("Explore")} <i>·</i> ${t("Understand")} <i>·</i> ${t("Build")}</p>`);

// Translator credit, next to the original designer's (brand area when wide, footer when compact)
const faCredit = (cls) =>
  `<a class="credit ${cls}" href="https://aradazr.site" target="_blank" rel="noopener" title="ترجمه و بازتولید فارسی: آراد آذرپناه">` +
  `<span class="credit-text"><small>ترجمه و بازتولید فارسی</small><b>آراد آذرپناه</b></span></a>`;
html = html.replace(/(<header class="brand">[\s\S]*?)(\s*<\/header>)/, (m, body, end) => `${body}\n        ${faCredit("fa-credit-brand")}${end}`);
html = html.replace(/(<a class="credit credit-row"[\s\S]*?<\/a>)/, (m) => `${m}\n        ${faCredit("credit-row fa-credit-row")}`);

fs.mkdirSync(path.join(site, "fa"), { recursive: true });
fs.writeFileSync(path.join(site, "fa/index.html"), html);
console.log("fa build done:", Object.keys(dict).length, "strings");
