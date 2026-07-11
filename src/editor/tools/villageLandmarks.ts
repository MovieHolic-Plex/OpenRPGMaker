// 호환 래퍼 — 실제 구현은 villageTerrainPass (E 하이브리드 마스크→지형 패스).

import type { GameMap, Project } from "@/project/types";
import type { VillageRequirements } from "./villageRequirements";
import {
  runTerrainConstraintPass,
  villageBuildAreaFromMasks,
  type Rect,
} from "./villageTerrainPass";

export type { Rect };

/** @deprecated villageBuildAreaFromMasks 사용 */
export function villageBuildAreaForRequirements(
  map: Pick<GameMap, "width" | "height">,
  requirements: VillageRequirements | undefined,
): Rect {
  return villageBuildAreaFromMasks(map, requirements);
}

/** @deprecated runTerrainConstraintPass 사용 */
export function placeRequiredLandmarks(
  draft: Project,
  map: GameMap,
  requirements: VillageRequirements,
  warnings: string[],
): { readonly waterCells: number; readonly forestOps: number; readonly notes: string[] } {
  const result = runTerrainConstraintPass(draft, map, requirements, warnings);
  return {
    waterCells: result.waterOps,
    forestOps: result.forestOps,
    notes: result.notes,
  };
}
