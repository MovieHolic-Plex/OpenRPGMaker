import type { Project, TroopId } from "@/project/types";

/** 에메랄드 전투 배경 갈래. 그림은 public/assets/emerald-monster/battle/<갈래>.png, 발판 색은 emeraldSurfaces.css. */
export const EMERALD_BATTLE_TERRAINS = ["grass", "sand", "snow", "water", "cave", "indoor"] as const;
export type EmeraldBattleTerrain = (typeof EMERALD_BATTLE_TERRAINS)[number];

const TAG_TERRAIN: Readonly<Record<number, EmeraldBattleTerrain>> = { 1: "water", 2: "sand", 3: "snow", 5: "grass" };

/**
 * 전투가 열린 자리의 배경 갈래. 사막 마을에서 싸워도 늘 같은 연두 바닥이었다(2026-10-07 사용자 지적: 「분위기가 자꾸 달라진다」).
 *
 * 1. 맵에 `battleBackground: "emerald:<갈래>"` 가 적혀 있으면 그것.
 * 2. 실내 시트(방·체육관)는 indoor, 던전 시트·「동굴」 바닥은 cave.
 * 3. 밟은 칸의 지형 태그(1 물·2 모래·3 눈·5 키 큰 풀). 길·절벽(0·4)이면 맵 전체에서 가장 많은 태그.
 */
export function emeraldBattleTerrain(
  project: Pick<Project, "maps" | "tilesets" | "database">,
  location: { readonly mapId: string; readonly x: number; readonly y: number } | undefined,
  troopId?: TroopId,
): EmeraldBattleTerrain {
  const map = location ? project.maps[location.mapId] : undefined;
  if (!map) return "grass";
  const authored = /^emerald:(\w+)$/u.exec(map.battleBackground ?? "")?.[1];
  if (authored && (EMERALD_BATTLE_TERRAINS as readonly string[]).includes(authored)) return authored as EmeraldBattleTerrain;
  const tileset = project.tilesets[map.tilesetId];
  const meta = tileset?.tileMeta as unknown;
  const tileInfo = (tile: number | undefined): { readonly label: string; readonly tag: number } => {
    if (tile === undefined || tile < 0) return { label: "", tag: 0 };
    const record = (Array.isArray(meta) ? meta[tile] : (meta as Record<string, unknown> | undefined)?.[String(tile)]) as
      { label?: string; terrainTag?: number } | undefined;
    return { label: record?.label ?? "", tag: record?.terrainTag ?? 0 };
  };
  const trainer = troopId ? project.database.troops.find((troop) => troop.id === troopId)?.trainerBattle === true : false;
  const tilesetId = map.tilesetId ?? "";
  if (/rooms|gyms|interior/u.test(tilesetId)) {
    // 배 갑판은 바다 위 — 물 배경.
    const sea = map.lowerTiles.filter((tile) => tileInfo(tile).tag === 1).length;
    return sea > map.lowerTiles.length * 0.15 && !trainer ? "water" : "indoor";
  }
  const counts = new Map<number, number>();
  let caveFloor = 0;
  for (const tile of map.lowerTiles) {
    const info = tileInfo(tile);
    counts.set(info.tag, (counts.get(info.tag) ?? 0) + 1);
    if (/동굴|탑 바닥|금속 판|유적/u.test(info.label)) caveFloor += 1;
  }
  if (/dungeon/u.test(tilesetId) || caveFloor > map.lowerTiles.length * 0.2) {
    const here = tileInfo(map.lowerTiles[location!.y * map.width + location!.x]).tag;
    return here === 1 ? "water" : here === 3 ? "snow" : "cave";
  }
  const here = tileInfo(map.lowerTiles[location!.y * map.width + location!.x]).tag;
  if (TAG_TERRAIN[here]) return TAG_TERRAIN[here]!;
  let best: EmeraldBattleTerrain = "grass";
  let bestCount = 0;
  for (const [tag, count] of counts) {
    const terrain = TAG_TERRAIN[tag];
    // 물 태그가 많아도 걷는 땅에서 싸우면 물가가 아니라 그 땅이다 — 물은 밟은 칸이 물일 때만.
    if (!terrain || terrain === "water" || terrain === "grass") continue;
    if (count > bestCount) { best = terrain; bestCount = count; }
  }
  return bestCount > map.lowerTiles.length * 0.12 ? best : "grass";
}
