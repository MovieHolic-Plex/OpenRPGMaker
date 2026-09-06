import { execFileSync, spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const cwd = process.cwd();
const out = dirname(fileURLToPath(import.meta.url));
const [head, tree] = execFileSync('git', ['rev-parse', 'HEAD', 'HEAD^{tree}'], {encoding:'utf8'}).trim().split('\n');
if (head !== 'd84001e88b5e0b7f8ff3074de0ec5f6cdbcbf41e') throw new Error('Unexpected candidate');
execFileSync('git', ['diff', '--exit-code', 'HEAD', '--', 'src', 'test', 'scripts', 'openwiki', '.vite-cache']);
const jobs = [
  ['diagnostics', 300, ['node', join(out, 'diagnostics.mjs')]],
  ['build', 600, ['npm', 'run', 'build']],
  ['index', 120, ['npm', 'run', 'openwiki:index', '--', '--check']],
  ['gates', 1200, ['npm', 'run', 'gates', '--', '--json']],
];
for (const [stage, seconds, command] of jobs) {
  const argv = ['--timeout', '900', '/tmp/rpg-zzu-life-full-qa-01a0727b.lock', 'timeout', '--signal=TERM', '--kill-after=15s', String(seconds)+'s', ...command];
  const started = new Date().toISOString();
  console.log('CORRECTED_STAGE_START '+stage);
  const result = spawnSync('flock', argv, {cwd, encoding:'utf8', maxBuffer:64*1024*1024, env:{...process.env, VITE_CACHE_DIR:join(out,'vite-cache')}});
  const receipt = {cwd,head,tree,command:['flock',...argv],started,finished:new Date().toISOString(),exit:result.status,signal:result.signal,error:result.error?.message,stdout:result.stdout??'',stderr:result.stderr??''};
  if (stage === 'gates') {
    const report = join(cwd,'.omo/gates-vitest-report.json');
    receipt.vitestReportPresent = existsSync(report);
    if (receipt.vitestReportPresent) await writeFile(join(out,'vitest-report.json'),await readFile(report),{flag:'wx'});
  }
  await writeFile(join(out,stage+'.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
  console.log('CORRECTED_STAGE_END '+stage+' exit='+receipt.exit);
  if (result.status !== 0) { process.exitCode = result.status ?? 1; break; }
}
