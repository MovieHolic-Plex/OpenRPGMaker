// Extract the live map_snow_mountain_60 + its tileset from the running editor (read-only).
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const URL =
  "http://localhost:9999/?project=rpg-zzu-quest-demo&name=%EC%84%A4%EC%82%B0+%C2%B7+%EC%A0%88%EB%B2%BD+%EB%8B%A4%EC%84%AF+%EA%B2%B9+%2860%C3%9760%29&map=map_snow_mountain_60";
const MAP_ID = "map_snow_mountain_60";

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(URL, { waitUntil: "domcontentloaded" });
const exportEl = page.getByTestId("project-export-json");
await exportEl.waitFor({ state: "attached", timeout: 60_000 });
const text = await exportEl.textContent();
if (!text) throw new Error("empty project-export-json");
const parsed = JSON.parse(text) as { project: { maps: Record<string, unknown>; tilesets: Record<string, unknown> } };
const map = parsed.project.maps[MAP_ID] as { tilesetId: string } | undefined;
if (!map) throw new Error(`map not in export; maps: ${Object.keys(parsed.project.maps).join(",")}`);
writeFileSync("tmp/snow60-live.json", JSON.stringify(map));
const tileset = parsed.project.tilesets[map.tilesetId];
writeFileSync("tmp/snow60-tileset.json", JSON.stringify(tileset));
const ts = tileset as { id: string; name: string; tileSize: number; tilesPerRow: number; count: number; image: unknown };
console.log(JSON.stringify({ tilesetId: ts.id, name: ts.name, tileSize: ts.tileSize, tilesPerRow: ts.tilesPerRow, count: ts.count, image: ts.image }));
await browser.close();
