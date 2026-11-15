// 언덕 뒤 가려지는 칸으로 걸어 들어갈 수 없는지 출하 플레이어에서 본다(2026-11-15 «플레이어가 걸어 들어가 안 보이게 되는 칸» 결함).
// 좌표 파일(RUNTIME_QA_POINTS): [{ mapId, id, from: {x, y}, dir: "down", stay: true } | { mapId, id, from, dir, to: {x, y} }]
//   stay — from 에 서서 dir 쪽으로 1.2초 밀어도 제자리(뒤 비탈 둑이 막는다). to — 같은 자리에서 다른 쪽으로는 걸어진다(키 입력이 먹는지 견주는 줄).
import { readFileSync } from "node:fs";

const points = JSON.parse(readFileSync(process.env.RUNTIME_QA_POINTS ?? "/tmp/hill-behind/points.json", "utf8"));
const beats = [{ id: "boot", note: "타이틀 넘기기", ops: [{ kind: "key", key: "Enter" }, { kind: "waitFor", testid: "title-screen", state: "absent" }, { kind: "waitForRuntime" }], shot: false }];
points.forEach((p, i) => {
  const start = [
    { kind: "teleport", mapId: p.mapId, x: p.from.x, y: p.from.y },
    { kind: "waitForPosition", mapId: p.mapId, x: p.from.x, y: p.from.y, timeoutMs: 15000 },
    { kind: "hold", dir: null, ms: 400 },
  ];
  if (p.stay) beats.push({
    id: `stay-${i}`, note: `${p.mapId} ${p.id}: (${p.from.x},${p.from.y}) 에서 ${p.dir} 로 밀어도 제자리`,
    ops: [...start, { kind: "dir", dir: p.dir }, { kind: "hold", dir: p.dir, ms: 1200 }, { kind: "dir", dir: null }, { kind: "hold", dir: null, ms: 300 }],
    expect: { mapId: p.mapId, x: p.from.x, y: p.from.y }, shot: true,
  });
  else beats.push({
    id: `walk-${i}`, note: `${p.mapId} ${p.id}: (${p.from.x},${p.from.y}) → (${p.to.x},${p.to.y})`,
    ops: [...start, { kind: "dir", dir: p.dir }, { kind: "waitForPosition", mapId: p.mapId, x: p.to.x, y: p.to.y, timeoutMs: 8000 }, { kind: "dir", dir: null }, { kind: "hold", dir: null, ms: 300 }],
    expect: { mapId: p.mapId, x: p.to.x, y: p.to.y }, shot: true,
  });
});
/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const hillBehindScenario = { id: "hill-behind", beats };
