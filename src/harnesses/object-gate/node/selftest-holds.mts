/**
 * 사람 허용 = 최종 통과(2026-10-20) 규칙의 위변조 시험. 임시 데이터 폴더·임시 서명 키만 쓴다(저장소 데이터·실제 키는 건드리지 않는다).
 *   npm run harness -- object-gate selftest-holds
 * TS 출구(objectGateRefusal + 시트 칸 색인)와 Python 출구(refusal)를 같은 경우로 확인하고, 검토 화면 서버의 POST 를 실제로 부른다.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { PNG } from 'pngjs';

const tmp = mkdtempSync(resolve(tmpdir(), 'og-holds-'));
process.env.OBJECT_GATE_DATA = resolve(tmp, 'data');
process.env.OBJECT_GATE_HOLD_KEY = resolve(tmp, 'key', 'hold.key');
mkdirSync(resolve(tmp, 'data'), { recursive: true });
const ROOT = process.cwd();
const { objectGateRefusal } = await import('../../_core/objectGate');
const store = await import('./store');
const cells = await import('./cells');
const { serveHolds } = await import('./holds');

let failures = 0;
const ok = (name: string, cond: boolean, detail = '') => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}${detail && !cond ? ` — ${detail}` : ''}`); if (!cond) failures++; };

function png(path: string, seed: number, w = 12, h = 20) {
  const p = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; p.data[i] = (x * 17 + seed * 31) & 255; p.data[i + 1] = (y * 11 + seed) & 255; p.data[i + 2] = seed & 255; p.data[i + 3] = 255; }
  mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, PNG.sync.write(p));
  return path;
}
async function receiptFor(path: string, verdict: 'pass' | 'refer' | 'fail', profileHash = 'deadbeefdeadbeef', kind = 'tall_furniture') {
  const { width, height, data } = store.readPng(path);
  const sha = await store.pngPixelSha256(path);
  store.writeReceipt({ schema: 'oprn-object-gate-receipt/1', pixelSha256: sha, width, height, kind: kind as never, name: path, label: `selftest/${path.split('/').pop()}`, profileHash, verdict, reasons: [`AI ${verdict}`], runs: [], decidedAt: new Date().toISOString(), cells: cells.receiptCells(width, height, data) });
  store.writeHeldImage(sha, width, height, data);
  return sha;
}
const tsRefusal = async (path: string, context: 'bundle' | 'shared' | 'store' | 'workshop-local', kind?: string) => {
  const sha = await store.pngPixelSha256(path);
  return objectGateRefusal({ receipt: store.readReceipt(sha), pixelSha256: sha, kind: kind as never, context, calibratedProfiles: store.calibratedProfiles(), approval: store.readApproval(sha), hold: store.readHoldDecision(sha) });
};
const pyRefusal = (path: string, context: string, kind?: string) => execFileSync('python3', ['-c', `import sys,json; sys.path.insert(0, ${JSON.stringify(resolve(ROOT, 'src/harnesses/_core'))}); import object_gate as OG; print(json.dumps(OG.refusal(sys.argv[1], kind=${kind ? JSON.stringify(kind) : 'None'}, context=sys.argv[2])))`, path, context], { env: process.env }).toString().trim();
const passesEverywhere = async (path: string) => {
  for (const c of ['bundle', 'shared', 'store', 'workshop-local'] as const) { if (await tsRefusal(path, c)) return false; if (pyRefusal(path, c) !== 'null') return false; }
  return true;
};
const blockedEverywhere = async (path: string) => {
  for (const c of ['bundle', 'shared', 'store', 'workshop-local'] as const) { if (!(await tsRefusal(path, c))) return false; if (pyRefusal(path, c) === 'null') return false; }
  return true;
};
const inCellIndex = async (path: string) => { const sha = await store.pngPixelSha256(path); return [...cells.passingCellIndex('store').values()].some(r => r.pixelSha256 === sha); };

const PORT = 18000 + Math.floor(Math.random() * 900);
function call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<{ status: number; json: Record<string, unknown>; cookie?: string }> {
  return new Promise((done, fail) => {
    const req = http.request({ host: '127.0.0.1', port: PORT, method, path, headers: { host: `127.0.0.1:${PORT}`, ...headers } }, res => {
      let s = ''; res.on('data', c => (s += c)); res.on('end', () => done({ status: res.statusCode ?? 0, json: s ? JSON.parse(s) : {}, cookie: (res.headers['set-cookie'] ?? [])[0]?.split(';')[0] }));
    });
    req.on('error', fail); if (body !== undefined) req.write(JSON.stringify(body)); req.end();
  });
}

const server = await serveHolds({ host: '127.0.0.1', port: PORT });
try {
  const A = png(resolve(tmp, 'img/a.png'), 1), B = png(resolve(tmp, 'img/b.png'), 2), C = png(resolve(tmp, 'img/c.png'), 3);
  const D1 = png(resolve(tmp, 'img/d1.png'), 4), D2 = png(resolve(tmp, 'img/d2.png'), 5), E = png(resolve(tmp, 'img/e.png'), 6);
  const shaA = await receiptFor(A, 'fail'), shaB = await receiptFor(B, 'refer');
  const shaD1 = await receiptFor(D1, 'pass'), shaD2 = await receiptFor(D2, 'refer'); await receiptFor(E, 'pass');
  const shaC = await store.pngPixelSha256(C); { const { width, height, data } = store.readPng(C); store.writeHeldImage(shaC, width, height, data); }
  store.writeQueueBatch({ schema: 'oprn-object-gate-queue/1', id: 'selftest-batch', title: '시험 묶음', createdAt: new Date().toISOString(), items: [shaD1, shaD2, shaD2].map((sha, i) => ({ sha, kind: 'tall_furniture', label: `${sha.slice(0, 8)}-${i}` })) }); // 같은 그림 두 이름(D2) — 한 장으로 센다

  ok('결정 전: AI FAIL(미보정) 은 모든 출구에서 막힘', await blockedEverywhere(A));
  ok('결정 전: AI PASS(미보정 프로필) 도 막힘', await blockedEverywhere(E));

  const session = await call('GET', '/api/session');
  const csrf = String(session.json.csrf), cookie = session.cookie!;
  const H = { origin: `http://127.0.0.1:${PORT}`, 'content-type': 'application/json', 'x-holds-csrf': csrf, cookie };

  const q = await call('GET', '/api/queue?batch=selftest-batch');
  ok('대기열: 묶음 수·대기 수', (q.json.batches as Array<{ id: string; waiting: number }>).find(b => b.id === 'selftest-batch')?.waiting === 2);

  const noSession = await call('POST', '/api/decide', { sha: shaA, decision: 'allow', decidedBy: '시험' }, { origin: H.origin, 'content-type': 'application/json' });
  ok('세션 없는 POST 거절', noSession.status === 409 && !store.readHoldDecision(shaA));
  const badOrigin = await call('POST', '/api/decide', { sha: shaA, decision: 'allow', decidedBy: '시험' }, { ...H, origin: 'http://evil.example' });
  ok('다른 출처 POST 거절', badOrigin.status === 409 && !store.readHoldDecision(shaA));

  const noReceipt = await call('POST', '/api/decide', { sha: shaC, decision: 'allow', decidedBy: '시험' }, H);
  ok('영수증 없는 그림 허용 거절', noReceipt.status === 409 && String(noReceipt.json.error).includes('영수증') && !store.readHoldDecision(shaC));

  const allowA = await call('POST', '/api/decide', { sha: shaA, decision: 'allow', decidedBy: '시험' }, H);
  ok('허용 저장', allowA.status === 200);
  ok('허용: AI FAIL·미보정이어도 TS·Python 모든 출구 통과', await passesEverywhere(A));
  ok('허용: 시트 칸 관문(store) 색인에 들어감', await inCellIndex(A));
  ok('허용: 종류를 다르게 요청하면 막힘', !!(await tsRefusal(A, 'bundle', 'seat')) && pyRefusal(A, 'bundle', 'seat') !== 'null');

  // 위변조
  const holdFile = resolve(tmp, 'data', 'approvals', 'hold', shaA.slice(0, 2), `${shaA}.json`);
  const original = readFileSync(holdFile, 'utf8');
  writeFileSync(holdFile, original.replace('"decidedBy": "시험"', '"decidedBy": "에이전트"'));
  ok('기록 내용을 고치면 무효(막힘)', await blockedEverywhere(A));
  const rec = JSON.parse(original); rec.sig = 'f'.repeat(64); writeFileSync(holdFile, JSON.stringify(rec));
  ok('가짜 서명이면 무효(막힘)', await blockedEverywhere(A));
  delete rec.sig; writeFileSync(holdFile, JSON.stringify(rec));
  ok('서명 없는(손으로 쓴) 기록이면 무효(막힘)', await blockedEverywhere(A));
  writeFileSync(holdFile, original);
  ok('원래 기록으로 되돌리면 다시 통과', await passesEverywhere(A));

  // 한 화소 바꾸기 — 같은 그림 경로라도 해시가 달라져 영수증·허용이 모두 없다
  const changed = store.readPng(A); const pA = PNG.sync.read(changed.png); pA.data[0] = (pA.data[0]! + 1) & 255; writeFileSync(resolve(tmp, 'img/a1.png'), PNG.sync.write(pA));
  ok('한 화소 바꾼 그림은 막힘', await blockedEverywhere(resolve(tmp, 'img/a1.png')));

  // 옛 프로필에서 한 허용(#3107 경우): 영수증이 다른 프로필로 다시 받아져도 같은 해시·종류면 유효
  const receiptA = store.readReceipt(shaA)!; store.writeReceipt({ ...receiptA, profileHash: 'feedfacefeedface', verdict: 'refer' });
  ok('다른 프로필로 다시 판정받아도 같은 해시·종류의 허용은 유효', await passesEverywhere(A));
  store.writeReceipt({ ...receiptA, kind: 'seat' as never });
  ok('영수증 종류가 바뀌면 허용은 무효', await blockedEverywhere(A));
  store.writeReceipt(receiptA);

  // 거절은 최종
  const rejB = await call('POST', '/api/decide', { sha: shaB, decision: 'reject', decidedBy: '시험' }, H);
  ok('거절 저장', rejB.status === 200);
  store.writeReceipt({ ...store.readReceipt(shaB)!, override: { by: 'human', at: new Date().toISOString() } });
  ok('거절: 공방 「그래도 넣기」까지 모든 출구 막힘', await blockedEverywhere(B));
  const reAllowB = await call('POST', '/api/decide', { sha: shaB, decision: 'allow', decidedBy: '시험' }, H);
  ok('거절 뒤 다시 허용 시도 거절', reAllowB.status === 409 && store.readHoldDecision(shaB)?.decision === 'reject');

  // 묶음 허용
  const wrong = await call('POST', '/api/decide-batch', { batch: 'selftest-batch', shas: [shaD1, shaD2], decidedBy: '시험', confirm: '네' }, H);
  ok('묶음 허용: 확인 문구가 틀리면 거절', wrong.status === 409 && !store.readHoldDecision(shaD1));
  const partial = await call('POST', '/api/decide-batch', { batch: 'selftest-batch', shas: [shaD1], decidedBy: '시험', confirm: '1장 전부 허용' }, H);
  ok('묶음 허용: 화면 목록이 서버 대기 목록과 다르면 거절', partial.status === 409 && !store.readHoldDecision(shaD1));
  const noSess = await call('POST', '/api/decide-batch', { batch: 'selftest-batch', shas: [shaD1, shaD2], decidedBy: '시험', confirm: '2장 전부 허용' }, { origin: H.origin, 'content-type': 'application/json' });
  ok('묶음 허용: 세션 없으면 거절', noSess.status === 409 && !store.readHoldDecision(shaD1));
  const batchOk = await call('POST', '/api/decide-batch', { batch: 'selftest-batch', shas: [shaD1, shaD2], decidedBy: '시험', confirm: '2장 전부 허용' }, H);
  const d1 = store.readHoldDecision(shaD1), d2 = store.readHoldDecision(shaD2);
  ok('묶음 허용: 그림마다 따로 서명 기록', batchOk.status === 200 && batchOk.json.saved === 2 && !!d1 && !!d2 && d1.pixelSha256 === shaD1 && d2.pixelSha256 === shaD2 && d1.sig !== d2.sig && d1.decision === 'allow' && d2.decision === 'allow');
  ok('묶음 허용: 둘 다 모든 출구 통과', (await passesEverywhere(D1)) && (await passesEverywhere(D2)));
  const q2 = await call('GET', '/api/queue?batch=selftest-batch');
  ok('묶음 허용 뒤 대기 0', (q2.json.batches as Array<{ id: string; waiting: number; allowed: number }>).find(b => b.id === 'selftest-batch')?.allowed === 2);
} finally {
  server.close();
  rmSync(tmp, { recursive: true, force: true });
}
console.log(failures ? `\n${failures}건 실패` : '\n전부 통과');
process.exit(failures ? 1 : 0);
