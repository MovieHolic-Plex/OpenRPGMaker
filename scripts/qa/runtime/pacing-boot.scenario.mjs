// 타이틀 「새 게임」 → 필드가 보일 때까지 단계별 시간(2026-10-29 vm3 flash jrpg 판정 「게임 시작 뒤 8~10초 로딩 화면」).
//
//   QA_OUT=<폴더> node scripts/runtime-qa.mjs --scenario pacing-boot --project <web.json> --netns
//
// 1-boot : Enter 시각을 0 으로 로딩 막의 단계(data-stage)·진행 막대가 바뀐 시각, 막이 사라진 시각, 첫 대사창/오프닝이 뜬 시각.
const OUT = process.env.QA_OUT ?? "/tmp/pacing-boot";
/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const pacingBootScenario = {
  id: "pacing-boot",
  beats: [
    { id: "title", note: "타이틀 대기", ops: [
      { kind: "waitFor", testid: "title-screen", state: "present", timeoutMs: 120000 },
      { kind: "evalToFile", out: `${OUT}/0-idle.json`, fn: "async () => { await new Promise((r) => setTimeout(r, 1500)); return { idle: 1500 }; }" },
      { kind: "evalToFile", out: `${OUT}/0-arm.json`, fn: `() => {
        const log = []; window.__qaBoot = log; let last = ""; let armed = false;
        const tick = () => {
          const t0 = window.__qaBootT0; if (t0 === undefined) return;
          const ov = document.querySelector("[data-testid='play-loading-overlay']");
          const stage = ov ? (ov.querySelector("[data-testid='play-loading-stage']")?.dataset.stage ?? "?") + " " + (ov.querySelector("[data-testid='play-loading-bar-fill']")?.style.width ?? "") : "none";
          const title = !!document.querySelector("[data-testid='title-screen']");
          const dlg = !!document.querySelector(".dialogue-overlay .dialogue-box");
          const cine = /건너뛰기/.test(document.body.innerText);
          const tag = (title ? "title|" : "") + stage + (dlg ? "|dialogue" : "") + (cine ? "|cinematic" : "");
          if (tag !== last) { log.push({ atMs: Math.round(performance.now() - t0), tag }); last = tag; }
        };
        window.__qaBootTimer = setInterval(tick, 25);
        document.addEventListener("keydown", (e) => { if (!armed && e.key === "Enter") { armed = true; window.__qaBootT0 = performance.now(); } }, { capture: true });
        return { armed: true };
      }` },
    ] },
    { id: "t3s", note: "Enter 뒤 3초 화면", ops: [
      ...(process.env.QA_PROFILE ? [{ kind: "cpuProfileStart" }] : []),
      { kind: "key", key: "Enter" },
      // QA_SKIP_OPENING=1: 판정자처럼 오프닝을 바로 넘긴다 — 그 뒤 남은 로딩 막을 그대로 보게 된다.
      ...(process.env.QA_SKIP_OPENING ? [{ kind: "evalToFile", out: `${OUT}/0-skip.json`, fn: "async () => { await new Promise((r) => setTimeout(r, 2500)); return 2500; }" }, { kind: "key", key: "Escape" }, { kind: "key", key: "Escape" }] : []),
      { kind: "evalToFile", out: `${OUT}/0-t3.json`, fn: "async () => { await new Promise((r) => setTimeout(r, 3000)); return 3000; }" },
    ], shot: true },
    { id: "t8s", note: "Enter 뒤 8초 화면", ops: [
      { kind: "evalToFile", out: `${OUT}/0-t8.json`, fn: "async () => { await new Promise((r) => setTimeout(r, 5000)); return 8000; }" },
    ], shot: true },
    { id: "boot", note: "Enter → 필드", ops: [
      { kind: "waitForRuntime", timeoutMs: 240000 },
      { kind: "hold", dir: null, ms: 4000 },
      { kind: "evalToFile", out: `${OUT}/1-boot.json`, fn: "() => { clearInterval(window.__qaBootTimer); return { log: window.__qaBoot, create: window.__qaCreate, boot: window.__oprnPlayBootLog?.()?.map((d) => ({ stage: d.stage, ms: Math.round(d.elapsedMs), detail: d.detail })), images: (() => { const r = performance.getEntriesByType('resource').filter((e) => /\\.(png|webp|jpe?g)(\\?|$)/.test(e.name)); return { count: r.length, kB: Math.round(r.reduce((a, e) => a + (e.decodedBodySize || e.encodedBodySize || 0), 0) / 1024), top: r.sort((a, b) => (b.decodedBodySize || 0) - (a.decodedBodySize || 0)).slice(0, 8).map((e) => ({ name: e.name.split('/').slice(-1)[0].slice(0, 60), kB: Math.round((e.decodedBodySize || 0) / 1024), ms: Math.round(e.duration) })) }; })() }; }" },
      ...(process.env.QA_PROFILE ? [{ kind: "cpuProfileStop", out: `${OUT}/2-profile.json`, raw: `${OUT}/2-boot.cpuprofile` }] : []),
    ], shot: true },
  ],
};
