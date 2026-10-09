// 타일 id 별 통행성/라벨 실측 — 빈 프로젝트를 띄워 paint_tiles 로 한 칸 칠하고 passableCount 로 잰다.
import { chromium } from "@playwright/test";
const BASE = process.env.BASE ?? "http://127.0.0.1:9851";
const IDS = (process.env.IDS ?? "342,120,0,1,2,390,391,392,393,394,395,423,424,425,453,454,455,365,240,360,421,246,306").split(",").map(Number);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
page.setDefaultTimeout(15000);
page.on("dialog", (d) => d.accept());
await page.addInitScript(() => { localStorage.setItem("oprn:editor-ui-mode", "standard"); localStorage.setItem("oprn:editor-welcome-dismissed", "1"); localStorage.setItem("oprn:standard-welcome-seen", "1"); localStorage.setItem("oprn:coachmarks-basic-v1", "1"); });
for (let attempt = 0; attempt < 3; attempt++) {
  try {
    await page.goto(`${BASE}/?blankProject=1`, { waitUntil: "domcontentloaded" });
    const guest = page.getByTestId("login-guest");
    if (await guest.isVisible({ timeout: 4000 }).catch(() => false)) await guest.click();
    await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 90000 });
    await page.waitForFunction(() => !!window.__oprnEditorTool && !!window.__oprnRegionTaskHarness, null, { timeout: 60000 });
    break;
  } catch (e) { console.error("boot retry", String(e).slice(0, 120)); }
}
const start = page.getByTestId("standard-welcome-start");
if (await start.isVisible().catch(() => false)) await start.click();
await page.waitForTimeout(1500);
const rows = await page.evaluate(async (ids) => {
  const h = window.__oprnRegionTaskHarness;
  const mapId = h.currentMapId();
  const out = [];
  const info = await window.__oprnEditorTool("get_tile_info", { tileIds: ids.slice(0, 30) });
  const tiles = info?.data?.tiles ?? [];
  for (const id of ids) {
    const x = 2, y = 2;
    const r = await window.__oprnEditorTool("paint_tiles", { mapId, layer: "lower", mode: "cells", tile: id, cells: [{ x, y }] });
    const passLower = h.passableCount(mapId, { x, y, w: 1, h: 1 });
    await window.__oprnEditorTool("paint_tiles", { mapId, layer: "lower", mode: "cells", tile: 240, cells: [{ x, y }] });
    await window.__oprnEditorTool("paint_tiles", { mapId, layer: "upper", mode: "cells", tile: -1, cells: [{ x, y }] });
    const t = tiles.find((e) => e.tileId === id || e.id === id || e.index === id);
    out.push({ id, ok: r?.ok, summary: (r?.summary ?? r?.error ?? "").slice(0, 120), passable: passLower, label: t ? JSON.stringify(t).slice(0, 220) : null });
  }
  return out;
}, IDS);
for (const r of rows) console.log(JSON.stringify(r));
await browser.close();
