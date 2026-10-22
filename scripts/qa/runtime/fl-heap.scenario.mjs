// 데모별 타이틀 시점 JS 힙 비교(첫사랑 감사용). HEAP_DEMO=first-love|chrono-bell
const demo = process.env.HEAP_DEMO ?? "first-love";
export default {
  id: `fl-heap-${demo}`,
  projectFixture: "scripts/qa/runtime/first-love-empty.json",
  query: { demo },
  viewport: { width: 960, height: 540 },
  beats: [
    { id: "title", note: "타이틀", ops: [{ kind: "waitFor", testid: "title-screen", state: "present", timeoutMs: 180000 }], shot: true },
    { id: "heap", note: "힙", ops: [{ kind: "evalToFile", out: `/tmp/fl-heap-${demo}.json`, fn: "() => ({ heapMB: Math.round(performance.memory.usedJSHeapSize/1048576), t: Math.round(performance.now()) })" }], shot: false },
  ],
};
