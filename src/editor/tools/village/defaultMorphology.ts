import { RIVER_VILLAGE_STYLE } from "@/project/defaults/riverVillageStyle";
import type { Project } from "@/project/types";
import { TILE } from "@/project/defaults/constants";

/** Defaults apply only to genuinely blank, unbounded targets without authored style.
 * Call before sizing so river banks receive space; explicit layouts always win. */
export function withVillageMorphologyDefault(project: Project, input: Record<string, unknown>): Record<string, unknown> {
  if (input.morphology !== undefined || input.settlementLayout !== undefined || input.relief !== undefined
    || input.composition !== undefined || input.houseObjectIds !== undefined || input.presetId !== undefined
    || project.defaultVillagePresetId || (typeof input.theme === "string" && input.theme.trim())
    || (Array.isArray(input.housePlans) && input.housePlans.some(plan => plan?.objectId))) return input;
  const target = input.target as { kind?: string; mapId?: string; bounds?: unknown } | undefined;
  if (!target || target.bounds !== undefined) return input;
  if (target.kind === "new") return { ...input, morphology: RIVER_VILLAGE_STYLE.morphology };
  const map = target.mapId ? project.maps[target.mapId] : undefined;
  if (!map || map.events.length || map.lowerTiles.some(t => t !== TILE.GRASS)
    || map.upperTiles.some(t => t !== TILE.EMPTY)
    || Object.values(map.lowerTileStacks ?? {}).some(stack => stack?.length)
    || Object.values(map.upperTileStacks ?? {}).some(stack => stack?.length)
    || map.layoutPlan?.regions.length
    || Object.values(project.spatialAuthoring?.occurrences ?? {}).some(o => o.bindings.some(b => b.mapId === map.id))) return input;
  return { ...input, morphology: RIVER_VILLAGE_STYLE.morphology };
}
