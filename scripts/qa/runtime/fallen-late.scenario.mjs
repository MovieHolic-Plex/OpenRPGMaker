// 『폴른 스타』 제1막 후반만 — 결전 패배 카드 → 물러섬 → 재도전 승리 카드 → 렌즈 신호 → 하넬 보고 → 엔딩 카드 → 크레딧.
// 통짜 감사(fallen-audit)는 부하 걸린 머신에서 결전 도중 브라우저가 죽어(「Target crashed」, 가혹 검수 r11) 이 장면들이
// 채점되지 못했다. 여기서는 보스 앞까지를 디버그 스위치·순간이동으로 건너뛰고(fallen-boss.probe 와 같은 길),
// 결전은 픽스처에서 보스 체력만 줄여 두 수 안에 끝낸다 — 그림·대사·흐름은 출하물 그대로다.
//
//   RES_FIXTURE=.omo/fs/v40.json npm run qa:runtime -- --scenario fallen-late
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const [vw, vh] = (process.env.RES_VP ?? "480x270").split("x").map(Number);
const STATE_OUT = process.env.FS_STATE_OUT ?? "/tmp/fs-late-state";

// 파생 픽스처: 이리스를 처음부터 파티에 넣고(관 이벤트는 fallen-audit 이 본다) 결전 적의 체력을 줄인다.
const source = resolve(process.env.RES_FIXTURE ?? ".omo/fs/v40.json");
const fixture = JSON.parse(readFileSync(source, "utf8"));
const project = fixture.project ?? fixture;
const auto = project.maps.fs_hub.events.find((e) => e.pages?.[0]?.trigger?.kind === "auto");
auto.pages[0].commands.unshift({ kind: "changeParty", actorId: "actor_fs_iris", action: "add" });
const BOSS_HP = Number(process.env.FS_LATE_BOSS_HP ?? 60);
for (const enemy of project.database.enemies) {
  if (enemy.id === "enemy_fs_valen" || enemy.id === "enemy_fs_guardian") enemy.stats = { ...enemy.stats, maxHp: BOSS_HP };
}
// 프로세스마다 따로 — 검수자와 감독이 동시에 돌리면 같은 파일을 서로 덮었다.
const derived = `/tmp/fs-late-fixture-${process.pid}.json`;
writeFileSync(derived, JSON.stringify(fixture));

const closeDialogue = (max = 30) => [
  { kind: "pressUntil", key: "Enter", testid: "dialogue-box", state: "absent", maxPresses: max, timeoutMs: 900 },
  { kind: "hold", dir: null, ms: 500 },
];
/** 옆(동쪽 두 칸)에서 걸어 들어와 (x, y)에 선다 — 천문대 서재처럼 아래가 벽이라 approachUp 이 쓸 수 없는 곳. */
const approachFromEast = (mapId, x, y) => [
  { kind: "teleport", mapId, x: x + 2, y }, { kind: "hold", dir: null, ms: 400 },
  { kind: "evalToFile", fn: `() => { window.__oprnDebug.playerRoute([{ kind: "move", dir: "left" }, { kind: "move", dir: "left" }]); return true; }`, out: "/tmp/fs-late-approach2.json" },
  { kind: "hold", dir: null, ms: 1200 },
];
const approachUp = (mapId, x, y) => [
  { kind: "face", dir: "up" }, { kind: "teleport", mapId, x, y: y + 2 }, { kind: "hold", dir: null, ms: 400 },
  { kind: "evalToFile", fn: `() => { window.__oprnDebug.playerRoute([{ kind: "move", dir: "up" }, { kind: "move", dir: "up" }]); return true; }`, out: "/tmp/fs-late-approach.json" },
  { kind: "hold", dir: null, ms: 1200 },
];
/** 지하 등불 방: 남쪽 통로로 걸어 들어가면 발렌이 북쪽 통로에서 걸어 내려온다(chronoBell valenWalksIn). */
const valenWalksIn = [
  { kind: "face", dir: "up" }, { kind: "teleport", mapId: "fs_vault", x: 15, y: 15 }, { kind: "hold", dir: null, ms: 500 },
  { kind: "evalToFile", fn: `() => { window.__oprnDebug.playerRoute([{ kind: "move", dir: "up" }, { kind: "move", dir: "up" }]); return true; }`, out: "/tmp/fs-walkin.json" },
  { kind: "waitFor", testid: "dialogue-box", state: "present", timeoutMs: 10000 },
  { kind: "hold", dir: null, ms: 1200 },
];
/** 발렌이 등불 앞에 다 설 때까지(장면이 도는 동안 말을 걸면 입력이 씹힌다). */
const untilValenArrived = { kind: "evalToFile", out: "/tmp/fs-valen-arrived.json",
  fn: `async () => { for (let i = 0; i < 160; i++) { if (window.__oprnDebug.readState().switches.sw_fs_valen_arrived) return true; await new Promise((r) => setTimeout(r, 250)); } return false; }` };
const talk = (dir) => [{ kind: "face", dir }, { kind: "action" }, { kind: "waitFor", testid: "dialogue-box", state: "present", timeoutMs: 8000 }, { kind: "hold", dir: null, ms: 1800 }];
const stepInto = (mapId, x, y, dir) => [
  { kind: "teleport", mapId, x, y },
  { kind: "hold", dir: null, ms: 500 },
  { kind: "hold", dir, ms: 700 },
  { kind: "hold", dir: null, ms: 1500 },
];
const evalOp = (name, fn) => ({ kind: "evalToFile", fn, out: `/tmp/fs-late-${name}.json` });
/**
 * 전투 한 수: 결과 창이면 확인, 명령 창이면 command(공격 또는 방어), 대상 창이면 첫 대상. 결과 패널이 뜨면 손대지 않는다(찍을 차례).
 * 패배 판은 체력 1 로 방어만 한다 — 보스 체력을 줄인 픽스처라 공격하면 이겨 버렸다.
 */
const STEP_FN = (confirm, command = "actor-command-attack") => `() => {
  const q = (t) => document.querySelector('[data-testid="' + t + '"]');
  if (q("battle-result-panel") && !${confirm}) return "result-panel";
  const ok = q("battle-result-confirm"); if (ok) { ok.click(); return "confirm"; }
  const live = [...document.querySelectorAll("button.battle-command")].filter((n) => !n.disabled && n.dataset.previewOnly !== "true");
  const cmd = live.find((n) => n.dataset.testid === "${command}") ?? live.find((n) => n.dataset.testid === "actor-command-attack");
  if (cmd) { cmd.click(); return cmd.dataset.testid; }
  const target = live.find((n) => (n.dataset.testid || "").startsWith("battle-target-") && n.dataset.testid !== "battle-target-cancel");
  if (target) { target.click(); return "target"; }
  return null;
}`;
const fightUntilResult = (name, command) => [
  { kind: "repeatUntil", testid: "battle-result-panel", state: "present", maxRounds: 300, ops: [evalOp(`${name}-step`, STEP_FN(false, command)), { kind: "hold", dir: null, ms: 400 }] },
  { kind: "hold", dir: null, ms: 1600 },
];
const leaveBattle = (name) => [
  { kind: "repeatUntil", testid: "battle-scene", state: "absent", maxRounds: 60, ops: [evalOp(`${name}-leave`, STEP_FN(true)), { kind: "key", key: "Enter" }, { kind: "hold", dir: null, ms: 500 }] },
  { kind: "hold", dir: null, ms: 1200 },
];
const startBoss = [
  ...approachUp("fs_vault", 15, 9), ...talk("up"),
  { kind: "pressUntil", key: "Enter", testid: "battle-scene", state: "present", maxPresses: 30, timeoutMs: 900 },
  { kind: "hold", dir: null, ms: 2500 },
];
const dumpState = (name) => evalOp(`state-${name}`,
  "() => { const s = window.__oprnDebug.readState(); return { map: s.currentMapId, x: s.x, y: s.y, party: s.partyActorIds, switches: Object.fromEntries(Object.entries(s.switches).filter(([k]) => k.startsWith('sw_fs'))), battleResult: s.battleResult }; }");

export default {
  id: "fallen-late",
  projectFixture: derived,
  // 패배 카드는 파티 체력을 1로 내려 일부러 진다 — __oprnSetActorVitals 는 이 쿼리가 있을 때만 열린다.
  query: { e2eVitals: "1" },
  viewport: { width: vw, height: vh },
  beats: [
    { id: "title", note: "타이틀(메뉴 글자 크기)", ops: [
      { kind: "waitFor", testid: "title-screen", state: "present", timeoutMs: 60000 },
      { kind: "waitForAttr", testid: "title-screen", attr: "data-seq-state", value: "done", timeoutMs: 30000 },
    ], shot: true },
    { id: "boot", note: "새 게임 → 오프닝 건너뛰기 → 포고 넘기기", ops: [
      { kind: "pressUntil", key: "Enter", testid: "cinematic-sequence", state: "present", maxPresses: 6, timeoutMs: 12000 },
      { kind: "hold", dir: null, ms: 600 },
      { kind: "pressUntil", key: "Escape", testid: "cinematic-sequence", state: "absent", maxPresses: 6 },
      { kind: "waitForRuntime", timeoutMs: 120000 },
      { kind: "hold", dir: null, ms: 1500 },
      ...closeDialogue(20),
    ], shot: false },
    // 포고 뒤 발렌·기사가 동문으로 걸어 나간다(가혹 검수 r12) — 걷는 중 한 장, 조금 뒤 한 장.
    { id: "march", note: "포고 뒤 발렌 일행이 동문으로 걸어 나간다", ops: [{ kind: "hold", dir: null, ms: 1200 }], shot: true },
    { id: "march-2", note: "", ops: [...closeDialogue(20), { kind: "hold", dir: null, ms: 2500 }], shot: true },
    { id: "proclamation-rest", note: "", ops: [
      ...[0, 1].flatMap(() => closeDialogue(20)),
      evalOp("switches", `() => { for (const id of ["sw_fs_main_started", "sw_fs_main_step0", "sw_fs_main_step1"]) window.__oprnDebug.setSwitch(id, true); return window.__oprnDebug.readState().partyActorIds; }`),
    ], shot: false },
    { id: "valen-enters", note: "발렌 등장 — 서술", ops: [...valenWalksIn], shot: true },
    { id: "valen-enters-close", note: "", ops: [...closeDialogue(10)], shot: false },
    // 걸어 내려오는 모습을 0.4초 간격으로(채점 규칙: 움직임은 연속 캡처).
    ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ id: `valen-walk-${n}`, note: n === 1 ? "발렌이 북쪽 통로에서 걸어 내려온다(0.4초 간격)" : "", ops: [{ kind: "hold", dir: null, ms: 400 }], shot: true })),
    { id: "valen", note: "발렌 앞 — 대열", ops: [untilValenArrived, { kind: "hold", dir: null, ms: 800 }, ...closeDialogue(), ...approachUp("fs_vault", 15, 9), ...talk("up")], shot: true },
    { id: "lose-start", note: "결전(일부러 체력 1로)", ops: [
      evalOp("weak", `() => { for (const id of window.__oprnDebug.readState().partyActorIds) window.__oprnSetActorVitals(id, 1, 999); return true; }`),
      { kind: "pressUntil", key: "Enter", testid: "battle-scene", state: "present", maxPresses: 30, timeoutMs: 900 },
      { kind: "hold", dir: null, ms: 2500 },
    ], shot: true },
    { id: "defeat-card", note: "패배 카드", ops: [...fightUntilResult("lose", "actor-command-defend")], shot: true },
    { id: "retreat", note: "물러섬 대사", ops: [...leaveBattle("lose"), { kind: "waitFor", testid: "dialogue-box", state: "present", timeoutMs: 8000 }, { kind: "hold", dir: null, ms: 1800 }], shot: true },
    { id: "retry-start", note: "다시 말 걸어 재도전", ops: [...closeDialogue(), evalOp("heal", "() => { window.__oprnDebug.heal(); return true; }"), ...startBoss], shot: true },
    { id: "victory-card", note: "승리 카드", ops: [...fightUntilResult("win")], shot: true },
    { id: "after-battle", note: "결전 뒤 — 발렌의 동기", ops: [...leaveBattle("win"), { kind: "hold", dir: null, ms: 1500 }, dumpState("boss")], shot: true },
    { id: "signal", note: "렌즈 신호", ops: [{ kind: "pressUntilText", key: "Enter", testid: "dialogue-box", text: "답이 왔어요", maxPresses: 30 }], shot: true },
    { id: "signal-close", note: "", ops: [...closeDialogue()], shot: false },
    { id: "vault-out", note: "지하 → 화로의 방 → 천문대", ops: [
      ...stepInto("fs_vault", 15, 25, "down"),
      ...stepInto("fs_vault_gate", 26, 4, "up"),
    ], shot: true },
    { id: "report", note: "하넬에게 보고", ops: [...closeDialogue(), ...approachFromEast("fs_observatory", 24, 21), ...talk("up")], shot: true },
    { id: "ending", note: "엔딩 카드", ops: [
      { kind: "repeatUntil", testid: "ending-screen", state: "present", maxRounds: 40, ops: [{ kind: "key", key: "Enter" }, { kind: "hold", dir: null, ms: 400 }] },
      { kind: "hold", dir: null, ms: 2500 },
    ], shot: true },
    { id: "ending-2", note: "크레딧", ops: [{ kind: "key", key: "Enter", times: 2, holdMs: 80 }, { kind: "hold", dir: null, ms: 4000 }], shot: true },
    { id: "ending-3", note: "마지막 카드", ops: [{ kind: "key", key: "Enter" }, { kind: "hold", dir: null, ms: 2500 }], shot: true },
  ],
};
