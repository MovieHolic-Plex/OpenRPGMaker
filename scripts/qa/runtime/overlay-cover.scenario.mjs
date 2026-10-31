// 컷신 건너뛰기 표시·전투 대사 창이 UI 를 덮는지(2026-10-31 폴른 스타 2막 첫 플레이 B6·B12·B13).
//
//   npx vite-node --script scripts/qa/runtime/overlay-cover-fixture.mts --out /tmp/overlay-cover.json
//   QA_OUT=<폴더> node scripts/runtime-qa.mjs --scenario overlay-cover --project /tmp/overlay-cover.json --netns --out <폴더>
//
// battle-text : 전투 1라운드 대사 — 대사 창과 파티 상태 창의 상자(rects.json)
// battle-cmd  : 대상 고르기 머리 — 건너뛰기 표시가 있으면 머리와 겹치는가
// save-menu   : 컷신 안 저장 메뉴 — 건너뛰기 표시가 명령 목록을 덮는가
const OUT = process.env.QA_OUT ?? "/tmp/overlay-cover";
const rects = `() => {
  const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return b.width && b.height ? { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) } : null; };
  const all = (sel) => [...document.querySelectorAll(sel)].map((el) => ({ sel, testid: el.getAttribute('data-testid'), cls: String(el.className).slice(0, 60), rect: r(el) })).filter((v) => v.rect);
  return { hint: r(document.querySelector("[data-testid='cutscene-skip-hint']")), dialogue: r(document.querySelector('.dialogue-overlay .dialogue-box')),
    dialoguePos: document.querySelector('.dialogue-overlay')?.className ?? null,
    battle: all("[data-testid^='battle-'][data-testid*='status'], [data-testid^='battle-'][data-testid*='party'], [data-testid^='battle-'][data-testid*='help'], [data-testid^='battle-'][data-testid*='command']"),
    menu: all("[data-testid='main-menu'] [data-testid*='command'], [data-testid='main-menu'] nav, [data-testid='main-menu'] ul") };
}`;
/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const overlayCoverScenario = {
  id: "overlay-cover",
  beats: [
    { id: "start", note: "새 게임 → 컷신 첫 대사", ops: [
      { kind: "pressUntilJs", key: "Enter", fn: "() => !document.querySelector(\"[data-testid='title-screen']\")", maxPresses: 4, settleMs: 2500 },
      { kind: "waitForRuntime", timeoutMs: 240000 },
    ] },
    { id: "battle-text", note: "전투 1라운드 대사", ops: [
      { kind: "pressUntilJs", key: "Enter", fn: "() => !!document.querySelector(\"[data-testid='battle-scene']\") && !!document.querySelector('.dialogue-overlay .dialogue-box') && /물지는/.test(document.querySelector('.dialogue-overlay')?.textContent ?? '')", maxPresses: 30, settleMs: 900 },
      { kind: "hold", dir: null, ms: 900 },
      { kind: "evalToFile", out: `${OUT}/battle-text.json`, fn: rects },
    ], shot: true },
    { id: "battle-cmd", note: "대상 고르기 머리", ops: [
      { kind: "pressUntilJs", key: "Enter", fn: "() => /노린다/.test(document.querySelector(\"[data-testid='battle-scene']\")?.textContent ?? '')", maxPresses: 30, settleMs: 700 },
      { kind: "evalToFile", out: `${OUT}/battle-cmd.json`, fn: rects },
    ], shot: true },
    { id: "save-menu", note: "전투를 끝내고 컷신 안 저장 메뉴", ops: [
      { kind: "pressUntilJs", key: "Enter", fn: "() => /비어 있음|저장할 슬롯/.test(document.body.innerText)", maxPresses: 300, settleMs: 350 },
      { kind: "hold", dir: null, ms: 900 },
      { kind: "evalToFile", out: `${OUT}/save-menu.json`, fn: rects },
    ], shot: true },
  ],
};
