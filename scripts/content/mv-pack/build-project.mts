// 사용자가 받은 RPG Maker MV/MZ 팩 폴더 → 프리셋 타일셋이 든 헤드리스 프로젝트(JSON).
// 그림은 저장소 밖(--out)에만 쓴다. 재배포 금지 팩이라 결과물을 커밋하지 않는다.
//
//   bun scripts/content/mv-pack/build-project.mts --pack ~/rasak-modern/extracted/Rasaks_Modern_Tileset \
//     --preset rasak-modern-city --out ~/rasak-modern/preset --map city:40x30
//
// 산출: <out>/project.json(맵 + 타일셋 + 업로드 자산), <out>/atlas.png, <out>/refs/*.png(참고문서 그림), <out>/example.png
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { createBlankProject } from "../../../src/project/defaults/defaultProject.ts";
import { buildMvPackTileset, renderMvMap } from "../../../src/project/rpgmakerMv/tilesetPreset.ts";
import { MV_PACK_PRESETS } from "../../../src/project/rpgmakerMv/packs/index.ts";
import type { RgbaImage } from "../../../src/project/rpgmakerMv/bake.ts";

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? fallback : process.argv[i + 1] ?? fallback;
}
const packRoot = arg("pack");
const out = arg("out");
const presetId = arg("preset", "rasak-modern-city")!;
if (!packRoot || !out) throw new Error("--pack <팩 폴더> --out <출력 폴더> 가 필요합니다");
const preset = MV_PACK_PRESETS.find((p) => p.id === presetId);
if (!preset) throw new Error(`프리셋 없음: ${presetId} (${MV_PACK_PRESETS.map((p) => p.id).join(", ")})`);

function findFiles(dir: string, found = new Map<string, string>()): Map<string, string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findFiles(full, found);
    else if (!found.has(entry.name)) found.set(entry.name, full);
  }
  return found;
}
const files = findFiles(packRoot);
const sheets = new Map<string, RgbaImage>();
const report: string[] = [];
for (const sheet of preset.sheets) {
  const file = files.get(sheet.file);
  if (!file) { report.push(`없음: ${sheet.folder}/${sheet.file}`); continue; }
  const bytes = fs.readFileSync(file);
  const hash = crypto.createHash("sha256").update(bytes).digest("hex");
  if (hash !== sheet.sha256) report.push(`판본 다름(번호가 어긋날 수 있음): ${sheet.file}`);
  sheets.set(sheet.file, PNG.sync.read(bytes));
}
const encodePng = (image: RgbaImage) => {
  const png = new PNG({ width: image.width, height: image.height });
  png.data = Buffer.from(image.data.buffer, image.data.byteOffset, image.data.byteLength);
  return `data:image/png;base64,${PNG.sync.write(png).toString("base64")}`;
};
const t0 = Date.now();
const tilesetId = `ts_${preset.id.replace(/-/g, "_")}`;
const assetId = `chipset_img_${preset.id.replace(/-/g, "_")}`;
const built = buildMvPackTileset({ preset, sheets, tilesetId, assetId, encodePng });
const atlasUrl = encodePng(built.atlas);
fs.mkdirSync(path.join(out, "refs"), { recursive: true });
fs.writeFileSync(path.join(out, "atlas.png"), Buffer.from(atlasUrl.split(",")[1]!, "base64"));
for (const category of built.tileset.referenceDocuments ?? []) {
  for (const image of category.images) fs.writeFileSync(path.join(out, "refs", `${image.id}.png`), Buffer.from(image.dataUrl.split(",")[1]!, "base64"));
  for (const doc of category.documents) fs.writeFileSync(path.join(out, "refs", `${doc.id}.md`), doc.markdown);
}
fs.writeFileSync(path.join(out, "example.png"), Buffer.from(encodePng(renderMvMap(built.example, built.atlas, built.tileset.tilesPerRow)).split(",")[1]!, "base64"));

const project = createBlankProject();
project.assets.uploaded[assetId] = {
  id: assetId, name: preset.name, kind: "chipset", dataUrl: atlasUrl,
  meta: { tileSize: 48, frames: built.tileset.count, frameWidth: 48, frameHeight: 48, width: built.atlas.width, height: built.atlas.height },
};
project.tilesets[tilesetId] = built.tileset;
for (const spec of (arg("map", "city:40x30") ?? "").split(",").filter(Boolean)) {
  const [id, size = "40x30"] = spec.split(":");
  const [w, h] = size.split("x").map(Number);
  project.maps[id!] = {
    id: id!, name: id!, width: w!, height: h!, tilesetId, tileSize: 48,
    lowerTiles: new Array(w! * h!).fill(-1), upperTiles: new Array(w! * h!).fill(-1), events: [],
  } as never;
  project.mapTree.children.push({ mapId: id!, children: [] } as never);
}
fs.writeFileSync(path.join(out, "project.json"), JSON.stringify(project));
const t = built.tileset;
console.log(JSON.stringify({
  ms: Date.now() - t0, report, count: t.count, atlas: [built.atlas.width, built.atlas.height],
  autotileGroups: t.autotileGroups?.length, tileGroups: t.tileGroups?.length, kits: t.structureKits?.length,
  refs: t.referenceDocuments?.map((c) => ({ docs: c.documents.map((d) => [d.id, d.markdown.length]), images: c.images.map((i) => [i.id, i.dataUrl.length]) })),
  projectBytes: fs.statSync(path.join(out, "project.json")).size,
}, null, 1));
