// 『첫사랑』 고백 정점 탐침 — 막차 승강장으로 바로 가서 고백 컷인을 찍는다(호감 FL_AFF, 기본 11).
const AFF = Number(process.env.FL_AFF ?? 11);
const DIALOG = "!!document.querySelector(\"[data-testid='dialogue-box']\")";
const CHOICES = "!!document.querySelector(\"[data-testid='runtime-choices']\")";
const hook = "() => { if (!window.__flLog) { window.__flLog = []; for (const k of ['error','warn']) { const o = console[k].bind(console); console[k] = (...a) => { window.__flLog.push(k + ': ' + a.map(String).join(' ').slice(0, 400)); o(...a); }; } window.addEventListener('error', (e) => window.__flLog.push('onerror: ' + e.message)); window.addEventListener('unhandledrejection', (e) => window.__flLog.push('rejection: ' + String(e.reason?.stack ?? e.reason).slice(0, 600))); } return true; }";
const textIs = (re) => `() => ${re}.test(document.querySelector("[data-testid='dialogue-box']")?.textContent ?? '')`;
export default {
  id: "fl-peak",
  projectFixture: "scripts/qa/runtime/first-love-empty.json",
  query: { demo: "first-love" },
  viewport: { width: 960, height: 540 },
  beats: [
    { id: "title", note: "타이틀", ops: [{ kind: "waitFor", testid: "title-screen", state: "present", timeoutMs: 170000 }, { kind: "evalToFile", out: "/tmp/fl-peak-hook.json", fn: hook }, { kind: "key", key: "Enter" }, { kind: "hold", dir: null, ms: 1500 }, { kind: "pressUntilJs", key: "Escape", fn: "() => !document.querySelector(\"[data-testid='cinematic-sequence']\")", maxPresses: 8, settleMs: 800 }, { kind: "waitForRuntime", timeoutMs: 120000 }], shot: false },
    { id: "jump", note: "막차 승강장", ops: [
      { kind: "pressUntilJs", key: "Enter", fn: `() => !(${DIALOG}) && !(${CHOICES})`, maxPresses: 40, settleMs: 400 },
      { kind: "evalToFile", out: "/tmp/fl-peak-set.json", fn: `() => { const d = window.__oprnDebug; d.setVariable('var_fl_jihu', ${AFF}); d.setVariable('var_fl_stage', 12); d.teleport('fl_platform_pm', 8, 7); return d.readState().currentMapId; }` },
      { kind: "waitFor", testid: "dialogue-box", state: "present", timeoutMs: 20000 },
      { kind: "hold", dir: null, ms: 800 },
    ], shot: true },
    { id: "c9", note: "마지막 선택", ops: [{ kind: "pressUntilJs", key: "Enter", fn: `() => ${CHOICES}`, maxPresses: 40, settleMs: 450 }], shot: true },
    { id: "pick", note: "먼저 말하기", ops: [{ kind: "hold", dir: null, ms: 300 }, { kind: "key", key: "Enter" }, { kind: "hold", dir: null, ms: 1200 }], shot: true },
    { id: "peak", note: "정점", ops: [{ kind: "pressUntilJs", key: "Enter", fn: textIs(AFF >= 6 ? "/10년 늦은 답장이에요/" : "/그 금요일에도. 지금도/"), maxPresses: 12, settleMs: 900 }, { kind: "hold", dir: null, ms: 900 }], shot: true },
    { id: "log", note: "콘솔", ops: [{ kind: "evalToFile", out: "/tmp/fl-peak-log.json", fn: "() => ({ log: window.__flLog, pics: window.__oprnDebug.readState().pictures ?? null, layer: document.querySelector('.picture-layer')?.outerHTML?.slice(0, 600) ?? null })" }], shot: false },
  ],
};
