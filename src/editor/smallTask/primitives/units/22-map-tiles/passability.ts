import { bundledTilesetDefinitionReady, ensureBundledTilesets } from "@/project/defaults/defaultAssets";
import { cellLayerTiles } from "@/project/mapLayers";
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
  let selected = false;
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
      selected ||= onMap;
    }
  }
  if (!selected) throw new PrimitiveError("범위 밖: 선택한 영역에 이 타일이 없어요.");
  if (jsonEqual(tileset.passability[tile], flags)) return project;

  const passability = tileset.passability.slice();
  passability[tile] = flags;
  const edited = { ...tileset, passability };
  const after = { ...project, tilesets: { ...project.tilesets, [map.tilesetId]: edited } };
  assertTileReferencesPreserved(project, after, map, map, { tile, contains });

  if (map.tilesetId.startsWith("shared_")) {
    throw new PrimitiveError("공용 타일셋의 통행 설정은 프로젝트에 저장할 수 없어요.");
  }
  const probe = { tilesets: { [map.tilesetId]: structuredClone(edited) } };
  // The editor runs these normalizers when it opens a project. Some bundled definitions
  // replace the author's flag table, so committing those edits would report a false success.
  if (bundledTilesetDefinitionReady(map.tilesetId) !== undefined) ensureBundledTilesets(probe);
  else ensureTilesetHarnesses(probe);
  if (!jsonEqual(probe.tilesets[map.tilesetId]?.passability[tile], flags)) {
    throw new PrimitiveError("이 타일셋은 프로젝트를 다시 열 때 통행 설정이 원래대로 돌아가요.");
  }
  return after;
}
