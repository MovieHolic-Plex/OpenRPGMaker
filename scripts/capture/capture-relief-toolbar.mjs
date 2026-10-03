// 실제 높이 도구의 메모리 세션 화면 증거. 프로젝트 저장소에는 쓰지 않는다.
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const origin = process.env.RELIEF_CAPTURE_URL ?? "http://127.0.0.1:9833";
const out = "verify-shots/relief-rough-brush/continued";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ["--disable-background-networking"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
const findings = {};
page.on("pageerror", error => { errors.push(error.stack ?? error.message); console.log("pageerror", error.stack ?? error.message); });
page.on("crash", () => errors.push("PAGE CRASH"));
const note = (key, value) => { findings[key] = value; console.log(key, JSON.stringify(value)); };
try {
  await page.goto(`${origin}/?blankProject=1`, { waitUntil: "load", timeout: 120000 });
  await page.waitForFunction(() => window.__oprnEditWorldToClient && window.__oprnEditorStore, null, { timeout: 120000 });
  await page.getByTestId("boot-loader").waitFor({ state: "hidden", timeout: 120000 });
  note("records", await page.evaluate(async () => {
    if (!indexedDB.databases) return { available: false };
    return { aiRecordsPresent: (await indexedDB.databases()).some(db => db.name === "oprn-ai-records") };
  }));
  await page.evaluate(async () => {
    const { editorState } = await import("/src/editor/editorState.ts");
    const { createBlankMap } = await import("/src/project/defaults/defaultMaps.ts");
    const { resetMapEditHistory } = await import("/src/editor/mapEditHistory.ts");
    const { requestEditorCameraFocus } = await import("/src/editor/editorCameraFocus.ts");
    const store = window.__oprnEditorStore, project = store.getCurrent();
    const map = project.maps[project.startMapId];
    const seed = createBlankMap("높이 붓 확인", 40, 28, map.tilesetId, map.tileSize);
    seed.id = map.id;
    store.updateMap(map.id, draft => Object.assign(draft, seed), { label: "화면 확인용 맵" });
    editorState.set({ currentMapId: map.id, zoom: 1 });
    requestEditorCameraFocus({ mapId: map.id, tileX: 20, tileY: 14, immediate: true });
    resetMapEditHistory();
  });
  await page.getByTestId("layer-relief").click();
  await page.waitForTimeout(1800);
  const point = async (x, y) => page.evaluate(({ x, y }) => {
    const p = window.__oprnEditorStore.getCurrent(), m = p.maps[p.startMapId];
    return window.__oprnEditWorldToClient((x + .5) * m.tileSize, (y + .5) * m.tileSize);
  }, { x, y });
  const state = () => page.evaluate(() => {
    const p = window.__oprnEditorStore.getCurrent(), m = p.maps[p.startMapId];
    return { levels: m.relief?.levels ?? [], ramps: m.relief?.ramps ?? [], lower: m.lowerTiles, style: m.relief?.style ?? null };
  });
  const photo = async name => {
    await page.mouse.move(20, 50);
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${out}/${name}.png` });
    await page.locator(".canvas-area").screenshot({ path: `${out}/${name}-canvas.png` });
  };
  await photo("01-toolbar");
  const at = await point(20, 16);
  await page.mouse.move(at.x, at.y); await page.mouse.down();
  await page.waitForFunction(() => {
    const p = window.__oprnEditorStore.getCurrent(), m = p.maps[p.startMapId];
    return m.relief?.levels.some(level => level === 4);
  }, null, { timeout: 15000 });
  await page.mouse.up();
  await page.waitForTimeout(1600);
  const hill = await state();
  note("roughHold", { cells: hill.levels.filter(v => v > 0).length, peak: Math.max(0, ...hill.levels) });
  await photo("02-rough-hill");
  await page.keyboard.press("Control+z"); await page.waitForTimeout(1000);
  note("undo", { raised: (await state()).levels.filter(v => v > 0).length });
  await page.keyboard.press("Control+y"); await page.waitForTimeout(1000);
  note("redo", { exact: JSON.stringify(await state()) === JSON.stringify(hill) });
  await page.keyboard.press("Control+z"); await page.waitForTimeout(1000);
  await page.keyboard.down("Shift");
  const precise = await point(12, 10);
  await page.mouse.move(precise.x, precise.y); await page.mouse.down(); await page.mouse.up();
  await page.keyboard.up("Shift"); await page.waitForTimeout(1200);
  const small = await state();
  note("shift", { cells: small.levels.filter(v => v > 0).length, peak: Math.max(0, ...small.levels) });
  await page.keyboard.press("Control+z"); await page.waitForTimeout(900);
  // 직선 절벽·골짜기: 놓기 UI를 확인하는 최소 fixture, 정본 콘텐츠가 아니다.
  await page.evaluate(async () => {
    const store = window.__oprnEditorStore, p = store.getCurrent(), m = p.maps[p.startMapId];
    store.updateMapTiles(m.id, draft => {
      const levels = new Array(m.width * m.height).fill(0);
      for (let y = 9; y <= 17; y++) for (let x = 6; x <= 33; x++) if (x < 18 || x > 23) levels[y * m.width + x] = 3;
      draft.relief = { width: m.width, height: m.height, levels };
    }, { relief: true, label: "지형지물 화면 확인용 절벽" });
  });
  await page.keyboard.press("d");
  await page.getByTestId("relief-doodad-ramp:stairs").click();
  const stair = await point(12, 17);
  await page.mouse.click(stair.x, stair.y);
  await page.waitForTimeout(1100);
  note("stairs", { cells: (await state()).ramps.filter(v => v === 5).length });
  await photo("03-stairs");
  await page.getByTestId("relief-doodad-tab-bridge").click();
  await page.getByTestId("relief-doodad-bridge:horizontal").click();
  const deck = await point(17, 12 - 3);
  await page.mouse.click(deck.x, deck.y);
  await page.waitForTimeout(1100);
  note("bridge", { cells: (await state()).ramps.filter(v => v === 9).length });
  await photo("04-bridge");
  await page.getByTestId("relief-doodad-tab-tree").click();
  note("trees", { count: await page.locator('[data-doodad-id^="tree:"]').count() });
  await photo("05-doodads");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  note("escape", await page.evaluate(async () => {
    const { editorState } = await import("/src/editor/editorState.ts");
    const state = editorState.get();
    return { tool: state.tool, picked: state.reliefDoodad, open: state.reliefDoodadOpen };
  }));
  await page.getByTestId("relief-mode-lower").focus();
  note("tooltip", await page.getByTestId("delayed-tooltip").textContent());
  await page.getByTestId("relief-mode-raise").click();
  await page.setViewportSize({ width: 1024, height: 768 }); await page.waitForTimeout(1500);
  note("layout1024", await page.evaluate(() => {
    const a = document.querySelector(".canvas-area").getBoundingClientRect();
    const bar = document.querySelector(".relief-bar").getBoundingClientRect();
    return { canvasWidth: a.width, barWidth: bar.width, inside: bar.left >= a.left && bar.right <= a.right };
  }));
  await page.screenshot({ path: `${out}/06-narrow.png` });
  note("errors", errors);
} finally {
  writeFileSync(`${out}/observations.json`, JSON.stringify(findings, null, 2) + "\n");
  await browser.close();
}
