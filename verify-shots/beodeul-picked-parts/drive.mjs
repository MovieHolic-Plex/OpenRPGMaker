// 버들항 고른 조각(bd-pick-*) 화면 증거 — 새 프로젝트와 기존 프로젝트(옛 23,936칸 사본을 실제 로드 정규화로 연 것).
// node verify-shots/beodeul-picked-parts/drive.mjs  (dev:worktree 가 9865 에 떠 있어야 한다)
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
const OUT = new URL(".", import.meta.url).pathname;
const URL0 = `http://127.0.0.1:${process.env.PORT || 9865}/?blankProject=1`;
const b = await chromium.launch({ headless: true, args: ["--disable-dev-shm-usage", "--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });
const report = {};
async function boot() {
  const page = await b.newPage({ viewport: { width: 1600, height: 900 } });
  await page.addInitScript(() => { localStorage.setItem("oprn:standard-welcome-seen", "1"); localStorage.setItem("oprn:ai-panel-collapsed", "1"); });
  page.errs = []; page.on("pageerror", (e) => page.errs.push(String(e).slice(0, 200)));
  await page.goto(URL0, { waitUntil: "domcontentloaded" });
  await page.getByTestId("edit-canvas").waitFor({ timeout: 120000 });
  await page.waitForTimeout(3000);
  return page;
}
const info = (page) => page.evaluate(() => {
  const p = window.__oprnEditorStore.getCurrent(); const ts = p.tilesets.beodeul_city; const m = p.maps[p.startMapId];
  return { map: m.id, mapTileset: m.tilesetId, count: ts.count, kits: ts.structureKits.length, pickKits: ts.structureKits.filter(k => k.id.startsWith("bd-pick-")).length,
    pickCats: (ts.referenceDocuments || []).filter(c => c.id.startsWith("beodeul-picks-")).map(c => `${c.id}:${c.documents.length}문서/${c.images.length}그림`) };
});
// 맵 원점(왼쪽 위 칸) 화면 좌표: 캔버스 안 맵 그림의 위치를 store 크기와 2x 배율로 구한다.
async function openShelf(page) {
  const t = page.getByTestId("sidebar-structure-kits");
  if ((await t.getAttribute("aria-expanded")) !== "true") { await t.click(); await page.waitForTimeout(800); }
}
async function stamp(page, kitId, x, y) {
  await openShelf(page);
  const btn = page.getByTestId(`structure-kit-${kitId}`); await btn.scrollIntoViewIfNeeded(); await btn.click(); await page.waitForTimeout(400);
  const t = page.getByTestId("sidebar-structure-kits");
  if ((await t.getAttribute("aria-expanded")) === "true") { await page.getByTestId("sidebar-kits-surface").getByText("닫기").click().catch(() => {}); await page.waitForTimeout(300); }
  const before = await page.evaluate(() => { const p = window.__oprnEditorStore.getCurrent(); const m = p.maps[p.startMapId]; return [m.lowerTiles.slice(), m.upperTiles.slice()]; });
  const count = () => page.evaluate((before) => { const p = window.__oprnEditorStore.getCurrent(); const m = p.maps[p.startMapId]; let n = 0;
    m.lowerTiles.forEach((t, i) => { if (t !== before[0][i]) n++; }); m.upperTiles.forEach((t, i) => { if (t !== before[1][i]) n++; }); return n; }, before);
  for (let tries = 0; tries < 3; tries++) {
    await page.mouse.click(423 + 32 * x + 10, 256 + 32 * y + 10); await page.waitForTimeout(700);
    if (await count()) break;
  }
  return page.evaluate(([before, kitId]) => {
    const p = window.__oprnEditorStore.getCurrent(); const m = p.maps[p.startMapId]; let n = 0;
    m.lowerTiles.forEach((t, i) => { if (t !== before[0][i]) n++; }); m.upperTiles.forEach((t, i) => { if (t !== before[1][i]) n++; });
    const kit = p.tilesets.beodeul_city.structureKits.find(k => k.id === kitId);
    return { kitId, name: kit.name, changedCells: n };
  }, [before, kitId]);
}
async function shots(page, tag, kits, searchWord) {
  await openShelf(page);
  const first = page.getByTestId(`structure-kit-${kits[0][0]}`); await first.scrollIntoViewIfNeeded(); await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}${tag}-1-shelf.png` });
  await page.getByText("닫기").first().click().catch(() => {}); await page.waitForTimeout(300);
  const search = page.locator("[data-testid='tile-search-input'], input[type=search]").first();
  if (await search.count()) { await search.click(); await search.fill(searchWord); await page.waitForTimeout(1200);
    await page.evaluate(() => { const s = document.querySelector("[data-testid='tile-palette']"); s.scrollTop = s.scrollHeight; }); await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}${tag}-2-palette-search.png` }); await search.fill(""); await page.waitForTimeout(600); }
  const stamped = [];
  for (const [id, x, y] of kits) stamped.push(await stamp(page, id, x, y));
  await page.keyboard.press("Escape"); await page.mouse.move(1300, 600); await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}${tag}-3-stamped.png` });
  await page.screenshot({ path: `${OUT}${tag}-4-stamped-crop.png`, clip: { x: 423, y: 256, width: 640, height: 480 } });
  return stamped;
}

// ---- 새 프로젝트 ----
const p1 = await boot();
report.new = { info: await info(p1) };
report.new.stamped = await shots(p1, "new", [["bd-pick-desert-oasis-n4", 1, 2], ["bd-pick-coast-cliff-road-fir-l", 8, 4], ["bd-pick-temple-ruins-roof-hip-shrine", 13, 6]], "버들항 장소");
report.new.errors = p1.errs;

// ---- 기존 프로젝트: 고른 조각 전 사본(23,936칸, bd-pick 키트·용도 없음)에 옛 키트로 그린 맵 → 로드 정규화 ----
const p2 = await boot();
report.existing = await p2.evaluate(async () => {
  const store = window.__oprnEditorStore;
  const p = structuredClone(store.getCurrent());
  const ts = p.tilesets.beodeul_city; const BASE = 23936;
  ts.count = BASE; ts.passability = ts.passability.slice(0, BASE); ts.priority = ts.priority.slice(0, BASE); ts.terrain = ts.terrain.slice(0, BASE);
  ts.tileMeta = ts.tileMeta.slice(0, BASE); ts.animationStrips = ts.animationStrips.filter(s => s.baseTile < BASE);
  ts.structureKits = ts.structureKits.filter(k => !k.id.startsWith("bd-pick-"));
  ts.referenceDocuments = ts.referenceDocuments.filter(c => !c.id.startsWith("beodeul-picks-"));
  ts.structureKits.push({ ...structuredClone(ts.structureKits[0]), id: "author-my-kit", name: "저자가 만든 키트" });
  delete p.meta.bootNormalization;
  const m = p.maps[p.startMapId]; m.name = "기존 버들항 맵";
  const kit = ts.structureKits.find(k => k.id === "bd-house-cstable");           // 옛 키트(왕성 마구간 3×5)를 (16,1) 에
  kit.rows.forEach((r, dy) => r.upperTiles.forEach((t, dx) => { if (t >= 0) m.upperTiles[(1 + dy) * m.width + 16 + dx] = t; }));
  const oldMap = JSON.stringify([m.lowerTiles, m.upperTiles]);
  const beforeLoad = { count: ts.count, pickKits: 0, kits: ts.structureKits.length };
  await store.loadFallbackProject(p);
  const q = store.getCurrent(); const t2 = q.tilesets.beodeul_city; const m2 = q.maps[q.startMapId];
  return { beforeLoad, afterLoad: { count: t2.count, kits: t2.structureKits.length, pickKits: t2.structureKits.filter(k => k.id.startsWith("bd-pick-")).length,
    authorKitKept: t2.structureKits.some(k => k.id === "author-my-kit"), mapUnchanged: JSON.stringify([m2.lowerTiles, m2.upperTiles]) === oldMap,
    basePassabilitySame: JSON.stringify(t2.passability.slice(0, 23936)) === JSON.stringify(p.tilesets.beodeul_city.passability.slice(0, 23936)),
    pickCats: t2.referenceDocuments.filter(c => c.id.startsWith("beodeul-picks-")).map(c => c.id) } };
});
await p2.waitForTimeout(1500);
report.existing.stamped = await shots(p2, "existing", [["bd-pick-mining-valley-headframe", 1, 3], ["bd-pick-swamp-stilt-mangrove", 6, 6], ["bd-pick-volcano-cave-furnace", 11, 9]], "버들항 장소");
report.existing.errors = p2.errs;
writeFileSync(`${OUT}report.json`, JSON.stringify(report, null, 1) + "\n");
console.log(JSON.stringify(report, null, 1));
await b.close();
