// 실물 게임 전투 QA — 「마왕의 동굴」(jrpg, 2026-10-28 standin) 을 컴파일된 출하 플레이어로 띄워 전투에 들어간다.
//
//   node scripts/runtime-qa.mjs --scenario whole-game-battle-jrpg --browser firefox --netns \
//     --whole-game ~/z-project/assistant-whole-game/suite/runs/2026-10-28-standin/standin/jrpg/project --out /tmp/bq/jrpg
//
// 편집기 경로를 쓰지 않는다: --whole-game 이 project.sqlite 를 제품 prepareWebExport 로 투영해 dist/export-player 로 띄운다.
// 전투 진입은 실제 필드 적 이벤트(접촉 발동)를 몸으로 밀어서 연다 — 순간이동은 그 옆 칸까지만이다.
//   지하 1층 foe1(22,17): 22~24 를 오가는 박쥐 → (21,17)에서 오른쪽으로 민다 → 승리까지.
//   지하 1층 guardian(14,9): 서 있는 중간 보스 → (14,10)에서 위로, 체력 1 로 → 패배(게임 오버).
import { fieldFoeBattleBeats, wholeGameOpening } from "./wholeGameBattleCommon.mjs";

const CAVE = "map_130e7973-e81d-408d-91b7-448f001188c3";

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export default {
  id: "whole-game-battle-jrpg",
  viewport: { width: 960, height: 720 },
  // setVitals(패배 비트의 체력 1)는 e2eVitals 훅이 있어야 한다.
  query: { e2eVitals: "1" },
  beats: [
    ...wholeGameOpening(),
    ...fieldFoeBattleBeats({
      win: { mapId: CAVE, x: 21, y: 17, push: "right", label: "동굴 지하 1층 박쥐(22,17)" },
      lose: { mapId: CAVE, x: 14, y: 10, push: "up", label: "동굴 지하 1층 수문장(14,9, 중간 보스)" },
    }),
  ],
};
