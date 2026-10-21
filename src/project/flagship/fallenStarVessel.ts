// 『폴른 스타』 숲의 떨어진 별 — 오프닝 crash 컷(그을린 구덩이에 누운 관 모양 은빛 배)에 맞춘, 동서로 누운 별의 관 48×32(3×2칸).
// 3/4 탑뷰: 양 끝이 좁아지는 은빛 뚜껑(관 모양 유리창·금 간 이음매의 희미한 빛·리벳·긁힌 결) + 남쪽 앞면(깨진 판 이음매·발 쪽 그을음). 코드 손 도트(스크립트 행 그리기), 생성 그림 없음.
// 이전에는 버들항 하수도 돌 관(평평한 석판)이었다 — 추락한 배가 아니라 무덤으로 읽혔다(VQA r6 major).
import { bakeWorkshopObject, workshopAssetId } from "@/project/workshopTiles";
import type { GameMap, Project } from "@/project/types";

export const FS_VESSEL_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAgCAYAAABU1PscAAAEqUlEQVR4nO2YX2RjWRzHP1OxRqzoQ4yIKw8RVWOMioqrompUrdWnlYeq0Ydaa+3DGGMfdqi1j/Owaox5GqvWGJWHqw+jao1aUTWuqKo1RkXEuo64KiqiqsZo9yE5J+fe3Js/naelX+Im5/xyz/fz+/3uuTeBG93oRv9r3Rr1C6l72at+886Hw5HP+SUaejFpfPP1Rt+45ZXVaxm5LvjAL/mNV6q1wLiJTPo66ysNAg8D7AuQupe98mdcB5jIpHuA/CCVai00To4NA7+8shoIEQigZ11fZONN0RMnhMAwjJ4xwDMeFrdU+K4HSpeE3y3tMz+XD4TwfPC3y25pHwBHCGXML2nCEfXAec/5jaR674g6TuecEjAM9HajRnxqltWHSz0Q6o3eLrulfVJGkn27rIyv/roGwN7BkWeB6s42M6bZY07KsiwKhQJ3vlng5K93oTBhOtzeJD41S+Noj+zick8lbunm9YxL+sy3i6En1wF0+c1ZlgVAoVAIPIc//r1tM2OauIclPt3J0DjaUxD+SkTCjKU6Ja3ubPMpYYSF8VXAmOxbae7J40cArD9/wU9/vPJUQprWYVLq2phTFQAUhL6tKIBKtcb8XJ6NN0VK1mvmCisYhkHKMHhv26EA/mvAH6ube/L4Eevf/wAQCOKPdw9LZBeXVUdIX3kzx+679ndVC/3W6XHo7jh5M8e+Xe5kJrwK7fnhelrKsixVGUfUmZ/Lq6p5gdrmZfvkzRzlt5vsHNXCW6hSrZE3c0xk0uzbZVKGoU4UJn1+mPicaarkCCHUThe2C32o/svajz97kvN19PYvY10D3YmJTBpH1KlUa6w+XBpoRl8sCEa+wiRN+83LsfjULGu/v6T8dlNd2FKeCkgI/1FWw38j0005Adnzw/RT3sz1nXdEnUS2fVFT7yY7sIXkPaDdCt1gP0iQuUFG+hnU5R6WAEhk59R7PfM9AI4QKqOyN/UxP8goZkaVZVnk03H1Wc98dnG5vdOdfPQCSMPSoA4BspeTPXt2t93EwJ1K3pWD5K9mvdMm9fom0L0H7Pz5shMRBWCMABWtrZ5nH0cIitaWZ7H15y/UvF4Vp7Or+F+D5qB7Xek3L2hvo27jFIDxyWkVrwB0w/LRQB/LmzlmTFNl2m+oaG3hCNH3phcmP7w0LBWfmuUinmZ8cppGs0Xz+EDNeR7mJu/eDV0kaIcp2za5Dqw0oT9ljiL9Mbxs2yQNg+bxAeOT054jgHsZ5bT28Slo10Ck5XLcvi6YX1hQJ9EXCIKQKlpb6pEYoGr/TcZ8MDJIuVNBPcu6+QifMcZanAJn5xfPVAVm7meuANzmOZ9jCQBisZgHQqouBEnDUEfA8zwf9ttBj++nuhBEz1wAGs0WGfMBzeMD3MsokZbLSeP06dn5xTMI+UU2cz9zJUFisRjnouLJpjQZZKifyUFzuiSAlHsZxRhr8U9VKPOhADqIuIwB7WoAHgNBFQgyE6ZzUSFqTADQarVC4yKtNoye+aEAJASADiLbJ0j9jPRTpOWSGI/iNs9JjEfVuPzsz/zQAFLpVPIqMR5VIMMaCTPkP4YZHKSR/kxKp5JXQKCBLzVyXf0H+RkW+LrBHOAAAAAASUVORK5CYII=";
const VESSEL_KIT = "workshop:fallen-star-vessel";

/** 숲 맵 칩셋에 별의 관 3×2 칸을 굽고, 왼쪽 위 (x, y) 에 놓는다. 두 줄 모두 막힌다. */
export function placeFallenStarVessel(project: Project, map: GameMap, x: number, y: number): void {
  const tileset = project.tilesets[map.tilesetId]!;
  const before = (tileset.tileGrafts ?? []).length;
  const kit = bakeWorkshopObject(project as unknown as Parameters<typeof bakeWorkshopObject>[0], map.tilesetId, {
    objectId: VESSEL_KIT, title: "떨어진 별의 관", description: "그을린 구덩이에 누운 관 모양 은빛 배 — 유리창·빛나는 이음매(폴른 스타 숲)",
    kind: "floor", columns: 3, rows: 2, footRows: 2, risePx: 0, use: ["추락지"], gridHash: "fallen-star-vessel-v6",
    asset: { id: workshopAssetId(FS_VESSEL_PNG), dataUrl: FS_VESSEL_PNG, width: 48, height: 32 },
    cells: [0, 1, 2, 3, 4, 5].map((k) => ({ sourceTile: k, dx: k % 3, dy: Math.floor(k / 3) })),
    provenance: { aiGenerated: false, tool: "code hand pixel (scripts/content/fallen-star-vessel-draw.py — polygon lid, glass window, glowing seam); object-gate fallen-town-r6" },
  });
  for (const g of (tileset.tileGrafts ?? []).slice(before)) { g.sourceTileSize = 16; g.sourceTilesPerRow = 3; }
  kit.rows.forEach((row, dy) => row.upperTiles?.forEach((id, dx) => {
    const cx = x + dx, cy = y + dy;
    if (id < 0 || cx < 0 || cy < 0 || cx >= map.width || cy >= map.height) return;
    map.upperTiles[cy * map.width + cx] = id;
  }));
}
