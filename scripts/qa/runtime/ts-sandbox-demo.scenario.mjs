// TypeScript 이벤트 스크립트 데모 판 — 실조수(Opus)가 스크립트로 지은 세 가지를 출하 플레이어로 실제로 해 본다.
//
//   node scripts/runtime-qa.mjs --scenario ts-sandbox-demo --browser firefox --netns \
//     --whole-game /tmp/ts-demo/game/project --out verify-shots/script-sandbox/runtime
//
// 판: 2026-10-31 실조수 세션(openwiki/script-sandbox.md 「실조수 데모」). 좌표·id 는 그 판의 저장본 값이다 — 다른 판이면
// TS_DEMO='{"levers":{"1":[6,11],...},...}' 로 덮는다.
//   1) 레버 4개 조합 퍼즐(레버마다 script) — 틀린 순서(3→2)는 흔들림+원위치, 맞는 순서(3→1→4→2)는 빗장 풀림·평판 +10 → 창고 → 상자.
//   2) 포션 상인(script + @lib/pricing) — 평판 10 이면 100G 가 20% 깎인 80G, 사면 300G → 220G.
//   3) 경비병(시간대 페이지 + 밀어내기/비켜서기 script) — 아침·저녁·밤(통행증 없음 → 한 칸 밀림)·밤(통행증 → 비켜섬).
import { fieldReady } from "./wholeGameBattleCommon.mjs";
import { openingBeats, toFieldBeats, transferBeat } from "./wholeGameStoryCommon.mjs";

const DEFAULTS = {
  start: "map_blank_start",
  shed: "map_46a7fe03-e43c-4c07-923c-030a52bf8fb4",
  levers: { 1: [6, 11], 2: [8, 11], 3: [11, 11], 4: [13, 11] },
  sign: [5, 9, "left"],
  door: [9, 7],
  chest: [4, 5],
  merchant: [15, 12],
  guard: [10, 12],
  guardId: "ev_npc_ce5a3f6b-2037-4c41-944d-e84c5c91d393",
  passItem: "item_night_pass",
  openSwitch: "sw_0001",
  reputation: "var_0001",
  progress: "var_0002",
};
const D = { ...DEFAULTS, ...JSON.parse(process.env.TS_DEMO ?? "{}") };
const state = (body) => `() => { const s = window.__oprnDebug?.readState?.(); return !!s && (${body}); }`;
/** 조건이 이미 참인지 확인(아니면 실패) — Shift 는 필드에서 아무 일도 안 한다. */
const assert = (body) => ({ kind: "pressUntilJs", key: "Shift", fn: state(body), maxPresses: 4, settleMs: 300 });
const toField = { kind: "pressUntilJs", key: "Enter", fn: fieldReady, maxPresses: 40, settleMs: 700 };
const dialogue = { kind: "waitForVisible", testid: "dialogue-box", minAlpha: 0.99, timeoutMs: 20000 };

function stand(mapId, x, y, face) {
  return [toField, { kind: "teleport", mapId, x, y }, { kind: "waitForPosition", mapId, x, y }, { kind: "face", dir: face }];
}
function pull(n) {
  const [x, y] = D.levers[n];
  return [...stand(D.start, x, y, "up"), { kind: "action" }, dialogue];
}

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export default {
  id: "ts-sandbox-demo",
  viewport: { width: 960, height: 720 },
  beats: [
    ...openingBeats().slice(0, 1),
    {
      id: "new-game",
      note: "새 게임 — 맵이 뜰 때까지 Enter",
      ops: [{ kind: "pressUntilJs", key: "Enter", fn: `() => Boolean(window.__oprnDebug?.readState?.().currentMapId)`, maxPresses: 20, settleMs: 3000 }],
    },
    ...toFieldBeats({ firstDialogue: false }),
    {
      id: "sign-hint",
      note: "팻말 — 레버 순서 힌트",
      ops: [...stand(D.start, D.sign[0], D.sign[1], D.sign[2]), { kind: "action" }, dialogue, { kind: "hold", dir: null, ms: 1200 }],
      shot: true,
    },
    {
      id: "lever-wrong-first",
      note: "레버 3(맞는 첫 수) — script 가 진행 변수를 1로",
      ops: [...pull(3), { kind: "hold", dir: null, ms: 900 }],
      shot: true,
    },
    {
      id: "lever-wrong-reset",
      note: "레버 2(틀린 둘째 수) — 흔들림 + 「전부 원위치」, 진행 0",
      ops: [toField, ...pull(2).slice(1), { kind: "pressUntilText", key: "Enter", testid: "dialogue-box", text: "원위치", maxPresses: 6, settleMs: 900 }, { kind: "hold", dir: null, ms: 600 }],
      shot: true,
    },
    {
      id: "lever-reset-state",
      note: "원위치 확인 — 진행 변수 0, 문 스위치 꺼짐",
      ops: [toField, assert(`(s.variables[${JSON.stringify(D.progress)}] ?? 0) === 0 && !s.switches[${JSON.stringify(D.openSwitch)}]`)],
    },
    {
      id: "lever-correct",
      note: "3→1→4→2 — 마지막 레버에서 빗장 풀림",
      ops: [
        ...pull(3), toField, ...pull(1), toField, ...pull(4), toField, ...pull(2),
        { kind: "pressUntilText", key: "Enter", testid: "dialogue-box", text: "빗장", maxPresses: 6, settleMs: 900 },
        { kind: "hold", dir: null, ms: 600 },
      ],
      shot: true,
    },
    {
      id: "lever-solved-state",
      note: "풀림 확인 — 문 스위치 켜짐, 평판 10",
      ops: [toField, assert(`s.switches[${JSON.stringify(D.openSwitch)}] === true && s.variables[${JSON.stringify(D.reputation)}] === 10`)],
    },
    transferBeat({ id: "shed-enter", note: "열린 창고 문으로 들어감", mapId: D.start, from: { x: D.door[0], y: D.door[1] }, push: "up", to: D.shed }),
    {
      id: "shed-chest",
      note: "창고 상자 — 회복약 3개",
      ops: [...stand(D.shed, D.chest[0], D.chest[1], "up"), { kind: "action" }, dialogue, { kind: "hold", dir: null, ms: 1200 }],
      shot: true,
    },
    {
      id: "merchant-price",
      note: "포션 상인 — 평판 10 → 20% 할인가 80G 안내(@lib/pricing)",
      ops: [...stand(D.start, D.merchant[0], D.merchant[1], "up"), { kind: "action" }, { kind: "pressUntilText", key: "Enter", testid: "dialogue-box", text: "80골드", maxPresses: 4, settleMs: 900 }, { kind: "hold", dir: null, ms: 900 }],
      shot: true,
    },
    {
      id: "merchant-choices",
      note: "선택지 — 1병 80G / 3병 240G / 그만둔다",
      ops: [{ kind: "pressUntilJs", key: "Enter", fn: `() => !!document.querySelector("[data-testid='dialogue-choice-frame']")`, maxPresses: 6, settleMs: 900 }, { kind: "hold", dir: null, ms: 900 }],
      shot: true,
    },
    {
      id: "merchant-bought",
      note: "1병 산다 — 300G → 220G",
      ops: [{ kind: "key", key: "Enter" }, dialogue, { kind: "hold", dir: null, ms: 900 }],
      shot: true,
    },
    {
      id: "merchant-gold",
      note: "돈 확인 — 220G",
      ops: [toField, assert("s.gold === 220")],
    },
    {
      id: "guard-morning",
      note: "경비병 아침(07:00) — 반가운 인사",
      ops: [toField, { kind: "setClock", hour: 7 }, ...stand(D.start, D.guard[0], D.guard[1], "up"), { kind: "action" }, { kind: "pressUntilText", key: "Enter", testid: "dialogue-box", text: "좋은 아침", maxPresses: 4, settleMs: 900 }, { kind: "hold", dir: null, ms: 900 }],
      shot: true,
    },
    {
      id: "guard-evening",
      note: "경비병 저녁(18:00) — 곧 문 닫는다",
      ops: [toField, { kind: "setClock", hour: 18 }, ...stand(D.start, D.guard[0], D.guard[1], "up"), { kind: "action" }, { kind: "pressUntilText", key: "Enter", testid: "dialogue-box", text: "해가 지고", maxPresses: 4, settleMs: 900 }, { kind: "hold", dir: null, ms: 900 }],
      shot: true,
    },
    {
      id: "guard-night-stop",
      note: "경비병 밤(22:00), 통행증 없음 — 「멈추게!」",
      ops: [toField, { kind: "setClock", hour: 22 }, ...stand(D.start, D.guard[0], D.guard[1], "up"), { kind: "action" }, { kind: "pressUntilText", key: "Enter", testid: "dialogue-box", text: "멈추게", maxPresses: 4, settleMs: 900 }, { kind: "hold", dir: null, ms: 900 }],
      shot: true,
    },
    {
      id: "guard-night-pushed",
      note: "script 가 주인공을 경비병 반대쪽으로 한 칸 밀어냄",
      ops: [{ kind: "pressUntilText", key: "Enter", testid: "dialogue-box", text: "날이 밝으면", maxPresses: 6, settleMs: 900 }, { kind: "hold", dir: null, ms: 600 }, assert(`s.y === ${D.guard[1] + 1}`)],
      shot: true,
    },
    {
      id: "guard-night-pass",
      note: "밤, 통행증 있음 — 「조용히 지나가게」",
      ops: [toField, { kind: "giveItem", itemId: D.passItem, amount: 1 }, ...stand(D.start, D.guard[0], D.guard[1], "up"), { kind: "action" }, { kind: "pressUntilText", key: "Enter", testid: "dialogue-box", text: "통행증이군", maxPresses: 4, settleMs: 900 }, { kind: "hold", dir: null, ms: 900 }],
      shot: true,
    },
    {
      id: "guard-steps-aside",
      note: "script 가 경비병을 옆으로 한 칸 비켜 세움 → 주인공이 지나감",
      ops: [toField, { kind: "hold", dir: null, ms: 900 }, { kind: "hold", dir: "up", ms: 700 }, { kind: "hold", dir: null, ms: 600 }, assert(`s.y < ${D.guard[1]}`)],
      shot: true,
    },
  ],
};
