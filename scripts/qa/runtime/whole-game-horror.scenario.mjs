// 실물 게임 공포 런타임 QA — 「폐병원」(horror, 2026-10-28 standin), 컴파일된 출하 플레이어.
//
//   node scripts/runtime-qa.mjs --scenario whole-game-horror --browser firefox --netns \
//     --whole-game ~/z-project/assistant-whole-game/suite/runs/2026-10-28-standin/standin/horror/project --out /tmp/bq/horror
//
// 맵 하나(50×50, 손전등 at:player 반경 4). 비상구(27,47)는 잠겨 대사 두 줄. 추격자(28,27): 금고를 열면 켜지는 sw_0001 페이지, chase 시야 6·맵 전체 추격·접촉 시 killPlayer.
// 순서: 첫 필드(어둠·손전등) → 잠긴 비상구 대사 → 추격자 시야 안으로 → 잡힘 → 게임 오버 → 「다시 도망친다」(체크포인트) →
// 다시 잡힘 → 「타이틀로」 → 타이틀 「불러오기」 목록.
// 숨기: 들킨 뒤 복도를 달려 은신처(끝맺음이 고른 병원 침대)에 숨고, 쫓아온 추격자가 2칸 안까지 왔다가 5칸 밖으로 멀어질 때까지 잡히지 않는지.
import { fieldReady, wholeGameOpening } from "./wholeGameBattleCommon.mjs";

const MAP = "map_blank_start";
const gameOverReady = [
  { kind: "waitFor", testid: "game-over-screen", state: "present", timeoutMs: 60000 },
  { kind: "waitForVisible", testid: "game-over-screen", descendant: ".game-over-choice", minAlpha: 0.99, timeoutMs: 30000 },
];

// 추격자는 집(28,27)에서 아래를 보고 서서 사각형(28..34, 27..30)을 돈다. 시야는 바라보는 쪽이다 — 집 북쪽에 세우면 등 뒤라
// 못 본다(첫 판 실측). 왼쪽 변(x=28)을 위로 올라올 때 북쪽 (28,25)를 본다. 손전등 반경 4 안(3칸)까지 들어오면 찍는다.
const chaserSees = [
  { kind: "setSwitch", switchId: "sw_0001" },
  { kind: "teleport", mapId: MAP, x: 28, y: 25 },
  { kind: "waitForPosition", mapId: MAP, x: 28, y: 25 },
  {
    kind: "pressUntilJs",
    key: "Control",
    settleMs: 100,
    maxPresses: 400,
    fn: `() => { const s = window.__oprnDebug.readState(); const id = Object.keys(s.horror?.pursuits ?? {})[0]; const p = id && s.horror.pursuits[id]; const at = id && s.eventLocations?.[id]; return !!document.querySelector('[data-testid=game-over-screen]') || (!!p?.active && !!at && Math.abs(at.x - s.x) + Math.abs(at.y - s.y) <= 3); }`,
  },
];

// 숨기: 끝맺음(ensureChaserHidingSpots)이 고르는 은신처 = 순찰 고리에서 걸어서 10걸음인 병원 침대 (38,24), 발 칸 (37,24)에서 오른쪽을 보고 조사.
// 은신처가 없는 옛 판(소급 전)에서는 이 비트가 실패한다 — 그것이 «숨을 곳 0» 증거다. 소급: scripts/content/apply-chaser-hiding.mts.
// 진짜 숨기 고리: 복도 입구 (31,24)에서 순찰 추격자에게 들키고(추격 시작) → 복도를 오른쪽으로 6칸 달려 → 침대에 숨는다 →
// 추격자는 마지막으로 본 자리까지 와서(은신처 곁을 지나) 수색하다 돌아간다. 숨는 걸 보였으면 잡힌다(그때는 이 비트가 실패한다).
const HIDE = { x: 38, y: 24, from: { x: 37, y: 24 }, run: { x: 31, y: 24 } };
// 숨은 동안 추격자와의 최소 거리를 window.__hideMinDistance 에 적는다 — 추격자가 어디까지 와서 지나갔는지 증거(hide-min-distance.json).
const chaserProbe = (cond) => `() => { const s = window.__oprnDebug.readState(); const id = Object.keys(s.horror?.pursuits ?? {})[0]; const p = id && s.horror.pursuits[id]; const at = id && s.eventLocations?.[id]; if (document.querySelector('[data-testid=game-over-screen]')) return true; if (!at) return false; const d = Math.abs(at.x - ${HIDE.from.x}) + Math.abs(at.y - ${HIDE.from.y}); window.__hideMinDistance = Math.min(window.__hideMinDistance ?? 99, d); const active = !!p?.active; return ${cond}; }`;
const pursuitActive = "() => { const s = window.__oprnDebug.readState(); return Object.values(s.horror?.pursuits ?? {}).some((p) => p.active) || !!document.querySelector('[data-testid=game-over-screen]'); }";
const hideBeats = [
  {
    id: "hide-approach",
    note: "숨기 전: 은신처 두 칸 앞에서 걸어 들어가면 침대가 반짝이고 곁에 서면 「숨기」 안내가 뜬다",
    ops: [
      { kind: "pressUntilJs", key: "Enter", fn: fieldReady, maxPresses: 10 },
      { kind: "teleport", mapId: MAP, x: HIDE.from.x - 3, y: HIDE.from.y },
      { kind: "waitForPosition", mapId: MAP, x: HIDE.from.x - 3, y: HIDE.from.y },
      { kind: "playerRoute", moves: [{ kind: "move", dir: "right" }, { kind: "move", dir: "right" }, { kind: "move", dir: "right" }] },
      { kind: "waitForPosition", mapId: MAP, x: HIDE.from.x, y: HIDE.from.y, timeoutMs: 15000 },
      { kind: "waitForBodyText", text: "숨기", timeoutMs: 5000 },
    ],
    shot: true,
  },
  {
    id: "hide",
    note: "추격 스위치를 켜고 복도 입구 (31,24)에서 들킨 뒤 복도를 달려 병원 침대 (38,24)에 숨는다(주인공이 사라짐)",
    ops: [
      { kind: "pressUntilJs", key: "Enter", fn: fieldReady, maxPresses: 10 },
      { kind: "setSwitch", switchId: "sw_0001" },
      { kind: "teleport", mapId: MAP, x: HIDE.run.x, y: HIDE.run.y },
      { kind: "waitForPosition", mapId: MAP, x: HIDE.run.x, y: HIDE.run.y },
      { kind: "pressUntilJs", key: "Control", settleMs: 100, maxPresses: 600, fn: pursuitActive },
      { kind: "playerRoute", moves: Array.from({ length: HIDE.from.x - HIDE.run.x }, () => ({ kind: "move", dir: "right" })) },
      { kind: "waitForPosition", mapId: MAP, x: HIDE.from.x, y: HIDE.from.y, timeoutMs: 15000 },
      { kind: "face", dir: "right" },
      { kind: "action" },
      { kind: "pressUntilJs", key: "Control", settleMs: 150, maxPresses: 40, fn: "() => !!window.__oprnDebug.readState().horror?.hiding" },
    ],
    shot: true,
  },
  {
    id: "hidden-chaser-near",
    note: "숨은 채로 쫓아온 추격자가 은신처 3칸 안까지 오거나(그때 찍는다) 놓치고 추격을 푼다 — 잡히지 않는다",
    ops: [{ kind: "pressUntilJs", key: "Control", settleMs: 100, maxPresses: 600, fn: chaserProbe("d <= 3 || !active") }],
    expect: { testidAbsent: ["game-over-screen"] },
    shot: true,
  },
  {
    id: "hidden-chaser-passed",
    note: "추격자가 추격을 풀고 5칸 넘게 멀어질 때까지 숨어 있다 — 게임 오버 없음. 숨은 동안 최소 거리는 hide-min-distance.json",
    ops: [
      { kind: "pressUntilJs", key: "Control", settleMs: 100, maxPresses: 900, fn: chaserProbe("!active && d >= 5") },
      { kind: "evalToFile", out: "/tmp/hide-min-distance.json", fn: "() => ({ minDistance: window.__hideMinDistance ?? null, hiding: !!window.__oprnDebug.readState().horror?.hiding })" },
    ],
    expect: { testidAbsent: ["game-over-screen"] },
    shot: true,
  },
  {
    id: "unhide",
    note: "다시 조사해 나온다",
    ops: [
      { kind: "action" },
      { kind: "pressUntilJs", key: "Control", settleMs: 150, maxPresses: 40, fn: "() => !window.__oprnDebug.readState().horror?.hiding" },
    ],
    shot: true,
  },
];

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export default {
  id: "whole-game-horror",
  viewport: { width: 960, height: 720 },
  beats: [
    ...wholeGameOpening(),
    {
      id: "locked-door",
      note: "잠긴 비상구(27,47) 위 칸에서 아래를 보고 조사 → 잠김 대사",
      ops: [
        { kind: "teleport", mapId: MAP, x: 27, y: 46 },
        { kind: "waitForPosition", mapId: MAP, x: 27, y: 46 },
        { kind: "pressUntilJs", key: "Enter", fn: fieldReady, maxPresses: 10 },
        { kind: "face", dir: "down" },
        { kind: "action" },
        { kind: "waitFor", testid: "dialogue-box", state: "present", timeoutMs: 15000 },
        { kind: "waitForText", testid: "dialogue-box", text: "자물쇠", timeoutMs: 15000 },
      ],
      shot: true,
    },
    ...hideBeats,
    {
      id: "chaser-sees",
      note: "대사를 닫고 sw_0001(금고 퍼즐 끝)을 켠 뒤 (28,25)에서 순찰 추격자가 보고 쫓아와 3칸 안",
      ops: [
        { kind: "pressUntilJs", key: "Enter", fn: fieldReady, maxPresses: 10 },
        ...chaserSees,
      ],
      shot: true,
    },
    {
      id: "caught",
      note: "잡힘 → 게임 오버(공포 연출) 선택지까지",
      ops: [...gameOverReady],
      shot: true,
    },
    {
      id: "retry",
      note: "「다시 도망친다」 → 체크포인트에서 다시",
      ops: [
        { kind: "click", testid: "checkpoint-retry" },
        { kind: "waitFor", testid: "game-over-screen", state: "absent", timeoutMs: 30000 },
        { kind: "pressUntilJs", key: "Enter", fn: fieldReady, maxPresses: 20 },
      ],
      shot: true,
    },
    {
      id: "caught-again",
      note: "다시 추격자 시야로 → 게임 오버",
      ops: [
        ...chaserSees,
        ...gameOverReady,
      ],
      shot: true,
    },
    {
      id: "to-title",
      note: "「타이틀로 돌아가기」 → 타이틀",
      ops: [
        { kind: "click", testid: "return-title" },
        { kind: "waitFor", testid: "title-screen", state: "present", timeoutMs: 60000 },
      ],
      shot: true,
    },
    {
      id: "title-load",
      note: "타이틀 「불러오기」 목록",
      ops: [
        { kind: "click", testid: "title-load-game", timeoutMs: 30000 },
        // 불러오기 창: 저장 칸 목록(체크포인트는 저장 칸이 아니다 — 게임 오버의 「다시 도망친다」 전용).
        { kind: "waitForBodyText", text: "1번 저장", timeoutMs: 15000 },
      ],
      shot: true,
    },
  ],
};
