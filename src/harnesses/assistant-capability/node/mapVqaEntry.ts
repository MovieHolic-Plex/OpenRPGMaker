// bun 입구: 조수가 깐 맵의 적대적 시각 검수(map-vqa). 편집기 도구·렌더러를 불러오므로 bun 으로 돈다.
import { resolve } from 'node:path';

const mode = process.argv[2];
const option = (name: string): string | undefined => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const flag = (name: string): boolean => process.argv.includes(`--${name}`);

if (mode === 'lay') {
  const { runMapLaying } = await import('./mapVqa/lay');
  process.exitCode = await runMapLaying({ out: option('out'), model: option('model'), only: option('only'), v2: flag('v2'), parallel: option('parallel'), timeoutMin: option('timeout-min'), skipCompleted: flag('skip-completed'), editorRoot: option('editor-root') });
} else if (mode === 'review') {
  const { runMapVqa } = await import('./mapVqa/review');
  process.exitCode = await runMapVqa({ out: option('out') ? resolve(option('out')!) : undefined, corpus: option('corpus'), only: option('only'), noReview: flag('no-review'), noArt: flag('no-art'), html: option('html'), before: option('before'), beforeLay: option('before-lay'), concurrency: option('concurrency') });
} else if (mode === 'calibrate') {
  const { runMapVqaCalibration } = await import('./mapVqa/calibrate');
  process.exitCode = await runMapVqaCalibration({ out: option('out') ? resolve(option('out')!) : undefined, only: option('only'), noReview: flag('no-review'), concurrency: option('concurrency') });
} else if (mode === 'freeze') {
  const { freezePositive } = await import('./mapVqa/calibrate');
  process.exitCode = freezePositive({ run: option('run'), map: option('map'), id: option('id') });
} else {
  throw new Error('mapVqaEntry: lay | review | calibrate | freeze');
}
