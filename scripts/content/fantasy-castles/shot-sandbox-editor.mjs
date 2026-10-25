// 샌드박스 SQLite 프로젝트를 띄운 편집기(oprn-serve.mjs)에서 맵 목록을 열고 맵마다 골라 화면을 찍는다. 그 뒤 같은 폴더를 다시 열어
// 편집기 로드·자동 저장이 타일셋 칸 표(통행·priority)와 맵 칸을 바꾸지 않았는지 확인한다.
//   FC_HOST=http://127.0.0.1:9871 FC_SAVE_DIR=/tmp/oprn-fantasy-castles-sandbox node scripts/content/fantasy-castles/shot-sandbox-editor.mjs
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { withTsModule } from "../../ontology-ts-loader.mjs";

const HOST = process.env.FC_HOST || "http://127.0.0.1:9871";
const DIR = process.env.FC_SAVE_DIR || "/tmp/oprn-fantasy-castles-sandbox";
const OUT = process.env.FC_SHOTS || "verify-shots/fantasy-castles";
const DATA = process.env.FC_DATA || "tiledata/fantasy-castles";
const def = JSON.parse(fs.readFileSync(`${DATA}/build/fantasyCastlesTileset.json`, "utf8"));
const maps = fs.readdirSync(`${DATA}/maps`).filter((f) => f.endsWith(".json")).sort().map((f) => JSON.parse(fs.readFileSync(`${DATA}/maps/${f}`, "utf8")).map);
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ["--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(HOST + "/", { waitUntil: "load" });
const visibleText = (text) => page.locator(`text="${text}" >> visible=true`).first();
await visibleText("맵").waitFor({ timeout: 180_000 });
await visibleText("맵").click();
const shots = [];
for (const m of maps) {
  await visibleText(m.name).click();
  await page.waitForFunction(() => document.querySelector("canvas") !== null, null, { timeout: 60_000 });
  await page.waitForTimeout(4000);
  const file = path.join(OUT, `editor-sandbox-${m.id}.png`);
  await page.screenshot({ path: file });
  shots.push(file);
}
await visibleText("그리기").click();
await page.waitForTimeout(1500);
const palette = path.join(OUT, "editor-sandbox-palette.png");
await page.screenshot({ path: palette });
shots.push(palette);
await browser.close();

const after = await withTsModule("electron/local-store/store.ts", "fc-store-after.mjs", async (store) => {
  const s = await store.openLocalProjectStore({ projectDir: DIR });
  const snap = s.loadSnapshot();
  s.close();
  return snap.project;
});
const ts = after.tilesets.fantasy_castles;
const changedCells = [];
for (let i = 0; i < def.count; i += 1) {
  if (ts.priority[i] !== def.priority[i] || ts.passability[i].up !== def.passability[i].up) changedCells.push([i, def.priority[i], ts.priority[i]]);
}
const mapChanged = maps.filter((m) => JSON.stringify(["lowerTiles", "lowerOverlayTiles", "upperTiles", "upperOverlayTiles"].map((k) => after.maps[m.id]?.[k]))
  !== JSON.stringify(["lowerTiles", "lowerOverlayTiles", "upperTiles", "upperOverlayTiles"].map((k) => m[k]))).map((m) => m.id);
const report = { host: HOST, projectDir: DIR, shots, errors, afterEditorLoad: { tilesetCellsChanged: changedCells.length, samples: changedCells.slice(0, 20), mapsChanged: mapChanged } };
fs.writeFileSync(path.join(OUT, "editor-sandbox.json"), JSON.stringify(report, null, 1) + "\n");
console.log(JSON.stringify(report, null, 1));
