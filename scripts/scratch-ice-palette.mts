// Scratch: measure passage marks + priority for the ice-plain palette candidates.
import { createBlankProject } from "../src/project/defaults";
import { passageMarkForTile } from "../src/project/tilesetPassage";
import { DUNGEON_TILESET_ID } from "../src/project/defaults/dungeonThemedLayouts";
import { dungeonTerrainBlockRoles } from "../src/project/defaults/dungeonTerrainAutotiles";

const project = createBlankProject();
const tileset = project.tilesets[DUNGEON_TILESET_ID];
if (!tileset) throw new Error("dungeon tileset missing");

const GROUPS: Record<string, readonly number[]> = {
  "눈밭 9슬라이스": [6, 7, 8, 36, 37, 38, 66, 67, 68, 96, 97, 98],
  "얼음 바닥 9슬라이스": [9, 10, 11, 39, 40, 41, 69, 70, 71, 99, 100, 101],
  "심연(어두운 못)": [396, 397, 398, 426, 427, 428, 456, 457, 458],
  "수평 절벽": [372, 373, 374, 285, 402, 403, 404],
  "대각 빙벽": [286, 287, 316, 317, 346, 347],
  "계단": [375, 376, 377],
  "부빙": [282, 283, 284, 312, 313, 314, 342, 343, 344],
  "봉우리": [408, 409, 438, 439, 410],
  "눈처짐": [237, 238, 239],
  "얼음 수정": [350, 351],
  "석순": [261, 288, 291],
  "얼음 블록": [232],
  "눈뭉치·눈사람": [315, 345],
  "마법 블록": [125, 155, 185, 215],
};

const out: Record<string, unknown> = {};
for (const [label, tiles] of Object.entries(GROUPS)) {
  out[label] = tiles.map((t) => ({
    t,
    mark: t >= 0 && t < tileset.count ? passageMarkForTile(tileset, t) : "oob",
    prio: tileset.priority[t],
    label: tileset.tileMeta?.[t]?.label ?? "",
  }));
}

out["_roles"] = dungeonTerrainBlockRoles().map((r) => ({
  key: r.key, body: r.body,
  edges: { n: r.edgeNorth, s: r.edgeSouth, w: r.edgeWest, e: r.edgeEast },
  corners: { nw: r.cornerNW, ne: r.cornerNE, sw: r.cornerSW, se: r.cornerSE },
  inner: { nw: r.innerNW, ne: r.innerNE, sw: r.innerSW, se: r.innerSE },
  isolated: r.isolated,
}));
out["_count"] = tileset.count;

console.log(JSON.stringify(out, null, 1));
