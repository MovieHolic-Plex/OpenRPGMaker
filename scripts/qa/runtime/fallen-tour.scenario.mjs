// 『폴른 스타』 맵 순회 — 오프닝을 건너뛰고 맵마다 순간이동해 한 장씩 찍는다(그림·배치 점검용, 진행 검증은 fallen-audit).
const [vw, vh] = (process.env.RES_VP ?? "480x270").split("x").map(Number);
import { readFileSync } from "node:fs";
const stops = JSON.parse(process.env.TOUR_STOPS ?? readFileSync(process.env.TOUR_FILE ?? ".omo/fs/stops.json", "utf8"));
export default {
  id: "fallen-tour",
  projectFixture: process.env.RES_FIXTURE ?? ".omo/fs/v1.json",
  viewport: { width: vw, height: vh },
  beats: [
    { id: "boot", note: "새 게임 → 오프닝 건너뛰기", ops: [
      { kind: "key", key: "Enter" },
      { kind: "waitFor", testid: "cinematic-sequence", state: "present", timeoutMs: 30000 },
      { kind: "hold", dir: null, ms: 600 },
      { kind: "pressUntil", key: "Escape", testid: "cinematic-sequence", state: "absent", maxPresses: 6 },
      { kind: "waitForRuntime", timeoutMs: 120000 },
      { kind: "hold", dir: null, ms: 1500 },
    ], shot: true },
    { id: "intro", note: "시작 컷신 넘기기", ops: [
      // 컷신은 대사 사이에 말풍선이 잠깐 사라진다 — 쉬었다가 여러 번 넘긴다.
      ...[0, 1, 2, 3].flatMap(() => [
        { kind: "pressUntil", key: "Enter", testid: "dialogue-box", state: "absent", maxPresses: 30 },
        { kind: "hold", dir: null, ms: 1500 },
      ]),
    ], shot: true },
    ...stops.map((s, i) => ({ id: `t${String(i + 1).padStart(2, "0")}-${s.name}`, note: s.name, ops: [
      { kind: "teleport", mapId: s.mapId, x: s.x, y: s.y },
      { kind: "hold", dir: null, ms: 1800 },
    ], shot: true })),
  ],
};
