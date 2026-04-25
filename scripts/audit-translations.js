#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC_DIRS = ['screens', 'components', 'utils'];
const TRANSLATIONS_FILE = path.join(ROOT, 'i18n', 'translations.js');
const KEY_RE = /\bt\(\s*['"`]([a-zA-Z0-9_.\-]+)['"`]/g;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(jsx?|tsx?)$/.test(e.name)) out.push(p);
  }
  return out;
}

function collectUsedKeys() {
  const used = new Map();
  for (const d of SRC_DIRS) {
    const dir = path.join(ROOT, d);
    if (!fs.existsSync(dir)) continue;
    for (const file of walk(dir)) {
      const src = fs.readFileSync(file, 'utf8');
      let m;
      while ((m = KEY_RE.exec(src)) !== null) {
        const key = m[1];
        if (!used.has(key)) used.set(key, []);
        used.get(key).push(path.relative(ROOT, file));
      }
    }
  }
  return used;
}

function collectDefinedKeys() {
  const src = fs.readFileSync(TRANSLATIONS_FILE, 'utf8');
  const langRe = /^\s{2}([a-z]{2}):\s*\{/gm;
  const langs = [];
  let lm;
  while ((lm = langRe.exec(src)) !== null) langs.push({ code: lm[1], start: lm.index });

  const out = {};
  for (let i = 0; i < langs.length; i++) {
    const { code, start } = langs[i];
    const end = i + 1 < langs.length ? langs[i + 1].start : src.length;
    const block = src.slice(start, end);
    const set = new Set();
    const re = /['"`]([a-zA-Z0-9_.\-]+)['"`]\s*:/g;
    let m;
    while ((m = re.exec(block)) !== null) set.add(m[1]);
    out[code] = set;
  }
  return out;
}

const used = collectUsedKeys();
const defined = collectDefinedKeys();
const langs = Object.keys(defined);

console.log(`\nLanguages found: ${langs.join(', ')}\n`);

const missing = {};
let totalUsed = 0;
for (const [key, files] of used.entries()) {
  totalUsed++;
  for (const lang of langs) {
    if (!defined[lang].has(key)) {
      if (!missing[lang]) missing[lang] = [];
      missing[lang].push({ key, files: [...new Set(files)] });
    }
  }
}

console.log(`Total unique t() keys used: ${totalUsed}\n`);

let any = false;
for (const lang of langs) {
  const list = missing[lang] || [];
  if (!list.length) continue;
  any = true;
  console.log(`❌ Missing in ${lang.toUpperCase()} (${list.length}):`);
  for (const { key, files } of list) {
    console.log(`   ${key}  →  ${files[0]}`);
  }
  console.log('');
}

if (!any) {
  console.log('✅ All used keys are defined in every language.\n');
}

const enKeys = defined.en || new Set();
const usedSet = new Set(used.keys());
const orphaned = [...enKeys].filter(k => !usedSet.has(k));
if (orphaned.length) {
  console.log(`ℹ️  ${orphaned.length} orphaned keys defined in EN but never used (showing 20):`);
  for (const k of orphaned.slice(0, 20)) console.log(`   ${k}`);
  console.log('');
}

process.exit(any ? 1 : 0);
