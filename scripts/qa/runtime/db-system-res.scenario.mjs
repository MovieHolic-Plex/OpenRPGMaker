// 자료집 「게임 설정 → 화면」에서 고른 해상도가 출하 플레이어(player.html)에 실제로 먹는지 — 타이틀·필드 캡처 + 캔버스 크기 기록.
// 픽스처: RES_DIALOGUE=dual-fullbody-veil RES_VIEW=480x270x1 npx --no-install tsx --import ./tiledata/jp-city/refs/css-stub.mjs scripts/qa/runtime/res480-fixture.mts > .omo/runtime-qa/res/veil480.json
//   RES_FIXTURE=.omo/runtime-qa/res/veil480.json RES_OUT=/tmp/canvas.json npm run qa:runtime -- --scenario db-system-res --out verify-shots/db-system-audit/runtime-veil480
const [vw, vh] = (process.env.RES_VP ?? "1920x1080").split("x").map(Number);
const canvasFn = `() => { const c = document.querySelector("canvas"); const cam = window.__oprnCamera ? window.__oprnCamera() : null; const r = c ? c.getBoundingClientRect() : null; return { canvas: c ? c.width + "x" + c.height : null, css: r ? Math.round(r.width) + "x" + Math.round(r.height) : null, camera: cam ? { width: cam.width, height: cam.height, zoom: cam.zoom } : null }; }`;
export default {
  id: "db-system-res",
  projectFixture: process.env.RES_FIXTURE ?? ".omo/runtime-qa/res/veil480.json",
  viewport: { width: vw, height: vh },
  beats: [
    { id: "title", ops: [{ kind: "waitFor", testid: "title-screen", state: "present", timeoutMs: 60_000 }], expect: { testidPresent: ["title-screen"] }, shot: true },
    {
      id: "field", note: "새 게임 → 필드, 캔버스 크기 기록",
      ops: [{ kind: "key", key: "Enter", times: 1 }, { kind: "waitForRuntime", timeoutMs: 120_000 }, { kind: "hold", dir: null, ms: 1500 },
        { kind: "evalToFile", fn: canvasFn, out: process.env.RES_OUT ?? "/tmp/db-system-res-canvas.json" }],
      expect: { testidAbsent: ["title-screen"] }, shot: true,
    },
  ],
};
