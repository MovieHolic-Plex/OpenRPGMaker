// 키트 견본 시트용 프로젝트 — 고른 키트마다 맵 하나(키트 + 둘레 한 칸 풀밭)를 만들어 render.mts 로 그린다.
//   npx tsx --import ./tiledata/jp-city/refs/css-stub.mjs scripts/content/fallen-astel/kit-sheet.mts <fixture.json> <out.json> <kit-id-regex>
import fs from "node:fs";
import { deserialize, serialize } from "../../../src/project/io";
const [src, out, pattern] = process.argv.slice(2);
const project = deserialize(fs.readFileSync(src!, "utf8"));
const hub = project.maps.fs_hub!;
const ts = project.tilesets[hub.tilesetId] as unknown as { structureKits: { id: string; width: number; height: number; rows: { tiles: number[]; upperTiles?: number[] }[] }[] };
const re = new RegExp(pattern!);
const kits = ts.structureKits.filter((k) => re.test(k.id));
const base = JSON.parse(JSON.stringify(hub));
for (const id of Object.keys(project.maps)) delete project.maps[id];
for (const k of kits) {
  const W = k.width + 2, H = k.height + 2;
  const m = { ...JSON.parse(JSON.stringify(base)), id: `kit__${k.id.replace(/[^a-z0-9_-]/gi, "_")}`, name: k.id, width: W, height: H, events: [], structurePlacements: [] };
  m.lowerTiles = Array(W * H).fill(737); m.upperTiles = Array(W * H).fill(-1);
  m.lowerOverlayTiles = Array(W * H).fill(-1); m.upperOverlayTiles = Array(W * H).fill(-1);
  delete m.relief;
  k.rows.forEach((row, y) => row.tiles.forEach((t, x) => { const i = (y + 1) * W + x + 1; if (t >= 0) m.lowerTiles[i] = t; const u = row.upperTiles?.[x] ?? -1; if (u >= 0) m.upperTiles[i] = u; }));
  project.maps[m.id] = m;
}
project.startMapId = Object.keys(project.maps)[0]!;
fs.writeFileSync(out!, serialize(project));
console.error(`kits ${kits.length}`);
