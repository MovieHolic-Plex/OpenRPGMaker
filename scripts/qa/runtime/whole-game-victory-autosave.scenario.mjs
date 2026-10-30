// 실물 게임 전투 승리 자동 저장 → 불러오기 QA — vm5 argon jrpg 「마왕의 동굴」(2026-10-29). 컴파일된 출하 플레이어.
//
//   QA_VA_OUT=/tmp/bq/jr7/after node scripts/runtime-qa.mjs --scenario whole-game-victory-autosave --browser firefox --netns \
//     --whole-game ~/z-project/assistant-whole-game/suite/runs/vm5-1029/argon/jrpg/project --out /tmp/bq/jr7/rt-after
//
// 판정자 원문: 「자동 저장을 불러온 뒤 메뉴가 열린 채 닫히지 않고 뒤에 전투 UI 가 겹쳐 보임, 메뉴의 Enter 가 전투로 새어 '도주' 실행,
// 저장 이름이 '전투 승리'」. 전투 승리 자동 저장이 전투를 연 접촉 이벤트가 끝나기 전(「이 적을 이겼다」 스위치를 켜기 전)에 구워져,
// 불러오면 같은 적이 다시 닿아 전투가 열렸다. 그 이벤트의 느낌표·대기 동안 Esc 가 메뉴를 열어 전투가 메뉴 아래에서 시작됐다.
//   1) 적(28,26) 옆에서 닿아 이긴다 → 자동 저장에 그 적의 처치 스위치가 있는가, 받은 경험치·레벨.
//   2) 메뉴 → 불러오기 → 자동 저장 → 3초 뒤 전투가 다시 열리는가(QA 하네스는 새로고침 때 저장소를 비우므로 게임 안 불러오기로).
//   3) 다른 적(18,15) 아래에서 닿아 이벤트가 돌기 시작하면(느낌표·대기) Esc → 메뉴와 전투가 함께 떠 있는가.
import { fieldReady, wholeGameOpening } from "./wholeGameBattleCommon.mjs";

const CAVE = "map_0bb3469f-b8fc-46fc-b119-057b6498162a";
const FOE = "sw_ev_map_0bb3469f-b8fc-46fc-b119-057b6498162a_v2foe1_clear";
const OUT = process.env.QA_VA_OUT ?? "/tmp/qa-victory-autosave";
const running = `() => window.__oprnHooksScene?.running === true`;
const inBattle = `() => Boolean(document.querySelector("[data-testid='battle-scene']"))`;
const autosave = `() => {
  const key = Object.keys(localStorage).find((k) => /save-slot.*auto$/.test(k));
  const snap = key ? JSON.parse(localStorage.getItem(key)) : null;
  const s = window.__oprnDebug?.readState?.();
  return { key, trigger: snap?.autosaveTrigger ?? null, savedFoeClear: snap?.session?.switches?.[${JSON.stringify(FOE)}] === true,
    liveFoeClear: s?.switches?.[${JSON.stringify(FOE)}] === true, pos: s && [s.currentMapId, s.x, s.y] };
}`;
const surfaces = `() => { const s = window.__oprnDebug?.readState?.(); return { menu: Boolean(document.querySelector("[data-testid='main-menu']")), battle: Boolean(document.querySelector("[data-testid='battle-scene']")),
  title: Boolean(document.querySelector("[data-testid='title-screen']")), pos: s && [s.currentMapId, s.x, s.y], foeClear: s?.switches?.[${JSON.stringify(FOE)}] === true }; }`;
const levels = `() => { const s = window.__oprnHooksScene?.session; const lead = s?.partyActorIds?.[0]; return { lead, level: s?.actorLevels?.[lead], exp: s?.actorExperience?.[lead] }; }`;
const sleep = (ms) => ({ kind: "evalToFile", fn: `async () => { await new Promise((r) => setTimeout(r, ${ms})); return ${ms}; }`, out: `${OUT}-sleep.json` });

/** 저장·불러오기 명령 — 묶음 메뉴(시스템 ▸)면 먼저 그 묶음을 연다(load-confirm-key 와 같다). */
const openCommand = (id) => `async () => {
  const pick = () => document.querySelector("[data-testid='status-menu-command-${id}'], [data-testid='status-menu-group-command-${id}']");
  if (!pick()) [...document.querySelectorAll("[data-testid^='status-menu-command-']")].find((b) => /시스템/.test(b.textContent ?? "") && b.tagName === "BUTTON")?.click();
  for (let i = 0; i < 20 && !pick(); i += 1) await new Promise((r) => setTimeout(r, 100));
  const found = !!pick();
  pick()?.click();
  return { opened: found };
}`;

/** 전투가 열려 있으면 Enter 로 끝내고, 남은 메뉴를 닫고, 필드로. 다음 자동 저장이 디바운스(5초)에 걸리지 않게 쉰다. */
const cleanup = (id) => ({
  id,
  note: "정리 — 전투는 Enter 로 끝내고 메뉴를 닫는다",
  ops: [
    { kind: "setVitals", hp: 9999, mp: 99 },
    { kind: "pressUntilJs", key: "Enter", fn: `() => !(${inBattle})() && !document.querySelector("[data-testid='battle-transition-overlay'], .battle-return-settle")`, maxPresses: 150, settleMs: 400 },
    { kind: "pressUntilJs", key: "Escape", fn: `() => !document.querySelector("[data-testid='main-menu']")`, maxPresses: 4, settleMs: 500 },
    { kind: "pressUntilJs", key: "Enter", fn: fieldReady, maxPresses: 30, settleMs: 600 },
    sleep(6000),
  ],
});

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export default {
  id: "whole-game-victory-autosave",
  viewport: { width: 960, height: 720 },
  query: { e2eVitals: "1" },
  beats: [
    ...wholeGameOpening(),
    {
      id: "win",
      note: "체력을 채우고 적(28,26) 옆(26,26)에서 오른쪽으로 밀어 닿는다 → 공격으로 이긴다",
      ops: [
        { kind: "teleport", mapId: CAVE, x: 26, y: 26 },
        { kind: "waitForPosition", mapId: CAVE, x: 26, y: 26 },
        { kind: "pressUntilJs", key: "Shift", fn: fieldReady, maxPresses: 10 },
        { kind: "setVitals", hp: 9999, mp: 99 },
        { kind: "pressUntilJs", key: "ArrowRight", fn: inBattle, maxPresses: 30, settleMs: 400 },
        { kind: "waitFor", testid: "actor-command-attack", state: "present", timeoutMs: 30000 },
        { kind: "battle", fallback: "attack", untilEnd: true, resultHoldMs: 300, timeoutMs: 180000 },
        { kind: "pressUntilJs", key: "Enter", fn: fieldReady, maxPresses: 30, settleMs: 600 },
        sleep(1500),
        { kind: "evalToFile", fn: autosave, out: `${OUT}-1-autosave.json` },
        { kind: "evalToFile", fn: levels, out: `${OUT}-1b-levels.json` },
      ],
      shot: true,
    },
    {
      id: "load",
      note: "Esc → 불러오기 → 자동 저장 → 3초 뒤",
      ops: [
        { kind: "key", key: "Escape" },
        { kind: "evalToFile", fn: openCommand("load"), out: `${OUT}-2a-open-load.json` },
        { kind: "waitFor", testid: "load-slot-auto", state: "present", timeoutMs: 20000 },
        { kind: "evalToFile", fn: `() => document.querySelector("[data-testid='load-slot-auto']")?.textContent?.replace(/\\s+/g, " ").trim() ?? null`, out: `${OUT}-2a-slot.json` },
        { kind: "click", testid: "load-slot-auto" },
        // 확인 창이 있는 판이면 Enter 로 확정한다.
        { kind: "pressUntilJs", key: "Enter", fn: `() => !document.querySelector("[data-testid='main-menu']")`, maxPresses: 3, settleMs: 700 },
        sleep(3000),
        { kind: "evalToFile", fn: surfaces, out: `${OUT}-2-after-load.json` },
        { kind: "evalToFile", fn: levels, out: `${OUT}-2b-levels.json` },
      ],
      shot: true,
    },
    cleanup("load-cleanup"),
    {
      id: "menu-during-touch",
      note: "적(18,15) 아래(18,17)에서 위로 닿아 이벤트가 돌기 시작하면(느낌표·대기) Esc — 메뉴와 전투가 함께 떠 있는가",
      ops: [
        { kind: "teleport", mapId: CAVE, x: 18, y: 17 },
        { kind: "waitForPosition", mapId: CAVE, x: 18, y: 17 },
        { kind: "pressUntilJs", key: "Shift", fn: fieldReady, maxPresses: 10 },
        { kind: "pressUntilJs", key: "ArrowUp", fn: running, maxPresses: 20, settleMs: 60 },
        { kind: "key", key: "Escape" },
        sleep(4000),
        { kind: "evalToFile", fn: surfaces, out: `${OUT}-3-menu-touch.json` },
      ],
      shot: true,
    },
    cleanup("menu-cleanup"),
  ],
};
