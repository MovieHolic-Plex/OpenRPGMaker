import type { GameMap, Project, Rect } from "@/project/types";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { wildTroopIdForSpecies } from "@/project/wildTroops";

/** 도구점에 파는 필드 도구: 벌레퇴치 스프레이 · 탈출 로프. 낚싯대는 팔지 않고 낚시꾼이 준다. */
export const EXPEDITION_FIELD_ITEM_IDS = ["mx_repel", "mx_repel_strong", "mx_escape_rope"] as const;
export const EXPEDITION_FISHING_ROD_ID = "mx_fishing_rod";

/**
 * 필드 도구 네 가지(벌레퇴치 둘 · 탈출 로프 · 낚싯대). 모두 기존 번들 그림을 쓴다 — 전용 그림은 없다.
 * 벌레퇴치는 repelSteps(걸음), 탈출 로프는 escapeTo, 낚싯대는 system.toolActions 의 fish 규칙으로 쓰인다.
 */
export function configureExpeditionFieldItems(project: Project): void {
  const items = [
    { id: "mx_repel", name: "별빛 스프레이", price: 350, description: "뿌리면 100걸음 동안 야생 몬스터가 다가오지 않는다. 메뉴 「가방」에서 쓴다.", repelSteps: 100, icon: "cc0-jetrel-herb-green", type: "normalGoods" },
    { id: "mx_repel_strong", name: "강한 별빛 스프레이", price: 500, description: "뿌리면 200걸음 동안 우리 선두보다 약한 야생 몬스터만 다가오지 않는다.", repelSteps: 200, repelBelowLead: true, icon: "cc0-jetrel-herb-green", type: "normalGoods" },
    { id: "mx_escape_rope", name: "탈출 로프", price: 550, description: "동굴·던전 안에서 쓰면 마지막으로 들어온 입구 밖으로 빠져나온다. 던전 밖에서는 쓸 수 없다.", escapeTo: "entrance" as const, icon: "oprn-item-toy-rope-2", type: "normalGoods" },
    { id: EXPEDITION_FISHING_ROD_ID, name: "낚싯대", price: 0, description: "물가를 바라보고 조사하면 낚시를 한다. 무엇이 걸릴지는 아무도 모른다.", icon: "oprn-item-fishing-spoon-1", type: "normalGoods", occasion: "never" },
  ] as const;
  const known = new Set(project.database.items.map((item) => item.id));
  for (const item of items) {
    if (known.has(item.id)) continue;
    const { icon, ...record } = item;
    const field = "occasion" in record ? record.occasion : "field";
    project.database.items.push(normalizeItemRecord({
      ...record, imageResourceId: icon, iconResourceId: icon, scope: "none", occasion: field, consumable: item.id !== EXPEDITION_FISHING_ROD_ID,
    } as never));
  }
}

const WATER_LABEL = /^(강물|바닷물|호수|늪 물)/u;

function isWaterCell(project: Project, map: GameMap, x: number, y: number): boolean {
  const meta = project.tilesets[map.tilesetId]?.tileMeta?.[map.lowerTiles[y * map.width + x] ?? -1];
  return meta?.passage === "solid" && WATER_LABEL.test(meta.label ?? "");
}

/** 물 칸만으로 이루어진 가장 큰 직사각형(낚시 구역은 물 칸만 덮어야 땅을 보고 낚시하지 않는다). */
export function largestWaterRect(project: Project, map: GameMap): Rect | undefined {
  // run[y][x] = (x,y) 에서 오른쪽으로 이어지는 물 칸 수.
  const run: number[][] = Array.from({ length: map.height }, () => new Array<number>(map.width).fill(0));
  for (let y = 0; y < map.height; y++) for (let x = map.width - 1; x >= 0; x--) {
    run[y]![x] = isWaterCell(project, map, x, y) ? 1 + (x + 1 < map.width ? run[y]![x + 1]! : 0) : 0;
  }
  let best: Rect | undefined;
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
    let width = Infinity;
    for (let h = 1; y + h <= map.height; h++) {
      width = Math.min(width, run[y + h - 1]![x]!);
      if (width === 0) break;
      if (!best || width * h > best.w * best.h) best = { x, y, w: width, h };
    }
  }
  return best && best.w * best.h >= 6 ? best : undefined;
}

export interface ExpeditionFishingPlan {
  readonly mapId: string;
  readonly area: Rect;
}

/**
 * 낚시 구역 한 곳(물가 길·항구·해변 중 물이 가장 넓은 맵)을 system.fishing 으로 만든다. 걸리는 것은 그 맵 야생 조우표의
 * 몬스터 중 물 타입 우선(없으면 전부)이고, 그 종의 야생 무리가 이미 있는 것만 쓴다. 낚싯대 규칙(toolActions fish)도 함께 건다.
 * 계획을 못 세우면(물 맵 없음) 아무것도 바꾸지 않고 undefined.
 */
export function configureExpeditionFishing(project: Project): ExpeditionFishingPlan | undefined {
  const candidates = ["mx_map_river", "mx_map_harbor", "mx_map_beach"].map((id) => project.maps[id]).filter((map): map is GameMap => map !== undefined);
  let plan: { map: GameMap; area: Rect } | undefined;
  for (const map of candidates) {
    const area = largestWaterRect(project, map);
    if (area && (!plan || area.w * area.h > plan.area.w * plan.area.h)) plan = { map, area };
  }
  if (!plan) return undefined;
  const enemyById = new Map(project.database.enemies.map((enemy) => [enemy.id, enemy] as const));
  const speciesById = new Map((project.database.monsterSpecies ?? []).map((species) => [species.id, species] as const));
  const rows = (plan.map.encounterTable ?? []).flatMap((entry) => {
    const troop = project.database.troops.find((candidate) => candidate.id === entry.troopId);
    const enemyIds = troop?.members?.length ? troop.members.map((member) => member.enemyId) : troop?.enemyIds ?? [];
    const speciesId = enemyById.get(enemyIds[0] ?? "")?.speciesId;
    return speciesId && speciesById.has(speciesId) && wildTroopIdForSpecies(project, speciesId) ? [{ speciesId, entry }] : [];
  });
  const water = rows.filter((row) => speciesById.get(row.speciesId)?.types?.includes("water"));
  const picked = (water.length > 0 ? water : rows).slice(0, 4);
  if (picked.length === 0) return undefined;
  const seen = new Set<string>();
  const monsterCatches = picked.filter((row) => !seen.has(row.speciesId) && seen.add(row.speciesId)).map((row) => ({
    speciesId: row.speciesId, weight: Math.max(1, row.entry.weight),
    ...(row.entry.levelMin !== undefined ? { levelMin: row.entry.levelMin } : {}),
    ...(row.entry.levelMax !== undefined ? { levelMax: row.entry.levelMax } : {}),
  }));
  project.system.fishing = { enabled: true, spots: [{ id: "mx_fishing_pond", name: "낚시터", mapId: plan.map.id, area: plan.area, catches: [], monsterCatches }] };
  project.system.toolActions = [...(project.system.toolActions ?? []).filter((rule) => rule.id !== "mx-rod-fish"), { id: "mx-rod-fish", itemId: EXPEDITION_FISHING_ROD_ID, action: "fish" }];
  return { mapId: plan.map.id, area: plan.area };
}
