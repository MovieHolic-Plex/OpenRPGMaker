// 이야기 NPC 표식·말 걸기·다 본 대상 표식 숨김 — 2026-10-29 vm3 flash 추리 판정
// «NPC 가 얼굴 방향과 칸이 정확해야만 대화가 열린다 · 갈색 머리 손님은 위에서만 말이 걸렸다 · 누가 조사 대상인지 표시 없음».
//
//   NPC_QA='{"mapId":"map_…","look":{"x":6,"y":7},"talk":{"x":5,"y":7,"face":"down"},"spentSwitch":"sw_…"}' \
//     node scripts/runtime-qa.mjs --scenario npc-talk --netns --browser firefox --project <project.json> --out <dir>
//
// 비트: 첫 필드 → 방 안(look)에서 둘레 NPC 표식 → talk 칸에서 바라보고 조사 → spentSwitch 를 켜 «다 본» 페이지로 넘긴 뒤 같은 자리.
import { fieldReady } from "./wholeGameBattleCommon.mjs";
import { openingBeats, toFieldBeats } from "./wholeGameStoryCommon.mjs";

const qa = JSON.parse(process.env.NPC_QA ?? '{"mapId":"map_blank_start","look":{"x":0,"y":0},"talk":{"x":0,"y":0,"face":"up"}}');

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export default {
  id: "npc-talk",
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
      id: "field",
      note: "첫 필드",
      ops: [{ kind: "pressUntilJs", key: "Enter", fn: fieldReady, maxPresses: 30, settleMs: 700 }],
    },
    {
      id: "room",
      note: `방 안 (${qa.look.x},${qa.look.y}) — 둘레 이야기 NPC 위 표식`,
      ops: [
        { kind: "teleport", mapId: qa.mapId, x: qa.look.x, y: qa.look.y },
        { kind: "waitForPosition", mapId: qa.mapId, x: qa.look.x, y: qa.look.y },
        { kind: "hold", dir: null, ms: 1500 },
      ],
      shot: true,
    },
    {
      id: "talk",
      note: `(${qa.talk.x},${qa.talk.y}) 에서 ${qa.talk.face} 보고 조사`,
      ops: [
        { kind: "teleport", mapId: qa.mapId, x: qa.talk.x, y: qa.talk.y },
        { kind: "waitForPosition", mapId: qa.mapId, x: qa.talk.x, y: qa.talk.y },
        { kind: "face", dir: qa.talk.face },
        { kind: "hold", dir: null, ms: 600 },
        { kind: "action" },
        { kind: "hold", dir: null, ms: 1200 },
      ],
      shot: true,
    },
    ...(qa.spentSwitch
      ? [{
          id: "spent",
          note: `${qa.spentSwitch} 켬 — 다 본 대상 위 표식이 사라진다`,
          ops: [
            { kind: "pressUntilJs", key: "Enter", fn: fieldReady, maxPresses: 30, settleMs: 500 },
            { kind: "setSwitch", switchId: qa.spentSwitch, value: true },
            { kind: "teleport", mapId: qa.mapId, x: qa.look.x, y: qa.look.y },
            { kind: "waitForPosition", mapId: qa.mapId, x: qa.look.x, y: qa.look.y },
            { kind: "hold", dir: null, ms: 1500 },
          ],
          shot: true,
        }]
      : []),
  ],
};
