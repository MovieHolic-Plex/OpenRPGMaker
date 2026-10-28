// 실물 게임 이야기 런타임 QA — 「사라진 별의 교수」(magic, 2026-10-28 standin), 컴파일된 출하 플레이어.
//
//   node scripts/runtime-qa.mjs --scenario whole-game-magic --browser firefox --netns \
//     --whole-game ~/z-project/assistant-whole-game/suite/runs/2026-10-28-standin/standin/magic/project --out /tmp/bq/magic
//
// 타이틀 → 오프닝 두 장면 → 입학 홀 컷신 첫 대사 → 필드 → 교장·사서 대화(흉상·이름표) → 기숙사 출입(계단 37,3 ↔ 5,12) →
// 천문탑 계단(14,20, sw_0003 — 석상 수수께끼 끝을 켠다) → 엘라 교수(16,9) 대화 → 엔딩.
import { fieldReady } from "./wholeGameBattleCommon.mjs";
import { openingBeats, talkBeat, toFieldBeats, transferBeat } from "./wholeGameStoryCommon.mjs";

const HALL = "map_blank_start";
const DORM = "map_13e263c3-8b6f-45ff-8ef9-ade14c49a60e";
const TOWER = "map_661f487b-7597-4289-a94f-87ad2ce41c98";

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export default {
  id: "whole-game-magic",
  viewport: { width: 960, height: 720 },
  beats: [
    ...openingBeats(),
    ...toFieldBeats(),
    talkBeat({ id: "talk-principal", note: "교장(11,23) 아래 칸에서 위를 보고 말 걸기", mapId: HALL, at: { x: 11, y: 24 }, face: "up" }),
    talkBeat({ id: "talk-librarian", note: "사서(33,31) 아래 칸에서 위를 보고 말 걸기(sw_0001 뒤 둘째 페이지)", mapId: HALL, at: { x: 33, y: 32 }, face: "up" }),
    transferBeat({ id: "dorm-enter", note: "입학 홀 북쪽 계단(37,3)으로 기숙사에 들어간다", mapId: HALL, from: { x: 37, y: 4 }, push: "up", to: DORM }),
    transferBeat({ id: "dorm-exit", note: "기숙사 출구(5,12)로 홀에 돌아온다", mapId: DORM, from: { x: 5, y: 11 }, push: "down", to: HALL }),
    {
      id: "tower-enter",
      note: "석상 수수께끼 끝(sw_0003)을 켜고 천문탑 계단(14,20)으로 오른다",
      ops: [
        { kind: "pressUntilJs", key: "Enter", fn: fieldReady, maxPresses: 30, settleMs: 700 },
        { kind: "setSwitch", switchId: "sw_0003" },
        { kind: "teleport", mapId: HALL, x: 14, y: 21 },
        { kind: "waitForPosition", mapId: HALL, x: 14, y: 21 },
        { kind: "pressUntilJs", key: "ArrowUp", fn: `() => window.__oprnDebug.readState().currentMapId === ${JSON.stringify(TOWER)}`, maxPresses: 12, settleMs: 500 },
        { kind: "pressUntilJs", key: "Enter", fn: fieldReady, maxPresses: 20, settleMs: 700 },
        { kind: "hold", dir: null, ms: 1500 },
      ],
      shot: true,
    },
    talkBeat({ id: "talk-professor", note: "엘라 교수(16,9) 아래 칸에서 말 걸기", mapId: TOWER, at: { x: 16, y: 10 }, face: "up" }),
    {
      id: "ending",
      note: "대사·선택지를 Enter 로 넘겨 엔딩 화면까지",
      ops: [
        { kind: "pressUntilJs", key: "Enter", fn: `() => !!document.querySelector(".ending-screen, [data-testid='ending-credits']")`, maxPresses: 80, settleMs: 900 },
        { kind: "hold", dir: null, ms: 2500 },
      ],
      shot: true,
    },
  ],
};
