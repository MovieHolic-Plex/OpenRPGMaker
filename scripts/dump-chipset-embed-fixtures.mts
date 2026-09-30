/**
 * 임베딩 실험용 고정 데이터 덤프.
 *
 * 1) 480칸 정답표 — 하네스가 시딩한 런타임 타일셋에서 통행성/레이어/role/라벨을 읽는다.
 *    (사람이 만든 사전이 정답지다. 실험은 "이 사전을 픽셀만 보고 복원할 수 있나"를 묻는다.)
 * 2) 타일 크롭 — 칩셋 PNG를 16×16 조각 480장으로 자르고, CLIP 입력용으로 224×224
 *    nearest-neighbor 업스케일본도 함께 낸다(픽셀 아트를 보간하면 원본에 없는
 *    그라디언트가 생겨 임베딩이 그걸 학습한다 — 반드시 nearest).
 *
 * 산출: tmp-embed-lab/fixtures/{groundTruth.json, tiles16/NNN.png, tiles224/NNN.png}
 */
import fs from "node:fs";
import path from "node:path";
import Jimp from "jimp";
import { RESOURCE_SLICING } from "../src/assets/resourceSlicing.ts";
import { combinedTownTileset as combinedTownTileset as defaultTileset } from "../src/project/defaults/defaultAssets.ts";
import { COMBINED_TOWN_HARNESS_GROUPS } from "../src/project/tilesetHarness/combinedTownGroups.ts";
import { COMBINED_TOWN_TILE_SEMANTICS } from "../src/project/defaults/tileSemanticsCombinedTown.ts";
import { isTransparentChipsetTile } from "../src/project/defaults/chipsetMapping.ts";
import { DEFAULT_AUTOTILE_GROUPS } from "../src/project/defaults/autotileGroups.ts";

const SHEET = RESOURCE_SLICING.chipset;
const COLS = SHEET.columns;
const CELL = SHEET.cellWidth;
const UPSCALE = 224;

const CHIPSET_PNG = path.resolve("public/assets/easyrpg-chipset-combined-town-transparent.png");
const OUT_DIR = path.resolve("tmp-embed-lab/fixtures");
const DIR16 = path.join(OUT_DIR, "tiles16");
const DIR224 = path.join(OUT_DIR, "tiles224");

for (const dir of [OUT_DIR, DIR16, DIR224]) fs.mkdirSync(dir, { recursive: true });

const tileset = defaultTileset();

const groupOfTile = new Map<number, (typeof COMBINED_TOWN_HARNESS_GROUPS)[number]>();
for (const group of COMBINED_TOWN_HARNESS_GROUPS) {
  for (const tile of group.tileIds) if (!groupOfTile.has(tile)) groupOfTile.set(tile, group);
}
const semanticOfTile = new Map(COMBINED_TOWN_TILE_SEMANTICS.map((entry) => [entry.index, entry]));
const autotileMembers = new Set<number>(DEFAULT_AUTOTILE_GROUPS.flatMap((group) => group.memberTileIds));

/**
 * 시각 범주(visual category) — "그림만 보면 알 수 있어야 하는" 라벨.
 * 하네스 role 과 시맨틱 role 을 사람이 읽는 큰 범주로 접는다. 통행성·레이어와 달리
 * 이 라벨은 원리적으로 픽셀에 들어 있다 — 그래서 임베딩의 상한을 재는 대조군이 된다.
 */
function visualCategory(tile: number): string | null {
  const group = groupOfTile.get(tile);
  const semantic = semanticOfTile.get(tile);
  const role = group?.role ?? semantic?.role ?? null;
  if (!role) return null;
  switch (role) {
    case "water":
      return "water";
    case "terrain":
    case "floor":
      return "ground";
    case "wall":
      return "wall";
    case "roof":
      return "roof";
    case "fence":
      return "fence";
    case "door":
      return "door";
    case "window":
      return "window";
    case "tree":
      return "tree";
    case "stairs":
    case "structure":
      return "structure";
    case "building":
      // 하네스 building 그룹은 문/계단/지붕경계가 섞여 있어 라벨명으로 한 번 더 쪼갠다.
      if (group && /문|입구|door/i.test(group.name)) return "door";
      if (group && /계단|stair/i.test(group.name)) return "structure";
      if (group && /지붕/.test(group.name)) return "roof";
      return "wall";
    case "prop":
    case "decoration":
      return "prop";
    default:
      return null;
  }
}

const passableOf = (tile: number): boolean => {
  const flag = tileset.passability[tile];
  return Boolean(flag.up || flag.down || flag.left || flag.right);
};

const rows = Array.from({ length: tileset.count }, (_, tile) => {
  const group = groupOfTile.get(tile);
  const semantic = semanticOfTile.get(tile);
  const meta = tileset.tileMeta?.[tile];
  const label = (meta?.label ?? "").trim() || semantic?.label || "";
  return {
    tile,
    col: tile % COLS,
    row: Math.floor(tile / COLS),
    label,
    // 정답 라벨 3종
    visualCategory: visualCategory(tile),
    passable: passableOf(tile),
    layer: tileset.priority[tile] as "lower" | "upper",
    // 보조 정보
    harnessRole: group?.role ?? null,
    harnessGroupId: group?.id ?? null,
    semanticRole: semantic?.role ?? null,
    terrain: tileset.terrain[tile],
    transparent: isTransparentChipsetTile(tile),
    autotileMember: autotileMembers.has(tile),
    banned: /사용 금지/.test(label),
    hasAnyKnowledge: Boolean(group || semantic),
  };
});

const sheet = await Jimp.read(CHIPSET_PNG);
let emptyCount = 0;
const emptyTiles: number[] = [];

for (const row of rows) {
  const crop = sheet.clone().crop(row.col * CELL, row.row * CELL, CELL, CELL);
  // 완전 투명/단색 빈 칸 판별 — 임베딩 실험에서 제외해야 하는 칸.
  let opaque = 0;
  crop.scan(0, 0, CELL, CELL, function scanPixel(_x, _y, idx) {
    if (this.bitmap.data[idx + 3] > 8) opaque += 1;
  });
  const isEmpty = opaque === 0;
  if (isEmpty) {
    emptyCount += 1;
    emptyTiles.push(row.tile);
  }
  (row as Record<string, unknown>).opaquePixels = opaque;
  (row as Record<string, unknown>).empty = isEmpty;

  const name = String(row.tile).padStart(3, "0") + ".png";
  await crop.writeAsync(path.join(DIR16, name));
  // nearest-neighbor 업스케일: 픽셀 아트 원본 격자를 보존한다.
  await crop.clone().resize(UPSCALE, UPSCALE, Jimp.RESIZE_NEAREST_NEIGHBOR).writeAsync(path.join(DIR224, name));
}

const distribution = (key: "visualCategory" | "passable" | "layer") => {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const value = String((row as Record<string, unknown>)[key]);
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1]));
};

const payload = {
  generatedFrom: "defaultTileset() + COMBINED_TOWN_HARNESS_GROUPS + COMBINED_TOWN_TILE_SEMANTICS",
  sheet: { cols: COLS, cell: CELL, count: tileset.count, upscale: UPSCALE },
  emptyTiles,
  distribution: {
    visualCategory: distribution("visualCategory"),
    passable: distribution("passable"),
    layer: distribution("layer"),
  },
  tiles: rows,
};

fs.writeFileSync(path.join(OUT_DIR, "groundTruth.json"), JSON.stringify(payload, null, 2), "utf8");

console.log(`tiles: ${rows.length}, empty: ${emptyCount}`);
console.log("visualCategory:", payload.distribution.visualCategory);
console.log("passable:", payload.distribution.passable);
console.log("layer:", payload.distribution.layer);
console.log(`crops → ${DIR16} , ${DIR224}`);
