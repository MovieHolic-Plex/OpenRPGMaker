// 몬스터 수집 게임 전 구간 QA — 「새싹 몬스터 모험」(monster, 2026-10-28 standin). 컴파일된 출하 플레이어.
//
//   node scripts/runtime-qa.mjs --scenario whole-game-monster-campaign --browser firefox --netns \
//     --whole-game ~/z-project/assistant-whole-game/suite/runs/2026-10-28-standin/standin/monster/project --out /tmp/bq/mon/rt-before
//
// 스타터 받기 → 1번길 야생 조우·포획 → 1번길 트레이너 → 새순 마을 도착(목표 줄이 체육관을 가리키나) → 몬스터 센터 위치·회복 →
// 체육관 퍼즐(받침→덩굴 문→가시 덤불→관장) → 관장전 → 관측탑 보스 → 리그 챔피언 → 엔딩. 전투 화면 자체는 whole-game-battle-monster 가
// 이미 본다 — 여기서는 전투를 자동으로 끝내고 결판·목표 줄·위치만 찍는다.
import { fieldReady, wholeGameOpening } from "./wholeGameBattleCommon.mjs";

// 대사창이 없어도 이벤트가 도는 중일 수 있다(관장 배지 수여의 번쩍임·기다림, 센터 회복 연출) — 그 사이 순간이동하면 이벤트가
// 남은 채 다음 비트로 가 대사가 엉뚱한 곳에서 뜬다. 런타임 덤프의 실행·입력 깃발(data-live-flags: 맵|x|y|입력|실행)까지 본다.
const fieldIdle = `() => {
  const flags = document.querySelector("[data-testid='runtime-state-json']")?.dataset.liveFlags?.split("|");
  if (flags && (flags[3] !== "true" || flags[4] === "true")) return false;
  return (${fieldReady})();
}`;

const starterReady = `() => window.__oprnDebug?.readState?.().switches?.mx_starter === true && (${fieldIdle})()`;
const inBattle = `() => Boolean(document.querySelector("[data-testid='battle-scene']"))`;
const fieldOrOver = `() => Boolean(document.querySelector("[data-testid='game-over-screen']")) || (${fieldIdle})()`;
const onMap = (mapId) => `() => window.__oprnDebug?.readState?.().currentMapId === ${JSON.stringify(mapId)} && (${fieldIdle})()`;
const switchOn = (id) => `window.__oprnDebug?.readState?.().switches?.[${JSON.stringify(id)}] === true`;

/** 새순 마을 몬스터 센터 간호사(7,6)에게 회복받는다 — 플레이어가 큰 싸움 앞에 하는 일. */
function healBeat(tag, note) {
  return {
    id: `${tag}-heal`,
    note: `${note} — 새순 마을 몬스터 센터에서 회복`,
    ops: [
      { kind: "teleport", mapId: "mx_map_grove_center", x: 7, y: 7 },
      { kind: "waitForPosition", mapId: "mx_map_grove_center", x: 7, y: 7 },
      // 순간이동 뒤 입력이 열릴 때까지(실행·입력 깃발) — 바로 말을 걸면 Enter 가 먹히지 않은 판이 있었다.
      { kind: "pressUntilJs", key: "Shift", fn: fieldIdle, maxPresses: 30, settleMs: 500 },
      { kind: "face", dir: "up" },
      // action 은 대사가 뜨기 전에 돌아온다 — 바로 fieldReady 를 보면 회복 전에 통과해 다음 비트에 간호사 대사가 남는다.
      // 순간이동 직후의 action 은 먹히지 않기도 해서(10초 동안 대사 없음) 대사가 뜰 때까지 Enter 로 말을 건다.
      { kind: "pressUntilJs", key: "Enter", fn: `() => Boolean(document.querySelector("[data-testid='dialogue-box']"))`, maxPresses: 8, settleMs: 800 },
      { kind: "pressUntilJs", key: "Enter", fn: `() => /안녕히 가세요/.test(document.body.innerText)`, maxPresses: 30, settleMs: 700 },
      { kind: "pressUntilJs", key: "Enter", fn: fieldIdle, maxPresses: 5, settleMs: 700 },
    ],
    shot: true,
  };
}

/**
 * 도감 정원 키큰풀(12~13, 3~6·12~16 — 런타임 terrainIdAt 으로 확인한 terrain_grass, 야생 Lv7~9)에서 레벨을 올린다.
 * 1번길 야생은 Lv2~4 라 Lv8 스타터가 세 판을 싸워도 레벨이 그대로였다 — 관측탑 보스(Lv7 비행) 앞에 플레이어가 하는 일.
 */
function grindBeat(n) {
  return {
    id: `grind-${n}`,
    note: `도감 정원 풀숲 야생전 ${n} — 이겨서 경험치(지면 센터에서 깸)`,
    ops: [
      { kind: "teleport", mapId: "mx_map_garden", x: 12, y: 13 },
      { kind: "waitForPosition", mapId: "mx_map_garden", x: 12, y: 13 },
      { kind: "pressUntilJs", key: "Enter", fn: fieldIdle, maxPresses: 10 },
      { kind: "pressUntilJs", keys: ["ArrowUp", "ArrowDown"], fn: inBattle, maxPresses: 240, settleMs: 320 },
      { kind: "battle", fallback: "attack", untilEnd: true, resultHoldMs: 300, timeoutMs: 240000 },
      { kind: "pressUntilJs", key: "Enter", fn: fieldOrOver, maxPresses: 40, settleMs: 500 },
    ],
    shot: true,
  };
}

/** 말을 걸고 전투에 들어가 끝까지 싸운 뒤 필드(또는 게임 오버)로. */
function fightBeats(tag, note, mapId, x, y, dir) {
  return [
    {
      id: `${tag}-enter`,
      note: `${note} — 말을 걸어 전투로`,
      ops: [
        { kind: "teleport", mapId, x, y },
        { kind: "waitForPosition", mapId, x, y },
        { kind: "pressUntilJs", key: "Enter", fn: fieldIdle, maxPresses: 10 },
        { kind: "face", dir },
        { kind: "action" },
        { kind: "pressUntilJs", key: "Enter", fn: inBattle, maxPresses: 30, settleMs: 500 },
        { kind: "waitFor", testid: "actor-command-fight", state: "present", timeoutMs: 40000 },
      ],
      shot: true,
    },
    {
      id: `${tag}-end`,
      note: `${note} — 결판(승리 결과 창 또는 패배)`,
      ops: [{ kind: "battle", fallback: "attack", timeoutMs: 300000 }],
      shot: true,
    },
    {
      id: `${tag}-back`,
      note: `${note} — 결과를 닫고 필드(또는 게임 오버·센터에서 깸)`,
      ops: [
        { kind: "battle", untilEnd: true, resultHoldMs: 300, timeoutMs: 90000 },
        { kind: "pressUntilJs", key: "Enter", fn: fieldOrOver, maxPresses: 40, settleMs: 500 },
      ],
      shot: true,
    },
  ];
}

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export default {
  id: "whole-game-monster-campaign",
  viewport: { width: 960, height: 720 },
  query: {},
  beats: [
    ...wholeGameOpening(),
    {
      id: "starter",
      note: "연구소 박사에게서 첫 동료(첫 선택지)를 받는다 — 받은 뒤 목표 줄",
      ops: [
        { kind: "teleport", mapId: "mx_map_lab", x: 7, y: 6 },
        { kind: "waitForPosition", mapId: "mx_map_lab", x: 7, y: 6 },
        { kind: "face", dir: "up" },
        { kind: "action" },
        { kind: "pressUntilJs", key: "Enter", fn: starterReady, maxPresses: 60, settleMs: 600 },
      ],
      shot: true,
    },
    {
      id: "home-center",
      note: "새싹마을 몬스터 센터 앞(21,7) — 센터가 보이나",
      ops: [
        { kind: "teleport", mapId: "mx_map_home", x: 21, y: 8 },
        { kind: "waitForPosition", mapId: "mx_map_home", x: 21, y: 8 },
        { kind: "pressUntilJs", key: "Enter", fn: fieldIdle, maxPresses: 10 },
      ],
      shot: true,
    },
    {
      id: "wild-encounter",
      note: "1번길 키큰풀에서 야생 조우",
      ops: [
        { kind: "teleport", mapId: "mx_map_meadow", x: 10, y: 11 },
        { kind: "waitForPosition", mapId: "mx_map_meadow", x: 10, y: 11 },
        { kind: "pressUntilJs", key: "Enter", fn: fieldIdle, maxPresses: 10 },
        { kind: "pressUntilJs", keys: ["ArrowRight", "ArrowRight", "ArrowRight", "ArrowLeft", "ArrowLeft", "ArrowLeft"], fn: inBattle, maxPresses: 240, settleMs: 320 },
        { kind: "waitFor", testid: "actor-command-fight", state: "present", timeoutMs: 40000 },
      ],
      shot: true,
    },
    {
      id: "capture",
      note: "포획 구슬을 잡힐 때까지 던진다 → 결판",
      ops: [{ kind: "battle", fallback: "capture:item_capture_orb", timeoutMs: 300000 }],
      shot: true,
    },
    {
      id: "capture-back",
      note: "포획 문장을 넘겨 필드로",
      ops: [
        { kind: "battle", untilEnd: true, resultHoldMs: 300, timeoutMs: 90000 },
        { kind: "waitFor", testid: "battle-scene", state: "absent", timeoutMs: 30000 },
        { kind: "pressUntilJs", key: "Enter", fn: fieldIdle, maxPresses: 30 },
      ],
      shot: true,
    },
    ...fightBeats("trainer", "1번길 트레이너(4,6)", "mx_map_meadow", 4, 7, "up"),
    {
      id: "grove-arrive",
      note: "1번길 북쪽 출구(12,2)로 걸어 새순 마을에 들어선다 — 목표 줄이 체육관을 가리키나",
      ops: [
        { kind: "teleport", mapId: "mx_map_meadow", x: 12, y: 3 },
        { kind: "waitForPosition", mapId: "mx_map_meadow", x: 12, y: 3 },
        { kind: "pressUntilJs", key: "Enter", fn: fieldIdle, maxPresses: 10 },
        { kind: "pressUntilJs", key: "ArrowUp", fn: onMap("mx_map_grove"), maxPresses: 6, settleMs: 900 },
        { kind: "pressUntilJs", key: "Enter", fn: fieldIdle, maxPresses: 20, settleMs: 500 },
      ],
      shot: true,
    },
    {
      id: "grove-center",
      note: "새순 마을 몬스터 센터 입구(4,7) 앞",
      ops: [
        { kind: "teleport", mapId: "mx_map_grove", x: 4, y: 8 },
        { kind: "waitForPosition", mapId: "mx_map_grove", x: 4, y: 8 },
        { kind: "pressUntilJs", key: "Enter", fn: fieldIdle, maxPresses: 10 },
      ],
      shot: true,
    },
    healBeat("gym", "체육관 앞"),
    {
      id: "gym-enter",
      note: "체육관 입구(16,9)로 걸어 들어간다",
      ops: [
        { kind: "teleport", mapId: "mx_map_grove", x: 16, y: 10 },
        { kind: "waitForPosition", mapId: "mx_map_grove", x: 16, y: 10 },
        { kind: "pressUntilJs", key: "ArrowUp", fn: onMap("mx_map_grove_gym"), maxPresses: 6, settleMs: 900 },
        { kind: "pressUntilJs", key: "Enter", fn: fieldIdle, maxPresses: 20, settleMs: 500 },
      ],
      shot: true,
    },
    {
      id: "gym-pivot",
      note: "새싹 돌 받침(8,17)에 손을 얹는다 → 덩굴 문이 열린다 — 관원 세 명은 이긴 것으로 둔다(시야 전투가 퍼즐 칸마다 끼어든다; 트레이너 전투 화면은 1번길에서 봤다)",
      ops: [
        { kind: "setSwitch", switchId: "mx_map_grove_gym_grunt_0_won" },
        { kind: "setSwitch", switchId: "mx_map_grove_gym_grunt_1_won" },
        { kind: "setSwitch", switchId: "mx_map_grove_gym_grunt_2_won" },
        { kind: "teleport", mapId: "mx_map_grove_gym", x: 8, y: 18 },
        { kind: "waitForPosition", mapId: "mx_map_grove_gym", x: 8, y: 18 },
        { kind: "pressUntilJs", key: "Enter", fn: fieldIdle, maxPresses: 10 },
        { kind: "face", dir: "up" },
        { kind: "action" },
        { kind: "pressUntilJs", key: "Enter", fn: `() => ${switchOn("mx_gym_1_puzzle_pivot")} && (${fieldIdle})()`, maxPresses: 20, settleMs: 600 },
      ],
      shot: true,
    },
    {
      id: "gym-vine",
      note: "열린 덩굴 문(8,14) — 안쪽(북쪽)으로",
      ops: [
        { kind: "teleport", mapId: "mx_map_grove_gym", x: 8, y: 15 },
        { kind: "waitForPosition", mapId: "mx_map_grove_gym", x: 8, y: 15 },
        { kind: "face", dir: "up" },
        { kind: "action" },
        { kind: "pressUntilJs", key: "Enter", fn: `() => window.__oprnDebug?.readState?.().y === 13 && (${fieldIdle})()`, maxPresses: 12, settleMs: 600 },
      ],
      shot: true,
    },
    {
      id: "gym-cut",
      note: "가시 덤불(12,6)을 정리하고 다시 조사해 관장 쪽으로",
      ops: [
        { kind: "teleport", mapId: "mx_map_grove_gym", x: 12, y: 7 },
        { kind: "waitForPosition", mapId: "mx_map_grove_gym", x: 12, y: 7 },
        { kind: "face", dir: "up" },
        { kind: "action" },
        { kind: "pressUntilJs", key: "Enter", fn: `() => ${switchOn("mx_gym_1_puzzle_cut")} && (${fieldIdle})()`, maxPresses: 20, settleMs: 600 },
        { kind: "face", dir: "up" },
        { kind: "action" },
        { kind: "pressUntilJs", key: "Enter", fn: `() => window.__oprnDebug?.readState?.().y === 5 && (${fieldIdle})()`, maxPresses: 12, settleMs: 600 },
      ],
      shot: true,
    },
    healBeat("leader", "관장전 앞"),
    ...fightBeats("leader", "체육관 관장 유림(14,3)", "mx_map_grove_gym", 14, 4, "up"),
    {
      id: "badge",
      note: "배지 뒤 목표 줄",
      ops: [{ kind: "pressUntilJs", key: "Enter", fn: `() => ${switchOn("mx_badge_1")} && (${fieldIdle})()`, maxPresses: 30, settleMs: 500 }],
      shot: true,
    },
    grindBeat(1), grindBeat(2), grindBeat(3), grindBeat(4), grindBeat(5),
    healBeat("boss", "관측탑 앞"),
    ...fightBeats("boss", "관측탑 밤막회사 대표(11,4)", "mx_map_observatory", 11, 5, "up"),
    healBeat("champion", "리그 앞"),
    ...fightBeats("champion", "리그 챔피언 나루(7,4)", "mx_map_league_0", 7, 5, "up"),
    {
      id: "ending",
      note: "챔피언 뒤 엔딩",
      ops: [
        { kind: "pressUntilJs", key: "Enter", fn: `() => Boolean(document.querySelector("[data-testid='ending-screen']"))`, maxPresses: 60, settleMs: 700 },
      ],
      shot: true,
    },
  ],
};
