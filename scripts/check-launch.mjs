#!/usr/bin/env node
/**
 * Launch check: lists placeholder values that must be replaced before the site goes live
 * (example.com addresses, "[Üniversite Adı]", bare LinkedIn/Medium/Substack home pages,
 * the legal draft sentence). It does not run in the normal build; run it with
 * `npm run check:launch`. Exit code 1 while any placeholder remains.
 *
 * Scans every .json and .md file under DATA_DIR (default `src/data`).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const RULES = [
  { test: (s) => /example\.com/i.test(s), reason: 'örnek adres (example.com) — gerçek adresle değiştirin' },
  { test: (s) => /\[(Üniversite Adı|University Name)\]/.test(s), reason: 'yer tutucu üniversite adı — gerçek bilgiyle değiştirin' },
  {
    test: (s) => /^https?:\/\/(www\.)?(linkedin\.com|medium\.com|substack\.com)\/?$/i.test(s.trim()),
    reason: 'yalnızca sitenin ana sayfası — kendi profil adresinizi yazın',
  },
  {
    test: (s) => s.includes('Bu metin hukuki içerik eklenene kadar taslaktır.'),
    reason: 'hukuki metin hâlâ taslak — gerçek metni ekleyin',
  },
];

function check(file, field, value, out) {
  for (const rule of RULES) {
    if (rule.test(value)) out.push({ file, field, value, reason: rule.reason });
  }
}

/**
 * Placeholders in one data file. `data` is parsed JSON (object/array) or Markdown text.
 * JSON hits name the field path (`timeline.0.detail.tr`); Markdown hits name the line (`satır 3`).
 * @returns {{ file: string, field: string, value: string, reason: string }[]}
 */
export function findPlaceholders(file, data) {
  const out = [];
  if (typeof data === 'string') {
    data.split(/\r?\n/).forEach((line, i) => check(file, `satır ${i + 1}`, line, out));
    return out;
  }
  const walk = (value, path) => {
    if (typeof value === 'string') check(file, path.join('.') || '(kök)', value, out);
    else if (Array.isArray(value)) value.forEach((v, i) => walk(v, [...path, i]));
    else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) walk(v, [...path, k]);
  };
  walk(data, []);
  return out;
}

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return files(full);
    return /\.(json|md)$/.test(name) ? [full] : [];
  });
}

function main() {
  const dir = process.env.DATA_DIR ?? 'src/data';
  const hits = files(dir).flatMap((full) => {
    const file = relative(dir, full).split(sep).join('/');
    const text = readFileSync(full, 'utf8');
    return findPlaceholders(file, full.endsWith('.json') ? JSON.parse(text) : text);
  });
  if (hits.length === 0) {
    console.log(`Yayın kontrolü: ${dir} içinde yer tutucu kalmadı.`);
    return 0;
  }
  console.error(`Yayın kontrolü: ${dir} içinde ${hits.length} yer tutucu var. Yayından önce değiştirin:\n`);
  for (const h of hits) console.error(`- ${h.file} › ${h.field}: ${h.reason}\n    "${h.value.trim()}"`);
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
