// 실물 추리 게임 — 용의자 셋이 서 있나 · 탐문(흉상·이름표) · 증거 제시 창 · 범인 고르기(틀리면 다시) · 맞는 증거로 엔딩.
//
//   MYS='<json>' node scripts/runtime-qa.mjs --scenario whole-game-mystery --browser firefox --netns \
//     --whole-game <mystery project 사본> --out /tmp/bq/my/rt-<판>
//   MYS_MODE=before 면 고치기 전 판(용의자·고르기 없음): 무대 칸 한 장 → 지목 칸 조사 → 엔딩까지.
//
// MYS = { stage:{mapId,at}, innocent:{mapId,at,face}, culprit:{mapId,at,face}, evidence, culpritSwitches[], accuse:{mapId,at,face},
//         accuseSwitches[], rightIndex, wrongIndex } — scripts/qa/assistant-v2 쪽에서 고친 프로젝트를 읽어 만든다.
// 2026-10-29 vm1/vm2 mystery 판정 「투명 칸 네 곳을 순서대로 누르면 끝·NPC 없음·추리·선택 없음」을 고친 판(ai/v2/mysteryCase.ts)을 본다.
import { fieldReady } from "./wholeGameBattleCommon.mjs";
import { openingBeats, toFieldBeats } from "./wholeGameStoryCommon.mjs";

const cfg = JSON.parse(process.env.MYS ?? "{}");
const before = process.env.MYS_MODE === "before";
const choiceOpen = `() => !!document.querySelector("[data-testid='dialogue-choice-frame']")`;
const presentOpen = `() => !!document.querySelector("[data-testid='present-item-scene']")`;
const ended = `() => !!document.querySelector(".ending-screen, [data-testid='ending-credits']")`;
const goTo = (spot) => [
  { kind: "pressUntilJs", key: "Enter", fn: fieldReady, maxPresses: 30, settleMs: 700 },
  { kind: "teleport", mapId: spot.mapId, x: spot.at.x, y: spot.at.y },
  { kind: "waitForPosition", mapId: spot.mapId, x: spot.at.x, y: spot.at.y },
  ...(spot.face ? [{ kind: "face", dir: spot.face }] : []),
];
const down = (n) => Array.from({ length: n }, () => ({ kind: "key", key: "ArrowDown" }));
const switches = (ids) => (ids ?? []).map((switchId) => ({ kind: "setSwitch", switchId, value: true }));

const opening = [
  ...openingBeats().slice(0, 1),
  { id: "new-game", note: "새 게임 — 맵이 뜰 때까지 Enter", ops: [{ kind: "pressUntilJs", key: "Enter", fn: `() => Boolean(window.__oprnDebug?.readState?.().currentMapId)`, maxPresses: 20, settleMs: 3000 }] },
  ...toFieldBeats({ firstDialogue: false }),
];
const stageBeat = {
  id: "stage", note: "심문 무대 — 용의자 셋이 서 있어야 한다(고치기 전: 투명 조사 칸뿐)",
  ops: [...goTo({ ...cfg.stage, face: "up" }), { kind: "hold", dir: null, ms: 1800 }], shot: true,
};

const afterBeats = [
  {
    id: "talk-innocent", note: `${cfg.innocent?.name ?? "용의자"} 탐문 — 흉상·이름표, 다른 용의자를 알리바이 증인으로`,
    ops: [...goTo(cfg.innocent ?? cfg.stage), { kind: "action" }, { kind: "waitForVisible", testid: "dialogue-box", minAlpha: 0.99, timeoutMs: 20000 }, { kind: "hold", dir: null, ms: 2500 }, { kind: "key", key: "Enter" }, { kind: "waitForText", testid: "dialogue-box", text: "물어보세요", timeoutMs: 15000 }, { kind: "hold", dir: null, ms: 1200 }],
    shot: true,
  },
  {
    id: "present-open", note: `증거를 가진 뒤 ${cfg.culprit?.name ?? "범인"}에게 「증거를 내민다」 — 증거 제시 창`,
    ops: [...goTo(cfg.culprit ?? cfg.stage), { kind: "giveItem", itemId: cfg.evidence }, ...switches(cfg.culpritSwitches), { kind: "action" },
      { kind: "pressUntilJs", key: "Enter", fn: choiceOpen, maxPresses: 8, settleMs: 900 }, ...down(1), { kind: "key", key: "Enter" },
      { kind: "pressUntilJs", key: "Enter", fn: presentOpen, maxPresses: 3, settleMs: 900 }, { kind: "hold", dir: null, ms: 900 }],
    shot: true,
  },
  {
    id: "present-react", note: "맞는 증거를 내밀자 범인이 흔들린다",
    ops: [{ kind: "click", testid: `present-item-${cfg.evidence}` }, { kind: "waitForVisible", testid: "dialogue-box", minAlpha: 0.99, timeoutMs: 20000 }, { kind: "hold", dir: null, ms: 2500 }, { kind: "key", key: "Enter" }, { kind: "hold", dir: null, ms: 2500 }, { kind: "key", key: "Enter" }, { kind: "waitForText", testid: "dialogue-box", text: "하얗게", timeoutMs: 15000 }, { kind: "hold", dir: null, ms: 2500 }],
    shot: true,
  },
  {
    id: "accuse-choices", note: "지목 칸 조사 — 범인 고르기(이름만, 정답 표시 없음)",
    ops: [...goTo(cfg.accuse), ...switches(cfg.accuseSwitches), { kind: "action" }, { kind: "pressUntilJs", key: "Enter", fn: choiceOpen, maxPresses: 8, settleMs: 900 }, { kind: "hold", dir: null, ms: 900 }],
    shot: true,
  },
  {
    id: "accuse-wrong", note: "틀린 사람을 고르면 엔딩 없이 다시 생각한다",
    ops: [...down(cfg.wrongIndex ?? 0), { kind: "key", key: "Enter" }, { kind: "waitForVisible", testid: "dialogue-box", minAlpha: 0.99, timeoutMs: 20000 }, { kind: "hold", dir: null, ms: 1200 }],
    shot: true,
  },
  {
    id: "accuse-prove", note: "범인을 고르면 증거를 내밀어 증명한다",
    ops: [...goTo(cfg.accuse), { kind: "action" }, { kind: "pressUntilJs", key: "Enter", fn: choiceOpen, maxPresses: 8, settleMs: 900 }, ...down(cfg.rightIndex ?? 0), { kind: "key", key: "Enter" },
      { kind: "pressUntilJs", key: "Enter", fn: presentOpen, maxPresses: 3, settleMs: 900 }, { kind: "hold", dir: null, ms: 900 }],
    shot: true,
  },
  {
    id: "ending", note: "맞는 증거 → 엔딩 화면",
    ops: [{ kind: "click", testid: `present-item-${cfg.evidence}` }, { kind: "pressUntilJs", key: "Enter", fn: ended, maxPresses: 60, settleMs: 900 }, { kind: "hold", dir: null, ms: 2500 }],
    shot: true,
  },
];

const beforeBeats = [
  {
    id: "accuse-before", note: "고치기 전 — 지목 칸(투명)을 조사하면 고르기 없이 바로 결말 대사",
    ops: [...goTo(cfg.accuse), ...switches(cfg.accuseSwitches), { kind: "action" }, { kind: "waitForVisible", testid: "dialogue-box", minAlpha: 0.99, timeoutMs: 20000 }, { kind: "hold", dir: null, ms: 1200 }],
    shot: true,
  },
  { id: "ending", note: "Enter 만으로 엔딩", ops: [{ kind: "pressUntilJs", key: "Enter", fn: ended, maxPresses: 60, settleMs: 900 }, { kind: "hold", dir: null, ms: 2500 }], shot: true },
];

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export default {
  id: "whole-game-mystery",
  viewport: { width: 960, height: 720 },
  beats: [...opening, stageBeat, ...(before ? beforeBeats : afterBeats)],
};
