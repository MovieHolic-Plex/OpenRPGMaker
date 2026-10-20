// 기본 해상도(480×270·배율 1) UI 순회 캡처: 타이틀 → 필드 → ESC 메뉴 → 대화 → 선택지 → 상점 → 저장 → 측면 전투.
// 픽스처: scripts/qa/runtime/res480-fixture.mts (RES_WHICH=ui). 창 크기는 RES_VP=1920x1080 | 2560x1440.
//   RES_FIXTURE=.omo/runtime-qa/res/ui-new480.json RES_VP=2560x1440 npm run qa:runtime -- --scenario res480-ui --out verify-shots/res480/ui-480-qhd
const [vw, vh] = (process.env.RES_VP ?? "1920x1080").split("x").map(Number);
const key = (k, times = 1) => ({ kind: "key", key: k, times });
const present = (testid, timeoutMs = 30_000) => ({ kind: "waitFor", testid, state: "present", timeoutMs });
const absent = (testid, timeoutMs = 30_000) => ({ kind: "waitFor", testid, state: "absent", timeoutMs });

export default {
  id: "res480-ui",
  projectFixture: process.env.RES_FIXTURE ?? ".omo/runtime-qa/res/ui-new480.json",
  viewport: { width: vw, height: vh },
  beats: [
    { id: "title", note: "타이틀", ops: [present("title-screen")], expect: { testidPresent: ["title-screen"] }, shot: true },
    {
      id: "field", note: "새 게임 → 시작 맵",
      ops: [key("Enter"), { kind: "waitForRuntime", timeoutMs: 120_000 }, { kind: "hold", dir: null, ms: 1500 }],
      expect: { testidAbsent: ["title-screen"] }, shot: true,
    },
    { id: "esc-menu", note: "ESC 메뉴", ops: [key("Escape"), present("main-menu"), { kind: "hold", dir: null, ms: 600 }], expect: { testidPresent: ["main-menu"] }, shot: true },
    { id: "esc-close", ops: [key("Escape"), absent("main-menu")], expect: { testidAbsent: ["main-menu"] } },
    {
      id: "dialogue", note: "오른쪽 NPC 와 대화",
      ops: [{ kind: "face", dir: "right" }, { kind: "action" }, present("dialogue-box"), { kind: "hold", dir: null, ms: 1200 }],
      expect: { testidPresent: ["dialogue-box"] }, shot: true,
    },
    {
      id: "choices", note: "선택지",
      ops: [{ kind: "pressUntil", key: "z", testid: "runtime-choices", state: "present", maxPresses: 6 }, { kind: "hold", dir: null, ms: 600 }],
      expect: { testidPresent: ["runtime-choices"] }, shot: true,
    },
    {
      id: "shop", note: "상점(사기 목록)",
      ops: [
        key("z"),
        { kind: "pressUntil", key: "z", testid: "shop-scene", state: "present", maxPresses: 6 },
        { kind: "hold", dir: null, ms: 400 },
        key("Enter"),
        { kind: "hold", dir: null, ms: 800 },
      ],
      expect: { testidPresent: ["shop-scene"] }, shot: true,
    },
    {
      id: "save", note: "저장 메뉴",
      ops: [key("x", 3), absent("shop-scene"), present("main-menu"), key("ArrowRight"), present("save-slot-1"), { kind: "hold", dir: null, ms: 800 }],
      expect: { testidPresent: ["main-menu", "save-slot-1"] }, shot: true,
    },
    {
      id: "battle", note: "측면 전투",
      ops: [{ kind: "pressUntil", key: "Escape", testid: "main-menu", state: "absent", maxPresses: 4 }, { kind: "pressUntil", key: "z", testid: "battle-scene", state: "present", maxPresses: 6 }, { kind: "hold", dir: null, ms: 4000 }],
      expect: { testidPresent: ["battle-scene"] }, shot: true,
    },
  ],
};
