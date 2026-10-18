// Fetches the post read counts from the panel backend (`?action=stats.reads`) into
// src/generated/read-counts.json before the site build, so post cards can show "1,2B okunma".
// Never fails the build: on any problem it writes nothing and the site shows no counts.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const config = readFileSync(join(root, 'src/admin/config.ts'), 'utf8');
const apiUrl = /apiUrl:\s*'(https:\/\/[^']+)'/.exec(config)?.[1];
const out = join(root, 'src/generated/read-counts.json');

try {
  if (!apiUrl) throw new Error('apiUrl yok');
  const res = await fetch(`${apiUrl}?action=stats.reads`, { redirect: 'follow', signal: AbortSignal.timeout(20000) });
  const body = await res.json();
  const counts = body?.ok ? body.data?.counts : null;
  if (!counts || typeof counts !== 'object') throw new Error('beklenmeyen yanıt');
  const clean = Object.fromEntries(Object.entries(counts).filter(([k, n]) => /^[a-z0-9-]{1,80}$/.test(k) && Number.isFinite(n) && n >= 0));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ fetchedAt: new Date().toISOString(), counts: clean }, null, 2));
  console.log(`read counts: ${Object.keys(clean).length} posts`);
} catch (e) {
  console.warn(`read counts skipped: ${e instanceof Error ? e.message : String(e)}`);
}
