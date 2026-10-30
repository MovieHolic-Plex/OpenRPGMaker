// 몬스터 수집 게임 전 구간 QA — 「새싹 몬스터 모험」(monster, 2026-10-28 standin). 컴파일된 출하 플레이어.
//
//   node scripts/runtime-qa.mjs --scenario whole-game-monster-campaign --browser firefox --netns \
//     --whole-game ~/z-project/assistant-whole-game/suite/runs/2026-10-28-standin/standin/monster/project --out /tmp/bq/mon/rt-before
//   MONSTER_QA_STARTER=1 을 앞에 붙이면 두 번째 스타터(불꽃)를 고른다(기본 0 = 첫 선택지, 풀, 2 = 물).
//   전투는 「가장 좋은 기술」(skill:best — 기술 단추의 기대 피해가 가장 큰 것)로 싸운다. 첫 기술만 누르면 실제 플레이어보다 약했다.
//
// 스타터 받기 → 1번길 야생 조우·포획 → 1번길 트레이너 셋 → 새순 마을 도착(목표 줄이 체육관을 가리키나) → 몬스터 센터 위치·회복 →
// 체육관 관원 셋 → 체육관 퍼즐(받침→덩굴 문→가시 덤불→관장) → 관장전 → 관측탑 보스 → 리그 챔피언 → 엔딩. 전투 화면 자체는 whole-game-battle-monster 가
// 이미 본다 — 여기서는 전투를 자동으로 끝내고 결판·목표 줄·위치만 찍는다.
import { fieldReady, wholeGameOpening } from "./wholeGameBattleCommon.mjs";

// 대사창이 없어도 이벤트가 도는 중일 수 있다(관장 배지 수여의 번쩍임·기다림, 센터 회복 연출) — 그 사이 순간이동하면 이벤트가
// 남은 채 다음 비트로 가 대사가 엉뚱한 곳에서 뜬다. 런타임 덤프의 실행·입력 깃발(data-live-flags: 맵|x|y|입력|실행)까지 본다.
const fieldIdle = `() => {
  const flags = document.querySelector("[data-testid='runtime-state-json']")?.dataset.liveFlags?.split("|");
  if (flags && (flags[3] !== "true" || flags[4] === "true")) return false;
  return (${fieldReady})();
}`;

// 패배 뒤(게임 오버 화면 → 센터에서 깸) 다음 비트가 바로 순간이동하면 깨어나는 이동이 그 뒤에 끼어든다(grind-2·boss-heal 이 센터에서 멈춘 판).
// 순간이동 전에 게임 오버 화면이 닫히고 필드가 조용해질 때까지 넘긴다.
const settled = `() => !document.querySelector("[data-testid='game-over-screen']") && (${fieldIdle})()`;
const settle = { kind: "pressUntilJs", key: "Enter", fn: settled, maxPresses: 40, settleMs: 700 };

// 박사의 첫 동료 선택지에서 몇 번째를 고를지(0 = 첫 선택지). MONSTER_QA_STARTER=1 이면 두 번째(불꽃).
const STARTER = Number(process.env.MONSTER_QA_STARTER ?? 0);
const starterChoice = `() => /첫 동료를 선택/.test(document.querySelector("[data-testid='dialogue-choice-frame']")?.closest("[data-testid='dialogue-box']")?.innerText ?? document.body.innerText) && Boolean(document.querySelector("[data-testid='dialogue-choice-frame']"))`;

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
      settle,
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

const HP_OUT = process.env.QA_MON_OUT ?? "/tmp/monster-campaign-hp";
// 파티 HP(라이브 세션). 들어갈 때 마지막 전투 보고 표식을 window.__qaMonStamp 에 둔다 — 결판 뒤에는 표식이 바뀔 때(세션에 결과를 되쓴 뒤)까지 기다렸다 잰다.
const partyHpFn = (tag) => `() => { const r = window.__oprnDebug?.monsterPartyHp?.(); if (r) window.__qaMonStamp = r.battleStamp; return { tag: ${JSON.stringify(tag)}, stamp: r?.battleStamp ?? null, party: r?.party ?? null }; }`;
const battleCommitted = `() => { const r = window.__oprnDebug?.monsterPartyHp?.(); return !!r && r.battleStamp !== window.__qaMonStamp; }`;

/** 1번길 회복의 샘(10,25)에서 회복 — 끝맺음이 필수 트레이너가 둘 이상인 길에 둔다(equipMonsterCampaign). 장치가 있으니 플레이어도 쓴다. */
function springHealBeat(tag) {
  return {
    id: `${tag}-spring`,
    note: "1번길 회복의 샘",
    ops: [
      settle,
      { kind: "teleport", mapId: "mx_map_meadow", x: 10, y: 26 },
      { kind: "waitForPosition", mapId: "mx_map_meadow", x: 10, y: 26 },
      { kind: "pressUntilJs", key: "Shift", fn: fieldIdle, maxPresses: 30, settleMs: 500 },
      { kind: "face", dir: "up" },
      { kind: "pressUntilJs", key: "Enter", fn: `() => /기운이 돌아왔다/.test(document.body.innerText)`, maxPresses: 8, settleMs: 700 },
      { kind: "pressUntilJs", key: "Enter", fn: fieldIdle, maxPresses: 6, settleMs: 700 },
    ],
    shot: true,
  };
}

/** 체육관 안내원(2,18)에게 회복받는다 — 끝맺음이 관원 전투가 있는 체육관 안내원에 회복을 붙인다(equipMonsterCampaign). */
function gymHealBeat(tag) {
  return {
    id: `${tag}-gymheal`,
    note: "체육관 안내원에게 회복",
    ops: [
      settle,
      { kind: "teleport", mapId: "mx_map_grove_gym", x: 3, y: 18 },
      { kind: "waitForPosition", mapId: "mx_map_grove_gym", x: 3, y: 18 },
      { kind: "pressUntilJs", key: "Shift", fn: fieldIdle, maxPresses: 30, settleMs: 500 },
      { kind: "face", dir: "left" },
      { kind: "pressUntilJs", key: "Enter", fn: `() => /회복할까요/.test(document.body.innerText)`, maxPresses: 10, settleMs: 700 },
      { kind: "pressUntilJs", key: "Enter", fn: `() => /건강해졌어요/.test(document.body.innerText)`, maxPresses: 10, settleMs: 700 },
      { kind: "pressUntilJs", key: "Enter", fn: fieldIdle, maxPresses: 6, settleMs: 700 },
    ],
    shot: true,
  };
}

/**
 * 실제 방향키로 걷는다 — 한 줄(방향, 칸 수)마다 그 끝 칸에 닿을 때까지 그 방향키를 누른다(지나가는 사람에게 잠깐 막혀도 다시 민다).
 * 마지막 줄의 끝이 이동 칸이면 맵이 바뀌는 것으로 끝난다. 고정 걸음 수(move)로 걷던 판은 한 걸음이 씹히면 한 칸씩 밀려 관측탑 출구를 밟았다.
 */
function walkRuns(mapId, x, y, runs) {
  const key = { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" };
  const delta = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const ops = [];
  for (const [dir, steps] of runs) {
    x += delta[dir][0] * steps; y += delta[dir][1] * steps;
    ops.push({ kind: "pressUntilJs", key: key[dir], maxPresses: steps * 6, settleMs: 600,
      fn: `() => { const s = window.__oprnDebug?.readLive?.(); return !!s && (s.currentMapId !== ${JSON.stringify(mapId)} || (s.x === ${x} && s.y === ${y})); }` });
    // 걸음마다 실제 자리를 남긴다 — 어느 줄에서 어긋났는지 판정하려고.
    ops.push({ kind: "evalToFile", out: `${HP_OUT}/walk-${mapId}-${ops.length}.json`,
      fn: `() => { const s = window.__oprnDebug?.readLive?.(); return { want: [${x}, ${y}], dir: ${JSON.stringify(dir)}, at: s ? [s.currentMapId, s.x, s.y] : null }; }` });
  }
  return ops;
}

/** 말을 걸고 전투에 들어가 끝까지 싸운 뒤 필드(또는 게임 오버)로. */
function fightBeats(tag, note, mapId, x, y, dir, { walked = false } = {}) {
  return [
    {
      id: `${tag}-enter`,
      note: `${note} — 말을 걸어 전투로`,
      ops: [
        settle,
        // 싸우기 전 파티 HP(라이브 세션, 최대 HP 포함) — 남은 HP 표의 「들어갈 때」 칸.
        { kind: "evalToFile", out: `${HP_OUT}/${tag}-before.json`, fn: partyHpFn(tag) },
        // walked: 앞 비트가 이미 그 칸까지 걸어 왔다 — 순간이동하지 않는다(리그 길을 실제로 걷는 판).
        ...(walked ? [] : [{ kind: "teleport", mapId, x, y }]),
        { kind: "waitForPosition", mapId, x, y },
        // 트레이너 시야에 내려서면 순간이동 직후 전투가 먼저 열린다 — 그때 Enter 를 누르면 「싸운다」 기술 목록이 열린 채 전투 op 가 멈췄다
        // (grunt2). 기다릴 때는 Shift(아무것도 고르지 않음), 말 걸기는 전투가 아직 없을 때만 누르는 pressUntilJs 로.
        // 시야 트레이너는 전투 전에 대사를 먼저 건다(대사창) — 그때도 기다림을 멈추고 아래 Enter 로 넘긴다.
        { kind: "pressUntilJs", key: "Shift", fn: `() => (${inBattle})() || (${fieldIdle})() || Boolean(document.querySelector("[data-testid='dialogue-box']"))`, maxPresses: 20, settleMs: 500 },
        { kind: "face", dir },
        { kind: "pressUntilJs", key: "Enter", fn: inBattle, maxPresses: 30, settleMs: 500 },
        { kind: "waitFor", testid: "actor-command-fight", state: "present", timeoutMs: 40000 },
      ],
      shot: true,
    },
    {
      id: `${tag}-end`,
      note: `${note} — 결판(승리 결과 창 또는 패배)`,
      ops: [
        { kind: "battle", fallback: "skill:best", timeoutMs: 300000 },
        // 전투별 남은 HP 표: 결과 창의 「현재/최대」와 이긴/진 문구, 파티 몬스터(종·레벨·남은 HP). QA_MON_OUT 폴더에 <tag>.json.
        { kind: "evalToFile", out: `${HP_OUT}/${tag}.json`, fn: `() => { const scene = document.querySelector("[data-testid='battle-scene']"); const text = scene?.innerText ?? ""; const s = window.__oprnDebug?.readState?.(); return { tag: ${JSON.stringify(tag)}, hp: [...text.matchAll(/(\\d+)\\s*\\/\\s*(\\d+)/g)].map((m) => [Number(m[1]), Number(m[2])]), won: /이겼다/.test(text), lost: /싸울 수 있는 몬스터가 없다|눈앞이 캄캄/.test(text), party: (s?.monsterParty ?? []).map((id) => { const m = s.monsterInstances?.[id] ?? {}; return { s: m.speciesId, l: m.level, hp: m.currentHp }; }) }; }` },
      ],
      shot: true,
    },
    {
      id: `${tag}-back`,
      note: `${note} — 결과를 닫고 필드(또는 게임 오버·센터에서 깸)`,
      ops: [
        { kind: "battle", untilEnd: true, fallback: "skill:best", resultHoldMs: 300, timeoutMs: 90000 },
        // 결판 뒤 파티 HP(라이브 세션) — 전투가 세션에 HP 를 되쓴 직후(보고 표식이 바뀜), 승리 뒤 대사·회복 명령이 돌기 전.
        // 전투 화면이 사라진 순간에 재면 아직 전투 전 값이었다(관장전 28/28 = 들어갈 때 그대로).
        // 결과 창 DOM 의 「현재/최대」는 나와 있던 한 마리뿐이고 readState 는 전투 전 사본이었다(2026-10-29 boss: DOM 1/30, readState 30).
        // 필드로 넘긴 뒤 재면 보스의 승리 뒤 recoverAll 이 이미 돌아 100% 로 찍혔다.
        { kind: "pressUntilJs", key: "Shift", fn: battleCommitted, maxPresses: 40, settleMs: 250 },
        { kind: "evalToFile", out: `${HP_OUT}/${tag}-after.json`, fn: partyHpFn(tag) },
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
      note: `연구소 박사에게서 첫 동료(${STARTER + 1}번째 선택지)를 받는다 — 받은 뒤 목표 줄`,
      ops: [
        { kind: "teleport", mapId: "mx_map_lab", x: 7, y: 6 },
        { kind: "waitForPosition", mapId: "mx_map_lab", x: 7, y: 6 },
        { kind: "face", dir: "up" },
        { kind: "action" },
        ...(STARTER > 0 ? [
          { kind: "pressUntilJs", key: "Enter", fn: starterChoice, maxPresses: 40, settleMs: 600 },
          { kind: "key", key: "ArrowDown", times: STARTER },
        ] : []),
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
        { kind: "battle", untilEnd: true, fallback: "skill:best", resultHoldMs: 300, timeoutMs: 90000 },
        { kind: "waitFor", testid: "battle-scene", state: "absent", timeoutMs: 30000 },
        { kind: "pressUntilJs", key: "Enter", fn: fieldIdle, maxPresses: 30 },
      ],
      shot: true,
    },
    // 길 트레이너 셋·체육관 관원 셋을 모두 이긴다 — 실제 플레이어가 받는 경험치(스타터 Lv8 → 관장 뒤 Lv10). 예전에는 트레이너 하나만 싸우고
    // 관원을 스위치로 건너뛴 뒤 도감 정원 야생(Lv7~9)에서 키우려 했는데, 정원 다섯 판 중 넷을 져서(센터에서 깸) 경험치가 +31 뿐이었다 —
    // Lv8 로 관측탑 보스에 갔다. 원정 끝맺음의 관문 곡선(fitGateLevelCurve)도 이 경로(길 트레이너 + 관원 + 관장)로 도착 레벨을 잰다.
    springHealBeat("trainer"),
    ...fightBeats("trainer", "1번길 트레이너(4,6)", "mx_map_meadow", 4, 7, "up"),
    springHealBeat("trainer1"),
    ...fightBeats("trainer1", "1번길 트레이너(10,14)", "mx_map_meadow", 10, 15, "up"),
    springHealBeat("trainer2"),
    ...fightBeats("trainer2", "1번길 트레이너 둘(16,22)", "mx_map_meadow", 16, 23, "up"),
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
    ...fightBeats("grunt0", "체육관 관원(10,15)", "mx_map_grove_gym", 9, 15, "right"),
    gymHealBeat("grunt1"),
    ...fightBeats("grunt1", "체육관 관원(13,17)", "mx_map_grove_gym", 12, 17, "right"),
    gymHealBeat("grunt2"),
    ...fightBeats("grunt2", "체육관 관원(6,16)", "mx_map_grove_gym", 5, 16, "right"),
    {
      id: "gym-pivot",
      note: "새싹 돌 받침(8,17)에 손을 얹는다 → 덩굴 문이 열린다 — 관원 셋은 위에서 이겼다(못 이긴 판이면 스위치로 넘긴다: 시야 전투가 퍼즐 칸마다 끼어든다)",
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
    gymHealBeat("leader"),
    ...fightBeats("leader", "체육관 관장 유림(14,3)", "mx_map_grove_gym", 14, 4, "up"),
    {
      id: "badge",
      note: "배지 뒤 목표 줄",
      ops: [{ kind: "pressUntilJs", key: "Enter", fn: `() => ${switchOn("mx_badge_1")} && (${fieldIdle})()`, maxPresses: 30, settleMs: 500 }],
      shot: true,
    },
    healBeat("boss", "관측탑 앞"),
    ...fightBeats("boss", "관측탑 밤막회사 대표(11,4)", "mx_map_observatory", 11, 5, "up"),
    healBeat("champion", "리그 앞"),
    {
      // 순간이동 없이 새순 마을에서 리그 출구(12,0)까지 걷고, 리그 안에서 챔피언 앞(7,5)까지 걷는다 — 출구 옆 길 넓히기 사본이
      // 북쪽 길을 막아 자동 플레이가 리그에 못 가던 판(2026-10-29, 52b189f762 에서 수리)을 실제 걸음으로 다시 본다.
      // 걸음은 끝맺음 뒤 standin 지도의 BFS 경로(이벤트 칸을 피함): 센터 문 앞(4,8) → (12,0), 리그 도착(7,10) → (7,5).
      id: "league-walk",
      note: "새순 마을 센터 앞에서 리그 출구까지 걸어가 리그에 들어가 챔피언 앞까지 걷는다",
      ops: [
        settle,
        { kind: "teleport", mapId: "mx_map_grove", x: 4, y: 8 },
        { kind: "waitForPosition", mapId: "mx_map_grove", x: 4, y: 8 },
        { kind: "pressUntilJs", key: "Shift", fn: fieldIdle, maxPresses: 30, settleMs: 500 },
        ...walkRuns("mx_map_grove", 4, 8, [["down", 2], ["right", 3], ["up", 1], ["right", 1], ["up", 2], ["right", 2], ["up", 2], ["right", 1], ["up", 4], ["right", 1], ["up", 1]]),
        { kind: "waitForMap", mapId: "mx_map_league_0", timeoutMs: 20000 },
        { kind: "waitForPosition", mapId: "mx_map_league_0", x: 7, y: 10 },
        { kind: "pressUntilJs", key: "Shift", fn: fieldIdle, maxPresses: 30, settleMs: 500 },
        ...walkRuns("mx_map_league_0", 7, 10, [["up", 5]]),
      ],
      shot: true,
    },
    ...fightBeats("champion", "리그 챔피언 나루(7,4)", "mx_map_league_0", 7, 5, "up", { walked: true }),
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
