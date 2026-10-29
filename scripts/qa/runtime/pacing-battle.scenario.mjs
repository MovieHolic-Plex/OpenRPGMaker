// 전투 명령 사이 대기·대기 중 Enter 처리 계측(2026-10-29 vm3 flash jrpg 판정 「명령마다 4~8초 대기, 지연 중 Enter 누르면 명령이 겹쳐 들어감」).
//
//   QA_OUT=<폴더> QA_MAP=<던전 맵> QA_AT=x,y QA_DIR=up node scripts/runtime-qa.mjs --scenario pacing-battle --project <web.json> --netns
//
// QA_AT 칸으로 옮겨 QA_DIR 쪽으로 걸어 적과 부딪혀 전투에 들어간다. 그 뒤 두 가지를 잰다.
//  1-quiet: 공격 명령을 내린 순간부터 다음 명령 카드가 눌릴 수 있게 될 때까지(손 안 댐) — 명령 사이 대기.
//  2-mash : 같은 재기를 하되 연출 중 300ms 마다 Enter 를 누른다 — 대기가 줄어드는지, 카드가 뜬 뒤 우리가 누르지 않은 명령이 저절로 들어가는지(겹침).
const OUT = process.env.QA_OUT ?? "/tmp/pacing-battle";
const MAP = process.env.QA_MAP ?? "map_blank_start";
const [ax, ay] = (process.env.QA_AT ?? "6,10").split(",").map(Number);
const DIR = process.env.QA_DIR ?? "up";
const KEY = { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" }[DIR];

const measure = (mash) => `async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const scene = () => document.querySelector('[data-testid="battle-scene"]');
  const attack = () => document.querySelector('[data-testid="actor-command-attack"]');
  const ready = () => { const s = scene(), b = attack(); return !!s && s.dataset.battleSequenceBusy !== "true" && !!b && !b.disabled && b.offsetParent !== null; };
  const over = () => !!document.querySelector('[data-testid="battle-result-confirm"]') || !scene();
  const lines = [];
  const t00 = performance.now();
  const mo = new MutationObserver(() => { const l = document.querySelector('[data-testid="battle-message-window"]')?.textContent?.trim(); if (l && lines.at(-1)?.line !== l) lines.push({ t: Math.round(performance.now() - t00), line: l.slice(0, 40) }); });
  mo.observe(document.body, { subtree: true, childList: true, characterData: true });
  const rows = [];
  for (let i = 0; i < ${mash ? 3 : 3}; i += 1) {
    let w = performance.now();
    while (!ready()) { if (over()) { mo.disconnect(); return { rows, lines, ended: true }; } if (performance.now() - w > 40000) { mo.disconnect(); return { rows, lines, timeout: true }; } await sleep(20); }
    attack().click();
    for (let k = 0; k < 40; k += 1) { const t = [...document.querySelectorAll('button[data-testid^="battle-target-"]')].find((n) => n.dataset.testid !== "battle-target-cancel" && !n.disabled); if (t) { t.click(); break; } await sleep(25); }
    const tCmd = performance.now();
    let presses = 0, lastPress = 0;
    while (scene() && !over() && (scene().dataset.battleSequenceBusy !== "true") && performance.now() - tCmd < 3000) await sleep(10);
    const tBusy = performance.now();
    while (!ready()) {
      if (over()) break;
      if (${mash} && performance.now() - lastPress > 300) { lastPress = performance.now(); presses += 1; for (const type of ["keydown", "keyup"]) window.dispatchEvent(new KeyboardEvent(type, { key: "Enter", code: "Enter", bubbles: true })); }
      if (performance.now() - tCmd > 40000) break;
      await sleep(10);
    }
    const tReady = performance.now();
    // 겹침: 연출을 넘기려고 누르던 손이 카드가 뜬 직후(120ms) 한 번 더 누른다 — 명령(대상 고르기·연출)이 열리면 겹침이다.
    let ghost = false;
    if (${mash} && !over()) {
      await sleep(120);
      for (const type of ["keydown", "keyup"]) window.dispatchEvent(new KeyboardEvent(type, { key: "Enter", code: "Enter", bubbles: true }));
      for (let k = 0; k < 30; k += 1) { if (document.querySelector('[data-testid="battle-target-prompt"]') || scene()?.dataset.battleSequenceBusy === "true") { ghost = true; break; } await sleep(20); }
      if (document.querySelector('[data-testid="battle-target-prompt"]')) for (const type of ["keydown", "keyup"]) window.dispatchEvent(new KeyboardEvent(type, { key: "Escape", code: "Escape", bubbles: true }));
      await sleep(200);
    }
    rows.push({ i, commandToReadyMs: Math.round(tReady - tCmd), toBusyMs: Math.round(tBusy - tCmd), presses, lateEnterOpenedCommand: ghost });
    if (over()) break;
  }
  mo.disconnect();
  return { rows, lines };
}`;

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const pacingBattleScenario = {
  id: "pacing-battle",
  beats: [
    { id: "start", note: "새 게임", ops: [
      { kind: "pressUntilJs", key: "Enter", fn: "() => !document.querySelector(\"[data-testid='title-screen']\")", maxPresses: 4, settleMs: 2500 },
      { kind: "waitForRuntime", timeoutMs: 240000 },
      { kind: "seed", seed: 1 },
    ] },
    { id: "enter-battle", note: "적 앞에서 부딪혀 전투로", ops: [
      { kind: "teleport", mapId: MAP, x: ax, y: ay },
      { kind: "pressUntil", key: KEY, testid: "battle-scene", state: "present", maxPresses: 30 },
    ], shot: true },
    { id: "quiet", note: "손 안 대고 명령 사이 대기", ops: [{ kind: "evalToFile", fn: measure(false), out: `${OUT}/1-quiet.json` }], shot: true },
    { id: "mash", note: "연출 중 Enter 연타", ops: [{ kind: "evalToFile", fn: measure(true), out: `${OUT}/2-mash.json` }], shot: true },
  ],
};
