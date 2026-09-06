// Evidence-only: full real-editor E2E then caption scroll proof on the same owned 19841 lifetime.
import { spawn } from 'node:child_process';

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', env: process.env });
    child.on('error', reject);
    child.on('exit', code => resolve(code ?? 1));
  });
}

const e2e = await run('node', ['node_modules/@playwright/test/cli.js', 'test', 'test/e2e/ai-job-inbox.spec.ts']);
console.log('E2E_EXIT', e2e);
if (e2e !== 0) process.exit(e2e);
const probe = await run('node', ['.omo/evidence/ai-job-queue/task-7/caption-scroll-probe.mjs']);
console.log('CAPTION_PROBE_EXIT', probe);
process.exit(probe);
