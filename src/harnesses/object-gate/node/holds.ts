/**
 * 보류(refer) 판정 사람 검토 화면 — `npm run harness -- object-gate serve-holds [--port 18323] [--host 0.0.0.0]`.
 *
 * 보류 영수증(현재 프로필)의 그림을 1배·4배로, 같은 종류 버들항 화풍 기준 그림·3/4 기준 쌍 옆에 놓고 사람이 허용/거절을 누른다.
 * 결정은 그림 화소 해시·프로필 해시·종류에 묶여 approvals/hold/ 에 저장되고, 저장소 밖 키로 HMAC 서명된다(store.writeHoldDecision).
 * 출구(objectGateRefusal · Python refusal)는 서명이 맞는 「허용」 기록이 있을 때만 보류를 통과로 받는다.
 *
 * 다른 하네스 고르기 화면과 같은 방식: 세션 쿠키 + CSRF 머리글 + 같은 출처(Origin) 확인, 요청의 해시를 서버가 저장된 그림에서 다시 잰 해시와 대조.
 * 감독·에이전트·MCP 도구는 이 화면을 대신 누르거나 기록 파일을 쓰지 않는다(쓰면 서명이 맞지 않아 무효이고, 서버를 흉내 내는 것은 규칙 위반이다).
 */
import http from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { resolve } from 'node:path';
import { OBJECT_GATE_KINDS, type ObjectGateReceipt } from '../../_core/objectGate';
import { GATE_DATA, gateProfileHash, heldImage, holdKey, listReceipts, readHoldDecision, readProfiles, readReceipt, styleRefs, writeHoldDecision } from './store';

const PAGE = resolve(import.meta.dirname ?? __dirname, '..', 'web', 'holds.html');
const equal = (a?: string, b?: string) => typeof a === 'string' && typeof b === 'string' && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const SHA = /^[0-9a-f]{64}$/;

export async function serveHolds({ host, port }: { host: string; port: number }): Promise<http.Server> {
  if (!Number.isSafeInteger(port) || port < 1024 || port > 65535) throw Error('명시적인 포트가 필요하다(1024~65535)');
  holdKey(true); // 서명 키가 없으면 만든다(저장소 밖, 0600)
  const sessions = new Map<string, number>();
  const server = http.createServer(async (req, res) => {
    const json = (status: number, value: unknown) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(value)); };
    const png = (path: string) => { res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(readFileSync(path)); };
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
      if (req.method === 'GET' && url.pathname === '/api/holds') {
        const current = await gateProfileHash();
        const profile = readProfiles().find(p => p.profileHash === current);
        const all = url.searchParams.get('all') === '1';
        const held = listReceipts().filter(r => r.verdict === 'refer' && (all || r.profileHash === current));
        const items = await Promise.all(held.map(async r => {
          const d = readHoldDecision(r.pixelSha256);
          const decision = d && d.profileHash === r.profileHash && d.kind === r.kind ? { decision: d.decision, decidedBy: d.decidedBy, decidedAt: d.decidedAt, note: d.note } : null;
          return {
            sha: r.pixelSha256, label: r.label ?? r.name, name: r.name, kind: r.kind, kindMeaning: OBJECT_GATE_KINDS[r.kind]?.meaning ?? '', width: r.width, height: r.height,
            profileHash: r.profileHash, current: r.profileHash === current, reasons: r.reasons, view34: r.view34?.verdict ?? null, style: r.style?.verdict ?? null,
            styleKind: r.style?.styleKind ?? null, refs: r.style?.refs ?? [], hasImage: !!(await heldImage(r.pixelSha256)), decision, decidedAt: r.decidedAt,
          };
        }));
        items.sort((a, b) => Number(!!a.decision) - Number(!!b.decision) || a.label.localeCompare(b.label));
        json(200, { currentProfile: current, profileStatus: profile?.status ?? 'uncalibrated', items }); return;
      }
      const img = url.pathname.match(/^\/img\/([0-9a-f]{64})\.png$/);
      if (req.method === 'GET' && img) { const path = await heldImage(img[1]!); if (!path) { json(404, { error: '그림 없음' }); return; } png(path); return; }
      const ref = url.pathname.match(/^\/ref\/([a-z_]+)\/([-_a-z0-9]+)\.png$/);
      if (req.method === 'GET' && ref) {
        const found = styleRefs(ref[1] as never).find(r => r.name === ref[2]);
        if (!found || !existsSync(found.path)) { json(404, { error: '기준 그림 없음' }); return; }
        png(found.path); return;
      }
      if (req.method === 'GET' && url.pathname === '/guide/pairs.png') { png(resolve(GATE_DATA, 'view34-pairs.png')); return; }
      if (req.method === 'POST' && url.pathname === '/api/decide') {
        if (req.headers.origin !== `http://${req.headers.host}`) throw Error('같은 검토 화면에서 고르세요');
        if (req.headers['content-type'] !== 'application/json') throw Error('JSON 요청만 받는다');
        const cookie = req.headers.cookie?.split(';').map(s => s.trim()).find(s => s.startsWith('holds_session='))?.slice('holds_session='.length);
        const token = req.headers['x-holds-csrf'] as string | undefined;
        if (!equal(cookie, token) || !sessions.has(token!) || sessions.get(token!)! < Date.now()) throw Error('검토 세션이 만료되었다. 새로고침하세요');
        let bytes = 0, body = '';
        for await (const chunk of req) { bytes += (chunk as Buffer).length; if (bytes > 8192) throw Error('요청이 너무 크다'); body += chunk; }
        const q = JSON.parse(body) as { sha?: string; profileHash?: string; decision?: string; decidedBy?: string; note?: string };
        if (!q.sha || !SHA.test(q.sha)) throw Error('그림 해시가 없다');
        if (q.decision !== 'allow' && q.decision !== 'reject') throw Error('결정은 allow 또는 reject');
        const decidedBy = String(q.decidedBy ?? '').trim().slice(0, 60);
        if (!decidedBy) throw Error('결정한 사람 이름을 적어라');
        const receipt: ObjectGateReceipt | null = readReceipt(q.sha);
        if (!receipt || receipt.verdict !== 'refer') throw Error('이 해시의 보류 영수증이 없다(이미 다시 판정됐을 수 있다). 새로고침하세요');
        const current = await gateProfileHash();
        if (receipt.profileHash !== current || q.profileHash !== current) throw Error(`현재 판정 프로필(${current})의 보류만 결정할 수 있다`);
        // 해시 확인: 서버에 저장된 그림을 다시 재서 영수증·요청의 해시와 같아야 한다(화면에 보인 그림 = 결정이 묶이는 그림).
        if (!(await heldImage(q.sha))) throw Error('보류 그림이 없거나 해시가 맞지 않는다 — object-gate review 로 다시 받아라');
        const note = String(q.note ?? '').trim().slice(0, 200);
        writeHoldDecision({ schema: 'oprn-object-gate-hold-decision/1', pixelSha256: q.sha, profileHash: receipt.profileHash, kind: receipt.kind, decision: q.decision, decidedBy, decidedAt: new Date().toISOString(), by: 'human', via: 'review-page', reasons: receipt.reasons, ...(note ? { note } : {}) });
        const saved = readHoldDecision(q.sha);
        if (!saved || saved.decision !== q.decision) throw Error('저장 확인 실패');
        json(200, { saved: true, decision: saved.decision, decidedAt: saved.decidedAt }); return;
      }
      json(404, { error: '없는 경로' });
    } catch (e) { json(409, { error: (e as Error).message }); }
  });
  await new Promise<void>((done, fail) => { server.once('error', fail); server.listen(port, host, () => done()); });
  console.log(JSON.stringify({ host, port, data: GATE_DATA, reviewUrl: `http://${host === '0.0.0.0' ? 'mdc-server' : host}:${port}/` }));
  return server;
}
