#!/usr/bin/env node
/**
 * check.mjs — the acceptance checks from the repo brief, runnable.
 * Exits non-zero if any hard check fails. Run after `npm run build`.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const SNIPPETS = join(ROOT, 'field-snippets');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

let failures = 0, warnings = 0;
const pass = (n, m) => console.log(`✔ ${n}. ${m}`);
const fail = (n, m) => { failures++; console.error(`✖ ${n}. ${m}`); };
const warn = (n, m) => { warnings++; console.warn(`⚠ ${n}. ${m}`); };

const FILES = ['portal', 'courses', 'communities'];
const read = (p) => readFileSync(p, 'utf8');

/* 1. six dist files, each starting with a BB_VERSION stamp */
{
  let bad = [];
  for (const b of FILES) {
    for (const ext of ['js', 'css']) {
      const p = join(DIST, `${b}.${ext}`);
      if (!existsSync(p)) { bad.push(`${b}.${ext} missing`); continue; }
      const head = read(p).slice(0, 200);
      const okStamp = ext === 'js'
        ? /^window\.BB_VERSION = '\d+\.\d+\.\d+ · \d{4}-\d{2}-\d{2}';/.test(head)
        : /^\/\* BB_VERSION \d+\.\d+\.\d+ · \d{4}-\d{2}-\d{2}/.test(head);
      if (!okStamp) bad.push(`${b}.${ext} has no BB_VERSION stamp at top`);
    }
  }
  bad.length ? fail(1, bad.join('; ')) : pass(1, 'six dist files, each starting with a BB_VERSION stamp');
}

/* 2. node --check on every built .js */
{
  let bad = [];
  for (const b of FILES) {
    const p = join(DIST, `${b}.js`);
    if (!existsSync(p)) continue;
    const r = spawnSync(process.execPath, ['--check', p], { encoding: 'utf8' });
    if (r.status !== 0) bad.push(`${b}.js: ${r.stderr.trim().split('\n')[0]}`);
  }
  bad.length ? fail(2, bad.join('; ')) : pass(2, 'every built .js passes node --check');
}

/* 3. no <script in built .js
   Hard failure: a <script …> or </script> tag at the start of a line — that is
   what a wrapper the strip step missed looks like.
   Warning only: the string "<script" elsewhere (e.g. inside a comment that
   talks about script tags). Harmless in an external .js, but listed so a
   reviewer can eyeball it. */
{
  let hard = [], soft = [];
  for (const b of FILES) {
    const p = join(DIST, `${b}.js`);
    if (!existsSync(p)) continue;
    read(p).split('\n').forEach((line, i) => {
      if (/^\s*<\/?script\b/i.test(line)) hard.push(`${b}.js:${i + 1}`);
      else if (/<script/i.test(line)) soft.push(`${b}.js:${i + 1} ${line.trim().slice(0, 70)}`);
    });
  }
  if (hard.length) fail(3, `<script> tag at line start in built JS: ${hard.join(', ')}`);
  else if (soft.length) warn(3, `no <script> tags, but the string "<script" appears in prose/comments: ${soft.join(' | ')}`);
  else pass(3, 'no "<script" anywhere in built .js');
}

/* 4. stale-deploy markers in dist/portal.js */
{
  const p = join(DIST, 'portal.js');
  const want = ['bbGetIdentity', 'bbBobHost', 'FOOTER_PATHS', 'spriteBase'];
  if (!existsSync(p)) fail(4, 'dist/portal.js missing');
  else {
    const s = read(p);
    const missing = want.filter((w) => !s.includes(w));
    missing.length
      ? fail(4, `dist/portal.js is missing marker(s): ${missing.join(', ')} — a block was dropped, or src/portal.js is not the current field contents`)
      : pass(4, 'dist/portal.js contains bbGetIdentity, bbBobHost, FOOTER_PATHS, spriteBase');
  }
}

/* 5. inline Bob stub before <script src> in portal-js.html */
{
  const p = join(SNIPPETS, 'portal-js.html');
  if (!existsSync(p)) fail(5, 'field-snippets/portal-js.html missing');
  else {
    const s = read(p);
    const stub = s.indexOf('data-bob-embed');
    const src = s.indexOf('<script src=');
    stub !== -1 && src !== -1 && stub < src
      ? pass(5, 'portal-js.html has the inline Bob stub before the <script src> loader')
      : fail(5, 'portal-js.html: inline Bob stub missing or placed after the loader');
  }
}

/* 6. every snippet URL pinned to @vX.Y.Z, none @main / @latest */
{
  let bad = [], count = 0;
  for (const f of readdirSync(SNIPPETS)) {
    const s = read(join(SNIPPETS, f));
    for (const m of s.matchAll(/cdn\.jsdelivr\.net\/gh\/[^@\s"')]+@([^/\s"')]+)\//g)) {
      count++;
      const ref = m[1];
      if (!/^v\d+\.\d+\.\d+$/.test(ref)) bad.push(`${f} → @${ref}`);
      else if (ref !== `v${pkg.version}`) bad.push(`${f} → @${ref} but package.json is ${pkg.version} (rebuild)`);
    }
    if (/@(main|master|latest)\b/.test(s)) bad.push(`${f} references a moving pointer`);
  }
  if (count === 0) fail(6, 'no jsDelivr URLs found in field-snippets/');
  else bad.length ? fail(6, bad.join('; ')) : pass(6, `all ${count} snippet URLs pinned to @v${pkg.version}`);
}

/* 7. README first screen mentions deploy flow + BB_VERSION */
{
  const p = join(ROOT, 'README.md');
  if (!existsSync(p)) fail(7, 'README.md missing');
  else {
    const first = read(p).split('\n').slice(0, 40).join('\n');
    /BB_VERSION/.test(first) && /npm run release/.test(first)
      ? pass(7, 'README states the deploy flow and the BB_VERSION check in the first screen')
      : fail(7, 'README first 40 lines must mention `npm run release` and BB_VERSION');
  }
}

/* extra: a src .js in RTF or with smart quotes (how the fields got mangled once) */
{
  let bad = [];
  for (const b of FILES) {
    for (const ext of ['js', 'css']) {
      const p = join(ROOT, 'src', `${b}.${ext}`);
      if (!existsSync(p)) continue;
      const s = read(p);
      if (s.startsWith('{\\rtf')) bad.push(`src/${b}.${ext} is RTF, not plain text`);
    }
  }
  bad.length ? fail('src', bad.join('; ')) : pass('src', 'all src/ files are plain text (not RTF)');
}

console.log(`\n${failures} failure(s), ${warnings} warning(s).`);
process.exit(failures ? 1 : 0);
