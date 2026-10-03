// 실제 편집기에서 계단 클릭 배치와 화면을 확인한다. 메모리 fixture만 사용한다.
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const out = "verify-shots/relief-stairs-fix";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ["--disable-background-networking", "--no-proxy-server"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const findings = [], errors = [];
page.on("pageerror", error => { errors.push(error.stack ?? error.message); console.log("pageerror", error.message); });
page.on("crash", () => errors.push("PAGE CRASH"));
try {
  await page.goto(`${process.env.RELIEF_CAPTURE_URL ?? "http://127.0.0.1:9833"}/?blankProject=1`, { waitUntil: "load", timeout: 120000 });
  await page.waitForFunction(() => window.__oprnEditWorldToClient && window.__oprnEditorStore, null, { timeout: 120000 });
  await page.getByTestId("boot-loader").waitFor({ state: "hidden", timeout: 120000 });
  for (const height of [1, 2, 3, 4]) {
    await page.evaluate(async height => {
      const { editorState } = await import("/src/editor/editorState.ts");
      const { createBlankMap } = await import("/src/project/defaults/defaultMaps.ts");
      const { requestEditorCameraFocus } = await import("/src/editor/editorCameraFocus.ts");
      const { resetMapEditHistory } = await import("/src/editor/mapEditHistory.ts");
      const store = window.__oprnEditorStore, p = store.getCurrent(), map = p.maps[p.startMapId];
      const seed = createBlankMap("계단 화면 확인", 40, 28, map.tilesetId, map.tileSize);
      seed.id = map.id;
      seed.relief = { width: 40, height: 28, levels: new Array(40 * 28).fill(0), ramps: new Array(40 * 28).fill(0) };
      for (let y = 9; y <= 17; y++) for (let x = 6; x <= 17; x++) seed.relief.levels[y * 40 + x] = height;
      store.updateMap(map.id, draft => Object.assign(draft, seed), { label: "계단 확인용 맵" });
      editorState.set({ currentMapId: map.id, zoom: 1, reliefDoodad: null, reliefDoodadOpen: true, tool: "relief", layer: "lower" });
      requestEditorCameraFocus({ mapId: map.id, tileX: 20, tileY: 14, immediate: true });
      resetMapEditHistory();
    }, height);
    await page.waitForTimeout(1500);
    await page.getByTestId("relief-doodad-ramp:stairs").click();
    const point = await page.evaluate(() => {
      const p = window.__oprnEditorStore.getCurrent(), map = p.maps[p.startMapId];
      return window.__oprnEditWorldToClient(12.5 * map.tileSize, 17.5 * map.tileSize);
    });
    await page.mouse.click(point.x, point.y);
    await page.waitForTimeout(1300);
    const state = await page.evaluate(async () => {
      const { reliefSlopes } = await import("/src/project/relief/walk.ts");
      const p = window.__oprnEditorStore.getCurrent(), map = p.maps[p.startMapId];
      return { levels: map.relief.levels, ramps: map.relief.ramps, slopes: reliefSlopes(map.relief) };
    });
    await page.keyboard.press("Control+z"); await page.waitForTimeout(500);
    const undone = await page.evaluate(() => {
      const p = window.__oprnEditorStore.getCurrent(); return p.maps[p.startMapId].relief.ramps.every(v => v === 0);
    });
    await page.keyboard.press("Control+y"); await page.waitForTimeout(500);
    const redone = await page.evaluate(state => {
      const p = window.__oprnEditorStore.getCurrent(), r = p.maps[p.startMapId].relief;
      return JSON.stringify(r.levels) === JSON.stringify(state.levels) && JSON.stringify(r.ramps) === JSON.stringify(state.ramps);
    }, state);
    await page.getByTestId("relief-doodad-close").click();
    await page.mouse.move(20, 50); await page.waitForTimeout(800);
    await page.screenshot({ path: `${out}/editor-${height}-levels.png` });
    await page.locator(".canvas-area").screenshot({ path: `${out}/editor-${height}-levels-canvas.png` });
    const report = { height, stairs: state.ramps.filter(v => v === 5).length, slopes: state.slopes, undo: undone, redo: redone };
    findings.push(report); console.log(JSON.stringify(report));
  }
  console.log("errors", JSON.stringify(errors));
} finally {
  writeFileSync(`${out}/editor-observations.json`, JSON.stringify({ findings, errors }, null, 2) + "\n");
  await browser.close();
}
