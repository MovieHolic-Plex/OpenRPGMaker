// 동작 보존 점검 2~5: 가장자리 드래그 확장, DB 탭, 조수 패널, 타일셋 참고문서. repo root 에서 BASE=서버 로 실행.
import { launch, BASE, wait, rmSync, writeFileSync } from "./lib.mjs";
import { DatabaseSync } from "node:sqlite";
const OUT = "verify-shots/editor-lag-integrated/";
const DB = "/tmp/lag-int/run-after/project.sqlite";
const MAP = "map_tiny_civilian_6_20260920";
const profile = "/tmp/lag-int/prof-beh2"; rmSync(profile, { recursive: true, force: true });
const res = { checks: {}, notes: [] };
const q = () => { const db = new DatabaseSync(DB, { readOnly: true }); const r = db.prepare("select width,height,map_json from maps where map_id=?").get(MAP); db.close(); const m = JSON.parse(r.map_json); return { w: r.width, h: r.height, lt: (Array.isArray(m.lowerTiles) ? m.lowerTiles.flat(3) : []), m }; };
const { ctx, page } = await launch({ profile });
page.on("pageerror", (e) => (res.pageerrors ??= []).push(String(e).slice(0, 200)));
await page.goto(BASE + "/");
for (let i = 0; i < 3000; i++) { if (await page.evaluate(() => typeof window.__oprnEditWorldToClient === "function" && document.querySelectorAll("canvas").length > 0).catch(() => false)) break; await wait(40); }
await wait(2500);
// --- 2. 가장자리 드래그 확장
await page.click("[data-testid=sidebar-maps]"); await wait(600);
await page.click(`[data-testid=map-tree-node-${MAP}]`); await wait(2500);
await page.click("[data-testid=layer-lower]"); await wait(400);
await page.click("[data-testid=tool-paint]").catch(() => {}); await wait(300);
const b = q(); res.edge = { before: { w: b.w, h: b.h } };
const g = await page.evaluate(() => { const a = window.__oprnEditWorldToClient(144, 88), c = window.__oprnEditWorldToClient(160, 88); return { x: a.x, y: a.y, tile: c.x - a.x }; });
res.edge.geom = g;
await page.screenshot({ path: OUT + "beh-6-edge-before.png" });
await page.mouse.move(g.x + 20, g.y); await wait(300); await page.mouse.down();
for (let i = 1; i <= 8; i++) { await page.mouse.move(g.x + 20 + (g.tile * 3 * i) / 8, g.y); await wait(60); }
await page.mouse.up(); await wait(800);
await page.screenshot({ path: OUT + "beh-7-edge-after.png" });
await wait(8000); await page.click("[data-testid=toolbar-save]").catch(() => res.notes.push("toolbar-save 없음")); await wait(4000);
const a = q(); res.edge.after = { w: a.w, h: a.h };
const cols = a.w; const newCols = [];
for (let c = b.w; c < a.w; c++) { const col = []; for (let r = 0; r < a.h; r++) col.push(a.lt[r * a.w + c]); newCols.push({ col: c, distinct: [...new Set(col)], empty: col.filter((v) => v === -1).length }); }
res.edge.newCols = newCols;
res.edge.lastOldColDistinct = [...new Set(Array.from({ length: a.h }, (_, r) => a.lt[r * a.w + (b.w - 1)]))];
res.checks.edge_grew = a.w > b.w;
res.checks.edge_new_cells_not_empty = newCols.length > 0 && newCols.every((c) => c.empty === 0);
await page.click("[data-testid=oprn-tool-undo]").catch(() => res.notes.push("undo 없음")); await wait(800);
await wait(8000); await page.click("[data-testid=toolbar-save]").catch(() => {}); await wait(3500);
const u = q(); res.edge.afterUndo = { w: u.w, h: u.h }; res.checks.edge_undo_one_step_restores_width = u.w === b.w;
// --- 3. DB 탭
await page.click("[data-testid=toolbar-database]"); await wait(1500);
await page.evaluate(() => { const t = document.querySelector("[data-testid=db-tab-spatial-tiles]"); if (t && t.getBoundingClientRect().width === 0) document.querySelector("[data-testid=db-tab-group-world]")?.click(); }); await wait(500);
res.checks.db_modal_open = await page.evaluate(() => !!document.querySelector("[data-testid=database-modal]"));
await page.evaluate(() => document.querySelector("[data-testid=db-tab-actors]")?.click() ?? document.querySelector("[data-testid=db-tab-spatial-places]")?.click()); await wait(2500);
res.checks.db_tab_renders = await page.evaluate(() => { const m = document.querySelector("[data-testid=database-modal]"); return !!m && m.querySelectorAll("*").length > 100; });
await page.screenshot({ path: OUT + "beh-8-db-tab.png" });
// --- 5. 타일셋 참고문서
await page.evaluate(() => document.querySelector("[data-testid=db-tab-spatial-tiles]")?.click()); await wait(3000);
const rows = await page.evaluate(() => [...document.querySelectorAll("[data-testid^=tileset-db-row-]")].map((e) => e.dataset.testid));
res.refs = { rows: rows.length, tried: [] };
for (const id of rows.slice(0, 40)) {
  await page.evaluate((id) => document.querySelector(`[data-testid="${id}"]`)?.click(), id); await wait(700);
  await page.evaluate(() => document.querySelector("[data-testid=tileset-section-tab-references]")?.click()); await wait(1200);
  const info = await page.evaluate(() => { const r = document.querySelector("[data-testid=tileset-references]"); if (!r) return { present: false }; return { present: true, textLen: r.textContent.length, items: r.querySelectorAll("[data-testid*=doc], li, article, details").length, sample: r.textContent.trim().slice(0, 120) }; });
  res.refs.tried.push({ id, ...info });
  if (info.present && info.textLen > 200) { res.refs.chosen = id; await page.screenshot({ path: OUT + "beh-9-tileset-references.png" }); break; }
}
res.checks.reference_panel_has_document = !!res.refs.chosen;
await page.click("[data-testid=database-modal-close]").catch(() => {}); await wait(800);
// --- 4. 조수 패널
const vis = () => page.evaluate(() => { const e = document.querySelector("[data-testid=editor-ai-sidebar]"); return !!e && e.getBoundingClientRect().width > 0 && getComputedStyle(e).visibility !== "hidden"; });
const v0 = await vis(); await page.click("[data-testid=topbar-ai-studio]").catch(() => res.notes.push("topbar-ai-studio 없음")); await wait(1500);
const v1 = await vis(); await page.screenshot({ path: OUT + "beh-10-assistant-open.png" });
await page.click("[data-testid=topbar-ai-studio]").catch(() => {}); await wait(1500); const v2 = await vis();
res.assistant = { initial: v0, afterToggle: v1, afterSecondToggle: v2 };
res.checks.assistant_toggles = v0 !== v1 && v2 === v0;
writeFileSync(OUT + "behaviour2.json", JSON.stringify(res, null, 1));
console.log(JSON.stringify(res, null, 1));
await ctx.close();
