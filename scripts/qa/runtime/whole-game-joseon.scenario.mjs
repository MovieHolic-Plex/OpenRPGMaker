// 실물 게임 이야기 런타임 QA — 「한양 저잣거리」(joseon, 2026-10-28 standin), 컴파일된 출하 플레이어.
//
//   node scripts/runtime-qa.mjs --scenario whole-game-joseon --browser firefox --netns \
//     --whole-game ~/z-project/assistant-whole-game/suite/runs/2026-10-28-standin/standin/joseon/project --out /tmp/bq/joseon
//
// 이 판은 빌더가 거의 비어 있다: 오프닝은 편집기 기본(「강을 낀 왕국」), 대화 이벤트·엔딩 0, 맵 셋에 이동 이벤트만 하나씩.
// 주막은 저잣거리에서 들어가는 문이 없다(주막 → 저잣거리 출구만) — 순간이동으로 들어가 출구를 본다.
// 타이틀 → 오프닝 두 장면 → 필드 → 포도청 출입(33,27 ↔ 6,20) → 주막 실내 → 주막 출구(14,16).
import { openingBeats, toFieldBeats, transferBeat } from "./wholeGameStoryCommon.mjs";
import { fieldReady } from "./wholeGameBattleCommon.mjs";

const STREET = "map_blank_start";
const JAIL = "map_0c683858-5176-4804-a6c0-82236c065052";
const INN = "map_9630c0a2-69e5-4894-92f9-37b199845295";

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export default {
  id: "whole-game-joseon",
  viewport: { width: 960, height: 720 },
  beats: [
    ...openingBeats(),
    ...toFieldBeats({ firstDialogue: false }),
    transferBeat({ id: "jail-enter", note: "저잣거리 포도청 문(33,27)으로 들어간다", mapId: STREET, from: { x: 33, y: 28 }, push: "up", to: JAIL }),
    transferBeat({ id: "jail-exit", note: "포도청 출구(6,20)로 나온다", mapId: JAIL, from: { x: 6, y: 19 }, push: "down", to: STREET }),
    {
      id: "inn-inside",
      note: "주막 실내(들어가는 문이 없어 순간이동)",
      ops: [
        { kind: "pressUntilJs", key: "Enter", fn: fieldReady, maxPresses: 30, settleMs: 700 },
        { kind: "teleport", mapId: INN, x: 14, y: 14 },
        { kind: "waitForMap", mapId: INN },
        { kind: "pressUntilJs", key: "Enter", fn: fieldReady, maxPresses: 20, settleMs: 700 },
        { kind: "hold", dir: null, ms: 1500 },
      ],
      shot: true,
    },
    transferBeat({ id: "inn-exit", note: "주막 출구(14,16)로 저잣거리에 나온다", mapId: INN, from: { x: 14, y: 15 }, push: "down", to: STREET }),
  ],
};
