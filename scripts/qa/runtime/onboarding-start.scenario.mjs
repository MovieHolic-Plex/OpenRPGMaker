// 새 게임 첫 조작 순간의 목표 안내(2026-10-29 판정자 「처음 시작 시 목표 안내가 거의 없음」·「도입 연출 뒤 안내가 한 줄뿐」·「현재 목표는 메뉴를 열어야만 보임」).
//
//   QA_OUT=<폴더> node scripts/runtime-qa.mjs --scenario onboarding-start --project <web.json> --netns
//
// 판정자처럼: 타이틀 Enter → 오프닝 「건너뛰기」가 보이면 Esc → 도입 대사는 Enter 로 넘김 → 조작 가능.
// 1-timeline : Enter 뒤 목표 카드(objective-card)·구석 목표 줄의 보임/글이 바뀐 시각.
// 2-first    : 처음 조작할 수 있게 된 순간의 카드 글. 3-later: 4초 뒤(카드가 걷혔는지).
// 4-change   : 목표 줄을 하나 더 넣었을 때의 「새 목표」 카드. 5-dismiss: 방향키 한 번에 닫히는지.
const OUT = process.env.QA_OUT ?? "/tmp/onboarding-start";
const SNAP = `() => { const c = document.querySelector("[data-testid='objective-card']"); const o = document.querySelector("[data-testid='zone-feedback-objective']");
  const box = c && !c.hidden ? c.getBoundingClientRect() : null;
  return { card: c && !c.hidden ? { kind: c.dataset.kind, text: c.innerText, w: Math.round(box.width), h: Math.round(box.height), cx: Math.round(box.x + box.width / 2), cy: Math.round(box.y + box.height / 2) } : null,
    line: o && !o.hidden ? o.textContent : null, dialogue: !!document.querySelector("[data-testid='dialogue-box']"), running: !!window.__oprnHooksScene?.running }; }`;
/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const onboardingStartScenario = {
  id: "onboarding-start",
  beats: [
    { id: "title", note: "타이틀 대기", ops: [
      { kind: "waitFor", testid: "title-screen", state: "present", timeoutMs: 120000 },
      { kind: "evalToFile", out: `${OUT}/0-arm.json`, fn: `async () => { await new Promise((r) => setTimeout(r, 1200));
        const log = []; window.__qaOnboard = log; let last = ""; const snap = (${SNAP});
        window.__qaOnboardTimer = setInterval(() => { const t0 = window.__qaOnboardT0; if (t0 === undefined) return; const s = snap();
          const tag = JSON.stringify([s.card?.kind, s.card?.text, s.line, s.dialogue]); if (tag !== last) { last = tag; log.push({ atMs: Math.round(performance.now() - t0), ...s }); } }, 50);
        document.addEventListener("keydown", (e) => { if (window.__qaOnboardT0 === undefined && e.key === "Enter") window.__qaOnboardT0 = performance.now(); }, { capture: true });
        return { armed: true }; }` },
    ] },
    { id: "start", note: "새 게임 → 오프닝 넘김 → 도입 대사 넘김", ops: [
      { kind: "key", key: "Enter" },
      { kind: "waitForRuntime", timeoutMs: 240000 },
      { kind: "evalToFile", out: `${OUT}/0-wait.json`, fn: "async () => { await new Promise((r) => setTimeout(r, 1500)); return 1500; }" },
      { kind: "pressUntilJs", key: "Escape", maxPresses: 4, settleMs: 700, fn: "() => !/건너뛰기/.test(document.body.innerText)" },
      { kind: "pressUntilJs", key: "Enter", maxPresses: 40, settleMs: 500,
        fn: "() => !document.querySelector(\"[data-testid='dialogue-box']\") && !!window.__oprnHooksScene && !window.__oprnHooksScene.running && !document.querySelector(\"[data-testid='play-loading-overlay']\")" },
      { kind: "evalToFile", out: `${OUT}/0-settle.json`, fn: "async () => { await new Promise((r) => setTimeout(r, 300)); return 300; }" },
      { kind: "evalToFile", out: `${OUT}/2-first.json`, fn: `() => (${SNAP})()` },
    ], shot: true },
    { id: "later", note: "4초 뒤", ops: [
      { kind: "evalToFile", out: `${OUT}/3-later.json`, fn: `async () => { await new Promise((r) => setTimeout(r, 4000)); return (${SNAP})(); }` },
    ], shot: true },
    { id: "change", note: "목표가 바뀜", ops: [
      { kind: "evalToFile", out: `${OUT}/4-change.json`, fn: `async () => { const ui = window.__oprnHooksScene?.session?.m2Runtime?.ui; if (!ui) return { error: "no ui" };
        ui.push({ surface: "objectiveChip", message: "QA: 서재의 금고를 열 번호를 찾자", durationMs: 0 });
        await new Promise((r) => setTimeout(r, 500)); return (${SNAP})(); }` },
    ], shot: true },
    { id: "dismiss", note: "방향키 한 번에 닫힘", ops: [
      { kind: "key", key: "ArrowDown" },
      { kind: "evalToFile", out: `${OUT}/5-dismiss.json`, fn: `async () => { await new Promise((r) => setTimeout(r, 200)); clearInterval(window.__qaOnboardTimer); return { now: (${SNAP})(), timeline: window.__qaOnboard }; }` },
    ], shot: true },
  ],
};
