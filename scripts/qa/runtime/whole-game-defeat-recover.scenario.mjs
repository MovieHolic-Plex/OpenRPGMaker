// 실물 게임 패배 → 귀환 QA — vm5 flash jrpg 「어두운 동굴」(2026-10-29). 컴파일된 출하 플레이어.
//
//   node scripts/runtime-qa.mjs --scenario whole-game-defeat-recover --browser firefox --netns \
//     --whole-game ~/z-project/assistant-whole-game/suite/runs/vm5-1029/flash/jrpg/project --out /tmp/bq/jr5/rt-before
//
// 판정자 원문: 「전투에서 패배하면 시작 지점·소지금 0G·첫 목표로 돌아가 상자 보상 등 진행이 사라짐, 복귀 지점 안내 없음」 — 게임 오버 메뉴에
// 「타이틀로 돌아가기」만 있었다(기록된 체크포인트 없음). 끝맺음이 결과를 귀환(recover)으로 둔 판은 진행·소지금을 지닌 채 회복해 시작 지점에서 깬다.
// 진행 표지: 스위치 qa_progress 와 소지금 500G 를 넣고, 체력 1 로 동굴 박쥐(10,17)에 닿아 방어만 하다 진다.
import { fieldReady, wholeGameOpening } from "./wholeGameBattleCommon.mjs";

const CAVE = "map_blank_start";
// 상태 기록 파일 접두(두 판을 함께 돌릴 때 겹치지 않게).
const OUT = process.env.QA_DEFEAT_OUT ?? "/tmp/qa-defeat";
const state = `() => { const s = window.__oprnDebug?.readState?.(); return s && { map: s.currentMapId, x: s.x, y: s.y, gold: s.gold, progress: s.switches?.qa_progress === true, actors: s.partyActorIds, gameOver: Boolean(document.querySelector("[data-testid='game-over-screen']")), title: Boolean(document.querySelector("[data-testid='title-screen']")) }; }`;

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export default {
  id: "whole-game-defeat-recover",
  viewport: { width: 960, height: 720 },
  query: { e2eVitals: "1" },
  beats: [
    ...wholeGameOpening(),
    {
      id: "defeat-enter",
      note: "진행 표지(스위치·500G)를 넣고 체력 1 로 동굴 박쥐(10,17)에 닿는다",
      ops: [
        { kind: "setSwitch", switchId: "qa_progress" },
        { kind: "evalToFile", fn: `() => { window.__oprnDebug?.setGold?.(500); return true; }`, out: `${OUT}-gold.json` },
        { kind: "teleport", mapId: CAVE, x: 10, y: 19 },
        { kind: "waitForPosition", mapId: CAVE, x: 10, y: 19 },
        { kind: "pressUntilJs", key: "Shift", fn: fieldReady, maxPresses: 10 },
        { kind: "setVitals", hp: 1, mp: 0 },
        { kind: "pressUntilJs", keys: ["ArrowUp", "ArrowUp", "ArrowLeft", "ArrowRight"], fn: `() => Boolean(document.querySelector("[data-testid='battle-scene']"))`, maxPresses: 40, settleMs: 350 },
        { kind: "waitFor", testid: "actor-command-attack", state: "present", timeoutMs: 30000 },
      ],
      shot: true,
    },
    {
      id: "defeat",
      note: "방어만 하다 쓰러짐 → 게임 오버 화면(귀환 글 또는 메뉴)",
      ops: [
        { kind: "battle", fallback: "defend", untilEnd: true, resultHoldMs: 300, timeoutMs: 180000 },
        { kind: "waitFor", testid: "game-over-screen", state: "present", timeoutMs: 30000 },
        { kind: "waitFor", testid: "battle-transition-overlay", state: "absent", timeoutMs: 30000 },
        // 귀환 글(.blackout-message) 또는 메뉴 선택지가 뜰 때 찍는다.
        { kind: "pressUntilJs", key: "Shift", fn: `() => Boolean(document.querySelector("[data-testid='game-over-screen'] .blackout-message, [data-testid='game-over-screen'] .game-over-choice"))`, maxPresses: 30, settleMs: 300 },
      ],
      shot: true,
    },
    {
      id: "after",
      note: "그 뒤 — 귀환이면 시작 지점에서 깸(진행·소지금 유지), 메뉴면 「타이틀로」뿐",
      ops: [
        { kind: "pressUntilJs", key: "Shift", fn: `() => !document.querySelector("[data-testid='game-over-screen']") && (${fieldReady})() || Boolean(document.querySelector("[data-testid='game-over-screen'] .game-over-choice"))`, maxPresses: 40, settleMs: 500 },
        { kind: "evalToFile", fn: state, out: `${OUT}-state.json` },
      ],
      shot: true,
    },
  ],
};
