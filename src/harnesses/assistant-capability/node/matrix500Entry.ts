import { resolve } from 'node:path';
import { writeSpec500 } from './matrix500Spec';
import { runMatrix500Selfcheck } from './matrix500Selfcheck';

const mode = process.argv[2];
const option = (name: string) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

if (mode === 'spec') {
  const result = writeSpec500(option('out'));
  for (const problem of result.problems) console.log(`WARN ${problem}`);
  console.log(`spec: ${result.path} — 가족 ${result.spec.counts.families}/${result.spec.expected.families}, 행 ${result.spec.counts.rows}/${result.spec.expected.rows}, complete=${result.spec.complete}`);
  process.exitCode = process.argv.includes('--require-full') && !result.spec.complete ? 1 : 0;
} else if (mode === 'selfcheck') {
  const out = option('out');
  if (!out) throw new Error('matrix500-selfcheck --out <새 실행 폴더>');
  process.exitCode = await runMatrix500Selfcheck(resolve(out));
} else {
  throw new Error('matrix500Entry: spec | selfcheck');
}
