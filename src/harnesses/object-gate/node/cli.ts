import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { OBJECT_GATE_PROFILE, objectGateRefusal, type ObjectGateContext, type ObjectGateKind } from '../../_core/objectGate';
import { calibratedProfiles, gateProfileHash, listReceipts, pngPixelSha256, readProfiles, readReceipt } from './store';

const spawnBun = (argv: string[]): Promise<number> => new Promise((done, reject) => {
  const child = spawn('bun', [resolve('src/harnesses/object-gate/node/judge.mts'), ...argv], { stdio: 'inherit', cwd: process.cwd() });
  child.once('error', reject); child.once('exit', code => done(code ?? 1));
});

export async function run(argv: string[]): Promise<number> {
  const stage = argv[0];
  const option = (name: string) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : undefined; };
  if (stage === 'review' || stage === 'calibrate' || stage === 'audit' || stage === 'preview' || stage === 'rereview') return spawnBun(argv);
  if (stage === 'check') {
    const png = option('png'), context = option('context') as ObjectGateContext | undefined;
    if (!png || !context) throw Error('check --png <그림> --context bundle|shared|store|workshop-local [--kind 종류]');
    const sha = await pngPixelSha256(resolve(png));
    const refusal = objectGateRefusal({ receipt: readReceipt(sha), pixelSha256: sha, kind: option('kind') as ObjectGateKind | undefined, context, calibratedProfiles: calibratedProfiles() });
    console.log(refusal ? `거절: ${refusal}` : `통과 (${sha.slice(0, 12)})`);
    return refusal ? 3 : 0;
  }
  if (stage === 'status') {
    const current = await gateProfileHash();
    const profiles = readProfiles();
    const cur = profiles.find(p => p.profileHash === current);
    console.log(`현재 규칙 프로필 ${current} — ${cur?.status ?? '보정 안 됨 (calibrate 먼저)'}`);
    const j = OBJECT_GATE_PROFILE.judges.map(x => `${x.provider}/${x.model} effort=${x.effort}`).join(' + ');
    console.log(`  판정자 ${j} × ${OBJECT_GATE_PROFILE.runsPerJudge}번 중앙값·과반 · 규칙 v${OBJECT_GATE_PROFILE.rulesVersion} · 측정 사실(열 훑기·화풍 지표) v${OBJECT_GATE_PROFILE.factsVersion} · 3/4 + 버들항 화풍 한 번에 (판정자 신원·effort 는 프로필 해시에 들어 있다 — 바꾸면 보정부터 다시)`);
    for (const p of profiles) {
      const st = p.style ? ` 화풍 얕음 ${p.style.caught}/${p.style.badTotal} 버들 ${p.style.passed}/${p.style.goodTotal}` : '';
      console.log(`  ${p.profileHash} ${p.status} 3/4 위반 ${p.bad.caught}/${p.bad.total} 정상 ${p.good.passed}/${p.good.total}${st}${p.judge ? ` [${p.judge}]` : ''} (${p.calibratedAt.slice(0, 10)})`);
    }
    const receipts = listReceipts();
    const now = receipts.filter(r => r.profileHash === current);
    console.log(`영수증 ${receipts.length}장 — 통과 ${receipts.filter(r => r.verdict === 'pass').length}, 사람 덮어쓰기 ${receipts.filter(r => r.override).length}`);
    console.log(`  현재 프로필 영수증 ${now.length}장 — 통과 ${now.filter(r => r.verdict === 'pass').length} (3/4 통과 ${now.filter(r => r.view34?.verdict === 'pass').length}, 화풍 통과 ${now.filter(r => r.style?.verdict === 'pass').length}) · 옛 프로필 ${receipts.length - now.length}장은 무효(재검수 필요: rereview)`);
    return 0;
  }
  throw Error('단계: review | calibrate | rereview | check | status | audit | preview');
}
