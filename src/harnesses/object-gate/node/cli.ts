import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { OBJECT_GATE_PROFILE, objectGateRefusal, type ObjectGateContext, type ObjectGateKind } from '../../_core/objectGate';
import { createInterface } from 'node:readline/promises';
import { humanDecision, validFrontPropApproval } from '../../_core/objectGate';
import { readFileSync } from 'node:fs';
import { exitInputs, calibratedProfiles, gateProfileHash, listApprovals, listQueueBatches, listReceipts, pngPixelSha256, readApproval, readHoldDecision, readProfiles, readReceipt, removeApproval, writeApproval, writeQueueBatch } from './store';

const spawnBun = (argv: string[]): Promise<number> => new Promise((done, reject) => {
  const child = spawn('bun', [resolve('src/harnesses/object-gate/node/judge.mts'), ...argv], { stdio: 'inherit', cwd: process.cwd() });
  child.once('error', reject); child.once('exit', code => done(code ?? 1));
});

export async function run(argv: string[]): Promise<number> {
  const stage = argv[0];
  const option = (name: string) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : undefined; };
  if (stage === 'review' || stage === 'calibrate' || stage === 'audit' || stage === 'preview' || stage === 'rereview') return spawnBun(argv);
  // Opus 5.5 medium 적대적 최종 판정(2026-10-21): final-calibrate · final-review · final-queue · final-status
  if (stage.startsWith('final-')) return new Promise((done, reject) => {
    const child = spawn('bun', [resolve('src/harnesses/object-gate/node/final.mts'), ...argv], { stdio: 'inherit', cwd: process.cwd() });
    child.once('error', reject); child.once('exit', code => done(code ?? 1));
  });
  // 사람 허용 규칙 위변조 시험(임시 데이터·임시 키). 모델 호출 없음.
  if (stage === 'selftest-holds') return new Promise((done, reject) => {
    const child = spawn('bun', [resolve('src/harnesses/object-gate/node/selftest-holds.mts')], { stdio: 'inherit', cwd: process.cwd() });
    child.once('error', reject); child.once('exit', code => done(code ?? 1));
  });
  if (stage === 'check') {
    const png = option('png'), context = option('context') as ObjectGateContext | undefined;
    if (!png || !context) throw Error('check --png <그림> --context bundle|shared|store|workshop-local [--kind 종류]');
    const sha = await pngPixelSha256(resolve(png));
    const refusal = objectGateRefusal({ ...exitInputs(sha), pixelSha256: sha, kind: option('kind') as ObjectGateKind | undefined, context });
    console.log(refusal ? `거절: ${refusal}` : `통과 (${sha.slice(0, 12)})`);
    return refusal ? 3 : 0;
  }
  // 정면형 소품(front_prop) 종류 선언의 사람 승인. 감독·에이전트는 승인하지 않는다 — 터미널(대화형)에서 사람이 그림 해시 앞 8자를 직접 쳐야 기록된다(파이프·백그라운드·--yes 는 거절).
  if (stage === 'approve-front-prop') {
    const png = option('png'), by = option('by')?.trim();
    if (!png || !by) throw Error('approve-front-prop --png <그림> --by <승인자 이름> [--note 메모]  (사람이 터미널에서 직접)');
    if (!process.stdin.isTTY || !process.stdout.isTTY) { console.error('거절: 승인은 사람이 터미널에서 직접 해야 한다(대화형 입력만 받는다). 감독·에이전트·스크립트는 승인할 수 없다.'); return 3; }
    const sha = await pngPixelSha256(resolve(png));
    const receipt = readReceipt(sha);
    if (!receipt) { console.error('거절: 이 그림의 판정 영수증이 없다 — object-gate review --kind front_prop 로 먼저 판정받아라(승인은 판정 뒤에 한다).'); return 3; }
    if (receipt.kind !== 'front_prop') { console.error(`거절: 영수증 종류가 front_prop 이 아니다(${receipt.kind}).`); return 3; }
    console.log(`그림 ${resolve(png)}\n  화소 해시 ${sha}\n  판정 ${receipt.verdict} · 3/4 ${receipt.view34?.verdict ?? '-'} · 화풍 ${receipt.style?.verdict ?? '-'}\n  이 그림은 윗면이 없는 정면형 소품(간판·건조 틀)이고, 그래서 3/4 판정을 면제해도 좋다고 승인합니다. 그림이 한 화소라도 바뀌면 승인은 무효가 됩니다.`);
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = (await rl.question(`승인하려면 해시 앞 8자(${sha.slice(0, 8)})를 입력: `)).trim(); rl.close();
    if (answer !== sha.slice(0, 8)) { console.error('입력이 달라 승인하지 않았다.'); return 3; }
    const file = writeApproval({ schema: 'oprn-object-gate-front-prop-approval/1', pixelSha256: sha, kind: 'front_prop', approvedBy: by, approvedAt: new Date().toISOString(), by: 'human', ...(option('note') ? { note: option('note') } : {}) });
    console.log(`승인 기록 ${file}`);
    return 0;
  }
  if (stage === 'revoke-front-prop') {
    const png = option('png'); if (!png) throw Error('revoke-front-prop --png <그림>');
    const sha = await pngPixelSha256(resolve(png));
    console.log(removeApproval(sha) ? `승인을 철회했다 (${sha.slice(0, 12)})` : '이 그림에는 승인 기록이 없다');
    return 0;
  }
  if (stage === 'approvals') {
    const approvals = listApprovals(), receipts = listReceipts();
    const fp = receipts.filter(r => r.kind === 'front_prop');
    console.log(`front_prop 영수증 ${fp.length}장 — 승인됨 ${fp.filter(r => validFrontPropApproval(readApproval(r.pixelSha256), r.pixelSha256)).length}, 승인 기록 ${approvals.length}건`);
    for (const a of approvals) console.log(`  ${a.pixelSha256.slice(0, 12)} ${a.approvedBy} ${a.approvedAt}${a.note ? ` — ${a.note}` : ''}`);
    return 0;
  }
  // 보류 판정 사람 검토 화면. 결정 기록은 이 서버만 쓴다(서명). 감독·에이전트는 띄울 수는 있어도 대신 누르지 않는다.
  if (stage === 'serve-holds') {
    const { serveHolds } = await import('./holds');
    await serveHolds({ host: option('host') ?? '0.0.0.0', port: Number(option('port') ?? 18323) });
    await new Promise(() => {});
  }
  // 사람 검토 대기열에 묶음을 올린다: 묶음 목록(queue/<id>.json)을 쓰고, 영수증이 없는 그림만 AI 판정(review --advisory)을 받는다.
  // 판정은 조언이고 최종 통과는 검토 화면(serve-holds)의 사람 허용이다. 이 단계는 아무것도 허용하지 않는다.
  if (stage === 'enqueue') {
    const batch = option('batch'), id = option('id'), title = option('title');
    if (!batch || !id || !title) throw Error('enqueue --batch items.jsonl({png,kind,styleKind?,name,label}) --id <묶음 id> --title <묶음 이름> [--note 메모] [--explain-image <queue/ 안 png 이름>] [--explain-text 쉬운 설명] [--no-review]');
    const lines = readFileSync(resolve(batch), 'utf8').split('\n').filter(l => l.trim()).map(l => JSON.parse(l) as { png: string; kind: string; label?: string; name?: string });
    const items = [];
    for (const l of lines) {
      const png = resolve(dirname(resolve(batch)), l.png);
      items.push({ sha: await pngPixelSha256(png), kind: l.kind, label: l.label ?? l.name ?? png, source: png.startsWith(process.cwd()) ? png.slice(process.cwd().length + 1) : png });
    }
    const prev = listQueueBatches().find(b => b.id === id);
    const file = writeQueueBatch({ schema: 'oprn-object-gate-queue/1', id, title, ...(option('note') ? { note: option('note') } : {}), ...((option('explain-image') ?? prev?.explainImage) ? { explainImage: option('explain-image') ?? prev?.explainImage } : {}), ...((option('explain-text') ?? prev?.explainText) ? { explainText: option('explain-text') ?? prev?.explainText } : {}), createdAt: prev?.createdAt ?? new Date().toISOString(), items });
    console.log(`대기열 묶음 ${file} — ${items.length}장`);
    if (argv.includes('--no-review')) return 0;
    const code = await spawnBun(['review', '--advisory', '--batch', resolve(batch)]);
    return code === 3 ? 0 : code; // 3 = 전부 통과는 아님(조언) — 대기열에 올리는 데는 정상
  }
  if (stage === 'holds') {
    // 사람 검토 대기열 현황(모델 호출 없음). 대기 = 영수증은 있고(AI 조언) 사람 결정이 없으며 보정 프로필의 통과도 아닌 것.
    const calibrated = calibratedProfiles(), byBatch = new Map<string, string[]>();
    for (const b of listQueueBatches()) byBatch.set(`${b.id} — ${b.title}`, b.items.map(i => i.sha));
    const count = (shas: string[]) => {
      const c = { total: shas.length, waiting: 0, allowed: 0, rejected: 0, autoPass: 0, noReceipt: 0 };
      for (const sha of shas) {
        const r = readReceipt(sha); if (!r) { c.noReceipt++; continue; }
        const h = humanDecision(readHoldDecision(sha), r);
        if (h === 'allow') c.allowed++; else if (h === 'reject') c.rejected++; else if (r.verdict === 'pass' && calibrated.has(r.profileHash)) c.autoPass++; else c.waiting++;
      }
      return c;
    };
    for (const [name, shas] of byBatch) { const c = count(shas); console.log(`${name}: ${c.total}장 — 대기 ${c.waiting} · 허용 ${c.allowed} · 거절 ${c.rejected}${c.autoPass ? ` · 자동 통과 ${c.autoPass}` : ''}${c.noReceipt ? ` · AI 판정 없음 ${c.noReceipt}` : ''}`); }
    const all = count(listReceipts().map(r => r.pixelSha256));
    console.log(`영수증 전체 ${all.total}장 — 사람 대기 ${all.waiting} · 허용 ${all.allowed} · 거절 ${all.rejected} · 보정 프로필 자동 통과 ${all.autoPass} · 검토 화면 serve-holds (18323)`);
    return 0;
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
      console.log(`  ${p.profileHash} ${p.status} 3/4 위반 ${p.bad.caught}/${p.bad.total} 정상 ${p.good.passed}/${p.good.total}${p.holdout ? ` 숨김1 위반 ${p.holdout.bad.caught}/${p.holdout.bad.total} 정상 ${p.holdout.good.passed}/${p.holdout.good.total}` : ''}${p.fresh ? ` 새숨김 위반 ${p.fresh.bad.caught}/${p.fresh.bad.total} 정상 ${p.fresh.good.passed}/${p.fresh.good.total}` : ''}${st}${p.judge ? ` [${p.judge}]` : ''} (${p.calibratedAt.slice(0, 10)})`);
    }
    const receipts = listReceipts();
    const now = receipts.filter(r => r.profileHash === current);
    console.log(`영수증 ${receipts.length}장 — 통과 ${receipts.filter(r => r.verdict === 'pass').length}, 사람 덮어쓰기 ${receipts.filter(r => r.override).length}`);
    console.log(`  현재 프로필 영수증 ${now.length}장 — 통과 ${now.filter(r => r.verdict === 'pass').length}, 보류 ${now.filter(r => r.verdict === 'refer').length} (3/4 통과 ${now.filter(r => r.view34?.verdict === 'pass').length}, 화풍 통과 ${now.filter(r => r.style?.verdict === 'pass').length}) · 옛 프로필 ${receipts.length - now.length}장은 무효(재검수 필요: rereview)`);
    return 0;
  }
  throw Error('단계: review | calibrate | rereview | check | status | audit | preview | approve-front-prop | revoke-front-prop | approvals | enqueue | serve-holds | holds | selftest-holds');
}
