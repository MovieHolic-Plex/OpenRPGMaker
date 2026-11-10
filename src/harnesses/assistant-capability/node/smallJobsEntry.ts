// bun 입구: 작은 일 묶음의 자기검사·실행·보고서. (편집기 도구를 불러오므로 vite-node 가 아니라 bun 으로 돈다 — matrix500Entry 와 같은 까닭.)
import { resolve } from 'node:path';

const mode = process.argv[2];
const option = (name: string): string | undefined => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const flag = (name: string): boolean => process.argv.includes(`--${name}`);

if (mode === 'selfcheck') {
  const { runSmallJobsSelfcheck } = await import('./smallJobs/selfcheck');
  process.exitCode = await runSmallJobsSelfcheck(option('out') ? resolve(option('out')!) : undefined, option('only'));
} else if (mode === 'run') {
  const { runSmallJobs } = await import('./smallJobs/run');
  process.exitCode = await runSmallJobs({ out: option('out'), model: option('model'), only: option('only'), v2: flag('v2'), parallel: option('parallel'), timeoutMin: option('timeout-min'), skipCompleted: flag('skip-completed') });
} else if (mode === 'report') {
  const { writeSmallJobsReport } = await import('./smallJobs/report');
  process.exitCode = writeSmallJobsReport({ run: option('run'), html: option('html'), before: option('before') });
} else if (mode === 'rescore') {
  const { rescoreSmallJobs } = await import('./smallJobs/rescore');
  process.exitCode = rescoreSmallJobs({ run: option('run') });
} else {
  throw new Error('smallJobsEntry: selfcheck | run | report | rescore');
}
