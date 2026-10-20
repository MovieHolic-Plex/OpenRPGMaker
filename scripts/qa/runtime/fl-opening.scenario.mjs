// 『첫사랑』 오프닝 컷 확인 — 새 게임 직후부터 1.6초 간격으로 찍는다.
const wait = (ms) => ({ kind: "pressUntilJs", key: "Shift", fn: `() => { const t = window.__flW ??= {}; const k = ${Math.random()}; t[k] ??= Date.now(); return Date.now() - t[k] > ${ms}; }`, maxPresses: 40, settleMs: 200 });
export default {
  id: "fl-opening",
  projectFixture: "scripts/qa/runtime/first-love-empty.json",
  query: { demo: "first-love" },
  viewport: { width: 960, height: 540 },
  beats: [
    { id: "title", note: "타이틀", ops: [{ kind: "waitFor", testid: "title-screen", state: "present", timeoutMs: 170000 }, wait(1500)], shot: true },
    { id: "t0", note: "새 게임 직후", ops: [{ kind: "key", key: "Enter" }, wait(600)], shot: true },
    ...Array.from({ length: 22 }, (_, i) => ({ id: `t${i + 1}`, note: `+${(i + 1) * 1.6}s`, ops: [wait(1600)], shot: true })),
  ],
};
