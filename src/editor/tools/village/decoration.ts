import type { GameMap, Project } from "@/project/types";
import { assertHouseProtection, captureHouseProtection } from "../houseProtection";
import type { BuiltHouse, Plaza, Rect, VillageIntent } from "./constants";
import { placeVillageDecor } from "./decor";
import { placeHouseLotFences } from "./fences";
import { dressVillageLandscape } from "./landscape";

/** Serializable continuation for the multi-turn AI builder; contains no live callbacks. */
export interface VillageDecorationPlan {
  readonly area: Rect;
  readonly plaza: Plaza;
  readonly houses: readonly BuiltHouse[];
  readonly seed: number;
  readonly intent: Omit<VillageIntent, "templateCatalog">;
  readonly fences: boolean;
  readonly decor: boolean;
  readonly landscape: boolean;
}

export function finishVillageDecoration(
  project: Project, map: GameMap, plan: VillageDecorationPlan, warnings: string[],
): number {
  const sealed = captureHouseProtection(project);
  const check = (): void => assertHouseProtection(sealed, project, []);
  if (plan.fences) {
    placeHouseLotFences(map, plan.houses.filter(house => house.fence !== false), plan.seed, plan.area);
    check();
  }
  let placed = 0;
  if (plan.decor) {
    placed += placeVillageDecor(project, map, plan.area, plan.plaza, plan.houses,
      plan.seed, { ...plan.intent, templateCatalog: [] }, warnings);
    check();
  }
  if (plan.landscape) {
    const cells = dressVillageLandscape(map, { ...plan, warnings });
    warnings.push(`조경 지구 ${cells}칸`);
    check();
  }
  return placed;
}
