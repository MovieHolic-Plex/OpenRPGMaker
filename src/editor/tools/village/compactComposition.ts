import { ToolError } from "../types";
import type { VillageObjectHouse } from "./objectHouses";

/** Actual Combined Town log-wall cells, not a name/tag heuristic. */
export const LOG_WALL_TILES = new Set([102, 103, 104, 132, 133, 134, 162, 163, 164]);
export const compactLandmark = (house: VillageObjectHouse): boolean => house.raster.width > 10 || house.raster.height > 10;

export function compactHousePool(catalog: readonly VillageObjectHouse[], fixedIds: readonly string[]): readonly VillageObjectHouse[] {
  const allowed = catalog.filter(house => house.raster.width <= 15 && house.raster.height <= 15
    && !house.raster.cells.some(cell => LOG_WALL_TILES.has(cell.tile)));
  for (const id of fixedIds) if (!allowed.some(house => house.design.id === id)) {
    throw new ToolError(`조밀한 마을의 지정 집 ${id}는 15×15를 넘거나 통나무 벽을 사용합니다. 작은 회벽·석벽 외형을 선택해 주세요.`, { code: "village-compact-house" });
  }
  if (!allowed.length) throw new ToolError("조밀한 마을에 쓸 15×15 이하 회벽·석벽 집이 없습니다.", { code: "village-compact-house" });
  return allowed;
}

/** Use ordinary homes for the town fabric; a large catalog cannot flood it with landmarks. */
export function chooseCompactHouses(pool: readonly VillageObjectHouse[], count: number,
  plans: readonly Record<string, unknown>[]): readonly VillageObjectHouse[] {
  const homes = pool.filter(house => !compactLandmark(house)), landmarks = pool.filter(compactLandmark);
  const fixed = plans.map(plan => typeof plan?.objectId === "string" ? pool.find(house => house.design.id === plan.objectId) : undefined);
  const fixedLarge = fixed.filter(house => house && compactLandmark(house)).length;
  if (fixedLarge > 2) throw new ToolError("조밀한 마을의 10×10 초과 큰집은 최대 2채입니다.", { code: "village-compact-landmarks" });
  const automaticLarge = Math.max(0, Math.min(2, landmarks.length, Math.floor(count / 10)) - fixedLarge);
  const open = Array.from({ length: count }, (_, i) => i).filter(i => !fixed[i]);
  const largeSlots = new Set(open.slice(Math.max(0, open.length - automaticLarge)));
  const used = new Map<string, number>();
  // Fixed choices count toward repetition too. First show every available shape,
  // then prefer genuinely small footprints; a shuffled cycle favored tall roofs.
  for (const house of fixed) if (house && !compactLandmark(house)) used.set(house.design.id, (used.get(house.design.id) ?? 0) + 1);
  const normalSlots = count - fixedLarge - automaticLarge;
  const repeatLimit = Math.max(1, Math.ceil(normalSlots / Math.max(1, homes.length)) + 1);
  const chooseHome = (): VillageObjectHouse | undefined => {
    const unused = homes.find(house => !used.has(house.design.id));
    const candidates = homes.filter(house => (used.get(house.design.id) ?? 0) < repeatLimit);
    const score = (house: VillageObjectHouse): number =>
      (used.get(house.design.id) ?? 0) * (house.raster.width * house.raster.height) ** 2;
    const chosen = unused ?? candidates.sort((a, b) => score(a) - score(b))[0];
    if (chosen) used.set(chosen.design.id, (used.get(chosen.design.id) ?? 0) + 1);
    return chosen;
  };
  let largeIndex = 0;
  return Array.from({ length: count }, (_, i) => {
    const chosen = fixed[i] ?? (largeSlots.has(i) ? landmarks[largeIndex++ % landmarks.length] : chooseHome());
    if (!chosen) throw new ToolError("작은 일반 주택 후보가 부족합니다. 10×10 이하 외형을 추가해 주세요.", { code: "village-compact-house" });
    return chosen;
  });
}
