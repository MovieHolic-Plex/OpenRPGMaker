// 목표 길 안내 — 2026-10-29 vm4 jrpg 판정 «마을→동굴 길 안내 없음 · 목표에 방향·거리 없음 · 동굴 안 계단 구분 안 됨».
//
//   WAYFIND='{"mapId":"map_…","talk":{"x":7,"y":14,"face":"down"},"stops":[{"mapId":"map_…","x":6,"y":25}]}' \
//     node scripts/runtime-qa.mjs --scenario wayfind --netns --browser firefox --project <project.json> --out <dir>
//
// switches: 조사 전에 켤 스위치 id 목록(앞 단계를 건너뛴다).
// 비트: 첫 필드 → talk 칸에서 바라보고 조사 → 대화를 닫은 필드(목표 줄·출구 라벨) → stops 마다 그 칸에 서서 한 장.
import { fieldReady } from "./wholeGameBattleCommon.mjs";
import { openingBeats, toFieldBeats } from "./wholeGameStoryCommon.mjs";

const qa = JSON.parse(process.env.WAYFIND ?? '{"mapId":"map_blank_start","talk":{"x":0,"y":0,"face":"up"},"stops":[]}');

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export default {
  id: "wayfind",
  viewport: { width: 960, height: 720 },
  beats: [
    ...openingBeats().slice(0, 1),
    {
      id: "new-game",
      note: "새 게임 — 맵이 뜰 때까지 Enter",
      ops: [{ kind: "pressUntilJs", key: "Enter", fn: `() => Boolean(window.__oprnDebug?.readState?.().currentMapId)`, maxPresses: 20, settleMs: 3000 }],
    },
    ...toFieldBeats({ firstDialogue: false }),
    { id: "field", note: "첫 필드", ops: [{ kind: "pressUntilJs", key: "Enter", fn: fieldReady, maxPresses: 30, settleMs: 700 }] },
    {
      id: "talk",
      note: `(${qa.talk.x},${qa.talk.y}) 에서 ${qa.talk.face} 보고 조사 → 대화를 닫은 필드`,
      ops: [
        ...(qa.switches ?? []).map((switchId) => ({ kind: "setSwitch", switchId, value: true })),
        { kind: "teleport", mapId: qa.mapId, x: qa.talk.x, y: qa.talk.y },
        { kind: "waitForPosition", mapId: qa.mapId, x: qa.talk.x, y: qa.talk.y },
        { kind: "face", dir: qa.talk.face },
        { kind: "hold", dir: null, ms: 600 },
        { kind: "action" },
        { kind: "hold", dir: null, ms: 900 },
        { kind: "pressUntilJs", key: "Enter", fn: fieldReady, maxPresses: 30, settleMs: 600 },
        { kind: "hold", dir: null, ms: 1500 },
      ],
      shot: true,
    },
    ...(qa.stops ?? []).map((stop, index) => ({
      id: `stop-${index + 1}`,
      note: `${stop.mapId} (${stop.x},${stop.y})`,
      ops: [
        { kind: "teleport", mapId: stop.mapId, x: stop.x, y: stop.y },
        { kind: "waitForPosition", mapId: stop.mapId, x: stop.x, y: stop.y },
        ...(stop.face ? [{ kind: "face", dir: stop.face }] : []),
        { kind: "hold", dir: null, ms: 1500 },
      ],
      shot: true,
    })),
  ],
};
