// place_storage_chest(서랍장) vs place_chest(보물상자) + place_savepoint(크리스탈) 검증.
// 픽스처: scripts/qa/runtime/storage-savepoint-fixture.mts
//   npx vite-node --script scripts/qa/runtime/storage-savepoint-fixture.mts --out /tmp/storage-savepoint.json
//   npm run qa:runtime -- --scenario storage-savepoint --project /tmp/storage-savepoint.json
// 시작 (14,18) 북쪽: 세이브 (13,17) · 보관함 (14,17) · 보물상자 (15,17).

export const storageSavepointScenario = {
  id: "storage-savepoint",
  beats: [
    {
      id: "field-start",
      note: "새 게임 → 시작 지점. 위쪽에 보관함(서랍장)·왼쪽 크리스탈·오른쪽 보물상자가 나란히 보인다",
      ops: [
        { kind: "key", key: "Enter" },
        { kind: "waitFor", testid: "title-screen", state: "absent" },
        { kind: "waitForRuntime" },
        { kind: "seed", seed: 1 },
        { kind: "face", dir: "up" },
      ],
      expect: { mapId: "map_lantern_village", x: 14, y: 18 },
      shot: true,
    },
    {
      id: "save-and-storage",
      note: "왼쪽으로 한 칸 — 크리스탈과 서랍장을 한 화면에",
      ops: [
        { kind: "teleport", mapId: "map_lantern_village", x: 13, y: 18 },
        { kind: "waitForPosition", mapId: "map_lantern_village", x: 13, y: 18 },
        { kind: "face", dir: "up" },
      ],
      expect: { mapId: "map_lantern_village", x: 13, y: 18 },
      shot: true,
    },
    {
      id: "chest-near",
      note: "보물상자 앞 — object1 상자 그래픽(보관함과 다른 그림)",
      ops: [
        { kind: "teleport", mapId: "map_lantern_village", x: 15, y: 18 },
        { kind: "waitForPosition", mapId: "map_lantern_village", x: 15, y: 18 },
        { kind: "face", dir: "up" },
      ],
      expect: { mapId: "map_lantern_village", x: 15, y: 18 },
      shot: true,
    },
    {
      id: "storage-near",
      note: "보관함 앞 — 서랍장 그래픽 근접샷",
      ops: [
        { kind: "teleport", mapId: "map_lantern_village", x: 14, y: 18 },
        { kind: "waitForPosition", mapId: "map_lantern_village", x: 14, y: 18 },
        { kind: "face", dir: "up" },
      ],
      expect: { mapId: "map_lantern_village", x: 14, y: 18 },
      shot: true,
    },
    {
      id: "open-storage",
      note: "보관함 조사 → openChest 오버레이(판정점: chest-scene)",
      ops: [
        { kind: "action" },
        { kind: "waitFor", testid: "chest-scene", state: "present", timeoutMs: 15_000 },
      ],
      expect: { testidPresent: ["chest-scene", "chest-status"] },
      shot: true,
    },
    {
      id: "storage-ui",
      note: "보관함 UI가 열린 채로 한 프레임 더 — 슬롯/상태 가독",
      ops: [
        { kind: "waitFor", testid: "chest-status", state: "present", timeoutMs: 5_000 },
      ],
      expect: { testidPresent: ["chest-scene", "chest-status"] },
      shot: true,
    },
    {
      id: "close-storage",
      note: "오버레이를 닫고 필드로 — 닫힘 뒤에도 에러 없음",
      ops: [
        { kind: "key", key: "Escape" },
        { kind: "waitFor", testid: "chest-scene", state: "absent", timeoutMs: 15_000 },
      ],
      expect: { mapId: "map_lantern_village" },
      shot: true,
    },
    {
      id: "savepoint-near",
      note: "세이브 크리스탈 앞으로 이동 — 크리스탈 그래픽 근접샷",
      ops: [
        { kind: "teleport", mapId: "map_lantern_village", x: 13, y: 18 },
        { kind: "waitForPosition", mapId: "map_lantern_village", x: 13, y: 18 },
        { kind: "face", dir: "up" },
      ],
      expect: { mapId: "map_lantern_village", x: 13, y: 18 },
      shot: true,
    },
    {
      id: "touch-savepoint",
      note: "크리스탈 조사 → 체크포인트 저장 + 「기록했다」 대사(판정점)",
      ops: [
        { kind: "action" },
        { kind: "waitFor", testid: "dialogue-box", state: "present", timeoutMs: 15_000 },
      ],
      expect: { testidPresent: ["dialogue-box"] },
      shot: true,
    },
    {
      id: "savepoint-done",
      note: "대사를 닫은 뒤 — 세이브 뒤 필드 복귀",
      ops: [
        { kind: "pressUntil", key: "Enter", testid: "dialogue-box", state: "absent", maxPresses: 6 },
      ],
      expect: { mapId: "map_lantern_village" },
      shot: true,
    },
  ],
};

export default storageSavepointScenario;
