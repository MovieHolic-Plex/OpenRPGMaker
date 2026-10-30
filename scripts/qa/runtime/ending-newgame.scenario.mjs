// 엔딩 → 타이틀 → 새 게임이 진행을 비우는지·타이틀 첫 Enter 가 먹는지(2026-10-29 vm4 flash 방탈출 판정 major
// 「엔딩 후 타이틀에서 새 게임을 눌러도 열린 금고·위치(5,4)·출구 열쇠가 남음」, polish 「타이틀 첫 Enter 안 먹힘·『제목 없는 게임』 화면」).
//
//   QA_OUT=<폴더> node scripts/runtime-qa.mjs --scenario ending-newgame --project <vm4 flash escape web.json> --netns
//
// 판에 맞춘 값(기본 = vm4 flash escape): QA_SWITCHES, QA_ITEM, QA_SAVE_AT(x,y,dir), QA_DOOR_AT(x,y,dir).
const OUT = process.env.QA_OUT ?? "/tmp/ending-newgame";
const MAP = process.env.QA_MAP ?? "map_blank_start";
const SWITCHES = (process.env.QA_SWITCHES ?? "sw_k3hch36_taken_1,sw_k3hch36_knqw4ch,sw_k3hch36_4860_solved_2").split(",").filter(Boolean);
const ITEM = process.env.QA_ITEM ?? "item_k3hch36_kn87asr";
const [vx, vy, vdir] = (process.env.QA_SAVE_AT ?? "5,4,up").split(",");
const [dx, dy, ddir] = (process.env.QA_DOOR_AT ?? "3,7,left").split(",");
const common = `
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const press = (key) => { for (const type of ["keydown", "keyup"]) document.dispatchEvent(new KeyboardEvent(type, { key, code: key === "Enter" ? "Enter" : key, bubbles: true })); };
  const body = () => document.body.innerText.replace(/\\s+/g, " ").slice(0, 300);
  const state = () => { const s = window.__oprnDebug?.readState?.(); return s ? { map: s.currentMapId, x: s.x, y: s.y, switches: Object.entries(s.switches ?? {}).filter(([, v]) => v).map(([k]) => k), items: s.inventory ?? s.items ?? null } : null; };
`;
/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const endingNewGameScenario = {
  id: "ending-newgame",
  beats: [
    { id: "start", note: "새 게임 → 시작 대사 넘김 → 진행 심기", ops: [
      { kind: "pressUntilJs", key: "Enter", fn: "() => !document.querySelector(\"[data-testid='title-screen']\")", maxPresses: 4, settleMs: 2500 },
      { kind: "waitForRuntime", timeoutMs: 240000 },
      { kind: "pressUntilJs", key: "Enter", fn: "() => !document.querySelector('.dialogue-overlay .dialogue-box')", maxPresses: 30, settleMs: 700 },
      ...SWITCHES.map((switchId) => ({ kind: "setSwitch", switchId, value: true })),
      { kind: "giveItem", itemId: ITEM, amount: 1 },
      { kind: "teleport", mapId: MAP, x: Number(vx), y: Number(vy) }, { kind: "face", dir: vdir },
    ] },
    { id: "save", note: "ESC → 저장 → 1번 칸", ops: [
      { kind: "hold", dir: null, ms: 1500 },
      { kind: "pressUntilJs", key: "Escape", fn: "() => !!document.querySelector(\"[data-testid='status-menu-command-save']\")", maxPresses: 4, settleMs: 900 },
      { kind: "click", testid: "status-menu-command-save" }, { kind: "click", testid: "save-slot-1" },
      { kind: "pressUntilJs", key: "Enter", fn: "() => /저장했습니다/.test(document.body.textContent ?? '')", maxPresses: 2, settleMs: 700 },
      { kind: "evalToFile", out: `${OUT}/1-saved.json`, fn: "() => ({ saved: /저장했습니다/.test(document.body.textContent ?? '') })" },
      { kind: "pressUntilJs", key: "Escape", fn: "() => !document.querySelector(\"[data-testid='main-menu']\")", maxPresses: 4, settleMs: 400 },
    ], shot: true },
    { id: "ending", note: "문 → 엔딩 → 1초마다 확인키(실제 키) → 마지막 장", ops: [
      { kind: "teleport", mapId: MAP, x: Number(dx), y: Number(dy) }, { kind: "face", dir: ddir }, { kind: "action" },
      { kind: "evalToFile", out: `${OUT}/2a-t0.json`, fn: "() => { window.__qaEndT0 = performance.now(); return { at: 0 }; }" },
      { kind: "pressUntilJs", key: "Enter", fn: "() => { const roll = document.querySelector('.ending-credits-roll'); if (roll) { window.__qaCredits = roll.textContent; window.__qaCreditsHint = document.querySelector(\"[data-testid='ending-screen'] .game-over-hint\")?.textContent; } return !!document.querySelector(\"[data-testid='ending-final-title']\"); }", maxPresses: 40, settleMs: 1000 },
      { kind: "evalToFile", out: `${OUT}/2-ending.json`, fn: "() => ({ toFinalMs: Math.round(performance.now() - window.__qaEndT0), credits: window.__qaCredits ?? null, creditsHint: window.__qaCreditsHint ?? null, finalText: document.querySelector(\"[data-testid='ending-screen']\")?.innerText.replace(/\\s+/g, ' ').slice(0, 120) })" },
      { kind: "hold", dir: null, ms: 600 },
      { kind: "pressUntilJs", key: "Enter", fn: "() => !!document.querySelector(\"[data-testid='title-screen']\")", maxPresses: 4, settleMs: 1500 },
    ], shot: true },
    { id: "title", note: "타이틀 300ms 뒤 Enter 한 번 → 새 게임", ops: [
      { kind: "evalToFile", out: `${OUT}/3-title.json`, fn: "() => [...document.querySelectorAll('[data-testid=title-screen] .rm-title-menu-button')].map((b) => ({ label: b.textContent.trim(), selected: b.getAttribute('tabindex') === '0' }))" },
      { kind: "evalToFile", out: `${OUT}/3a-hook.json`, fn: "() => { window.__qaOldHook = window.__oprnDebug; return { oldHook: !!window.__oprnDebug }; }" },
      { kind: "hold", dir: null, ms: 300 }, { kind: "key", key: "Enter" }, { kind: "hold", dir: null, ms: 1500 },
      { kind: "evalToFile", out: `${OUT}/3b-left.json`, fn: "() => ({ leftAfterOneEnter: !document.querySelector(\"[data-testid='title-screen']\") })" },
      { kind: "pressUntilJs", key: "Enter", fn: "() => !document.querySelector(\"[data-testid='title-screen']\")", maxPresses: 4, settleMs: 1200 },
    ] },
    { id: "after", note: "새 게임 상태", ops: [
      { kind: "waitForRuntime", timeoutMs: 240000 },
      // 타이틀로 나간 뒤에도 옛 판의 __oprnDebug 가 남아 옛 상태를 읽는다 — 새 판이 훅을 갈아 끼울 때까지 기다린다.
      { kind: "pressUntilJs", key: "Shift", fn: "() => !!window.__oprnDebug && window.__oprnDebug !== window.__qaOldHook", maxPresses: 120, settleMs: 500 },
      { kind: "evalToFile", out: `${OUT}/4a-during-opening.json`, fn: `async () => { ${common} return { state: state(), body: body().slice(0, 120) }; }` },
      { kind: "pressUntilJs", key: "Escape", fn: "() => !/건너뛰기/.test(document.body.innerText)", maxPresses: 6, settleMs: 900 },
      { kind: "pressUntilJs", key: "Enter", fn: "() => !document.querySelector('.dialogue-overlay .dialogue-box')", maxPresses: 30, settleMs: 700 },
      { kind: "evalToFile", out: `${OUT}/4-after.json`, fn: `async () => { ${common} await new Promise((r) => setTimeout(r, 1500)); return { state: state(), body: body().slice(0, 160) }; }` },
    ], shot: true },
  ],
};
