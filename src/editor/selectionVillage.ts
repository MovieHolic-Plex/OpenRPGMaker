import type { GameMap, TilesetDef } from "@/project/types";
import { layerTileAt, setLayerTileAt } from "@/project/mapLayers";
import { terrainLocked } from "@/project/terrainDesign";
import { standGroundCoverTile } from "@/assets/tilesetStands";
import { planQuickHouse, quickHouseKit, quickHouseMinWidth, quickHouseStyles, type QuickHouseOptions } from "./quickHouse";
import { terrainRoadTile } from "./terrainMaterials";
import type { SelectionRect } from "./selectionTerrainSummary";

export interface SelectionVillagePlan {
  readonly houses: number;
  readonly roadCells: number;
  readonly reason: string;
  readonly blockedByLocks: boolean;
  readonly apply?: (draft: GameMap) => void;
  readonly cells: readonly number[];
}

const inside = (r: SelectionRect, x: number, y: number) => x >= r.x && y >= r.y && x < r.x + r.width && y < r.y + r.height;

/**
 * 선택 사각형 안만 짓는 마을: 같은 높이의 빈 땅에 집을 앉히고 문 앞을 길로 잇는다.
 * 높이·경사로·물은 쓰지 않으므로 「땅 모양 잠금」이 켜진 맵에서도 막히지 않는다. 사각형 밖 칸은 건드리지 않는다.
 */
export function planSelectionVillage(map: GameMap, tileset: TilesetDef, rect: SelectionRect): SelectionVillagePlan {
  const styles = [...quickHouseStyles(tileset)].sort((a, b) => quickHouseMinWidth(a) - quickHouseMinWidth(b));
  const style = styles[0];
  if (!style) return { houses: 0, roadCells: 0, reason: "이 칩셋에는 바로 앉힐 집 조각이 없습니다", blockedByLocks: false, cells: [] };
  const sameSize = styles.filter((s) => quickHouseMinWidth(s) === quickHouseMinWidth(style));
  const options: QuickHouseOptions = { style, width: quickHouseMinWidth(style), stories: 1 };
  const kit = quickHouseKit(tileset, options), door = kit?.parts?.find((p) => p.kind === "entrance");
  if (!kit || !door) return { houses: 0, roadCells: 0, reason: "이 칩셋에는 바로 앉힐 집 조각이 없습니다", blockedByLocks: false, cells: [] };
  const work: GameMap = structuredClone(map);
  const road = terrainRoadTile(tileset);
  const plans: NonNullable<ReturnType<typeof planQuickHouse>["apply"]>[] = [];
  const fronts: { x: number; y: number }[] = [];
  const used = new Set<number>();
  let lockHits = 0;
  const doorDx = door.dx, doorDy = door.dy + door.h - 1;
  for (let top = rect.y; top + kit.height < rect.y + rect.height; top++) {
    for (let left = rect.x; left + kit.width <= rect.x + rect.width; left++) {
      const anchor = { x: left + doorDx, y: top + doorDy };
      if (!inside(rect, anchor.x, anchor.y + 1)) continue;
      let clash = false;
      for (let y = top - 1; y <= top + kit.height && !clash; y++) for (let x = left - 1; x <= left + kit.width; x++) if (used.has(y * map.width + x)) { clash = true; break; }
      if (clash) continue;
      const plan = planQuickHouse(work, tileset, anchor, { ...options, style: sameSize[plans.length % sameSize.length]! });
      if (!plan.ok || !plan.apply) {
        if (plan.indices.some((i) => terrainLocked(map.terrainDesign, i))) lockHits++;
        continue;
      }
      plan.apply(work);
      plans.push(plan.apply);
      for (let y = top; y < top + kit.height; y++) for (let x = left; x < left + kit.width; x++) used.add(y * map.width + x);
      used.add((anchor.y + 1) * map.width + anchor.x);
      fronts.push({ x: anchor.x, y: anchor.y + 1 });
      left += kit.width;
    }
  }
  if (!plans.length) {
    const blockedByLocks = lockHits > 0;
    const reason = blockedByLocks ? "잠긴 칸이 있어 집을 앉힐 빈 땅이 없습니다"
      : rect.width < kit.width || rect.height < kit.height + 1 ? `집 한 채에 ${kit.width}×${kit.height + 1}칸이 필요합니다 — 조금 더 넓게 골라 주세요`
        : "같은 높이의 빈 땅이 모자랍니다 — 평평한 곳을 더 넓게 골라 주세요";
    return { houses: 0, roadCells: 0, reason, blockedByLocks, cells: [] };
  }
  const roadCells: number[] = [];
  if (road !== undefined) {
    const level = (x: number, y: number) => map.relief?.levels[y * map.width + x] ?? 0;
    const groundCover = standGroundCoverTile(tileset); // 바닥 덧그림(풀 결 등)은 빈 땅이다
    const free = (x: number, y: number) => {
      const i = y * map.width + x;
      return inside(rect, x, y) && !used.has(i) && !terrainLocked(map.terrainDesign, i) && (layerTileAt(work, 2, i) < 0 || groundCover(layerTileAt(work, 2, i))) && layerTileAt(work, 3, i) < 0
        && (map.relief?.ramps?.[i] ?? 0) === 0 && (map.terrainDesign?.waterDepth?.[i] ?? 0) === 0;
    };
    const rows = new Map<number, number[]>();
    for (const f of fronts) rows.set(f.y, [...(rows.get(f.y) ?? []), f.x]);
    for (const [y, xs] of rows) {
      const lo = Math.min(...xs), hi = Math.max(...xs);
      for (let x = lo; x <= hi; x++) if ((xs.includes(x) || free(x, y)) && level(x, y) === level(lo, y)) roadCells.push(y * map.width + x);
    }
  }
  const touched = [...used, ...roadCells];
  return {
    houses: plans.length, roadCells: roadCells.length, reason: `집 ${plans.length}채 · 길 ${roadCells.length}칸`, blockedByLocks: false, cells: touched,
    apply: (draft) => {
      for (const apply of plans) apply(draft);
      if (road !== undefined) for (const i of roadCells) { setLayerTileAt(draft, 1, i, road); setLayerTileAt(draft, 2, i, -1); }
    },
  };
}
