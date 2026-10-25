// 재로드한 샌드박스 프로젝트(save-fantasy-castles.mjs 의 FC_EXPORT_RELOADED)의 맵을 편집기의 실제 캔버스 렌더러
// (editor/mapTileDrawCore.drawMapTileLayers — 「맵 스크린샷」·지역 스냅숏이 쓰는 함수)로 헤드리스 Chromium 에서 그리고
// 변환기 입력의 composite.png 와 화소 단위로 비교한다. vite dev 서버(npm run dev:worktree)가 떠 있어야 한다.
//   FC_RELOADED=/tmp/fc-reloaded.json FC_DEV=http://127.0.0.1:9854 node scripts/content/fantasy-castles/render-fantasy-castles.mjs
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { PNG } from "pngjs";

const DATA = process.env.FC_DATA || "tiledata/fantasy-castles";
const OUT = process.env.FC_SHOTS || "verify-shots/fantasy-castles";
const DEV = process.env.FC_DEV || "http://127.0.0.1:9854";
const reloaded = JSON.parse(fs.readFileSync(process.env.FC_RELOADED || "/tmp/fc-reloaded.json", "utf8"));
const sheet = fs.readFileSync(`${DATA}/build/fantasy-castles-chipset.png`);
const composites = JSON.parse(process.env.FC_COMPOSITES || "{}");
fs.mkdirSync(OUT, { recursive: true });

const mapIds = Object.keys(reloaded.maps).filter((id) => reloaded.maps[id].tilesetId === "fantasy_castles");
const tileset = reloaded.tilesets.fantasy_castles;
const project = { tilesets: { fantasy_castles: tileset }, maps: Object.fromEntries(mapIds.map((id) => [id, reloaded.maps[id]])),
  assets: { uploaded: { [tileset.image.id]: { ...reloaded.assets.uploaded[tileset.image.id], ref: undefined, dataUrl: `data:image/png;base64,${sheet.toString("base64")}` } } } };

const browser = await chromium.launch({ args: ["--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(`${DEV}/src/editor/mapTileDrawCore.ts`);
const result = {};
for (const id of mapIds) {
  const b64 = await page.evaluate(async ({ project, id }) => {
    const draw = await import("/src/editor/mapTileDrawCore.ts");
    const map = project.maps[id], tileset = project.tilesets[map.tilesetId];
    const image = new Image();
    image.src = project.assets.uploaded[tileset.image.id].dataUrl;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = map.width * 16; canvas.height = map.height * 16;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    draw.drawMapTileLayers(ctx, image, map, tileset, 1);
    return canvas.toDataURL("image/png").split(",")[1];
  }, { project, id });
  const file = path.join(OUT, `editor-render-${id}.png`);
  fs.writeFileSync(file, Buffer.from(b64, "base64"));
  const got = PNG.sync.read(Buffer.from(b64, "base64"));
  const wantFile = composites[id] || `${DATA}/src/${id.replace(/^fc_/, "").replace(/_/g, "-")}/composite.png`;
  const want = PNG.sync.read(fs.readFileSync(wantFile));
  let differing = 0, maxDelta = 0;
  const heat = new PNG({ width: got.width, height: got.height });
  if (got.width === want.width && got.height === want.height) {
    for (let i = 0; i < got.width * got.height; i += 1) {
      let d = 0;
      for (let c = 0; c < 3; c += 1) d = Math.max(d, Math.abs(got.data[i * 4 + c] - want.data[i * 4 + c]));
      const g = Math.round((want.data[i * 4] + want.data[i * 4 + 1] + want.data[i * 4 + 2]) / 3 * 0.35);
      heat.data[i * 4] = d ? 255 : g; heat.data[i * 4 + 1] = d ? 40 : g; heat.data[i * 4 + 2] = d ? 40 : g; heat.data[i * 4 + 3] = 255;
      if (d) { differing += 1; maxDelta = Math.max(maxDelta, d); }
    }
    fs.writeFileSync(path.join(OUT, `editor-render-diff-${id}.png`), PNG.sync.write(heat));
  }
  result[id] = { render: file, against: wantFile, size: [got.width, got.height], wantSize: [want.width, want.height],
    sameSize: got.width === want.width && got.height === want.height, pixels: got.width * got.height, differing, maxDelta };
}
await browser.close();
fs.writeFileSync(path.join(OUT, "editor-render.json"), JSON.stringify({ renderer: "src/editor/mapTileDrawCore.ts drawMapTileLayers (headless Chromium, vite dev)", errors, result }, null, 1) + "\n");
console.log(JSON.stringify({ errors, result }, null, 1));
if (errors.length || Object.values(result).some((r) => !r.sameSize || r.differing)) process.exit(1);
