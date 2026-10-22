// project/stairs/placement.ts
// 계단 키트를 찍기 전 검사 — 입구 계약의 앞 칸(들어서는 칸)이 하나라도 걸을 수 있는 바닥인가.
// 조수 stamp_object(kitPlacementRules.checkKitPlacement)와 편집기 팔레트 스탬프(TilePaintEngine, 알림만)가 같이 쓴다.
import type { GameMap, TilesetDef } from "../types";
import { cellPassability } from "../collision";
import { stairContractOf } from "./contract";

export function stairApproachProblem(map: GameMap, ts: TilesetDef, kit: { id: string; name?: string }, x: number, y: number): string | null {
  const c = stairContractOf(ts.id, kit as { id: string });
  if (!c) return null;
  const cells = c.approach.map(([dx, dy]) => ({ x: x + dx, y: y + dy }));
  const open = cells.filter((p) => {
    if (p.x < 0 || p.y < 0 || p.x >= map.width || p.y >= map.height) return false;
    const pass = cellPassability(ts, map, p.y * map.width + p.x);
    return pass.up || pass.down || pass.left || pass.right;
  });
  if (open.length) return null;
  return `「${kit.name ?? kit.id}」 계단 입구가 막힌다 — 앞 칸 ${cells.map((p) => `(${p.x},${p.y})`).join(" ")} 이 모두 벽·가구·맵 밖이다(stair-entrance-blocked). ${c.note}`;
}
