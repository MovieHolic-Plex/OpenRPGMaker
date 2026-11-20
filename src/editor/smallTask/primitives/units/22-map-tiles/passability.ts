import { bundledTilesetDefinitionReady, ensureBundledTilesets } from "@/project/defaults/defaultAssets";
import { cellPassability } from "@/project/collision";
import { cellLayerTiles, layerTileAt, TILE_LAYER_NOS } from "@/project/mapLayers";
import { ensureTilesetHarnesses } from "@/project/tilesetHarness";
import { blockedFlag, passableFlag } from "@/project/tilesetPassage";
import { jsonEqual } from "@/util/structuralJson";
import { PrimitiveError } from "../../errors";
import type { PrimitiveContext } from "../../types";
import { getTileset, hostRegion, includesCell, requireTile } from "./region";
import { assertTileReferencesPreserved } from "./references";

export function setRegionPassability(ctx: PrimitiveContext, args: Record<string, unknown>) {
  const { project } = ctx;
  const { map, rect } = hostRegion(ctx);
  const tileset = getTileset(project, map);
  const tile = requireTile(project, map, args.tile);
  const contains = (x: number, y: number) => includesCell(rect, x, y);
  const flags = args.passable === true ? passableFlag() : blockedFlag();
  const selected: number[] = [];
  const used: number[] = [];
  for (const candidate of Object.values(project.maps)) {
    if (candidate.tilesetId !== map.tilesetId) continue;
    for (let index = 0; index < candidate.width * candidate.height; index++) {
      const onMap = cellLayerTiles(candidate, index).includes(tile);
      if (!onMap && !candidate.lowerTileStacks?.[index]?.includes(tile) && !candidate.upperTileStacks?.[index]?.includes(tile)) continue;
      if (candidate !== map || !contains(index % candidate.width, Math.floor(index / candidate.width))) {
        throw new PrimitiveError("범위 밖: 선택한 영역 밖에서도 같은 타일을 써요.");
      }
      if (map.terrainDesign?.lockedCells?.includes(index) && !jsonEqual(tileset.passability[tile], flags)) {
        throw new PrimitiveError("범위 밖: 보호된 타일의 통행을 바꿀 수 없어요.");
      }
      if (onMap) selected.push(index);
      used.push(index);
    }
  }
  if (!selected.length) throw new PrimitiveError("범위 밖: 선택한 영역에 이 타일이 없어요.");
  const passability = tileset.passability.slice();
  passability[tile] = flags;
  const edited = { ...tileset, passability };
  if (selected.some(index => !jsonEqual(cellPassability(edited, map, index), flags))) {
    throw new PrimitiveError("이 칸의 통행은 높이 지형이나 다른 층의 타일이 결정해요.");
  }
  if (jsonEqual(tileset.passability[tile], flags)) return project;
  const after = { ...project, tilesets: { ...project.tilesets, [map.tilesetId]: edited } };
  assertTileReferencesPreserved(project, after, map, map, { tile, contains });

  if (map.tilesetId.startsWith("shared_")) {
    throw new PrimitiveError("공용 타일셋의 통행 설정은 프로젝트에 저장할 수 없어요.");
  }
  const probeMap = structuredClone(map);
  const probe = { tilesets: { [map.tilesetId]: structuredClone(edited) }, maps: { [map.id]: probeMap } };
  // Bundles can replace flags and relocate graft/workshop tiles. Follow the tile's
  // source image and verify that each saved cell still refers to the same tile.
  if (bundledTilesetDefinitionReady(map.tilesetId) !== undefined) ensureBundledTilesets(probe);
  else ensureTilesetHarnesses(probe);
  const reloaded = probe.tilesets[map.tilesetId];
  const graft = tileset.tileGrafts?.find(entry => entry.targetTile === tile);
  const firstUse = selected[0]!;
  const firstLayer = TILE_LAYER_NOS.find(layer => layerTileAt(map, layer, firstUse) === tile)!;
  const normalizedTile = layerTileAt(probeMap, firstLayer, firstUse);
  const normalizedGraft = reloaded?.tileGrafts?.find(entry => entry.targetTile === normalizedTile);
  const sameSource = graft
    ? graft.sourceChipset === normalizedGraft?.sourceChipset && graft.sourceTile === normalizedGraft.sourceTile
    : !normalizedGraft && normalizedTile === tile;
  if (!sameSource || !reloaded || !jsonEqual(reloaded.passability[normalizedTile], flags)
    || used.some(index =>
      TILE_LAYER_NOS.some(layer => layerTileAt(map, layer, index) === tile && layerTileAt(probeMap, layer, index) !== normalizedTile)
      || (["lowerTileStacks", "upperTileStacks"] as const).some(key =>
        map[key]?.[index]?.some((entry, slot) => entry === tile && probeMap[key]?.[index]?.[slot] !== normalizedTile)))
    || selected.some(index => !jsonEqual(cellPassability(reloaded, probeMap, index), flags))) {
    throw new PrimitiveError("이 타일셋은 프로젝트를 다시 열 때 통행 설정이 원래대로 돌아가요.");
  }
  return after;
}
