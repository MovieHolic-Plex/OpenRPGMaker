// node verify-shots/editor-lag-integrated/behaviour.mjs  (repo root, BASE=서버). 결과: behaviour.json + beh-*.png
import { launch, BASE, wait, rmSync, writeFileSync } from "./lib.mjs";
import { DatabaseSync } from "node:sqlite";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
const OUT = "verify-shots/editor-lag-integrated/";
const DB = "/tmp/lag-int/run-after/project.sqlite";
const MAP = "map_blank_start";
const profile = "/tmp/lag-int/prof-beh"; rmSync(profile, { recursive: true, force: true });
const res = { checks: {}, notes: [] };
const q = () => { const db = new DatabaseSync(DB, { readOnly: true }); const r = db.prepare("select width,height,map_json from maps where map_id=?").get(MAP); db.close(); const m = JSON.parse(r.map_json); return { w: r.width, h: r.height, m }; };
const flat = (t) => (Array.isArray(t) ? t.flat(3) : []);
const { ctx, page } = await launch({ profile });
page.on("pageerror", (e) => (res.pageerrors ??= []).push(String(e).slice(0, 200)));
const ready = () => page.evaluate(() => typeof window.__oprnEditWorldToClient === "function" && document.querySelectorAll("canvas").length > 0).catch(() => false);
const boot = async (first) => { await (first ? page.goto(BASE + "/") : page.reload()); for (let i = 0; i < 3000; i++) { if (await ready()) break; await wait(40); } await wait(2500); };
const openMap = async () => { await page.click("[data-testid=sidebar-maps]"); await wait(600); await page.click(`[data-testid=map-tree-node-${MAP}]`); await wait(2500); await page.click("[data-testid=layer-lower]"); await wait(400); };
const shot = async (name) => { await page.mouse.move(400, 100); await page.mouse.move(410, 110); await wait(500); const c = await page.evaluate(() => { const r = [...document.querySelectorAll("canvas")].map(e => e.getBoundingClientRect()).sort((a, b) => b.width * b.height - a.width * a.height)[0]; return { x: r.x, y: r.y, width: r.width, height: r.height }; }); return page.screenshot({ path: OUT + name + ".png", clip: c }); };
const GHOST = [40, 32, 90, 84]; // 호버 미리보기(마우스 위치) 영역은 비교에서 뺀다
const diff = (a, b) => { const A = PNG.sync.read(a), B = PNG.sync.read(b); if (A.width !== B.width || A.height !== B.height) return -1; for (const P of [A, B]) for (let y = GHOST[1]; y < GHOST[3]; y++) for (let x = GHOST[0]; x < GHOST[2]; x++) { const i = (y * P.width + x) * 4; P.data[i] = P.data[i + 1] = P.data[i + 2] = 0; }
  return pixelmatch(A.data, B.data, null, A.width, A.height, { threshold: 0.05 }); };

await boot(true); await openMap();
const before = q(); const lt0 = flat(before.m.lowerTiles);
res.map = { w: before.w, h: before.h, tileSize: before.m.tileSize };
const tileId = await page.evaluate(() => { const e = [...document.querySelectorAll("[data-testid^=chipset-tile-]")].filter(e => e.getBoundingClientRect().width > 0)[5]; e?.click(); return e?.dataset.testid; });
await page.click("[data-testid=tool-paint]").catch(() => {}); await wait(400);
const A = await shot("beh-1-before-paint");
const cv = await page.evaluate(() => { const c = [...document.querySelectorAll("canvas")].map(c => c.getBoundingClientRect()).sort((a, b) => b.width * b.height - a.width * a.height)[0]; return { x: c.x, y: c.y, w: c.width, h: c.height }; });
await page.mouse.move(cv.x + cv.w / 2 - 100, cv.y + cv.h / 2); await page.mouse.down(); await page.mouse.up(); await wait(500);
const B = await shot("beh-2-after-paint");
res.checks.paint_visible_pixels = diff(A, B);
await wait(8000); await page.click("[data-testid=toolbar-save]").catch(() => res.notes.push("toolbar-save 없음")); await wait(4000);
const saved = q(); const lt1 = flat(saved.m.lowerTiles);
res.checks.paint_saved_changed_cells = lt0.reduce((n, v, i) => n + (v !== lt1[i] ? 1 : 0), 0);
// 되돌리기 / 다시하기
console.log(JSON.stringify(res), await page.evaluate(()=>["oprn-tool-undo","oprn-tool-redo"].map(t=>document.querySelector(`[data-testid=${t}]`)?.disabled)));
await page.click("[data-testid=oprn-tool-undo]"); await wait(600); const C = await shot("beh-3-undo");
res.checks.undo_equals_before_paint_diff = diff(A, C);
await page.click("[data-testid=oprn-tool-redo]"); await wait(600); const D = await shot("beh-4-redo");
res.checks.redo_equals_painted_diff = diff(B, D);
await wait(8000); await page.click("[data-testid=toolbar-save]").catch(() => {}); await wait(3000);
// 재로드
await boot(false); await openMap();
const E = await shot("beh-5-after-reload");
const rl = q(); const lt2 = flat(rl.m.lowerTiles);
res.checks.reload_db_cells_vs_saved = lt1.reduce((n, v, i) => n + (v !== lt2[i] ? 1 : 0), 0);
res.checks.reload_canvas_vs_painted_diff = diff(B, E);
res.checks.reload_canvas_vs_before_paint_diff = diff(A, E);
res.tileId = tileId;
writeFileSync(OUT + "behaviour.json", JSON.stringify(res, null, 1));
console.log(JSON.stringify(res));
await ctx.close();
