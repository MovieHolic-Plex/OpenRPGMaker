// 미연시 룩 — ESC 메뉴가 대사창과 같은 색·모서리 토큰을 받는지(uiTheme match) 한 장 찍는다. 픽스처: vn-matrix-fixture.mts <dir> look '<oprnVnLook json>'
//   node scripts/runtime-qa.mjs --scenario vn-look-menu --project output/qa/look1/fx-sakura-card/project.json --out output/qa/look1/menu-sakura-card
const settle = [{ kind: "pauseFrames" }, { kind: "stepFrames", frames: 150, deltaMs: 16 }, { kind: "resumeFrames" }];
const flag = process.argv.indexOf("--project");
export default {
  id: "vn-look-menu",
  projectFixture: flag >= 0 ? process.argv[flag + 1] : "output/qa/look1/fx-sakura-card/project.json",
  viewport: { width: 1024, height: 768 },
  beats: [
    { id: "title", note: "타이틀", shot: false, expect: { testidPresent: ["title-screen"] } },
    { id: "01-start", note: "새 게임", ops: [{ kind: "key", key: "Enter", times: 1 }, { kind: "waitForRuntime" }, ...settle, ...settle] },
    { id: "02-menu", note: "ESC 메뉴", ops: [{ kind: "pressUntil", key: "Escape", testid: "main-menu", state: "present", maxPresses: 6, timeoutMs: 3_000 }, ...settle], shot: true },
  ],
};
