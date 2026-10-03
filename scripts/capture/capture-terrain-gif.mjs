// Record real editor pointer/keyboard interactions; never edit the user's host project.
// Needs this worktree's dev server, Playwright Chromium, and ffmpeg.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const out = resolve(process.env.TERRAIN_GIF_OUTPUT ?? "verify-shots/terrain-operation-gif");
mkdirSync(out, { recursive: true });
mkdirSync(".vite-cache", { recursive: true });
const framesDir = mkdtempSync(resolve(".vite-cache/terrain-gif-"));
const browser = await chromium.launch({ args: ["--disable-background-networking", "--no-proxy-server", "--js-flags=--max-old-space-size=8192"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const errors = [], phases = [], frames = [];
page.on("pageerror", error => errors.push(error.message));
let recordingStart, session, crop, propId;
const settle = async (ms = 600) => page.waitForTimeout(ms);
const pointAt = (x, y) => page.evaluate(async ({ x, y }) => {
  const { reliefLiftField, cellLift } = await import("/src/project/relief/screen.ts");
  const project = window.__oprnEditorStore.getCurrent(), map = project.maps[project.startMapId];
  const lift = map.relief ? cellLift(reliefLiftField(map.relief), x, y) : 0;
  return window.__oprnEditWorldToClient((x + .5) * map.tileSize, (y + .5 - lift) * map.tileSize);
}, { x, y });
const clickCell = async (x, y) => {
  const point = await pointAt(x, y);
  await page.mouse.move(point.x, point.y, { steps: 10 });
  await settle(250);
  await page.mouse.click(point.x, point.y);
  await settle();
};
const clickTool = async id => {
  const locator = page.getByTestId(id), box = await locator.boundingBox();
  if (!box) throw new Error(`Tool missing: ${id}`);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 8 });
  await settle(180);
  await locator.click();
  await settle(300);
};
const caption = async text => {
  phases.push({ seconds: (Date.now() - recordingStart) / 1000, text });
  console.log(text);
  await page.locator("#terrain-capture-caption").evaluate((node, text) => { node.textContent = text; }, text);
  await settle(900);
};

try {
  console.log("Opening isolated editor fixture");
  await page.goto(`${process.env.TERRAIN_CAPTURE_URL ?? "http://127.0.0.1:9833"}/?blankProject=1`, { waitUntil: "load", timeout: 120000 });
  await page.waitForFunction(() => window.__oprnEditorStore && window.__oprnEditWorldToClient, null, { timeout: 120000 });
  await page.getByTestId("boot-loader").waitFor({ state: "hidden", timeout: 120000 });
  propId = await page.evaluate(async () => {
    const { createBlankMap } = await import("/src/project/defaults/defaultMaps.ts");
    const { editorState } = await import("/src/editor/editorState.ts");
    const { reliefDoodadCatalog } = await import("/src/editor/reliefDoodads.ts");
    const { requestEditorCameraFocus } = await import("/src/editor/editorCameraFocus.ts");
    const { resetMapEditHistory } = await import("/src/editor/mapEditHistory.ts");
    const store = window.__oprnEditorStore, project = store.getCurrent(), original = project.maps[project.startMapId];
    const map = createBlankMap("지형 도구 시연", 40, 30, original.tilesetId, original.tileSize);
    map.id = original.id;
    map.relief = { width: 40, height: 30, levels: new Array(1200).fill(0), ramps: new Array(1200).fill(0) };
    for (let y = 10; y <= 17; y++) for (let x = 12; x <= 23; x++) map.relief.levels[y * 40 + x] = 2;
    store.updateMap(map.id, draft => Object.assign(draft, map), { label: "GIF QA fixture" });
    editorState.set({ currentMapId: map.id, tool: "relief", layer: "lower", zoom: 1, terrainBrush: "height", reliefDoodadOpen: false, reliefDoodad: null, terrainReachability: false });
    requestEditorCameraFocus({ mapId: map.id, tileX: 20, tileY: 15, immediate: true });
    resetMapEditHistory();
    return reliefDoodadCatalog(project.tilesets[map.tilesetId]).find(d => d.tab === "tree")?.id;
  });
  if (!propId) throw new Error("Fixture tileset has no tree kit");
  await settle(2500);
  const area = await page.locator(".canvas-area").boundingBox();
  crop = { x: Math.round(area.x), y: Math.round(area.y + 96), width: Math.floor(area.width), height: Math.floor(area.height - 96) };
  // Caption/cursor are recording aids. Product rendering and all operations stay real.
  await page.evaluate(({ crop }) => {
    const caption = document.createElement("div");
    caption.id = "terrain-capture-caption";
    Object.assign(caption.style, { position: "fixed", left: `${crop.x + 18}px`, top: `${crop.y + 12}px`, zIndex: "2147483647", background: "#1c242e", color: "#ffffff", padding: "10px 14px", borderRadius: "8px", font: "600 17px system-ui", pointerEvents: "none" });
    document.body.append(caption);
    const cursor = document.createElement("div");
    Object.assign(cursor.style, { position: "fixed", width: "16px", height: "16px", border: "2px solid #ffffff", boxShadow: "0 0 0 2px #253956", borderRadius: "50%", transform: "translate(-50%, -50%)", zIndex: "2147483647", pointerEvents: "none" });
    document.body.append(cursor);
    document.addEventListener("pointermove", event => { cursor.style.left = `${event.clientX}px`; cursor.style.top = `${event.clientY}px`; });
    document.addEventListener("pointerdown", () => { cursor.style.background = "#58cc8b"; });
    document.addEventListener("pointerup", () => { cursor.style.background = "transparent"; });
  }, { crop });
  session = await page.context().newCDPSession(page);
  session.on("Page.screencastFrame", event => {
    const path = resolve(framesDir, `${String(frames.length).padStart(5, "0")}.jpg`);
    writeFileSync(path, Buffer.from(event.data, "base64"));
    frames.push({ path, time: Date.now() });
    session.send("Page.screencastFrameAck", { sessionId: event.sessionId }).catch(() => {});
  });
  recordingStart = Date.now();
  await session.send("Page.startScreencast", { format: "jpeg", quality: 95, maxWidth: 1440, maxHeight: 960, everyNthFrame: 1 });

  await caption("① 경사로 · 절벽 방향에 맞춰 연결");
  await clickTool("relief-doodad-toggle");
  await page.getByTestId("relief-ramp-width").selectOption("6");
  await clickTool("relief-doodad-ramp:slope");
  await clickCell(17, 17);
  await clickTool("relief-doodad-close");
  await settle(600);

  await caption("② 표면 · 높이는 유지하고 바닥 재질만");
  await clickTool("terrain-tool-surface");
  await page.getByTestId("terrain-material").selectOption("dirt");
  await clickCell(16, 14);

  await caption("③ 강 · 드래그로 물길 그리기");
  await clickTool("terrain-tool-river");
  await page.getByTestId("terrain-width").selectOption("5");
  const riverStart = await pointAt(7, 9), riverEnd = await pointAt(7, 25);
  await page.mouse.move(riverStart.x, riverStart.y, { steps: 10 });
  await settle(300);
  await page.mouse.down();
  for (let step = 1; step <= 32; step++) {
    await page.mouse.move(riverStart.x, riverStart.y + (riverEnd.y - riverStart.y) * step / 32);
    await settle(40);
  }
  await page.mouse.up();
  await settle(1000);

  await caption("④ 다리 · 양쪽 둑을 차례로 클릭");
  await clickTool("relief-doodad-toggle");
  await clickTool("relief-doodad-tab-bridge");
  await clickTool("relief-doodad-bridge:horizontal");
  await clickCell(4, 22);
  await clickCell(10, 22);
  await clickTool("relief-doodad-close");

  await caption("⑤ 나무 군집 · 한 번에 배치");
  await clickTool("relief-doodad-toggle");
  await clickTool("relief-doodad-tab-tree");
  await clickTool(`relief-doodad-${propId}`);
  const head = await page.locator(".relief-pop-head").boundingBox();
  await page.mouse.move(head.x + 80, head.y + 14);
  await page.mouse.down();
  await page.mouse.move(area.x + 90, area.y + 24, { steps: 12 });
  await page.mouse.up();
  await clickCell(29, 23);
  await clickTool("relief-doodad-close");
  await clickTool("terrain-tool-group");
  const group = await page.evaluate(() => {
    const project = window.__oprnEditorStore.getCurrent(), map = project.maps[project.startMapId], cell = map.doodadGroups?.[0]?.cells[0];
    return cell ? { x: cell.index % map.width, y: Math.floor(cell.index / map.width) } : null;
  });
  if (!group) throw new Error("Tree group was not placed");
  await caption("⑥ 군집 이동 · 묶음 전체가 따라 이동");
  await clickCell(group.x, group.y);
  await clickTool("terrain-group-move");
  await clickCell(group.x - 1, group.y);
  await caption("⑦ 삭제 → Ctrl+Z · 군집과 바닥 복원");
  await clickCell(group.x - 1, group.y);
  await clickTool("terrain-group-delete");
  await settle(900);
  await page.keyboard.press("Control+z");
  await settle(1200);

  await caption("⑧ 통행 미리보기 · 경사로와 다리 연결 확인");
  await clickTool("terrain-reachability");
  await page.mouse.move(area.x + 15, area.y + 110, { steps: 8 });
  await settle(2200);
  await page.screenshot({ path: resolve(out, "final.png") });
  const observed = await page.evaluate(async () => {
    const project = window.__oprnEditorStore.getCurrent(), map = project.maps[project.startMapId];
    const { layerTileAt } = await import("/src/project/mapLayers.ts");
    return { rampCells: map.relief.ramps.filter(v => v > 0 && v < 9).length, bridgeCells: map.relief.ramps.filter(v => v === 9).length, groupCount: map.doodadGroups?.length ?? 0, groupCells: map.doodadGroups?.[0]?.cells.length ?? 0, plateauHeight: map.relief.levels[14 * 40 + 17], riverTiles: Array.from({ length: 17 }, (_, y) => layerTileAt(map, 1, (y + 9) * 40 + 7)) };
  });
  await session.send("Page.stopScreencast");
  if (observed.rampCells !== 18 || observed.bridgeCells !== 10 || observed.groupCount !== 1 || observed.plateauHeight !== 2 || observed.riverTiles.some(tile => tile < 0) || errors.length) throw new Error(`Recording observation failed: ${JSON.stringify({ observed, errors })}`);
  if (frames.length < 100) throw new Error(`Too few recorded frames: ${frames.length}`);
  const concat = frames.map((frame, i) => `file '${frame.path}'\nduration ${i + 1 < frames.length ? Math.max(.01, (frames[i + 1].time - frame.time) / 1000) : 1}`).join("\n") + `\nfile '${frames.at(-1).path}'\n`;
  const frameList = resolve(framesDir, "frames.ffconcat");
  writeFileSync(frameList, concat);
  const filter = `crop=${crop.width}:${crop.height}:${crop.x}:${crop.y},fps=10,split[v][p];[p]palettegen=max_colors=192:stats_mode=diff[pal];[v][pal]paletteuse=dither=sierra2_4a`;
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-threads", "2", "-f", "concat", "-safe", "0", "-i", frameList, "-filter_complex_threads", "2", "-filter_complex", filter, "-loop", "0", resolve(out, "terrain-operation.gif")], { stdio: "inherit" });
  writeFileSync(resolve(out, "recording.json"), JSON.stringify({ source: "Actual editor CDP screencast; pointer/keyboard operations on isolated memory fixture", url: page.url(), frames: frames.length, crop, phases, observed, errors }, null, 2) + "\n");
  console.log(JSON.stringify({ frames: frames.length, observed, gif: resolve(out, "terrain-operation.gif") }));
} catch (error) {
  await page.screenshot({ path: resolve(out, "capture-debug.png") }).catch(() => {});
  throw error;
} finally {
  await session?.send("Page.stopScreencast").catch(() => {});
  await browser.close();
}
