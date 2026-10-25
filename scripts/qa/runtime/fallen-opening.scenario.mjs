// 『폴른 스타』 타이틀과 영화식 오프닝 여섯 컷(39초) — 컷마다 앞·가운데를 찍는다. 1배속 영상은 fallen-opening.capture.mjs.
const [vw, vh] = (process.env.RES_VP ?? "480x270").split("x").map(Number);
export default {
  id: "fallen-opening",
  projectFixture: process.env.RES_FIXTURE ?? ".omo/fs/v9.json",
  viewport: { width: vw, height: vh },
  beats: [
    { id: "title", note: "타이틀", ops: [{ kind: "waitFor", testid: "title-screen", state: "present", timeoutMs: 60000 }, { kind: "waitForAttr", testid: "title-screen", attr: "data-seq-state", value: "done", timeoutMs: 30000 }], expect: { testidPresent: ["title-screen"] }, shot: true },
    { id: "op1a", note: "새 게임 → 컷 1", ops: [
      // 타이틀 입장 연출 중의 Enter 는 연출만 건너뛴다 — 연출이 끝난 뒤 눌러 오프닝이 뜰 때까지 누른다.
      { kind: "waitForAttr", testid: "title-screen", attr: "data-seq-state", value: "done", timeoutMs: 30000 },
      { kind: "pressUntil", key: "Enter", testid: "cinematic-sequence", state: "present", maxPresses: 4, timeoutMs: 12000 },
      { kind: "waitFor", testid: "cinematic-sequence", state: "present", timeoutMs: 30000 },
      { kind: "hold", dir: null, ms: 2600 },
    ], shot: true },
    // 컷 길이(ms): 밤하늘 9000 · 갈라짐 3000 · 추락 6000 · 연기 6000 · 종 6000 · 제목 9000. 첫 셔터는 컷 1 의 2.6초.
    ...[[1, 9000], [2, 3000], [3, 6000], [4, 6000], [5, 6000], [6, 9000]].flatMap(([n, ms], i, all) => {
      const used = n === 1 ? 2600 : 0, mid = Math.round(ms / 2) - used;
      return [
        ...(n === 1 ? [] : [{ id: `op${n}a`, note: `컷 ${n} 앞`, ops: [{ kind: "hold", dir: null, ms: 400 }], shot: true }]),
        { id: `op${n}b`, note: `컷 ${n} 가운데`, ops: [{ kind: "hold", dir: null, ms: Math.max(100, mid - (n === 1 ? 0 : 400)) }], shot: true },
        { id: `op${n}c`, note: `컷 ${n} 끝`, ops: [{ kind: "hold", dir: null, ms: Math.max(100, ms - Math.round(ms / 2) - 100) }], shot: false },
      ];
    }),
  ],
};
