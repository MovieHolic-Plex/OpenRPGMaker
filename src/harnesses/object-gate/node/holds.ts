/**
 * 사람 검토 대기열 — `npm run harness -- object-gate serve-holds [--port 18323] [--host 0.0.0.0]`.
 *
 * 2026-10-21 사용자 결정: 최종 판정은 Opus 5.5 medium 적대적 VQA(final.mts)다 — 옵션 A(사람 허용이 최종)를 대체. 이 화면은 Opus 판정·이유를 보이고 「Opus 불합격」만 거를 수 있다.
 * 사람 거절은 그대로 최종 차단(Opus 통과도 뒤집는다). 사람 허용은 이제 선택이며 Opus 판정이 없는 그림에만 효력이 있다.
 * (옛 설명) 2026-10-20 사용자 결정(옵션 A): AI 판정은 1차 거름·조언이고, 최종 통과는 서명된 사람 허용이다(AI 판정 보정 2회 실패, 사용자가 매번 눈으로 판정).
 * 이 화면은 AI 가 한 번이라도 판정한(영수증이 있는) 그림 중 사람 결정이 없는 것 — 보류(REFER)·불합격(FAIL)·보정 안 된 프로필의 통과(PASS) — 을
 * 묶음별로 보여 준다. 그림은 1배·4배로, 같은 종류 버들항 화풍 기준 그림·3/4 기준 쌍 옆에 놓고, AI 판정과 이유는 조언으로 함께 보인다.
 * 보정된 프로필의 통과는 사람 결정 없이도 지나가므로 대기열에 넣지 않는다(숫자만 센다).
 *
 * 결정은 그림 화소 해시·종류에 묶여 approvals/hold/ 에 저장되고 저장소 밖 키로 HMAC 서명된다(store.writeHoldDecision). 기록에는 사람이 본 조언의 프로필도 적는다.
 * 출구(objectGateRefusal · Python refusal)는 서명이 맞는 「허용」이 있으면 프로필 보정 여부와 무관하게 통과시키고, 「거절」은 최종 차단이다.
 * 「이 묶음 전부 허용」은 사람이 확인 문구를 직접 입력해야 하고, 그림마다 따로 서명 기록을 쓴다.
 *
 * 다른 하네스 고르기 화면과 같은 방식: 세션 쿠키 + CSRF 머리글 + 같은 출처(Origin) 확인, 요청의 해시를 서버가 저장된 그림에서 다시 잰 해시와 대조.
 * 감독·에이전트·MCP 도구는 이 화면을 대신 누르거나 기록 파일을 쓰지 않는다(쓰면 서명이 맞지 않아 무효이고, 서버를 흉내 내는 것은 규칙 위반이다).
 */
import http from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { OBJECT_GATE_KINDS, finalApplies, humanDecision, type ObjectGateFinal, type ObjectGateHoldDecision, type ObjectGateReceipt } from '../../_core/objectGate';
import { GATE_DATA, calibratedFinalProfiles, readFinal, calibratedProfiles, gateProfileHash, heldImage, holdKey, listQueueBatches, listReceipts, queueExplainImagePath, readHoldDecision, readProfiles, readReceipt, styleRefs, writeHoldDecision } from './store';

const PAGE = resolve(import.meta.dirname ?? __dirname, '..', 'web', 'holds.html');
const equal = (a?: string, b?: string) => typeof a === 'string' && typeof b === 'string' && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const SHA = /^[0-9a-f]{64}$/;
const heldImagePath = (sha: string) => resolve(GATE_DATA, 'held-images', sha.slice(0, 2), `${sha}.png`);

type Entry = { receipt: ObjectGateReceipt | null; sha: string; kind: string; label: string; batches: string[] };
type BatchInfo = { id: string; title: string; note?: string; explainImage?: string; explainText?: string; auto: boolean; shas: string[] };

/** 영수증 5,000장 넘게 매번 읽지 않게 잠깐 담아 둔다(결정 기록은 매번 새로 읽는다). */
let receiptCache: { at: number; list: ObjectGateReceipt[] } | null = null;
function receipts(fresh = false): ObjectGateReceipt[] {
  if (fresh || !receiptCache || Date.now() - receiptCache.at > 30_000) receiptCache = { at: Date.now(), list: listReceipts() };
  return receiptCache.list;
}

/** 대기열 묶음 = queue/<id>.json 묶음 + 거기 들지 않은 영수증을 표식 앞머리로 나눈 자동 묶음. */
function buildQueue(fresh = false): { entries: Map<string, Entry>; batches: BatchInfo[] } {
  const entries = new Map<string, Entry>();
  for (const r of receipts(fresh)) entries.set(r.pixelSha256, { receipt: r, sha: r.pixelSha256, kind: r.kind, label: r.label ?? r.name, batches: [] });
  const batches: BatchInfo[] = [];
  for (const b of listQueueBatches()) {
    // 같은 그림(같은 해시)이 묶음에 여러 이름으로 들어 있으면 한 장으로 센다(결정은 해시에 묶이므로 한 번이면 된다). 이름은 모아 보인다.
    const shas: string[] = [], names = new Map<string, string[]>();
    for (const it of b.items) {
      if (names.has(it.sha)) { names.get(it.sha)!.push(it.label); continue; }
      const e = entries.get(it.sha) ?? { receipt: readReceipt(it.sha), sha: it.sha, kind: it.kind, label: it.label, batches: [] };
      if (e.receipt && e.receipt.kind !== it.kind) e.receipt = null; // 다른 종류로 받은 영수증은 이 묶음 항목의 조언이 아니다
      names.set(it.sha, [it.label]); e.batches.push(b.id); entries.set(it.sha, e); shas.push(it.sha);
    }
    for (const [sha, list] of names) entries.get(sha)!.label = list.length > 1 ? `${list[0]} (같은 그림 ${list.length}개: ${list.join(', ')})` : list[0]!;
    batches.push({ id: b.id, title: b.title, note: b.note, explainImage: b.explainImage, explainText: b.explainText, auto: false, shas });
  }
  const auto = new Map<string, string[]>();
  for (const e of entries.values()) if (!e.batches.length) {
    const id = `auto:${e.label.split('/')[0] || '기타'}`;
    e.batches.push(id); (auto.get(id) ?? auto.set(id, []).get(id)!).push(e.sha);
  }
  for (const [id, shas] of [...auto].sort((a, b) => a[0].localeCompare(b[0]))) batches.push({ id, title: `${id.slice(5)} (묶음 목록 없음 — 표식 앞머리로 나눔)`, auto: true, shas });
  return { entries, batches };
}

type Status = 'no-receipt' | 'auto-pass' | 'allowed' | 'rejected' | 'waiting' | 'opus-pass' | 'opus-fail' | 'superseded';
let finalCalibrated = new Set<string>();
/** 이 그림의 Opus 최종 기록(종류가 같은 것만). 효력(보정된 프로필)은 finalApplies 로 따로 본다. */
function finalOf(e: Entry): ObjectGateFinal | null { const f = readFinal(e.sha); return f && f.kind === e.kind ? f : null; }
function statusOf(e: Entry, calibrated: Set<string>): { status: Status; decision: ObjectGateHoldDecision | null } {
  const d = readHoldDecision(e.sha);
  // 다시 그려 물러난 그림(supersede-holds)은 대기열에 다시 올리지 않는다 — 결정이 끝난 것으로 본다.
  if (d?.supersededBy && d.decision === 'allow') return { status: 'superseded', decision: d };
  const f = finalOf(e);
  if (f && finalApplies(f, e.sha, finalCalibrated)) {
    // Opus 최종 판정이 있으면 그것이 상태다. 사람 거절만 그 위에 있다.
    if (humanDecision(d, { pixelSha256: e.sha, kind: f.kind } as ObjectGateReceipt) === 'reject') return { status: 'rejected', decision: d };
    return { status: f.verdict === 'pass' ? 'opus-pass' : 'opus-fail', decision: humanDecision(d, { pixelSha256: e.sha, kind: f.kind } as ObjectGateReceipt) ? d : null };
  }
  if (!e.receipt) return { status: 'no-receipt', decision: null };
  const h = humanDecision(d, e.receipt);
  if (h === 'allow') return { status: 'allowed', decision: d };
  if (h === 'reject') return { status: 'rejected', decision: d };
  if (e.receipt.verdict === 'pass' && calibrated.has(e.receipt.profileHash)) return { status: 'auto-pass', decision: null };
  return { status: 'waiting', decision: null };
}

export async function serveHolds({ host, port }: { host: string; port: number }): Promise<http.Server> {
  if (!Number.isSafeInteger(port) || port < 1024 || port > 65535) throw Error('명시적인 포트가 필요하다(1024~65535)');
  holdKey(true); // 서명 키가 없으면 만든다(저장소 밖, 0600)
  const sessions = new Map<string, number>();
  const server = http.createServer(async (req, res) => {
    const json = (status: number, value: unknown) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(value)); };
    const png = (path: string) => { res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(readFileSync(path)); };
    /** 같은 화면·살아 있는 세션의 JSON POST 만 받는다. 본문을 돌려준다. */
    const guardedBody = async (limit: number): Promise<Record<string, unknown>> => {
      if (req.headers.origin !== `http://${req.headers.host}`) throw Error('같은 검토 화면에서 고르세요');
      if (req.headers['content-type'] !== 'application/json') throw Error('JSON 요청만 받는다');
      const cookie = req.headers.cookie?.split(';').map(s => s.trim()).find(s => s.startsWith('holds_session='))?.slice('holds_session='.length);
      const token = req.headers['x-holds-csrf'] as string | undefined;
      if (!equal(cookie, token) || !sessions.has(token!) || sessions.get(token!)! < Date.now()) throw Error('검토 세션이 만료되었다. 새로고침하세요');
      let bytes = 0, body = '';
      for await (const chunk of req) { bytes += (chunk as Buffer).length; if (bytes > limit) throw Error('요청이 너무 크다'); body += chunk; }
      return JSON.parse(body) as Record<string, unknown>;
    };
    const who = (q: Record<string, unknown>) => { const s = String(q.decidedBy ?? '').trim().slice(0, 60); if (!s) throw Error('결정한 사람 이름을 적어라'); return s; };
    // 위임 허용(2026-10-21): 사용자가 감독자에게 위임해 독립 검수 뒤 기록하는 경우. delegatedBy 와 evidence 가 둘 다 있어야 하고, 없으면 사람 클릭으로 기록한다.
    const delegation = (q: Record<string, unknown>): { by: 'human' } | { by: 'delegated'; delegatedBy: string; evidence: string } => {
      const delegatedBy = String(q.delegatedBy ?? '').trim().slice(0, 60), evidence = String(q.evidence ?? '').trim().slice(0, 300);
      if (!delegatedBy && !evidence) return { by: 'human' };
      if (!delegatedBy || !evidence) throw Error('위임 허용은 delegatedBy(위임한 사람)와 evidence(근거 경로)를 둘 다 적어야 한다');
      if (q.decision !== undefined && q.decision !== 'allow') throw Error('위임 결정은 허용만 기록한다 — 거절은 사람이 누른다');
      if (!existsSync(resolve(evidence.replace(/^~(?=\/)/, homedir())))) throw Error(`evidence 경로에 파일이 없다: ${evidence}`);
      return { by: 'delegated', delegatedBy, evidence };
    };
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      if (req.method === 'GET' && url.pathname === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Frame-Options': 'SAMEORIGIN', 'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'" });
        res.end(readFileSync(PAGE)); return;
      }
      if (req.method === 'GET' && url.pathname === '/api/session') {
        const token = randomBytes(32).toString('hex');
        sessions.set(token, Date.now() + 12 * 60 * 60 * 1000);
        for (const [k, v] of sessions) if (v < Date.now()) sessions.delete(k);
        res.setHeader('Set-Cookie', `holds_session=${token}; HttpOnly; SameSite=Strict; Path=/`);
        json(200, { csrf: token }); return;
      }
      if (req.method === 'GET' && (url.pathname === '/api/queue' || url.pathname === '/api/holds')) {
        const current = await gateProfileHash();
        const profile = readProfiles().find(p => p.profileHash === current);
        const calibrated = calibratedProfiles();
        finalCalibrated = calibratedFinalProfiles();
        const { entries, batches } = buildQueue(url.searchParams.get('fresh') === '1');
        const statusCache = new Map<string, ReturnType<typeof statusOf>>();
        const st = (sha: string) => statusCache.get(sha) ?? statusCache.set(sha, statusOf(entries.get(sha)!, calibrated)).get(sha)!;
        const summary = batches.map(b => {
          const c = { total: b.shas.length, waiting: 0, allowed: 0, rejected: 0, superseded: 0, autoPass: 0, noReceipt: 0, withImage: 0, ai: { pass: 0, refer: 0, fail: 0 }, opusPass: 0, opusFail: 0 };
          for (const sha of b.shas) {
            const s = st(sha).status, r = entries.get(sha)!.receipt;
            if (s === 'opus-pass') c.opusPass++; else if (s === 'opus-fail') c.opusFail++;
            else if (s === 'waiting') { c.waiting++; if (existsSync(heldImagePath(sha))) c.withImage++; if (r) c.ai[r.verdict]++; }
            else if (s === 'allowed') c.allowed++; else if (s === 'rejected') c.rejected++; else if (s === 'superseded') c.superseded++; else if (s === 'auto-pass') c.autoPass++; else c.noReceipt++;
          }
          return { id: b.id, title: b.title, note: b.note ?? '', explainText: b.explainText ?? '', hasExplainImage: !!queueExplainImagePath(b.explainImage), auto: b.auto, ...c };
        });
        // 전체 수는 그림(해시) 하나를 한 번만 센다(한 그림이 여러 묶음에 들 수 있다).
        const totals = { waiting: 0, allowed: 0, rejected: 0, autoPass: 0, opusPass: 0, opusFail: 0 };
        for (const sha of entries.keys()) { const s = st(sha).status; if (s === 'waiting') totals.waiting++; else if (s === 'allowed') totals.allowed++; else if (s === 'rejected') totals.rejected++; else if (s === 'auto-pass') totals.autoPass++; else if (s === 'opus-pass') totals.opusPass++; else if (s === 'opus-fail') totals.opusFail++; }
        const pick = url.searchParams.get('batch') ?? summary.find(b => !b.auto && b.waiting)?.id ?? summary.find(b => b.waiting)?.id ?? summary[0]?.id;
        const showDecided = url.searchParams.get('decided') === '1';
        const batch = batches.find(b => b.id === pick);
        const items = batch ? batch.shas.flatMap(sha => {
          const e = entries.get(sha)!, { status, decision } = st(sha), r = e.receipt;
          if (status === 'auto-pass' || (!showDecided && (status === 'allowed' || status === 'rejected' || status === 'opus-pass' || status === 'superseded'))) return [];
          const f = finalOf(e);
          return [{
            opus: f ? { verdict: f.verdict, reasons: f.reasons, view34: f.view34, style: f.style, kindOk: f.kindOk, sure: f.sure, profileHash: f.profileHash, calibrated: finalCalibrated.has(f.profileHash), decidedAt: f.decidedAt } : null,
            sha, label: e.label, name: r?.name ?? e.label, kind: e.kind, kindMeaning: OBJECT_GATE_KINDS[e.kind as keyof typeof OBJECT_GATE_KINDS]?.meaning ?? '', width: r?.width ?? 0, height: r?.height ?? 0,
            status, aiVerdict: r?.verdict ?? null, profileHash: r?.profileHash ?? null, calibrated: !!r && calibrated.has(r.profileHash), reasons: r?.reasons ?? [],
            view34: r?.view34?.verdict ?? null, style: r?.style?.verdict ?? null, styleKind: r?.style?.styleKind ?? null, refs: r?.style?.refs ?? [],
            hasImage: existsSync(heldImagePath(sha)), decision: decision ? { decision: decision.decision, by: decision.by, ...(decision.by === 'delegated' ? { delegatedBy: decision.delegatedBy, evidence: decision.evidence } : {}), ...(decision.supersededBy ? { supersededBy: decision.supersededBy, supersededAt: decision.supersededAt } : {}), decidedBy: decision.decidedBy, decidedAt: decision.decidedAt, note: decision.note } : null,
          }];
        }) : [];
        const order: Record<string, number> = { 'opus-fail': 0, waiting: 1, 'no-receipt': 2, 'opus-pass': 3, allowed: 4, rejected: 5, superseded: 6 };
        items.sort((a, b) => order[a.status]! - order[b.status]! || a.label.localeCompare(b.label));
        json(200, { currentProfile: current, profileStatus: profile?.status ?? 'uncalibrated', finalProfiles: [...finalCalibrated], totals, batches: summary, batch: pick, items }); return;
      }
      const img = url.pathname.match(/^\/img\/([0-9a-f]{64})\.png$/);
      if (req.method === 'GET' && img) { const path = existsSync(heldImagePath(img[1]!)) ? heldImagePath(img[1]!) : null; if (!path) { json(404, { error: '그림 없음' }); return; } png(path); return; }
      const explain = url.pathname.match(/^\/explain\/([a-z0-9][-a-z0-9_.]{0,80})\.png$/);
      if (req.method === 'GET' && explain) {
        const path = queueExplainImagePath(listQueueBatches().find(b => b.id === explain[1])?.explainImage);
        if (!path) { json(404, { error: '설명 그림 없음' }); return; }
        png(path); return;
      }
      const ref = url.pathname.match(/^\/ref\/([a-z_]+)\/([-_a-z0-9]+)\.png$/);
      if (req.method === 'GET' && ref) {
        const found = styleRefs(ref[1] as never).find(r => r.name === ref[2]);
        if (!found || !existsSync(found.path)) { json(404, { error: '기준 그림 없음' }); return; }
        png(found.path); return;
      }
      if (req.method === 'GET' && url.pathname === '/guide/pairs.png') { png(resolve(GATE_DATA, 'view34-pairs.png')); return; }
      if (req.method === 'POST' && url.pathname === '/api/decide') {
        const q = await guardedBody(8192);
        const sha = String(q.sha ?? '');
        if (!SHA.test(sha)) throw Error('그림 해시가 없다');
        if (q.decision !== 'allow' && q.decision !== 'reject') throw Error('결정은 allow 또는 reject');
        const decidedBy = who(q);
        const final = readFinal(sha);
        if (q.decision === 'allow' && final && finalApplies(final, sha, calibratedFinalProfiles())) throw Error('Opus 최종 판정이 있는 그림이다 — 허용은 효력이 없다(최종은 Opus, 사람은 거절만 덮어쓴다)');
        const receipt = readReceipt(sha) ?? (final ? ({ pixelSha256: sha, kind: final.kind, profileHash: final.profileHash, reasons: final.reasons } as unknown as ObjectGateReceipt) : null);
        // AI 가 한 번도 판정하지 않은 그림은 결정할 수 없다(조언 없이 허용하는 길을 막는다).
        if (!receipt) throw Error('이 해시의 판정 영수증이 없다 — object-gate enqueue/review 로 AI 조언을 먼저 받아라');
        if (typeof q.kind === 'string' && q.kind !== receipt.kind) throw Error(`화면의 종류(${q.kind})와 영수증 종류(${receipt.kind})가 다르다. 새로고침하세요`);
        if (readHoldDecision(sha)?.supersededBy) throw Error('다시 그려 물러난 그림이다 — 새 그림의 해시로 결정하라');
        const prev = humanDecision(readHoldDecision(sha), receipt);
        if (prev === 'reject') throw Error('이미 거절된 그림이다 — 거절은 최종이다. 다시 그려 새 해시로 받아라');
        if (prev === 'allow' && q.decision === 'allow') throw Error('이미 허용된 그림이다');
        // 해시 확인: 서버에 저장된 그림을 다시 재서 영수증·요청의 해시와 같아야 한다(화면에 보인 그림 = 결정이 묶이는 그림).
        if (!(await heldImage(sha))) throw Error('저장된 그림이 없거나 해시가 맞지 않는다 — object-gate review 로 다시 받아라');
        const note = String(q.note ?? '').trim().slice(0, 200);
        writeHoldDecision({ schema: 'oprn-object-gate-hold-decision/1', pixelSha256: sha, profileHash: receipt.profileHash, kind: receipt.kind, decision: q.decision, decidedBy, decidedAt: new Date().toISOString(), ...delegation(q), via: 'review-page', reasons: receipt.reasons, ...(note ? { note } : {}) });
        const saved = readHoldDecision(sha);
        if (!saved || saved.decision !== q.decision) throw Error('저장 확인 실패');
        json(200, { saved: true, decision: saved.decision, decidedAt: saved.decidedAt }); return;
      }
      if (req.method === 'POST' && url.pathname === '/api/decide-batch') {
        const q = await guardedBody(1 << 20);
        const decidedBy = who(q);
        finalCalibrated = calibratedFinalProfiles();
        const { entries, batches } = buildQueue(true);
        const batch = batches.find(b => b.id === q.batch);
        if (!batch) throw Error('없는 묶음이다. 새로고침하세요');
        const calibrated = calibratedProfiles();
        // 허용할 수 있는 것 = 이 묶음에서 영수증이 있고, 사람 결정이 없고, 저장된 그림의 해시가 맞는 것.
        const eligible: Array<{ sha: string; receipt: ObjectGateReceipt }> = [];
        for (const sha of batch.shas) {
          const e = entries.get(sha)!;
          if (statusOf(e, calibrated).status !== 'waiting') continue;
          if (!(await heldImage(sha))) continue;
          eligible.push({ sha, receipt: e.receipt! });
        }
        const sent = Array.isArray(q.shas) ? [...new Set(q.shas.map(String))].sort() : [];
        const want = eligible.map(x => x.sha).sort();
        if (!want.length) throw Error('이 묶음에 허용할 수 있는 그림이 없다');
        if (sent.length !== want.length || sent.some((s, i) => s !== want[i])) throw Error('화면의 목록과 서버의 대기 목록이 다르다(그 사이에 바뀌었을 수 있다). 새로고침하세요');
        if (q.confirm !== `${want.length}장 전부 허용`) throw Error(`확인 문구가 맞지 않는다 — 「${want.length}장 전부 허용」을 직접 입력해야 한다`);
        const at = new Date().toISOString(), note = `묶음 허용: ${batch.title}${q.note ? ` — ${String(q.note).trim().slice(0, 150)}` : ''}`;
        const deleg = delegation({ ...q, decision: 'allow' });
        let saved = 0;
        for (const { sha, receipt } of eligible) {
          writeHoldDecision({ schema: 'oprn-object-gate-hold-decision/1', pixelSha256: sha, profileHash: receipt.profileHash, kind: receipt.kind, decision: 'allow', decidedBy, decidedAt: at, ...deleg, via: 'review-page', reasons: receipt.reasons, note });
          if (readHoldDecision(sha)?.decision === 'allow') saved++;
        }
        if (saved !== eligible.length) throw Error(`저장 확인 실패(${saved}/${eligible.length})`);
        json(200, { saved, batch: batch.id }); return;
      }
      json(404, { error: '없는 경로' });
    } catch (e) { json(409, { error: (e as Error).message }); }
  });
  await new Promise<void>((done, fail) => { server.once('error', fail); server.listen(port, host, () => done()); });
  console.log(JSON.stringify({ host, port, data: GATE_DATA, reviewUrl: `http://${host === '0.0.0.0' ? 'mdc-server' : host}:${port}/` }));
  return server;
}
