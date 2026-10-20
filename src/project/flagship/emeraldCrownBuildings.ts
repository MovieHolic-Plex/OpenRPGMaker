import type { Project } from "@/project/types";

/**
 * 아스트라 호라이즌의 회복 센터·상점 외관을 새 칸(공용 야외 시트 끝에 덧붙인 2224~2255)으로 옮긴다.
 * 옛 칸(1344~1375)은 다른 프로젝트가 쓰므로 그림도, 번호도 건드리지 않는다 — 이 데모의 지도만 새 번호를 가리킨다.
 * 센터 1344..1359 → 2224..2239, 상점 1360..1375 → 2240..2255 (킷 한 줄 = 4×4 칸, 칸 순서 그대로).
 */
const OLD_CENTER_BASE = 1344;
const OLD_MART_BASE = 1360;
const NEW_CENTER_BASE = 2224;
const NEW_MART_BASE = 2240;
const KIT_TILES = 16;

export function remapAstraBuildingKits(project: Project): void {
  for (const map of Object.values(project.maps)) {
    if (map.tilesetId !== "monster_overworld") continue;
    for (const layer of [map.lowerTiles, map.upperTiles]) {
      for (let i = 0; i < layer.length; i += 1) {
        const id = layer[i]!;
        if (id >= OLD_CENTER_BASE && id < OLD_CENTER_BASE + KIT_TILES) layer[i] = id - OLD_CENTER_BASE + NEW_CENTER_BASE;
        else if (id >= OLD_MART_BASE && id < OLD_MART_BASE + KIT_TILES) layer[i] = id - OLD_MART_BASE + NEW_MART_BASE;
      }
    }
  }
}
