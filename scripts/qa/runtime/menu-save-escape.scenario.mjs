// 저장한 뒤 Esc 몇 번이면 필드로 돌아가는지(2026-10-29 vm3 terra jrpg 판정 「저장 화면과 메뉴에서 Esc 가 한 단계씩만 닫혀 여러 번 눌러야 필드로」).
//
//   QA_OUT=<폴더> node scripts/runtime-qa.mjs --scenario menu-save-escape --project <web.json> --netns
//
// 1-save    : Esc → 「저장」 누름(칸 목록) → Enter(1번 칸 저장) → Esc 를 한 번씩 누르며 메뉴가 닫혔는지.
// 2-top     : 메뉴만 열고(최상위) Esc 한 번 → 닫혔는지(유지돼야 하는 동작).
const OUT = process.env.QA_OUT ?? "/tmp/menu-save-escape";
const MENU = "[data-testid='main-menu']";
const open = `() => !!document.querySelector("${MENU}")`;
const escapes = (file) => [1, 2, 3].flatMap((n) => [
  { kind: "key", key: "Escape" }, { kind: "hold", dir: null, ms: 500 },
  { kind: "evalToFile", out: `${OUT}/${file}-esc${n}.json`, fn: `() => ({ esc: ${n}, menuOpen: !!document.querySelector("${MENU}") })` },
]);
/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const menuSaveEscapeScenario = {
  id: "menu-save-escape",
  beats: [
    { id: "start", note: "새 게임 → 시작 대사 넘김", ops: [
      { kind: "pressUntilJs", key: "Enter", fn: "() => !document.querySelector(\"[data-testid='title-screen']\")", maxPresses: 4, settleMs: 2500 },
      { kind: "waitForRuntime", timeoutMs: 240000 },
      { kind: "pressUntilJs", key: "Escape", fn: "() => !/건너뛰기/.test(document.body.innerText)", maxPresses: 6, settleMs: 900 },
      { kind: "pressUntilJs", key: "Enter", fn: "() => !document.querySelector('.dialogue-overlay .dialogue-box')", maxPresses: 40, settleMs: 700 },
      { kind: "hold", dir: null, ms: 1500 },
    ] },
    { id: "save", note: "Esc → 저장 → Enter → Esc 세 번", ops: [
      { kind: "pressUntilJs", key: "Escape", fn: "() => !!document.querySelector(\"[data-testid='status-menu-command-save']\")", maxPresses: 4, settleMs: 900 },
      { kind: "click", testid: "status-menu-command-save" }, { kind: "hold", dir: null, ms: 300 }, { kind: "evalToFile", out: `${OUT}/1-stepa.json`, fn: "() => document.querySelector(\"[data-testid='main-menu']\")?.innerText.replace(/\\s+/g, ' ').slice(0, 260) ?? null" },
      { kind: "key", key: "Enter" }, { kind: "hold", dir: null, ms: 700 }, { kind: "evalToFile", out: `${OUT}/1-stepc.json`, fn: "() => document.querySelector(\"[data-testid='main-menu']\")?.innerText.replace(/\\s+/g, ' ').slice(0, 260) ?? null" },
      { kind: "evalToFile", out: `${OUT}/1-saved.json`, fn: "() => ({ saved: /저장했습니다/.test(document.body.textContent ?? '') })" },
      ...escapes("1"),
    ], shot: true },
    { id: "top", note: "메뉴 열고 최상위에서 Esc 한 번", ops: [
      { kind: "pressUntilJs", key: "Escape", fn: open, maxPresses: 3, settleMs: 900 },
      ...escapes("2").slice(0, 3),
    ] },
  ],
};
