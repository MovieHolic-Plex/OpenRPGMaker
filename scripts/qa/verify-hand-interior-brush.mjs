// Editor verification (dev:worktree): load the canonical hand-pixel interior project (v5) into the editor session, add an
// empty test room on atlas_biome_interior, paint ceilings (lower layer) and rugs / mine rail (upper layer) with the real
// brush (mouse drags on the canvas) and read the cells back: every painted cell must equal its group's variantMap[own mask].
// Then open example rooms in the editor and screenshot them. Nothing is saved.
// Usage: npm run dev:worktree (then) DEV_URL=http://127.0.0.1:<port> node scripts/qa/verify-hand-interior-brush.mjs
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";
const ORIGIN = process.env.DEV_URL ?? "http://127.0.0.1:9886", OUT = "verify-shots/hand-interior";
fs.mkdirSync(OUT, { recursive: true });
const project = JSON.parse(execFileSync("python3", ["-c", "import sqlite3;c=sqlite3.connect('file:.oprn-projects/hand-interior-v5-20260929/project.sqlite?mode=ro',uri=True);print(c.execute('select current_json from project').fetchone()[0])"], { maxBuffer: 400 * 1024 * 1024 }));
const TS = "atlas_biome_interior", W = 34, H = 18, TEST = "hand-interior-brush-test";
const FLOOR = JSON.parse(fs.readFileSync("src/assets/handInteriorSpec.json", "utf8")).floors.plank.tiles[0];
project.maps[TEST] = { id: TEST, name: "실내 붓 시험", width: W, height: H, tileSize: 16, tilesetId: TS,
  lowerTiles: Array(W * H).fill(FLOOR), upperTiles: Array(W * H).fill(-1), events: [] };
project.mapTree.children.push({ mapId: TEST, children: [] });
const b = await chromium.launch({ args: ["--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });
const page = await b.newPage({ viewport: { width: 1700, height: 1050 } });
const errors = []; page.on("pageerror", (e) => errors.push(e.message));
await page.addInitScript(() => {
  localStorage.setItem("oprn:editor-ui-mode", "expert"); localStorage.setItem("oprn:ai-panel-collapsed", "1");
  for (const k of ["oprn:editor-welcome-dismissed", "oprn:standard-welcome-seen", "oprn:coachmarks-basic-v1"]) localStorage.setItem(k, "1");
});
await page.goto(ORIGIN + "/?blankProject=1", { waitUntil: "domcontentloaded" });
await page.getByTestId("edit-canvas").waitFor({ timeout: 120000 });
await page.evaluate((p) => window.__oprnEditorStore.replace(p, { preserveEventDrafts: false, change: { projectSwitch: true, label: "atlas interior verify load" } }), project);
await page.evaluate((id) => window.__oprnRegionTaskHarness.selectMap(id), TEST);
await page.waitForTimeout(2500);
const draw = page.getByRole("tab", { name: /그리기/ }).or(page.getByRole("button", { name: /그리기/ })).first();
if (await draw.count()) await draw.click();
await page.waitForTimeout(800);
await page.getByTestId("tool-paint").click();
const toggle = page.getByTestId("auto-connect-mode-toggle");
console.log("autoconnect", await toggle.getAttribute("aria-pressed"), await toggle.getAttribute("aria-checked"), (await toggle.textContent())?.trim());
const cell = async (x, y) => page.evaluate(([x, y]) => window.__oprnEditWorldToClient(x * 16 + 8, y * 16 + 8), [x, y]);
const pick = async (t) => { const el = page.getByTestId(`chipset-tile-${t}`); await el.scrollIntoViewIfNeeded(); await el.click(); await page.waitForTimeout(300); };
const stroke = async (pts) => {
  const a = await cell(...pts[0]); await page.mouse.move(a.x, a.y); await page.mouse.down();
  for (const p of pts.slice(1)) { const c = await cell(...p); await page.mouse.move(c.x, c.y, { steps: 12 }); }
  await page.mouse.up(); await page.waitForTimeout(400);
};
const rect = (x0, y0, x1, y1) => { const pts = []; for (let y = y0; y <= y1; y++) { pts.push(y % 2 ? [x1, y] : [x0, y]); pts.push(y % 2 ? [x0, y] : [x1, y]); } return pts; };
const ts = project.tilesets[TS], G = (id) => ts.autotileGroups.find((q) => q.id === id);
const groups = {
  "ceiling-default": "hand-interior:ceiling:default",
  "ceiling-wood": "hand-interior:ceiling:wood",
  "rug-red": "hand-interior:line:rug red",
  "rug-royal": "hand-interior:line:rug royal",
  "rail": "hand-interior:line:rail",
};
const areas = { "ceiling-default": rect(1, 1, 7, 5), "ceiling-wood": rect(10, 1, 15, 5), "rug-red": rect(18, 2, 24, 6), "rug-royal": [[1, 10], [9, 10], [9, 15], [4, 15], [4, 12]], rail: [[13, 9], [20, 9], [20, 15], [28, 15]] };
const full = (g) => g.variantMap[g.neighborhood === 8 ? "255" : "15"];
for (const [name, gid] of Object.entries(groups)) { const g = G(gid); if (!g) throw new Error("no group " + gid);
  await page.getByTestId(g.layer === "upper" ? "layer-upper" : "layer-lower").click();
  await pick(full(g)); await page.getByTestId("tool-paint").click(); await stroke(areas[name]); console.log("painted", name, full(g)); }
await page.mouse.move(5, 5); await page.waitForTimeout(1200);
const map = await page.evaluate((id) => { const p = window.__oprnEditorStore.getCurrent(); const m = p.maps[id]; return { lower: m.lowerTiles, upper: m.upperTiles }; }, TEST);
const report = {};
for (const [name, gid] of Object.entries(groups)) {
  const g = G(gid), mem = new Set([...(g.memberTileIds ?? []), ...Object.values(g.variantMap)]);
  // a neighbour counts when it is a connect tile of this group (ceilings: every ceiling/void cell)
  const conn = new Set(g.connectTileIds ?? [...mem]);
  const inArea = new Set(); for (const [x, y] of areas[name]) inArea.add(`${y}`); // rows touched
  const cells = (g.layer === "upper" ? map.upper : map.lower).map((t, i) => [t, i]).filter(([t]) => mem.has(t));
  const layer = g.layer === "upper" ? map.upper : map.lower;
  const set = new Set(layer.map((t, i) => [t, i]).filter(([t]) => conn.has(t)).map(([, i]) => i)); let wrong = 0; const bad = [];
  const n8 = g.neighborhood === 8;
  for (const [t, i] of cells) { const x = i % W, y = (i / W) | 0; let m = 0;
    [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]].slice(0, n8 ? 8 : 4).forEach(([dx, dy], k) => { const X = x + dx, Y = y + dy; if ((X < 0 || Y < 0 || X >= W || Y >= H) ? (g.edgeConnects === true) : set.has(Y * W + X)) m |= 1 << k; });
    const want = g.variantMap[String(m)]; if (want !== undefined && t !== want) { wrong++; bad.push([x, y, t, want, m]); } }
  report[name] = { group: gid, cells: cells.length, distinctTiles: new Set(cells.map(([t]) => t)).size, mismatchedMask: wrong, sample: bad.slice(0, 3) };
}
console.log(JSON.stringify(report, null, 1));
const a = await page.evaluate(() => window.__oprnEditWorldToClient(0, 0)), z = await page.evaluate(([w, h]) => window.__oprnEditWorldToClient(w * 16, h * 16), [W, H]);
await page.screenshot({ path: `${OUT}/01-brush-autotiles.png`, clip: { x: a.x, y: a.y, width: z.x - a.x, height: z.y - a.y } });
await page.screenshot({ path: `${OUT}/02-editor-full.png` });
// 예제 방 화면은 이벤트 레이어(F7)로 — 칠하는 층 강조(다른 층 흐림) 없이 모든 타일 층이 원래 색으로 보인다. 격자는 끈다.
await page.mouse.click(5, 5); await page.keyboard.press("F7"); await page.waitForTimeout(400);
await page.evaluate(() => { const s = window.__oprnEditorState ?? window.__oprnEditorUiState; if (s?.set) s.set({ showGrid: false }); });
for (const [k, id] of [["03", "hand-bakery"], ["04", "hand-manor-1f"], ["05", "hand-chapel"], ["06", "hand-inn"], ["07", "hand-throne"], ["08", "hand-magitek"]]) {
  await page.evaluate((id) => window.__oprnRegionTaskHarness.selectMap(id), id); await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/${k}-editor-${id}.png` });
}
fs.writeFileSync(`${OUT}/brush-report.json`, JSON.stringify({ map: TEST, report, errors }, null, 1));
console.log("errors", errors);
await b.close();
