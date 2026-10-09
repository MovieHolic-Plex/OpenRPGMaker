// 호스트 Pi 실행 중계(scripts/lib/piRunRelay.mjs) — 2026-09-27 프리셋 팀 첫 생성 실측에서 나온 두 실패의 회귀.
// ① 요청 151MB(무거운 키 해시 전송) ② 브라우저 연결이 끊기면 워커가 에이전트를 중단했다(이어 받기).
import assert from "node:assert/strict";
import { it } from "node:test";
import { handleCompanionRequest } from "../scripts/lib/ohMyPiHttp.mjs";
import { heavyHash, resetRelayForTests } from "../scripts/lib/piRunRelay.mjs";

const lines = (stream) => new Promise(async (resolve) => { const r = stream.getReader(); const d = new TextDecoder(); let t = ""; for (;;) { const { value, done } = await r.read(); if (done) break; t += d.decode(value); } resolve(t.trim().split("\n").map(JSON.parse)); });
const readN = async (stream, n) => { const r = stream.getReader(); const d = new TextDecoder(); let t = ""; while (t.split("\n").filter(Boolean).length < n) { const { value, done } = await r.read(); if (done) break; t += d.decode(value); } await r.cancel(); return t.trim().split("\n").filter(Boolean).map(JSON.parse); };

// 가짜 워커: 받은 몸통을 기억하고, 줄을 천천히 흘린다. 중단 신호를 기록한다.
let seenBody = null; let aborted = 0; let emit = null; let end = null;
const adapters = { runAgent: async (_p, body, { signal }) => {
  seenBody = body; signal.addEventListener("abort", () => { aborted++; end?.(); });
  const enc = new TextEncoder();
  return { ndjson: new ReadableStream({ start(c) { emit = (e) => c.enqueue(enc.encode(JSON.stringify(e) + "\n")); end = () => { try { c.close(); } catch {} }; } }) };
} };

const tilesets = JSON.stringify({ t1: { image: "x".repeat(300000) } });
const hash = heavyHash(tilesets);

it("실행 중계: 해시 캐시 · 끊긴 스트림 이어 받기 · 명시 중단", async () => {
// 1) 모르는 해시 → 409 heavy-missing
resetRelayForTests();
let res = await handleCompanionRequest({ method: "POST", url: "/v1/agent/run", headers: {}, body: { task: "t", mapIds: [], runId: "run-aaaaaaaa", project: { maps: {}, tilesets: {} }, heavy: { tilesets: hash } } }, adapters);
assert.equal(res.status, 409); assert.deepEqual(res.body.missing, [hash]);
// 2) 내용 동봉 → 워커가 되살린 프로젝트를 받는다
res = await handleCompanionRequest({ method: "POST", url: "/v1/agent/run", headers: {}, body: { task: "t", mapIds: [], runId: "run-aaaaaaaa", project: { maps: {}, tilesets: {} }, heavy: { tilesets: hash }, heavyBlobs: { [hash]: tilesets } } }, adapters);
assert.equal(res.status, 200); assert.equal(res.headers["X-Oprn-Run-Id"], "run-aaaaaaaa");
assert.equal(seenBody.project.tilesets.t1.image.length, 300000); assert.equal(seenBody.heavy, undefined); assert.equal(seenBody.runId, undefined);
// 3) 줄 두 개 받고 끊는다(브라우저 연결 끊김) — 워커는 멈추지 않는다
emit({ type: "turn", index: 1 }); emit({ type: "turn", index: 2 });
const first = await readN(res.ndjson, 2);
assert.deepEqual(first.map((e) => e.seq), [0, 1]);
emit({ type: "turn", index: 3 });
await new Promise((r) => setTimeout(r, 20));
assert.equal(aborted, 0, "브라우저가 끊었는데 워커가 멈췄다");
// 4) after=2 로 이어 받는다 → 끊긴 동안 쌓인 줄부터 받는다
const resumed = await handleCompanionRequest({ method: "GET", url: "/v1/agent/run?runId=run-aaaaaaaa&after=2", headers: {}, body: {} }, adapters);
assert.equal(resumed.status, 200);
setTimeout(() => { emit({ type: "done", project: {}, stats: {}, changedKeys: [] }); end(); }, 20);
const rest = await lines(resumed.ndjson);
assert.deepEqual(rest.map((e) => [e.seq, e.type]), [[2, "turn"], [3, "done"]]);
// 5) 두 번째 요청은 해시만으로 통한다(캐시)
res = await handleCompanionRequest({ method: "POST", url: "/v1/agent/run", headers: {}, body: { task: "t", mapIds: [], runId: "run-bbbbbbbb", project: { maps: {}, tilesets: {} }, heavy: { tilesets: hash } } }, adapters);
assert.equal(res.status, 200); assert.equal(seenBody.project.tilesets.t1.image.length, 300000);
// 6) 명시 중단만 워커를 멈춘다
const cancel = await handleCompanionRequest({ method: "POST", url: "/v1/agent/cancel", headers: {}, body: { runId: "run-bbbbbbbb" } }, adapters);
assert.equal(cancel.body.ok, true); assert.equal(aborted, 1);
// 7) 거짓 해시는 거부
await assert.rejects(handleCompanionRequest({ method: "POST", url: "/v1/agent/run", headers: {}, body: { task: "t", mapIds: [], project: { maps: {} }, heavy: { tilesets: "0".repeat(64) }, heavyBlobs: { ["0".repeat(64)]: "{}" } } }, adapters), /해시가 내용과 다릅니다/);
// 8) 없는 실행 이어 받기는 404
const gone = await handleCompanionRequest({ method: "GET", url: "/v1/agent/run?runId=run-zzzzzzzz&after=0", headers: {}, body: {} }, adapters);
assert.equal(gone.status, 404);
resetRelayForTests();
});


