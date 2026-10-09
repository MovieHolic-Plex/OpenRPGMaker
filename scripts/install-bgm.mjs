import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { installRelease, readTrustedManifest, verifyInstalled } from './lib/bgm-release.mjs';

const checkout = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const usage = `BGM 설치 (Node.js 24):
  npm run bgm:install
  npm run bgm:install -- --archive /경로/rpg-zzu-bgm-v1.tar
  npm run bgm:install -- --root /경로/체크아웃
  npm run bgm:verify -- --root /경로/체크아웃
기본 다운로드에는 gh 설치가 필요합니다. 공개 릴리스라 저장소 접근 권한은 필요하지 않습니다.
수동 설치: GitHub의 MovieHolic-Plex/OpenRPGMaker → Releases → bgm-v1에서
rpg-zzu-bgm-v1.tar를 직접 받은 뒤 --archive로 지정하세요. 수동 설치에는 gh/네트워크가 필요 없습니다.
설정 파일은 변경하지 않습니다. 로컬 재생은 VITE_BGM_CDN_BASE를 해제한 뒤 실행하세요.`;

const controller = new AbortController();
let interruptedExit;
const interrupt = (signal) => {
  interruptedExit = signal === 'SIGINT' ? 130 : 143;
  controller.abort(new Error('BGM 작업이 취소됐습니다. 임시 파일과 잠금을 정리합니다.'));
};
const onInterrupt = () => interrupt('SIGINT');
const onTerminate = () => interrupt('SIGTERM');
process.on('SIGINT', onInterrupt);
process.on('SIGTERM', onTerminate);

try {
  const { values } = parseArgs({ options: {
    root: { type: 'string' }, archive: { type: 'string' }, verify: { type: 'boolean' }, help: { type: 'boolean' },
  }, allowPositionals: false, strict: true });
  if (values.help) console.log(usage);
  else {
    if (Number(process.versions.node.split('.')[0]) < 24) throw new Error('Node.js 24 이상이 필요합니다.');
    if (values.verify && values.archive) throw new Error('--verify와 --archive를 함께 사용할 수 없습니다.');
    const manifest = await readTrustedManifest(resolve(checkout, 'assets/bgm-release-v1.json'));
    const root = resolve(values.root ?? checkout);
    if (values.verify) {
      const result = await verifyInstalled({ root, manifest, signal: controller.signal });
      console.log(`BGM 검증: ${result.verified}/${manifest.count}곡`);
      if (!result.complete) {
        console.error(`누락/손상된 곡 ${result.missing.length}개: ${result.missing.join(', ')}`);
        console.error('복구: npm run bgm:install (수동 파일은 --archive로 지정)');
        process.exitCode = 1;
      }
    } else {
      const result = await installRelease({ root, manifest, archive: values.archive, signal: controller.signal });
      console.log(`BGM ${result.verified}/${manifest.count}곡 검증 완료 (${result.installed}곡 설치).`);
    }
  }
} catch (error) {
  console.error(`BGM 작업 실패: ${error.message}`);
  console.error(usage);
  process.exitCode = interruptedExit ?? 1;
} finally {
  process.off('SIGINT', onInterrupt);
  process.off('SIGTERM', onTerminate);
}
