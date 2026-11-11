// 『강호의 철련』 제1막 — 타이틀, 오프닝, 포고 대사, 죽림 맵, 보이는 적 전투.
// 제1막 엔딩은 체크포인트로 연다: --scenario checkpoints --checkpoint-set iron-lotus --checkpoint act1-ending
// 구운 데모로 부팅한다: npm run bake:demos -- --only iron-lotus
const fieldReady = `() => {
  const s = window.__oprnDebug?.readState?.();
  if (!s?.currentMapId) return false;
  if (document.querySelector("[data-testid='dialogue-box'], [data-testid='battle-scene'], [data-testid='main-menu'], [data-testid='dialogue-choice-frame'], [data-testid='battle-transition-overlay'], [data-testid='cinematic-sequence']")) return false;
  return true;
}`;

export default {
  id: "iron-lotus",
  query: { demo: "iron-lotus", e2eVitals: "1" },
  projectFixture: "dist/demos/iron-lotus.play.json",
  viewport: { width: 480, height: 270 },
  beats: [
    {
      id: "title",
      note: "타이틀 — 강호의 철련",
      ops: [
        { kind: "waitFor", testid: "title-screen", state: "present", timeoutMs: 180000 },
      ],
      expect: { testidPresent: ["title-screen"] },
      shot: true,
    },
    {
      id: "opening",
      note: "오프닝 — 고치가 떨어진다",
      ops: [
        { kind: "pressUntil", key: "Enter", testid: "cinematic-sequence", state: "present", maxPresses: 6, timeoutMs: 20000 },
        { kind: "waitForAttr", testid: "cinematic-sequence", attr: "data-scene-id", value: "il_op_fall", timeoutMs: 20000 },
        { kind: "hold", dir: null, ms: 1200 },
      ],
      expect: { testidPresent: ["cinematic-sequence"] },
      shot: true,
    },
    {
      id: "dialogue",
      note: "유하진 포고 대사",
      ops: [
        { kind: "waitForAttr", testid: "cinematic-sequence", attr: "data-scene-id", value: "il_op_title", timeoutMs: 50000 },
        { kind: "waitFor", testid: "dialogue-box", state: "present", timeoutMs: 30000 },
        { kind: "hold", dir: null, ms: 500 },
      ],
      expect: { testidPresent: ["dialogue-box"] },
      shot: true,
    },
    {
      id: "town",
      note: "유하진 — 여관 거리",
      ops: [
        { kind: "pressUntilJs", key: "Enter", fn: fieldReady, maxPresses: 40, settleMs: 400 },
        { kind: "pressUntilJs", key: "Escape", times: 2, fn: "() => !/건너뛰기/.test(document.body.innerText)", maxPresses: 4, settleMs: 600 },
        { kind: "pressUntilJs", key: "Escape", fn: "() => !document.querySelector(\"[data-testid='main-menu']\")", maxPresses: 2, settleMs: 300 },
        { kind: "hold", dir: null, ms: 800 },
      ],
      shot: true,
    },
    {
      id: "map",
      note: "청죽림 — 흙길과 대나무",
      ops: [
        { kind: "teleport", mapId: "il_grove", x: 30, y: 18 },
        { kind: "waitForPosition", mapId: "il_grove", x: 30, y: 18, timeoutMs: 15000 },
        { kind: "hold", dir: null, ms: 800 },
      ],
      shot: true,
    },
    {
      id: "battle",
      note: "청죽 살무사와 전투",
      ops: [
        { kind: "face", dir: "up" },
        { kind: "hold", dir: "up", ms: 900 },
        { kind: "waitFor", testid: "battle-scene", state: "present", timeoutMs: 15000 },
        { kind: "waitFor", testid: "actor-command-attack", state: "present", timeoutMs: 30000 },
      ],
      expect: { testidPresent: ["battle-scene"] },
      shot: true,
    },
    {
      id: "battle-win",
      note: "전투 승리",
      ops: [
        { kind: "battle", fallback: "attack", timeoutMs: 120000 },
        { kind: "waitFor", testid: "battle-result-confirm", state: "present", timeoutMs: 20000 },
        { kind: "pressUntil", key: "Enter", testid: "battle-scene", state: "absent", maxPresses: 8, timeoutMs: 3000 },
      ],
      shot: false,
    },
    {
      id: "temple",
      note: "운무산 사원",
      ops: [
        { kind: "pressUntilJs", key: "Enter", fn: fieldReady, maxPresses: 12, settleMs: 400 },
        { kind: "teleport", mapId: "il_temple", x: 22, y: 16 },
        { kind: "waitForPosition", mapId: "il_temple", x: 22, y: 16, timeoutMs: 15000 },
        { kind: "hold", dir: null, ms: 800 },
      ],
      shot: true,
    },
    {
      id: "return",
      note: "디버그 순간이동으로 마을에 돌아오면 귀환 대사가 시작된다",
      ops: [
        { kind: "setSwitch", switchId: "sw_il_main_step2", value: true },
        { kind: "setSwitch", switchId: "sw_il_main_done", value: false },
        { kind: "teleport", mapId: "il_hub", x: 37, y: 18 },
        { kind: "waitForPosition", mapId: "il_hub", x: 37, y: 18, timeoutMs: 15000 },
        { kind: "waitFor", testid: "dialogue-box", state: "present", timeoutMs: 15000 },
        { kind: "hold", dir: null, ms: 600 },
      ],
      expect: { testidPresent: ["dialogue-box"] },
      shot: true,
    },
  ],
};
