// bbox 언덕 마을의 절벽 깎은 길(경사로·계단·겹친 계단)을 출하 플레이어에서 걸어 오르내린다.
// 픽스처·좌표: scripts/qa/runtime/bbox-ramps-fixture.mts (좌표 파일 RUNTIME_QA_POINTS, 기본 /tmp/bbox-ramps/hill.json.points.json)
// 길마다: 아래 입구로 순간이동 → 위로 걸어 위 출구에 닿는다(찍음) → 아래로 걸어 입구로 돌아온다(찍음).
import { readFileSync } from "node:fs";

const walks = JSON.parse(readFileSync(process.env.RUNTIME_QA_POINTS ?? "/tmp/bbox-ramps/hill.json.points.json", "utf8"));
const beats = [{ id: "boot", note: "타이틀 넘기기", ops: [{ kind: "key", key: "Enter" }, { kind: "waitFor", testid: "title-screen", state: "absent" }, { kind: "waitForRuntime" }], shot: false }];
walks.forEach((w, i) => {
  beats.push({
    id: `up-${i}`, note: `${w.mapId} ${w.id}: (${w.x},${w.from}) → 위 (${w.x},${w.to})`,
    ops: [
      { kind: "teleport", mapId: w.mapId, x: w.x, y: w.from },
      { kind: "waitForPosition", mapId: w.mapId, x: w.x, y: w.from, timeoutMs: 15000 },
      { kind: "hold", dir: null, ms: 500 },
      { kind: "dir", dir: "up" },
      { kind: "waitForPosition", mapId: w.mapId, x: w.x, y: w.to, timeoutMs: 12000 },
      { kind: "dir", dir: null },
      { kind: "hold", dir: null, ms: 400 },
    ],
    expect: { mapId: w.mapId, x: w.x, y: w.to }, shot: true,
  });
  beats.push({
    id: `down-${i}`, note: `${w.mapId} ${w.id}: 다시 아래 (${w.x},${w.from})`,
    ops: [
      { kind: "dir", dir: "down" },
      { kind: "waitForPosition", mapId: w.mapId, x: w.x, y: w.from, timeoutMs: 12000 },
      { kind: "dir", dir: null },
      { kind: "hold", dir: null, ms: 400 },
    ],
    expect: { mapId: w.mapId, x: w.x, y: w.from }, shot: true,
  });
});
/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const bboxRampsScenario = { id: "bbox-ramps", beats };
