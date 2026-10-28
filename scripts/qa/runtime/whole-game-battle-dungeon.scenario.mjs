// 실물 게임 전투 QA — 「잊힌 지하묘지」(dungeon, 2026-10-28 standin), 컴파일된 출하 플레이어.
//
//   node scripts/runtime-qa.mjs --scenario whole-game-battle-dungeon --browser firefox --netns \
//     --whole-game ~/z-project/assistant-whole-game/suite/runs/2026-10-28-standin/standin/dungeon/project --out /tmp/bq/dungeon
//
// 지하 1층(시작 맵) foe1(33,11): 33~35 를 오간다 → (32,11)에서 오른쪽으로 민다 → 승리.
// 승리 전투에서 스킬(카일 십자베기 — 직업 기술)·아이템(회복약 3개를 giveItem)·공격. foe2(38,20): 20~22 세로 → (38,19)에서 아래로 → 도주.
// foe3(25,19): 25~27 → (24,19)에서 오른쪽으로, 체력 1 → 패배.
import { fieldFoeBattleBeats, wholeGameOpening } from "./wholeGameBattleCommon.mjs";

const B1 = "map_blank_start";

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export default {
  id: "whole-game-battle-dungeon",
  viewport: { width: 960, height: 720 },
  query: { e2eVitals: "1" },
  beats: [
    ...wholeGameOpening(),
    ...fieldFoeBattleBeats({
      win: { mapId: B1, x: 32, y: 11, push: "right", label: "지하 1층 박쥐(33,11)" },
      lose: { mapId: B1, x: 24, y: 19, push: "right", label: "지하 1층 유령(25,19)" },
      escape: { mapId: B1, x: 38, y: 19, push: "down", label: "지하 1층 해골(38,20)" },
      skill: { actor_hero: "skill_hero_cross_slash" },
      item: "item_potion",
    }),
  ],
};
