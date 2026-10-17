// Pushes the bundle and updates the existing web app deployment, so its URL stays the same.
// The deployment id lives in apps-script/.deployment-id (git-ignored); without it a new
// deployment is created and its id is saved there.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const idFile = join(here, '.deployment-id');
const run = (cmd) => execSync(cmd, { cwd: here, encoding: 'utf8', stdio: ['inherit', 'pipe', 'inherit'] });

const id = existsSync(idFile) ? readFileSync(idFile, 'utf8').trim() : '';
const out = run(`npx clasp deploy ${id ? `--deploymentId ${id} ` : ''}--description "Yönetim paneli"`);
console.log(out);
if (!id) {
  const found = out.match(/AKfy[\w-]+/);
  if (found) writeFileSync(idFile, `${found[0]}\n`);
}
