// 조사 표식·가구 전체 조사 — 2026-10-29 vm3 terra escape 판정 «하이라이트가 흐려 찾기 어렵다·책상 정면에서는 반응이 없다».
//
//   EXAMINE_AT='{"mapId":"map_blank_start","x":4,"y":4,"face":"up"}' node scripts/runtime-qa.mjs --scenario examine-marker --netns \
//     --project /tmp/od2/t-after/terra-escape.project.json --out /tmp/od2/rq-after
//
// 비트: 첫 필드(가까운 조사 대상·목표 대상 위 꺾쇠 표식) → 가구의 «이벤트가 없는» 칸 앞에서 바라봄 → 조사(가구 전체가 몸이면 대사가 뜬다).
import { fieldReady } from "./wholeGameBattleCommon.mjs";
import { openingBeats, toFieldBeats } from "./wholeGameStoryCommon.mjs";

const at = JSON.parse(process.env.EXAMINE_AT ?? '{"mapId":"map_blank_start","x":0,"y":0,"face":"up"}');

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export default {
  id: "examine-marker",
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
      note: "첫 필드 — 가까운 조사 대상·목표 대상 위 표식",
      ops: [{ kind: "pressUntilJs", key: "Enter", fn: fieldReady, maxPresses: 30, settleMs: 700 }, { kind: "hold", dir: null, ms: 1500 }],
      shot: true,
    },
    {
      id: "face-furniture",
      note: `가구 칸 앞(${at.x},${at.y})에서 ${at.face} — 이벤트 앵커가 아닌 칸`,
      ops: [
        { kind: "teleport", mapId: at.mapId, x: at.x, y: at.y },
        { kind: "waitForPosition", mapId: at.mapId, x: at.x, y: at.y },
        { kind: "face", dir: at.face },
        { kind: "hold", dir: null, ms: 900 },
      ],
      shot: true,
    },
    {
      id: "examine",
      note: "조사 — 가구 전체가 몸이면 대사가 뜬다",
      ops: [{ kind: "action" }, { kind: "hold", dir: null, ms: 1200 }],
      shot: true,
    },
  ],
};
