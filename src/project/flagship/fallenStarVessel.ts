// 『폴른 스타』 숲의 떨어진 별 — 오프닝 crash 컷(그을린 구덩이에 누운 관 모양 은빛 배)에 맞춘, 동서로 누운 별의 관 48×32(3×2칸).
// 3/4 탑뷰: 머리 쪽 어깨가 가장 넓고 둥근 두 끝으로 좁아지는 관 모양 볼록 은빛 뚜껑(긴 반사광·테 두른 타원 유리창·빛나는 별 문양·발 쪽 지그재그 금) + 끊기지 않은 테와 이음매 + 남쪽 앞면 8행(매끈한 그러데이션·고른 리벳 줄·발 쪽 그을음). 코드 손 도트(스크립트 행 그리기), 생성 그림 없음.
// 이전에는 버들항 하수도 돌 관(평평한 석판)이었다 — 추락한 배가 아니라 무덤으로 읽혔다(VQA r6 major).
import { bakeWorkshopObject, workshopAssetId } from "@/project/workshopTiles";
import type { GameMap, Project } from "@/project/types";

export const FS_VESSEL_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAgCAYAAABU1PscAAADNUlEQVR4nO2YP2gaURzHvxYpIYRQnIKDiIhIBgkZSyghHKUcRURChiLHDUEkQxo6deqQKUMIoYQSQgeR0CEECQ5SyhEklIwZQilB5BCHw0mKlCIZaof0Pd+7P++eGje/i97vvfu9z/f3fk/uBKaaaqqpphpDAZlJ4Xiq7zfHatxK5XpsCRcl4J9Ojn0TbeULnmOTNOeaeBhwGU3SnOPmcDzVZ8ETschIietmS2reuOaCXgNu4JHwghSUrOpmS7jLW/kCd/bcDHEBUv1ELIIP1e+OhLvqijTcKGZbVpu7tu/iVr7gMEEvSN8bRpXC77xJ4/BLhUuyq67gomr4wmRUZSh44MH0YecXdkLPuHjLaqNutmi7sSYCBN5eeQI/jgkAuMEMltGTNlEqFgEAmq47xhaTCQD8TtAz8POuDgD4UasBADaZz88nB9jMv6OJ6kn/g72YTOD0roWlrIKbsoFcMkLXEEnTdfzNvkYpvQ5N19Ewm3SsYTYRj0W5+YFwPNU3jCr2jz4DANLqS7w/LnkusFfQUKl+8wUh6saSmDfvpOcTXV/VkKucw9w/4uLxWBQZVYGiqLAat4FAOJ7qz4dCKJ+d0rYgW8Ua2StoADAUvIzsFWVF2ql8dsrFsxs5dDsdWI3bQBB42LbsRo5OJEYINCAHLoLxkuiwl4pF5CrnyKbXubim6zg6OMDc7Mx2kA1mN3IA4DAyKpwMJFnTTZquI9Pr4YnLgSYKAoPDoek6MqoiNPLYkGzrkjzkulQs0jYihggvEf0ZfZXJIh6LwrisQVlbpQlYIyL5VdINEAC3HrsmANy3TQDA04UYjT1/sYqvF2V0rfpbaoA1AfDtwu6ISATSDugHzFbz+qrmgCciJrqdDoX3NEBk35FRAI3LGqLRqJtnTjLwdgO///Q+Op6FAMDNiAhQWVvlKjmMms3BfVZr8P2+bTrAAXDwgMfjdHJpGQCkKjcspJ9YE6zsrUMMeD5OswvLGBkGkpUXMDCoOuCsPJGrAZI0HImOBWfP5yYW0jHGVNxLwlfK+VDo4fq/EZEmCWmvOiupl3piRKRJQor0aH+rTBJSpJH/EZibndl2i08CUqR/1y68tORFINEAAAAASUVORK5CYII=";
const VESSEL_KIT = "workshop:fallen-star-vessel";

/** 숲 맵 칩셋에 별의 관 3×2 칸을 굽고, 왼쪽 위 (x, y) 에 놓는다. 두 줄 모두 막힌다. */
export function placeFallenStarVessel(project: Project, map: GameMap, x: number, y: number): void {
  const tileset = project.tilesets[map.tilesetId]!;
  const before = (tileset.tileGrafts ?? []).length;
  const kit = bakeWorkshopObject(project as unknown as Parameters<typeof bakeWorkshopObject>[0], map.tilesetId, {
    objectId: VESSEL_KIT, title: "떨어진 별의 관", description: "그을린 구덩이에 누운 관 모양 은빛 배 — 유리창·빛나는 이음매(폴른 스타 숲)",
    kind: "floor", columns: 3, rows: 2, footRows: 2, risePx: 0, use: ["추락지"], gridHash: "fallen-star-vessel-v10",
    asset: { id: workshopAssetId(FS_VESSEL_PNG), dataUrl: FS_VESSEL_PNG, width: 48, height: 32 },
    cells: [0, 1, 2, 3, 4, 5].map((k) => ({ sourceTile: k, dx: k % 3, dy: Math.floor(k / 3) })),
    provenance: { aiGenerated: false, tool: "code hand pixel (scripts/content/fallen-star-vessel-draw.py — tapered coffin lid, chrome shading, glass window, star rune, glowing crack); object-gate fallen-town-r9" },
  });
  for (const g of (tileset.tileGrafts ?? []).slice(before)) { g.sourceTileSize = 16; g.sourceTilesPerRow = 3; }
  kit.rows.forEach((row, dy) => row.upperTiles?.forEach((id, dx) => {
    const cx = x + dx, cy = y + dy;
    if (id < 0 || cx < 0 || cy < 0 || cx >= map.width || cy >= map.height) return;
    map.upperTiles[cy * map.width + cx] = id;
  }));
}
