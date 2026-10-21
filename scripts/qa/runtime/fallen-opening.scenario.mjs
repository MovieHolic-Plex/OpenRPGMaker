// 『폴른 스타』 타이틀과 오프닝 다섯 컷 — 컷마다 두 번(자막 첫 줄·둘째 줄 무렵) 찍는다.
const [vw, vh] = (process.env.RES_VP ?? "480x270").split("x").map(Number);
const SHOT_MS = 7000;
export default {
  id: "fallen-opening",
  projectFixture: process.env.RES_FIXTURE ?? ".omo/fs/v9.json",
  viewport: { width: vw, height: vh },
  beats: [
    { id: "title", note: "타이틀", ops: [{ kind: "waitFor", testid: "title-screen", state: "present", timeoutMs: 60000 }], expect: { testidPresent: ["title-screen"] }, shot: true },
    { id: "op1a", note: "새 게임 → 컷 1", ops: [
      // 타이틀 입장 연출 중의 Enter 는 연출만 건너뛴다 — 연출이 끝난 뒤 눌러 오프닝이 뜰 때까지 누른다.
      { kind: "waitForAttr", testid: "title-screen", attr: "data-seq-state", value: "done", timeoutMs: 30000 },
      { kind: "pressUntil", key: "Enter", testid: "cinematic-sequence", state: "present", maxPresses: 4, timeoutMs: 12000 },
      { kind: "waitFor", testid: "cinematic-sequence", state: "present", timeoutMs: 30000 },
      { kind: "hold", dir: null, ms: 2600 },
    ], shot: true },
    ...[1, 2, 3, 4, 5].flatMap((n) => [
      ...(n === 1 ? [] : [{ id: `op${n}a`, note: `컷 ${n} 앞`, ops: [{ kind: "hold", dir: null, ms: 2600 }], shot: true }]),
      { id: `op${n}b`, note: `컷 ${n} 뒤`, ops: [{ kind: "hold", dir: null, ms: 2700 }], shot: true },
      { id: `op${n}c`, note: `컷 ${n} 끝`, ops: [{ kind: "hold", dir: null, ms: SHOT_MS - 2600 - 2700 - 100 }], shot: false },
    ]),
  ],
};
