// 실물 게임 — 「현재 목표」의 다음 대상이 보이나(목표 표시)·조사 안내에 대상 이름이 붙나(「Z 조사 · 책상의 메모」).
//
//   OBJ_APPROACH='{"x":3,"y":4,"face":"up"}' node scripts/runtime-qa.mjs --scenario whole-game-objective-target --browser firefox --netns \
//     --whole-game ~/z-project/assistant-whole-game/suite/runs/vm1-1029/deepseek/escape/project --out /tmp/bq/obj-deepseek-escape
//
// OBJ_APPROACH = 시작 목표 대상 이벤트 곁 칸(시작 맵)과 바라볼 쪽. 2026-10-29 VM 측정 판 5개 판정자가 모두 「조사 위치가 눈에 안 띈다」고 했다.
// 비트: 첫 필드(목표 대상에 은은한 표시) → 대상 곁에서 바라봄(안내 「Z 조사 · 이름」) → 조사해 다음 목표로 → 다음 대상 표시.
import { fieldReady } from "./wholeGameBattleCommon.mjs";
import { openingBeats, toFieldBeats } from "./wholeGameStoryCommon.mjs";

const approach = JSON.parse(process.env.OBJ_APPROACH ?? '{"x":0,"y":0,"face":"up"}');

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export default {
  id: "whole-game-objective-target",
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
      id: "field-objective",
      note: "첫 필드 — 목표 줄이 가리키는 대상 칸에 은은한 표시(거리와 무관)",
      ops: [{ kind: "pressUntilJs", key: "Enter", fn: fieldReady, maxPresses: 30, settleMs: 700 }, { kind: "hold", dir: null, ms: 2500 }],
      shot: true,
    },
    {
      id: "face-target",
      note: `대상 곁 칸(${approach.x},${approach.y})에서 ${approach.face} 를 바라봄 — 안내에 대상 이름`,
      ops: [
        { kind: "teleport", mapId: "map_blank_start", x: approach.x, y: approach.y },
        { kind: "waitForPosition", mapId: "map_blank_start", x: approach.x, y: approach.y },
        { kind: "face", dir: approach.face },
        { kind: "hold", dir: null, ms: 900 },
      ],
      shot: true,
    },
    {
      id: "next-objective",
      note: "조사해 대사를 넘기고 다음 목표 — 새 대상 칸에 표시",
      ops: [
        { kind: "action" },
        { kind: "pressUntilJs", key: "Enter", fn: fieldReady, maxPresses: 40, settleMs: 800 },
        { kind: "hold", dir: null, ms: 2500 },
      ],
      shot: true,
    },
  ],
};
