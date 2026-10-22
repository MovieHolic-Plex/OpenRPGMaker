// jp_city 거리 계단 — 출하 플레이어에서 육교 계단을 올라 상판을 건너 내려오고, 옆 계단으로 단상에 올라 반대쪽으로 내려온다(2026-10-22).
//   node node_modules/vite-node/dist/cli.mjs --script scripts/qa/runtime/jp-street-stairs-fixture.mts > /tmp/jps/vid/project.json
//   QA_RECORD_VIDEO=/tmp/jps/vid node scripts/runtime-qa.mjs --scenario jp-street-stairs --project /tmp/jps/vid/project.json --netns
const M = "jp-street-stairs";
// 걸음은 플레이어 이동 경로로 한 칸씩(키를 누르고 떼면 마지막 칸을 넘어간다). 막힘 확인만 키를 누른다.
const D = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
let at = [11, 18];
const go = (dir, x, y, ms = 15000) => {
  const steps = Math.abs(x - at[0]) + Math.abs(y - at[1]);
  if (x - at[0] !== D[dir][0] * steps || y - at[1] !== D[dir][1] * steps) throw new Error(`go ${dir} ${x},${y} 가 직선이 아니다`);
  at = [x, y];
  return [
    { kind: "playerRoute", moves: Array.from({ length: steps }, () => ({ kind: "move", dir })) },
    { kind: "waitForPosition", mapId: M, x, y, timeoutMs: ms },
  ];
};
const blocked = (dir) => [{ kind: "hold", dir, ms: 700 }, { kind: "hold", dir: null, ms: 300 }];
export default {
  id: "jp-street-stairs",
  beats: [
    { id: "start", note: "육교 계단(동쪽 상판) 앞 칸 (11,16) 에 선다 — 남쪽에서 들어선다", ops: [
      { kind: "key", key: "Enter" },
      { kind: "waitFor", testid: "title-screen", state: "absent" },
      { kind: "waitForRuntime" },
      { kind: "hold", dir: null, ms: 1200 },
      ...go("up", 11, 16),
    ], expect: { mapId: M, x: 11, y: 16 }, shot: true },
    { id: "climb", note: "북쪽을 보고 13단을 올라 층계참 (11,10) 에 선다", ops: [...go("up", 11, 10)], expect: { mapId: M, x: 11, y: 10 }, shot: true },
    { id: "landing-blocked-north", note: "층계참 먼 쪽 난간(0줄)은 막혀 있다", ops: [...go("up", 11, 9), ...blocked("up")], expect: { mapId: M, x: 11, y: 9 } },
    { id: "deck", note: "동쪽으로 상판을 건너 반대편 층계참 (20,9) 까지", ops: [...go("right", 20, 9)], expect: { mapId: M, x: 20, y: 9 }, shot: true },
    { id: "descend", note: "남쪽을 보고 서쪽 계단을 내려와 앞 칸 (20,16) 에 선다", ops: [...go("down", 20, 16)], expect: { mapId: M, x: 20, y: 16 }, shot: true },
    { id: "side-blocked", note: "계단 칸에서는 옆으로 못 나간다 — (20,13) 에서 오른쪽을 눌러도 그대로", ops: [
      ...go("up", 20, 13), ...blocked("right")], expect: { mapId: M, x: 20, y: 13 } },
    { id: "to-side-stair", note: "옆 계단 서쪽 바깥 칸 (21,17) 으로 간다", ops: [
      ...go("down", 20, 16), ...go("down", 20, 18), ...go("right", 21, 18), ...go("up", 21, 17)], expect: { mapId: M, x: 21, y: 17 }, shot: true },
    { id: "side-climb", note: "동쪽을 보고 옆 계단을 올라 단상 마루 (26,17) 로", ops: [...go("right", 26, 17)], expect: { mapId: M, x: 26, y: 17 }, shot: true },
    { id: "stage-cross", note: "단상을 건너 동쪽 옆 계단으로 내려와 바깥 칸 (32,17) 에 선다", ops: [...go("right", 32, 17), { kind: "hold", dir: null, ms: 1200 }],
      expect: { mapId: M, x: 32, y: 17 }, shot: true },
    { id: "ladder", note: "사다리 앞 칸 (10,7) 에서 위로 — 맨 아래 칸 (10,6) 을 밟는다", ops: [
      { kind: "teleport", mapId: M, x: 10, y: 8 }, { kind: "waitForPosition", mapId: M, x: 10, y: 8 }, ...(at = [10, 8], []),
      ...go("up", 10, 6), { kind: "hold", dir: null, ms: 1200 }], expect: { mapId: M, x: 10, y: 6 }, shot: true },
  ],
};
