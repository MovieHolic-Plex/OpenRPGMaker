// 실제 편집기에서 경사로 클릭 배치와 화면을 확인한다. 메모리 fixture만 사용한다.
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const out = "verify-shots/relief-slope-fix";
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
  const scenarios = process.env.RELIEF_CAPTURE_REPLACE === "1" ? [{ height: 3, replace: true }] : [1, 2, 3, 4].map(height => ({ height, replace: false }));
  for (const scenario of scenarios) {
    const { height, replace } = scenario;
    await page.evaluate(async ({ height, replace }) => {
      const { editorState } = await import("/src/editor/editorState.ts");
      const { createBlankMap } = await import("/src/project/defaults/defaultMaps.ts");
      const { requestEditorCameraFocus } = await import("/src/editor/editorCameraFocus.ts");
      const { resetMapEditHistory } = await import("/src/editor/mapEditHistory.ts");
      const store = window.__oprnEditorStore, p = store.getCurrent(), map = p.maps[p.startMapId];
      const seed = createBlankMap("경사로 화면 확인", 40, 28, map.tilesetId, map.tileSize);
      seed.id = map.id;
      seed.relief = { width: 40, height: 28, levels: new Array(40 * 28).fill(0), ramps: new Array(40 * 28).fill(0) };
      for (let y = 9; y <= 17; y++) for (let x = 6; x <= 17; x++) seed.relief.levels[y * 40 + x] = height;
      if (replace) for (let y = 18; y < 18 + height + 1; y++) for (const x of [12, 13]) seed.relief.ramps[y * 40 + x] = 5;
      store.updateMap(map.id, draft => Object.assign(draft, seed), { label: "경사로 확인용 맵" });
      editorState.set({ currentMapId: map.id, zoom: 1, reliefDoodad: null, reliefDoodadOpen: true, tool: "relief", layer: "lower" });
      requestEditorCameraFocus({ mapId: map.id, tileX: 20, tileY: 14, immediate: true });
      resetMapEditHistory();
    }, scenario);
    await page.waitForTimeout(1500);
    const before = await page.evaluate(() => {
      const p = window.__oprnEditorStore.getCurrent(); return p.maps[p.startMapId].relief.ramps;
    });
    const suffix = replace ? "-replaced" : "";
    if (replace) {
      await page.getByTestId("relief-doodad-close").click();
      await page.mouse.move(20, 50);
      await page.locator(".canvas-area").screenshot({ path: `${out}/editor-${height}-levels-before-replacement-canvas.png` });
      await page.getByTestId("relief-doodad-toggle").click();
    }
    await page.getByTestId("relief-doodad-ramp:slope").click();
    const point = await page.evaluate(async replace => {
      const p = window.__oprnEditorStore.getCurrent(), map = p.maps[p.startMapId];
      if (replace) {
        const { reliefLiftField, cellLift } = await import("/src/project/relief/screen.ts");
        const lift = cellLift(reliefLiftField(map.relief), 12, 20);
        return window.__oprnEditWorldToClient(12.5 * map.tileSize, (20.5 - lift) * map.tileSize);
      }
      return window.__oprnEditWorldToClient(12.5 * map.tileSize, 17.5 * map.tileSize);
    }, replace);
    await page.mouse.click(point.x, point.y);
    await page.waitForTimeout(1300);
    const state = await page.evaluate(async () => {
      const { reliefSlopes } = await import("/src/project/relief/walk.ts");
      const p = window.__oprnEditorStore.getCurrent(), map = p.maps[p.startMapId];
      return { levels: map.relief.levels, ramps: map.relief.ramps, slopes: reliefSlopes(map.relief) };
    });
    await page.keyboard.press("Control+z"); await page.waitForTimeout(500);
    const undone = await page.evaluate(before => {
      const p = window.__oprnEditorStore.getCurrent(); return JSON.stringify(p.maps[p.startMapId].relief.ramps) === JSON.stringify(before);
    }, before);
    await page.keyboard.press("Control+y"); await page.waitForTimeout(500);
    const redone = await page.evaluate(state => {
      const p = window.__oprnEditorStore.getCurrent(), r = p.maps[p.startMapId].relief;
      return JSON.stringify(r.levels) === JSON.stringify(state.levels) && JSON.stringify(r.ramps) === JSON.stringify(state.ramps);
    }, state);
    await page.getByTestId("relief-doodad-close").click();
    await page.mouse.move(20, 50); await page.waitForTimeout(800);
    await page.screenshot({ path: `${out}/editor-${height}-levels${suffix}.png` });
    await page.locator(".canvas-area").screenshot({ path: `${out}/editor-${height}-levels${suffix}-canvas.png` });
    const report = { height, replace, rampCells: state.ramps.filter(v => v === 1).length, remainingStairCells: state.ramps.filter(v => v === 5).length, slopes: state.slopes, undo: undone, redo: redone };
    findings.push(report); console.log(JSON.stringify(report));
  }
  console.log("errors", JSON.stringify(errors));
} finally {
  const suffix = process.env.RELIEF_CAPTURE_REPLACE === "1" ? "-replacement" : "";
  writeFileSync(`${out}/editor-observations${suffix}.json`, JSON.stringify({ findings, errors }, null, 2) + "\n");
  await browser.close();
}
