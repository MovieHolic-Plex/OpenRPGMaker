// 실물 게임 전투 QA — 「몬스터 수집」(monster, 2026-10-28 standin), 포켓몬 스킨 전투. 컴파일된 출하 플레이어.
//
//   node scripts/runtime-qa.mjs --scenario whole-game-battle-monster --browser firefox --netns \
//     --whole-game ~/z-project/assistant-whole-game/suite/runs/2026-10-28-standin/standin/monster/project --out /tmp/bq/monster
//
// 몬스터 파티 전투라 첫 동료가 있어야 한다 — 연구소 박사(7,5)에게 말을 걸어 첫 선택지(토리프·예)를 고른다.
// 그다음 1번길 트레이너(4,6) 아래 칸에서 위를 보고 말을 건다 → 트레이너 전투.
import { battleBusy, fieldReady, wholeGameOpening } from "./wholeGameBattleCommon.mjs";

const starterReady = `() => window.__oprnDebug?.readState?.().switches?.mx_starter === true && (${fieldReady})()`;

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export default {
  id: "whole-game-battle-monster",
  viewport: { width: 960, height: 720 },
  query: { e2eVitals: "1" },
  beats: [
    ...wholeGameOpening(),
    {
      id: "starter",
      note: "연구소 박사에게서 첫 동료(토리프)를 받는다",
      ops: [
        { kind: "teleport", mapId: "mx_map_lab", x: 7, y: 6 },
        { kind: "waitForPosition", mapId: "mx_map_lab", x: 7, y: 6 },
        { kind: "face", dir: "up" },
        { kind: "action" },
        { kind: "pressUntilJs", key: "Enter", fn: starterReady, maxPresses: 40, settleMs: 600 },
      ],
      shot: true,
    },
    {
      id: "approach",
      note: "1번길 트레이너(4,6) 아래 칸",
      ops: [
        { kind: "teleport", mapId: "mx_map_meadow", x: 4, y: 7 },
        { kind: "waitForPosition", mapId: "mx_map_meadow", x: 4, y: 7 },
        { kind: "pressUntilJs", key: "Enter", fn: fieldReady, maxPresses: 10 },
        { kind: "face", dir: "up" },
      ],
      shot: true,
    },
    {
      id: "battle-enter",
      note: "말을 걸어 대사 → 트레이너 전투(명령 대기)",
      ops: [
        { kind: "action" },
        { kind: "pressUntil", key: "Enter", testid: "battle-scene", state: "present", maxPresses: 12, timeoutMs: 2000 },
        { kind: "waitFor", testid: "actor-command-fight", state: "present", timeoutMs: 40000 },
      ],
      // 포켓몬 스킨은 정면 발판 구도라 측면 접지 띠 기하(battlerGeometry)를 쓰지 않는다.
      expect: { testidPresent: ["battle-scene"] },
      shot: true,
    },
    {
      id: "battle-attack-fx",
      note: "싸운다 → 첫 기술(Enter) → 연출 도중",
      ops: [
        { kind: "click", testid: "actor-command-fight" },
        { kind: "pressUntilJs", key: "Enter", fn: battleBusy, maxPresses: 5, settleMs: 300 },
      ],
      shot: true,
    },
    {
      id: "battle-end",
      note: "결판 — 승리 결과 창 또는 패배",
      ops: [
        { kind: "battle", fallback: "attack", timeoutMs: 240000 },
      ],
      shot: true,
    },
    {
      id: "back-to-field",
      note: "결과를 닫고 필드(또는 게임 오버)",
      ops: [
        { kind: "battle", untilEnd: true, resultHoldMs: 300, timeoutMs: 60000 },
        { kind: "pressUntilJs", key: "Enter", fn: `() => Boolean(document.querySelector("[data-testid='game-over-screen']")) || (${fieldReady})()`, maxPresses: 20 },
      ],
      shot: true,
    },
  ],
};
