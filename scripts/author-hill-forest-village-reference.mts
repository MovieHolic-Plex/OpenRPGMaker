/**
 * 「언덕 위 숲마을」 장소 저장본을 만든다 — 혼합 칩셋(합본 마을+레트로 월드맵+숲 나무) 위에
 * morphology=cluster(괴촌)·relief=hills(언덕) 마을을 결정적으로 시공해 비취 대계곡과 같은 형식으로 동결한다.
 *
 *   npx vite-node scripts/author-hill-forest-village-reference.mts
 *
 * 출력:
 *   src/project/regionReferences/hill-forest-village.json   — { map, tileset } 저장본(읽기 전용 참고 사례)
 *   public/assets/region-references/hill-forest-village.png — 16px/칸 미리보기(1024×1024)
 *
 * 같은 씨앗·같은 코드면 같은 결과가 나온다. 시공기가 바뀌어 저장본을 갱신하려면 이 스크립트를 다시 돌리고
 * regionReferences.ts 의 rules 가 여전히 맞는지 본다.
 */
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { createEmptyToolProject } from "../src/editor/tools/emptyProject";
import { runTool } from "../src/editor/tools/toolRunner";
import { buildVillageDomain } from "../src/editor/tools/village/builder";
import { chipsetQuarterComposition } from "../src/project/defaults/terrainQuarterAutotile";
import { tileBackingTile } from "../src/editor/tileLayerPolicy";
import { COMBINED_TOWN_RETRO_WORLD_TILESET_ID } from "../src/project/defaults/constants";
import { FOREST_TREE_CELLS } from "../src/project/defaults/forestTreesExtension";
import type { GameMap, Project, TilesetDef } from "../src/project/types";

const HILL_FOREST_VILLAGE = {
  referenceId: "hill-forest-village-64x64",
  mapId: "map_hill_forest_village_20260918",
  mapName: "언덕 위 숲마을 · 괴촌",
  size: 64,
  seed: 7,
  theme: "평범한 마을",
  morphology: "cluster",
  relief: "hills",
} as const;

const T = 16, COLS = 30;
const SHEET = "public/assets/easyrpg-chipset-combined-town-retro-world-transparent.png";
const OUT_JSON = "src/project/regionReferences/hill-forest-village.json";
const OUT_PNG = "public/assets/region-references/hill-forest-village.png";

function render(map: GameMap, tileset: TilesetDef, chip: PNG): PNG {
  const png = new PNG({ width: map.width * T, height: map.height * T });
  const blit = (tile: number, dx: number, dy: number, q?: { sx: number; sy: number; sw: number; sh: number }): void => {
    if (tile < 0) return;
    const sx0 = (tile % COLS) * T + (q?.sx ?? 0), sy0 = Math.floor(tile / COLS) * T + (q?.sy ?? 0);
    const sw = q?.sw ?? T, sh = q?.sh ?? T;
    for (let y = 0; y < sh; y += 1) for (let x = 0; x < sw; x += 1) {
      const si = ((sy0 + y) * chip.width + (sx0 + x)) * 4, di = ((dy + y) * png.width + (dx + x)) * 4;
      if (chip.data[si + 3] === 0) continue;
      png.data[di] = chip.data[si]!; png.data[di + 1] = chip.data[si + 1]!; png.data[di + 2] = chip.data[si + 2]!; png.data[di + 3] = 255;
    }
  };
  for (let y = 0; y < map.height; y += 1) for (let x = 0; x < map.width; x += 1) {
    const i = y * map.width + x, dx = x * T, dy = y * T;
    const backing = tileBackingTile(tileset, map.lowerTiles[i]!);
    if (backing !== null) blit(backing, dx, dy);
    const comp = chipsetQuarterComposition(map, tileset as never, x, y);
    if (comp) {
      blit(comp.underlayTile ?? map.lowerTiles[i]!, dx, dy);
      for (const s of comp.sources) blit(s.tile, dx + s.offsetX, dy + s.offsetY, { sx: s.offsetX, sy: s.offsetY, sw: 8, sh: 8 });
    } else if (map.lowerTiles[i]! >= 0) blit(map.lowerTiles[i]!, dx, dy);
    if (map.upperTiles[i]! >= 0) blit(map.upperTiles[i]!, dx, dy);
  }
  return png;
}

function buildHillForestVillage(): { project: Project; map: GameMap; tileset: TilesetDef; summary: string } {
  const context: { project: Project } = { project: createEmptyToolProject("언덕 위 숲마을 참고 사례") };
  const created = runTool(context, "create_map", {
    id: HILL_FOREST_VILLAGE.mapId, name: HILL_FOREST_VILLAGE.mapName,
    width: HILL_FOREST_VILLAGE.size, height: HILL_FOREST_VILLAGE.size, tilesetId: COMBINED_TOWN_RETRO_WORLD_TILESET_ID,
  });
  if (!created.ok) throw new Error(`create_map 실패: ${created.summary}`);
  const result = buildVillageDomain(context.project, {
    mapId: HILL_FOREST_VILLAGE.mapId, seed: HILL_FOREST_VILLAGE.seed, theme: HILL_FOREST_VILLAGE.theme,
    morphology: HILL_FOREST_VILLAGE.morphology, relief: HILL_FOREST_VILLAGE.relief,
  });
  const map = context.project.maps[HILL_FOREST_VILLAGE.mapId]!;
  const tileset = context.project.tilesets[map.tilesetId]!;
  return { project: context.project, map, tileset, summary: result.summary };
}

function main(): void {
  const { map, tileset, summary } = buildHillForestVillage();
  const forestCells = [...map.lowerTiles, ...map.upperTiles].filter((tile) => FOREST_TREE_CELLS.has(tile)).length;
  const houses = (map.layoutPlan?.regions ?? []).filter((region) => region.role === "house").length;
  if (houses < 6 || forestCells < 100) throw new Error(`저장본 품질 미달: 집 ${houses}, 숲 나무 칸 ${forestCells}`);
  // 저장본은 비취 대계곡과 같은 형식 — 맵(타일·layoutPlan·주민 배치)과 그 타일셋 정의를 함께 동결한다.
  // 집 문 이벤트는 이 프로젝트의 실내 맵으로 transfer 하므로 맵 한 장짜리 저장본에서는 빠진다(대상 맵이 없다).
  const events = map.events.filter((event) => event.id.startsWith("ev_village_"));
  const snapshot = {
    map: {
      id: map.id, name: map.name, width: map.width, height: map.height, tileSize: map.tileSize, tilesetId: map.tilesetId,
      layoutPlan: map.layoutPlan, lowerTiles: map.lowerTiles, upperTiles: map.upperTiles, events,
    },
    tileset,
  };
  fs.writeFileSync(OUT_JSON, JSON.stringify(snapshot));
  const chip = PNG.sync.read(fs.readFileSync(SHEET));
  fs.mkdirSync(path.dirname(OUT_PNG), { recursive: true });
  fs.writeFileSync(OUT_PNG, PNG.sync.write(render(map, tileset, chip), { deflateLevel: 9, deflateStrategy: 0, filterType: 0 }));
  console.log(JSON.stringify({
    referenceId: HILL_FOREST_VILLAGE.referenceId, mapId: map.id, size: [map.width, map.height], houses, forestCells,
    events: events.length, json: `${OUT_JSON} ${fs.statSync(OUT_JSON).size}B`, png: `${OUT_PNG} ${fs.statSync(OUT_PNG).size}B`,
    summary: summary.slice(0, 200),
  }, null, 2));
}

main();
