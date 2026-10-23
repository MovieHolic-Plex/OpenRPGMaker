// 『폴른 스타』 왕도 아스텔(fs_hub, fallenAstel.ts) — 성벽 고리·성문루·운하 수문·포고 광장·왕성을 출하 플레이어에서 1배로 둘러본다(오프닝 그림과 대조용).
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
  projectFixture: process.env.RES_FIXTURE ?? "/tmp/fs-town109.json",
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
    // 포고 넉 줄은 한 줄씩 넘겨 그 줄이 떠 있을 때 찍는다 — 대사창이 줄 사이에 잠깐 사라지면 closeDialogue 가 넉 줄을 한 번에
    // 넘겨 「포고 1」 샷이 이미 행진이 시작된 화면이었다(VQA r22·r23 이 그 샷을 포고 중 군중으로 읽었다).
    { id: "procl-1", note: "포고 1", ops: [{ kind: "waitForText", testid: "dialogue-box", text: "백성은 들어라", timeoutMs: 8000 }, { kind: "hold", dir: null, ms: 600 }], shot: true },
    { id: "procl-2", note: "포고 2", ops: [{ kind: "pressUntilText", key: "Enter", testid: "dialogue-box", text: "불경한 하늘의 물건", maxPresses: 6, settleMs: 300 }, { kind: "hold", dir: null, ms: 900 }], shot: true },
    { id: "procl-3", note: "포고 3", ops: [{ kind: "pressUntilText", key: "Enter", testid: "dialogue-box", text: "이단으로 다스린다", maxPresses: 6, settleMs: 300 }, { kind: "hold", dir: null, ms: 900 }], shot: true },
    { id: "procl-4", note: "포고 4 — 행진 시작", ops: [{ kind: "pressUntilText", key: "Enter", testid: "dialogue-box", text: "마찬가지다", maxPresses: 6, settleMs: 300 }, { kind: "hold", dir: null, ms: 900 }, ...closeDialogue()], shot: true },
    // 0.2초 간격(행진 겹침·사라짐을 프레임으로 본다 — 판정 규칙의 움직임 캡처).
    ...Array.from({ length: 70 }, (_, i) => ({ id: `march-${String(i + 1).padStart(2, "0")}`, note: "발렌 일행이 성문으로(0.2초 간격, 화면이 행렬을 따라간다)", ops: [{ kind: "hold", dir: null, ms: 200 }], shot: true })),
    { id: "march-done", note: "행진 끝", ops: [{ kind: "hold", dir: null, ms: 4000 }, ...closeDialogue()], shot: true },
    look("v-bridge", "아치 돌다리 · 운하 · 천문대 탑", 22, 25),
    look("v-tower", "천문대 탑 문 앞", 27, 25, "up"),
    look("v-gate", "성문루 · 원뿔 탑 · 포고 광장", 55, 19, "up"),
    look("v-plaza", "광장 남서 노점·우물", 42, 30),
    look("v-notch", "성벽 꺾임 · 원뿔 탑", 37, 21, "up"),
    look("v-nw-wall", "서북 성벽 · 운하 북 수문", 15, 17, "up"),
    look("v-west", "서쪽 성벽 · 북서 주택가", 4, 17),
    look("v-palace-street", "궁전 거리 · 왕성 뒤 성벽", 40, 33),
    look("v-quay", "선창 길 · 운하 · 왕성 서쪽 성벽", 25, 45),
    look("v-avenue", "왕실 대로 · 귀족 저택", 18, 40),
    look("v-chapel", "예배당 · 성 앞마당", 11, 61),
    look("v-castle", "도개교 · 왕성 정문", 44, 61, "up"),
    look("v-se", "남동 모서리 · 성 앞마당", 58, 61),
    // 집 문은 부딪혀 들어간다 — 들어가면 문을 등지고(위), 아래로 걸어 나오면 문 앞 칸에 문을 등지고(아래) 선다.
    ...[["inn", 8, 15, "별빛 여관"], ["apothecary", 41, 23, "약방(사고팔기)"], ["bakery", 14, 15, "빵집 뒤채"], ["stargazer", 30, 31, "늙은 별지기의 집"], ["lisa", 33, 21, "리사네 집"]].flatMap(([id, x, y, note]) => [
      { id: `in-${id}`, note: `${note} — 문에 부딪혀 들어감`, ops: [
        { kind: "teleport", mapId: "fs_hub", x, y: y + 1 }, { kind: "face", dir: "up" }, { kind: "hold", dir: null, ms: 400 },
        { kind: "hold", dir: "up", ms: 500 }, { kind: "hold", dir: null, ms: 1800 },
      ], shot: true },
      { id: `out-${id}`, note: `${note} — 나와서 문 앞`, ops: [{ kind: "hold", dir: "down", ms: 700 }, { kind: "hold", dir: null, ms: 1800 }], shot: true },
    ]),
    { id: "locked-door", note: "잠긴 집 문 — 한 줄", ops: [
      { kind: "teleport", mapId: "fs_hub", x: 36, y: 32 }, { kind: "face", dir: "up" }, { kind: "hold", dir: null, ms: 500 },
      { kind: "action" }, { kind: "waitFor", testid: "dialogue-box", state: "present", timeoutMs: 8000 }, { kind: "hold", dir: null, ms: 900 },
    ], shot: true },
    { id: "locked-close", note: "잠긴 문 대사 닫기", ops: [...closeDialogue()], shot: false },
    { id: "to-forest", note: "성문 통로 → 숲", ops: [
      { kind: "teleport", mapId: "fs_hub", x: 55, y: 13 }, { kind: "hold", dir: null, ms: 500 },
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
