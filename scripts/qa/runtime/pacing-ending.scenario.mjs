// 엔딩 → 크레딧 → 마지막 장까지 걸리는 시간·확인키 수 계측(2026-10-29 vm3 flash 방탈출 판정 「엔딩 뒤 크레딧 대기 김」).
// 픽스처는 시작 맵에 triggerEnding 자동 실행 이벤트를 하나 더한 출하 web json.
//
//   QA_OUT=<폴더> node scripts/runtime-qa.mjs --scenario pacing-ending --project <web.json> --netns
//
// 1-tap : (QA_TAP_MS, 기본 1000) 플레이어가 1초마다 확인키를 한 번씩 톡 누른다(누르고 바로 뗌) — 엔딩 화면이 뜬 뒤 마지막 장까지 ms·누른 수·단계 시각표.
const OUT = process.env.QA_OUT ?? "/tmp/pacing-ending";
const TAP_MS = Number(process.env.QA_TAP_MS ?? 1000);
/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const pacingEndingScenario = {
  id: "pacing-ending",
  beats: [
    { id: "start", note: "새 게임", ops: [
      { kind: "pressUntilJs", key: "Enter", fn: "() => !document.querySelector(\"[data-testid='title-screen']\")", maxPresses: 4, settleMs: 2500 },
    ] },
    { id: "tap", note: "1초마다 확인키 톡", ops: [{ kind: "evalToFile", out: `${OUT}/1-tap.json`, fn: `async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const press = () => { for (const type of ["keydown", "keyup"]) document.dispatchEvent(new KeyboardEvent(type, { key: "Enter", code: "Enter", bubbles: true })); };
      const screen = () => document.querySelector("[data-testid='ending-screen']");
      let t0 = performance.now(); let dialogPresses = 0;
      while (!screen() && performance.now() - t0 < 240000) { if (document.querySelector(".dialogue-overlay .dialogue-box")) { press(); dialogPresses += 1; await sleep(1000); } else await sleep(50); }
      if (!screen()) return { ending: false };
      t0 = performance.now(); const phases = []; let last = ""; let presses = 0; let nextTap = t0 + ${TAP_MS};
      while (!document.querySelector("[data-testid='ending-final-title']") && performance.now() - t0 < 120000) {
        const ph = screen()?.dataset.phase ?? "gone"; if (ph !== last) { phases.push({ phase: ph, atMs: Math.round(performance.now() - t0), presses }); last = ph; }
        if (performance.now() >= nextTap) { press(); presses += 1; nextTap += ${TAP_MS}; }
        await sleep(20);
      }
      return { ending: true, dialogPressesBefore: dialogPresses, toFinalMs: Math.round(performance.now() - t0), presses, final: !!document.querySelector("[data-testid='ending-final-title']"), phases };
    }` }], shot: true },
  ],
};
export default pacingEndingScenario;
