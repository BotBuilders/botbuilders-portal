#!/usr/bin/env node
/**
 * build.mjs — packages src/ into dist/ and regenerates field-snippets/.
 *
 * Node stdlib only. No bundler, no transforms beyond:
 *   1. stripping <script>…</script> wrappers from the JS sources (the portal
 *      fields take HTML; an externally loaded .js must not), concatenating the
 *      block bodies IN ORDER separated by a `/* ── block N ── *\/` comment;
 *   2. prepending a BB_VERSION stamp (JS statement / CSS comment);
 *   3. regenerating field-snippets/ with the current version in every URL;
 *   4. running every built .js through `node --check` and failing loudly.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const DIST = join(ROOT, 'dist');
const SNIPPETS = join(ROOT, 'field-snippets');

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const VERSION = pkg.version;
const REPO = (pkg.config && pkg.config.cdnRepo) || 'YOURORG/REPO';
const TAG = `v${VERSION}`;
const DATE = (() => { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; })(); // local date, not UTC
const STAMP = `${VERSION} · ${DATE}`;
const CDN = `https://cdn.jsdelivr.net/gh/${REPO}@${TAG}/dist`;

const FILES = ['portal', 'courses', 'communities'];

let failed = false;
const fail = (msg) => { failed = true; console.error(`✖ ${msg}`); };
const ok = (msg) => console.log(`✔ ${msg}`);

/* ── 1. strip <script> wrappers ─────────────────────────────────────────── */
function stripScriptTags(source, name) {
  const re = /<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi;
  const blocks = [];
  let m;
  while ((m = re.exec(source)) !== null) blocks.push(m[1]);
  if (blocks.length === 0) {
    // No wrapper at all — plain JS, leave untouched.
    return { body: source, blocks: 0 };
  }
  // Anything outside the <script> blocks must be whitespace only; otherwise a
  // tag is unbalanced and we would silently drop code.
  const outside = source.replace(re, '').trim();
  if (outside.length) {
    fail(`${name}: found non-whitespace content outside <script> blocks — unbalanced tag? First 80 chars: ${JSON.stringify(outside.slice(0, 80))}`);
  }
  const body = blocks
    .map((b, i) => `/* ── block ${i + 1} ── */\n${b.replace(/^\n+/, '').replace(/\s+$/, '')}\n`)
    .join('\n');
  return { body, blocks: blocks.length };
}

/* ── 2. stamp + write dist ─────────────────────────────────────────────── */
mkdirSync(DIST, { recursive: true });
mkdirSync(SNIPPETS, { recursive: true });

for (const base of FILES) {
  // JS
  const jsSrcPath = join(SRC, `${base}.js`);
  if (!existsSync(jsSrcPath)) { fail(`missing src/${base}.js`); continue; }
  const { body, blocks } = stripScriptTags(readFileSync(jsSrcPath, 'utf8'), `src/${base}.js`);
  const jsOut =
    `window.BB_VERSION = '${STAMP}';\n` +
    `window.BB_BUILDS = Object.assign(window.BB_BUILDS || {}, { ${base}: '${STAMP}' });\n` +
    `window.BB_CDN = '${CDN}';\n` +   // lets portal.js load courses.css/js from the same tag
    `/* botbuilders-portal · ${base}.js · built from src/${base}.js (${blocks} script block${blocks === 1 ? '' : 's'}) */\n\n` +
    body;
  writeFileSync(join(DIST, `${base}.js`), jsOut);
  ok(`dist/${base}.js  (${blocks} block${blocks === 1 ? '' : 's'}, ${jsOut.length} bytes)`);

  // CSS
  const cssSrcPath = join(SRC, `${base}.css`);
  if (!existsSync(cssSrcPath)) { fail(`missing src/${base}.css`); continue; }
  const css = readFileSync(cssSrcPath, 'utf8');
  if (/<\/?style\b/i.test(css)) fail(`src/${base}.css contains a <style> tag — the CSS fields take raw CSS, remove it`);
  const cssOut = `/* BB_VERSION ${STAMP} · botbuilders-portal · ${base}.css */\n\n${css.replace(/\s+$/, '')}\n`;
  writeFileSync(join(DIST, `${base}.css`), cssOut);
  ok(`dist/${base}.css (${cssOut.length} bytes)`);
}

/* ── 3. field snippets ─────────────────────────────────────────────────── */
const snippets = {
  'portal-js.html': `<script>
/* INLINE ON PURPOSE — do not move this into the hosted bundle.
   The Bob widget scans for its [data-bob-embed] host exactly once, at init,
   and never reconsiders. An external script is fetched over the network and
   loses that race, so Bob would silently fall back to a floating panel.
   Parking the host here costs 8 lines and removes the race entirely.
   portal.js adopts an existing host rather than creating a second one. */
(function () {
  var p = location.pathname;
  if (!(p.replace(/\\/+$/, '') === '/dashboard' || /^\\/courses\\/products\\//.test(p))) return;
  if (document.querySelector('[data-bob-embed], #bob-embed')) return;
  var d = document.createElement('div');
  d.setAttribute('data-bob-embed', '');
  d.style.cssText = 'position:absolute;left:-10000px;top:0;width:400px;height:600px;';
  (document.body || document.documentElement).appendChild(d);
})();
</script>
<script src="${CDN}/portal.js"></script>
`,

  'portal-css.css': `@import url("${CDN}/portal.css");
`,

  // The Course Custom JS field takes raw JavaScript, not HTML, so a <script>
  // tag there is a syntax error. Load the bundle from JS instead.
  'courses-js.js': `(function(){var s=document.createElement('script');s.src='${CDN}/courses.js';document.head.appendChild(s);})();
`,

  'courses-css.css': `@import url("${CDN}/courses.css");

/* INLINE ON PURPOSE — anti-flash. See the LOADING STATE block in src/courses.css. */
#post-details-container:not(:has(#bb-topbar)) { position: relative !important; }
#post-details-container:not(:has(#bb-topbar)) > * { opacity: 0; animation: bbReveal 0s linear 10s forwards; }
@keyframes bbReveal { to { opacity: 1; } }
`,

  'communities-js.html': `<script src="${CDN}/communities.js"></script>
`,

  'communities-css.css': `@import url("${CDN}/communities.css");
`,
};

for (const [name, content] of Object.entries(snippets)) {
  writeFileSync(join(SNIPPETS, name), content);
}
ok(`field-snippets/ regenerated for ${REPO}@${TAG}`);

/* ── 4. syntax gate ─────────────────────────────────────────────────────── */
for (const base of FILES) {
  const p = join(DIST, `${base}.js`);
  if (!existsSync(p)) continue;
  const r = spawnSync(process.execPath, ['--check', p], { encoding: 'utf8' });
  if (r.status !== 0) {
    fail(`node --check failed for dist/${base}.js\n${r.stderr}`);
  } else {
    ok(`node --check dist/${base}.js`);
  }
}

if (REPO === 'YOURORG/REPO') {
  console.warn('⚠ package.json → config.cdnRepo is still the placeholder; field-snippets/ URLs will not resolve.');
}

if (failed) {
  console.error('\nBUILD FAILED — do not paste anything from field-snippets/ into the portal.');
  process.exit(1);
}
console.log(`\nBuilt ${TAG} (${STAMP}).`);
