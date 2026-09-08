// Revision-qualified baseline execution without changing any checkout or worktree.
import { mergeConfig } from 'vitest/config';
import base from '../../../vitest.config.ts';
import { execFileSync } from 'node:child_process';
import { relative } from 'node:path';
import { writeFileSync } from 'node:fs';
const ref = process.env.INTEGRATION_BASELINE;
if (!['72f1f179b39972c3838922746c7641a57e95fce8', 'd2be60d92b74e456ea4b9e54e30daafe7fc41fc8'].includes(ref)) throw new Error('Explicit baseline required');
const observed = new Set();
process.once('exit', () => writeFileSync(`.omo/evidence/integration-st01a08238/baseline-${ref.slice(0,7)}-modules.json`, JSON.stringify({ ref, modules: [...observed].sort() }, null, 2)));
export default mergeConfig(base, { plugins: [{ name: 'exact-git-baseline', enforce: 'pre', load(id) {
  const file = relative(process.cwd(), id.split('?')[0]);
  if (!/^(src|test)\//.test(file)) return;
  observed.add(file);
  return execFileSync('git', ['show', `${ref}:${file}`], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
} }] });
