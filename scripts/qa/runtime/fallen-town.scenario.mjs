// 『폴른 스타』 왕도(fs_hub) — 성벽 고리·성문루·운하 수문·광장을 출하 플레이어에서 1배로 둘러본다(오프닝 그림과 대조용).
// 포고가 끝나면 발렌 일행이 광장 북쪽 성문 통로로 걸어 나가는 것도 0.4초 간격으로 찍는다.
//   RES_WHICH=fallen npx --no-install tsx --import ./tiledata/jp-city/refs/css-stub.mjs scripts/qa/runtime/res480-fixture.mts > /tmp/fs.json
//   RES_FIXTURE=/tmp/fs.json npm run qa:runtime -- --scenario fallen-town
const [vw, vh] = (process.env.RES_VP ?? "480x270").split("x").map(Number);

const closeDialogue = (max = 20) => [
  { kind: "pressUntil", key: "Enter", testid: "dialogue-box", state: "absent", maxPresses: max, timeoutMs: 900 },
  { kind: "hold", dir: null, ms: 400 },
];
const look = (id, note, x, y, dir = "down") => ({
  id, note, ops: [{ kind: "face", dir }, { kind: "teleport", mapId: "fs_hub", x, y }, { kind: "hold", dir: null, ms: 900 }], shot: true,
});

export default {
  id: "fallen-town",
  projectFixture: process.env.RES_FIXTURE ?? "/tmp/fs-town62.json",
  viewport: { width: vw, height: vh },
  beats: [
    { id: "title", note: "타이틀", ops: [
      { kind: "waitFor", testid: "title-screen", state: "present", timeoutMs: 60000 },
      { kind: "waitForAttr", testid: "title-screen", attr: "data-seq-state", value: "done", timeoutMs: 30000 },
    ], shot: true },
    { id: "boot", note: "새 게임 → 오프닝 건너뛰기 → 광장 포고", ops: [
      { kind: "pressUntil", key: "Enter", testid: "cinematic-sequence", state: "present", maxPresses: 4, timeoutMs: 12000 },
      { kind: "hold", dir: null, ms: 600 },
      { kind: "pressUntil", key: "Escape", testid: "cinematic-sequence", state: "absent", maxPresses: 6 },
      { kind: "waitForRuntime", timeoutMs: 120000 },
      { kind: "hold", dir: null, ms: 1500 },
    ], shot: true },
    { id: "procl-1", note: "포고 1", ops: [...closeDialogue()], shot: true },
    { id: "procl-2", note: "포고 2", ops: [...closeDialogue()], shot: true },
    { id: "procl-3", note: "포고 3", ops: [...closeDialogue()], shot: true },
    { id: "procl-4", note: "포고 4 — 행진 시작", ops: [...closeDialogue()], shot: true },
    ...Array.from({ length: 10 }, (_, i) => ({ id: `march-${i + 1}`, note: "발렌 일행이 성문으로(화면이 행렬을 따라간다)", ops: [{ kind: "hold", dir: null, ms: 1400 }], shot: true })),
    { id: "march-done", note: "행진 끝", ops: [{ kind: "hold", dir: null, ms: 4000 }, ...closeDialogue()], shot: true },
    look("v-bridge", "아치 돌다리 · 운하 · 천문대 탑", 21, 21),
    look("v-tower", "천문대 탑 문 앞", 24, 21, "up"),
    look("v-gate", "성문루 · 성문 광장", 48, 19, "up"),
    look("v-plaza", "옛 광장(우물·노점)", 42, 26),
    look("v-ne-wall", "동북 성벽 · 꺾이는 원탑", 35, 17, "up"),
    look("v-nw-wall", "서북 성벽 · 운하 북 수문", 15, 5, "up"),
    look("v-west", "서쪽 성벽 · 주택가", 4, 22),
    look("v-sw", "남서 모서리 원탑 · 과수원", 6, 43),
    look("v-bridge2", "둘째 아치 다리", 16, 34),
    look("v-south-gate", "남 성벽 운하 수문", 21, 40),
    look("v-se", "남동 모서리 원탑 · 남쪽 거리", 47, 43),
    look("v-east", "동쪽 성벽", 53, 32, "right"),
    // 집 문은 부딪혀 들어간다 — 들어가면 문을 등지고(위), 아래로 걸어 나오면 문 앞 칸에 문을 등지고(아래) 선다.
    ...[["inn", 50, 31, "별빛 여관"], ["apothecary", 31, 31, "약방(사고팔기)"], ["bakery", 13, 11, "빵집 뒤채"], ["stargazer", 4, 20, "늙은 별지기의 집"], ["lisa", 32, 20, "리사네 집"]].flatMap(([id, x, y, note]) => [
      { id: `in-${id}`, note: `${note} — 문에 부딪혀 들어감`, ops: [
        { kind: "teleport", mapId: "fs_hub", x, y: y + 1 }, { kind: "face", dir: "up" }, { kind: "hold", dir: null, ms: 400 },
        { kind: "hold", dir: "up", ms: 500 }, { kind: "hold", dir: null, ms: 1800 },
      ], shot: true },
      { id: `out-${id}`, note: `${note} — 나와서 문 앞`, ops: [{ kind: "hold", dir: "down", ms: 700 }, { kind: "hold", dir: null, ms: 1800 }], shot: true },
    ]),
    { id: "locked-door", note: "잠긴 집 문 — 한 줄", ops: [
      { kind: "teleport", mapId: "fs_hub", x: 7, y: 12 }, { kind: "face", dir: "up" }, { kind: "hold", dir: null, ms: 500 },
      { kind: "action" }, { kind: "waitFor", testid: "dialogue-box", state: "present", timeoutMs: 8000 }, { kind: "hold", dir: null, ms: 900 },
    ], shot: true },
    { id: "locked-close", note: "잠긴 문 대사 닫기", ops: [...closeDialogue()], shot: false },
    { id: "to-forest", note: "성문 통로 → 숲", ops: [
      { kind: "teleport", mapId: "fs_hub", x: 48, y: 16 }, { kind: "hold", dir: null, ms: 500 },
      { kind: "hold", dir: "up", ms: 700 }, { kind: "hold", dir: null, ms: 1500 },
    ], shot: true },
    { id: "crash-site", note: "숲 추락지 — 구덩이·관·연기", ops: [
      { kind: "teleport", mapId: "fs_forest", x: 15, y: 9 }, { kind: "face", dir: "up" }, { kind: "hold", dir: null, ms: 2200 },
    ], shot: true },
    { id: "back-to-town", note: "숲 → 성문 앞 도착(성문을 등지고)", ops: [
      { kind: "teleport", mapId: "fs_forest", x: 15, y: 38 }, { kind: "hold", dir: null, ms: 500 },
      { kind: "hold", dir: "down", ms: 700 }, { kind: "hold", dir: null, ms: 1500 },
    ], shot: true },
  ],
};
