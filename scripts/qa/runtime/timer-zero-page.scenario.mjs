// 타이머 조건 페이지 — 타이머가 0이 되는 순간 자동 페이지가 도는가(2026-10-31 script-ab sab-1031 A dungeon-2 「철창 닫힘」이 20초 늦게 돌았다).
//
//   node scripts/runtime-qa.mjs --scenario timer-zero-page --browser firefox --netns \
//     --whole-game <sab-1031/A/dungeon-2/project> --out verify-shots/timer-zero-page
//
// 판 값(레버·타이머 이벤트 좌표·스위치)은 그 판 저장본이다. 다른 판이면 TIMER_ZERO='{"lever":[x,y],...}' 로 덮는다.
//   1) 앞 단계 스위치를 켜고 레버를 당긴다 → 타이머 10초 시작, sw_0002 켜짐.
//   2) 철창 아래(남쪽)에 가만히 선다 — 아무 키도 누르지 않는다.
//   3) 14초 안에 「닫힘」 자동 페이지(타이머 0 조건)가 돌아 sw_0002 가 꺼지고 「다시 내려와」 대사가 떠야 한다.
//   4) 레버를 다시 당겨 두 번째 만료에도 같은 페이지가 다시 돈다.
import { fieldReady } from "./wholeGameBattleCommon.mjs";
import { openingBeats, toFieldBeats } from "./wholeGameStoryCommon.mjs";

const D = {
  start: "map_blank_start",
  lever: [10, 15, "up"],
  priorSwitch: "sw_bp_s2_done",
  armedSwitch: "sw_0002",
  closedText: "다시 내려와",
  ...JSON.parse(process.env.TIMER_ZERO ?? "{}"),
};
const toField = { kind: "pressUntilJs", key: "Enter", fn: fieldReady, maxPresses: 40, settleMs: 700 };

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export default {
  id: "timer-zero-page",
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
      id: "pull-lever",
      note: "앞 단계 스위치 켜고 레버 — 타이머 10초",
      ops: [
        toField,
        { kind: "setSwitch", switchId: D.priorSwitch, value: true },
        { kind: "teleport", mapId: D.start, x: D.lever[0], y: D.lever[1] },
        { kind: "waitForPosition", mapId: D.start, x: D.lever[0], y: D.lever[1] },
        { kind: "face", dir: D.lever[2] },
        { kind: "action" },
        { kind: "waitForVisible", testid: "dialogue-box", minAlpha: 0.99, timeoutMs: 20000 },
        toField,
        { kind: "pressUntilJs", key: "Shift", fn: `() => window.__oprnDebug?.readState?.().switches?.[${JSON.stringify(D.armedSwitch)}] === true`, maxPresses: 2, settleMs: 200 },
      ],
      shot: true,
    },
    {
      id: "timer-zero-closes",
      note: "가만히 기다림 — 타이머 0 에서 닫힘 페이지가 14초 안에 돌아야 한다",
      ops: [{ kind: "waitForText", testid: "dialogue-box", text: D.closedText, timeoutMs: 14000 }],
      shot: true,
    },
    {
      id: "pull-again",
      note: "닫힌 뒤 레버를 다시 당김 — 타이머 다시 10초",
      ops: [
        toField,
        { kind: "face", dir: D.lever[2] },
        { kind: "action" },
        { kind: "waitForVisible", testid: "dialogue-box", minAlpha: 0.99, timeoutMs: 20000 },
        toField,
        { kind: "pressUntilJs", key: "Shift", fn: `() => window.__oprnDebug?.readState?.().switches?.[${JSON.stringify(D.armedSwitch)}] === true`, maxPresses: 2, settleMs: 200 },
      ],
    },
    {
      id: "timer-zero-closes-again",
      note: "두 번째 만료에도 닫힘 페이지가 다시 돈다(타이머 자동 페이지 재무장)",
      ops: [{ kind: "waitForText", testid: "dialogue-box", text: D.closedText, timeoutMs: 14000 }],
      shot: true,
    },
  ],
};
