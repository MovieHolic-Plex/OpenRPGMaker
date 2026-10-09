// 높이 지형(map.relief) 게임 화면 증거 시나리오 (출하 플레이어 경로).
//
// 픽스처: scripts/qa/runtime/relief-fixture.mts (판타지 500장 f5-jungle-cliffTerrace-1 + NPC 한 명)
//   node_modules/.bin/vite-node --script scripts/qa/runtime/relief-fixture.mts --out .omo/runtime-qa/relief.json
//   npm run qa:runtime -- --scenario relief --project .omo/runtime-qa/relief.json --out verify-shots/relief-runtime
//
// 경사로는 x 18~19, y 18~23 (북쪽 오르막, 0단 → 5단 대지). 대지 남쪽 벽은 y 18 줄.

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const reliefScenario = {
  id: "relief",
  beats: [
    {
      id: "ramp-foot",
      note: "경사로 발치(0단). 북쪽 5단 대지의 벽과 경사로가 보인다",
      ops: [
        { kind: "key", key: "Enter" },
        { kind: "waitFor", testid: "title-screen", state: "absent" },
        { kind: "waitForRuntime" },
        { kind: "teleport", mapId: "f5-jungle-cliffTerrace-1", x: 18, y: 24 },
        { kind: "waitForPosition", mapId: "f5-jungle-cliffTerrace-1", x: 18, y: 24, timeoutMs: 15000 },
        { kind: "face", dir: "up" },
      ],
      expect: { mapId: "f5-jungle-cliffTerrace-1", x: 18, y: 24 },
      shot: true,
    },
    {
      id: "ramp-mid",
      note: "경사로 중간 — 주인공이 경사면 높이만큼 떠서 선다",
      ops: [
        { kind: "playerRoute", moves: [{ kind: "move", dir: "up" }, { kind: "move", dir: "up" }, { kind: "move", dir: "up" }] },
        { kind: "waitForPosition", mapId: "f5-jungle-cliffTerrace-1", x: 18, y: 21, timeoutMs: 15000 },
      ],
      expect: { mapId: "f5-jungle-cliffTerrace-1", x: 18, y: 21 },
      shot: true,
    },
    {
      id: "plateau-top",
      note: "경사로를 다 올라 5단 대지 위(18, 16). 주인공이 대지 윗면에 서 있다",
      ops: [
        { kind: "playerRoute", moves: [{ kind: "move", dir: "up" }, { kind: "move", dir: "up" }, { kind: "move", dir: "up" }, { kind: "move", dir: "up" }, { kind: "move", dir: "up" }] },
        { kind: "waitForPosition", mapId: "f5-jungle-cliffTerrace-1", x: 18, y: 16, timeoutMs: 15000 },
      ],
      expect: { mapId: "f5-jungle-cliffTerrace-1", x: 18, y: 16 },
      shot: true,
    },
    {
      id: "cliff-edge-blocked",
      note: "대지 남쪽 끝(21, 18)에서 남쪽으로 — 5단 벼랑이라 한 칸도 못 내려간다",
      ops: [
        { kind: "teleport", mapId: "f5-jungle-cliffTerrace-1", x: 21, y: 18 },
        { kind: "waitForPosition", mapId: "f5-jungle-cliffTerrace-1", x: 21, y: 18, timeoutMs: 15000 },
        { kind: "hold", dir: "down", ms: 700 },
      ],
      expect: { mapId: "f5-jungle-cliffTerrace-1", x: 21, y: 18 },
      shot: true,
    },
    {
      id: "cliff-foot-blocked",
      note: "벼랑 발치(24, 19)에서 북쪽으로 — 벽에 막힌다",
      ops: [
        { kind: "teleport", mapId: "f5-jungle-cliffTerrace-1", x: 24, y: 19 },
        { kind: "waitForPosition", mapId: "f5-jungle-cliffTerrace-1", x: 24, y: 19, timeoutMs: 15000 },
        { kind: "hold", dir: "up", ms: 700 },
      ],
      expect: { mapId: "f5-jungle-cliffTerrace-1", x: 24, y: 19 },
      shot: true,
    },
    {
      id: "behind-south-mound",
      note: "0단(37, 28) — 바로 남쪽 줄 29~ 이 둔덕(1단, 가운데 2단). NPC(35, 28)는 둔덕 윗면 뒤에 반쯤 가린다",
      ops: [
        { kind: "teleport", mapId: "f5-jungle-cliffTerrace-1", x: 37, y: 28 },
        { kind: "waitForPosition", mapId: "f5-jungle-cliffTerrace-1", x: 37, y: 28, timeoutMs: 15000 },
        { kind: "face", dir: "down" },
        { kind: "hold", dir: "down", ms: 700 },
      ],
      expect: { mapId: "f5-jungle-cliffTerrace-1", x: 37, y: 28 },
      shot: true,
    },
  ],
};
