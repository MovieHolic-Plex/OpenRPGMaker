import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { objectGateProfileHash, objectGateRefusal, type ObjectGateContext, type ObjectGateKind } from '../../_core/objectGate';
import { calibratedProfiles, listReceipts, pngPixelSha256, readProfiles, readReceipt } from './store';

const spawnBun = (argv: string[]): Promise<number> => new Promise((done, reject) => {
  const child = spawn('bun', [resolve('src/harnesses/object-gate/node/judge.mts'), ...argv], { stdio: 'inherit', cwd: process.cwd() });
  child.once('error', reject); child.once('exit', code => done(code ?? 1));
});

export async function run(argv: string[]): Promise<number> {
  const stage = argv[0];
  const option = (name: string) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : undefined; };
  if (stage === 'review' || stage === 'calibrate' || stage === 'audit' || stage === 'preview') return spawnBun(argv);
  if (stage === 'check') {
    const png = option('png'), context = option('context') as ObjectGateContext | undefined;
    if (!png || !context) throw Error('check --png <그림> --context bundle|shared|store|workshop-local [--kind 종류]');
    const sha = await pngPixelSha256(resolve(png));
    const refusal = objectGateRefusal({ receipt: readReceipt(sha), pixelSha256: sha, kind: option('kind') as ObjectGateKind | undefined, context, calibratedProfiles: calibratedProfiles() });
    console.log(refusal ? `거절: ${refusal}` : `통과 (${sha.slice(0, 12)})`);
    return refusal ? 3 : 0;
  }
  if (stage === 'status') {
    const current = await objectGateProfileHash();
    const profiles = readProfiles();
    console.log(`현재 규칙 프로필 ${current} — ${profiles.find(p => p.profileHash === current)?.status ?? '보정 안 됨 (calibrate 먼저)'}`);
    for (const p of profiles) console.log(`  ${p.profileHash} ${p.status} 위반 ${p.bad.caught}/${p.bad.total} 정상 ${p.good.passed}/${p.good.total} (${p.calibratedAt.slice(0, 10)})`);
    const receipts = listReceipts();
    console.log(`영수증 ${receipts.length}장 — 통과 ${receipts.filter(r => r.verdict === 'pass').length}, 사람 덮어쓰기 ${receipts.filter(r => r.override).length}`);
    return 0;
  }
  throw Error('단계: review | calibrate | check | status | audit');
}
