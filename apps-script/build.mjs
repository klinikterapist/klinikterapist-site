// Bundles apps-script/src into apps-script/dist/Code.js for `clasp push`.
// Apps Script needs top-level functions, so the bundle exposes `App` and we add thin shims.
import { build } from 'esbuild';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'dist');
mkdirSync(out, { recursive: true });

const result = await build({
  entryPoints: [join(here, 'src/main.ts')],
  bundle: true,
  format: 'iife',
  globalName: 'App',
  target: 'es2020',
  platform: 'neutral',
  write: false,
  charset: 'utf8',
  legalComments: 'none',
  // The publish flow brings zod and yaml along (shared with the panel); minified it stays small.
  minify: true,
});

const shims = `
function doPost(e) { return App.doPost(e); }
function doGet(e) { return App.doGet(e); }
function hourly(e) { return App.hourly(e); }
`;
writeFileSync(join(out, 'Code.js'), result.outputFiles[0].text + shims);
copyFileSync(join(here, 'appsscript.json'), join(out, 'appsscript.json'));
console.log(`apps-script/dist/Code.js (${readFileSync(join(out, 'Code.js')).length} bytes)`);
