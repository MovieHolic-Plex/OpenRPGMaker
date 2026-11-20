import { isPassable } from "@/project/collision";
import { blockedFlag, passableFlag } from "@/project/tilesetPassage";
import { PrimitiveError } from "../../errors";
import type { PrimitiveContext } from "../../types";
import { getTileset, hostRegion, requireTile } from "./region";

export function setRegionPassability(ctx: PrimitiveContext, args: Record<string, unknown>) {
  const { project } = ctx;
  const { map } = hostRegion(ctx);
  const tileset = getTileset(project, map);
  const tile = requireTile(project, map, args.tile);
  const passability = tileset.passability.slice();
  passability[tile] = args.passable === true ? passableFlag() : blockedFlag();
  // The map-region guard checks every occurrence of the tile on every map using this tileset.
  const after = { ...project, tilesets: { ...project.tilesets, [map.tilesetId]: { ...tileset, passability } } };
  if (project.startMapId === map.id) {
    const { x, y } = project.startPos;
    if (isPassable(project, map, x, y) && !isPassable(after, map, x, y)) {
      throw new PrimitiveError("범위 밖: 게임 시작 칸의 통행을 막을 수 없어요.");
    }
  }
  return after;
}
