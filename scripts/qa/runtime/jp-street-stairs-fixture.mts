// jp-street-stairs.scenario.mjs 픽스처 — jp_city 거리 계단(육교 곧은 계단·상판, 옆 계단 한 쌍·단상, 벽 사다리)을 번들 키트 그대로 찍은 광장 맵.
//   node node_modules/vite-node/dist/cli.mjs --script scripts/qa/runtime/jp-street-stairs-fixture.mts > /tmp/jps.json
// 기준 프로젝트는 editor-authored-demo-v3(주인공 캐릭셋 정상). 키트 칸은 structureKits 의 rows 그대로(1층=lowerTiles, 위층=upperTiles, layer4 키트=upperOverlayTiles).
import { readFileSync } from "node:fs";
import { deserialize, serializePretty } from "@/project/io";
import { createJpCityTileset } from "@/project/defaults/jpCity";

export const MAP = "jp-street-stairs";
const W = 36, H = 22, PLAZA = 3379, ROAD = 3232;
const project = deserialize(readFileSync("test/fixtures/projects/editor-authored-demo-v3.json", "utf8"));
const TS = createJpCityTileset();
project.tilesets.jp_city = TS;
const KIT = Object.fromEntries((TS.structureKits ?? []).map((k) => [k.id, k]));
const L1 = new Array(W * H).fill(PLAZA), L2 = new Array(W * H).fill(-1), L3 = new Array(W * H).fill(-1), L4 = new Array(W * H).fill(-1);
for (let y = 0; y < H; y++) for (let x = 13; x <= 18; x++) L1[y * W + x] = ROAD;
function stamp(id: string, x0: number, y0: number, top = L3) {
  const k = KIT[id];
  if (!k) throw new Error("키트 없음 " + id);
  for (let r = 0; r < k.height; r++) for (let c = 0; c < k.width; c++) {
    if (x0 + c < 0 || x0 + c >= W) continue;
    const row = k.rows[r]!, i = (y0 + r) * W + x0 + c, t = row.tiles[c] ?? -1, u = row.upperTiles?.[c] ?? -1;
    if (t >= 0) L1[i] = t;
    if (u >= 0) top[i] = u;
  }
}
stamp("jp-bldg-station-small", -2, 1);
stamp("jp-wall-ladder", 10, 4, L4);
stamp("jp-overpass-stair-e", 11, 8);
for (const x of [13, 15, 17]) stamp("jp-overpass-deck-red", x, 8);
stamp("jp-overpass-stair-w", 19, 8);
stamp("jp-side-stair-l", 22, 17);
for (const x of [25, 27]) stamp("jp-stage-platform", x, 15);
stamp("jp-side-stair-r", 29, 17);
project.maps[MAP] = { id: MAP, name: "거리 계단 시험(육교·옆 계단·사다리)", width: W, height: H, tilesetId: "jp_city", tileSize: 16,
  lowerTiles: L1, lowerOverlayTiles: L2, upperTiles: L3, upperOverlayTiles: L4, events: [] } as never;
project.mapTree = { ...project.mapTree, children: [...(project.mapTree?.children ?? []), { mapId: MAP, children: [] }] } as typeof project.mapTree;
project.startMapId = MAP;
project.startPos = { x: 11, y: 18 };
process.stdout.write(serializePretty(project));
