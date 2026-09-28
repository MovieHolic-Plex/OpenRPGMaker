// 「위로 올라가면 마을」의 두 번째 절반 — 새 마을 맵을 지은 뒤 출발 맵의 그쪽 끝과 마을의 반대쪽 끝을 잇는다.
//
// 모델에게 맡기지 않는 이유: 마을 계약 실행은 author_village·author_npc_cast 외의 쓰기를 막는다(piAgentRuntime wrapTool).
// 2026-09-28 실측: 계약이 새 맵 만들기와 출입구 달기를 모두 막은 채 지금 맵 전체 재시공만 허용해 6번 중 5번 실패했다.
// 방향은 의도 선언이 옮긴 사실(construction.approach)이고, 출입구 자리는 실제 통행으로 코드가 고른다.
import type { ConstructionApproach } from "@/ai/constructionDeclaration";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { eventAtPoint } from "@/project/eventFootprintQuery";
import { computeReachableCells } from "@/project/lint/reachability";
import type { GameMap, Project } from "@/project/types";
import type { VillageConnectionReceipt } from "./villageContract";

type Point = { readonly x: number; readonly y: number };

const OPPOSITE: Record<ConstructionApproach, ConstructionApproach> = { north: "south", south: "north", east: "west", west: "east" };
const INWARD: Record<ConstructionApproach, Point> = { north: { x: 0, y: 1 }, south: { x: 0, y: -1 }, east: { x: -1, y: 0 }, west: { x: 1, y: 0 } };

export type VillageConnectionOutcome =
  | { readonly ok: true; readonly connection: VillageConnectionReceipt; readonly summary: string }
  | { readonly ok: false; readonly summary: string };

/**
 * 출발 맵 side 쪽과 마을 맵 반대쪽을 양방향 출입구로 잇고, 게임 시작을 출발 맵의 원래 자리로 되돌린다.
 * author_village(kind:"new") 는 시작 위치를 새 마을로 옮긴다 — 「올라가면 마을」에서는 출발 맵이 시작이다.
 * 실패하면 ctx.project 를 건드리지 않는다.
 */
export function connectContractVillage(ctx: ToolContext, baseline: Project, input: {
  readonly fromMapId: string;
  readonly villageMapId: string;
  readonly side: ConstructionApproach;
  readonly doorFronts: readonly Point[];
}): VillageConnectionOutcome {
  const before = ctx.project;
  const origin = before.maps[input.fromMapId];
  const village = before.maps[input.villageMapId];
  if (!origin || !village) return { ok: false, summary: `연결할 맵이 없습니다: ${input.fromMapId} → ${input.villageMapId}` };
  const restartOnOrigin = baseline.startMapId === origin.id && !!baseline.maps[origin.id];
  const originStart = restartOnOrigin ? baseline.startPos : undefined;
  // 출발 맵의 걸을 수 있는 영역: 원래 시작점이 있으면 거기서, 없으면 맵 가운데에서 가장 가까운 통행 칸 기준.
  const originSeed = originStart ?? { x: Math.floor(origin.width / 2), y: Math.floor(origin.height / 2) };
  const originGate = pickGate(before, origin, input.side, [originSeed], true);
  const villageGate = pickGate(before, village, OPPOSITE[input.side], input.doorFronts, false);
  if (!originGate) return { ok: false, summary: `${origin.name}(${origin.id})에서 ${input.side} 쪽으로 걸어갈 수 있는 칸이 없어 마을 출입구를 달지 못했습니다.` };
  if (!villageGate) return { ok: false, summary: `마을 ${village.id}의 ${OPPOSITE[input.side]} 끝에 집들과 이어진 통행 칸이 없어 출입구를 달지 못했습니다.` };
  const linked = runTool(ctx, "link_maps", {
    from: { mapId: origin.id, x: originGate.x, y: originGate.y },
    to: { mapId: village.id, x: villageGate.x, y: villageGate.y },
    bidirectional: true,
  });
  if (!linked.ok) { ctx.project = before; return { ok: false, summary: linked.summary }; }
  const data = linked.data as { gateA: Point; gateB: Point; landingB: Point };
  if (originStart) {
    ctx.project.startMapId = origin.id;
    ctx.project.startPos = { ...originStart };
  }
  return {
    ok: true,
    connection: { fromMapId: origin.id, originGate: data.gateA, villageMapId: village.id, villageGate: data.gateB, villageLanding: data.landingB },
    summary: `${origin.name}(${data.gateA.x},${data.gateA.y}) ↔ 마을 ${village.id}(${data.gateB.x},${data.gateB.y}) 출입구를 이었습니다`
      + (originStart ? `. 게임 시작은 ${origin.name}(${originStart.x},${originStart.y})에 그대로 둡니다.` : "."),
  };
}

/**
 * side 가장자리의 출입구 칸. seeds 에서 걸어 닿는 칸 중 그 변에 붙은 칸을 가운데에 가까운 순으로 고른다.
 * 가장자리가 막혀 있고 allowInner 면(숲 맵의 북쪽이 나무로 막힌 경우) 그 변에 가장 가까운 도달 칸을 쓴다 —
 * 사용자가 그린 숲을 베지 않는다.
 */
function pickGate(project: Project, map: GameMap, side: ConstructionApproach, seeds: readonly Point[], allowInner: boolean): Point | undefined {
  const reach = new Set<string>();
  for (const seed of seeds) for (const key of computeReachableCells(project, map, seed.x, seed.y)) reach.add(key);
  const inward = INWARD[side];
  const cells = [...reach].map(key => { const [x, y] = key.split(",").map(Number); return { x: x!, y: y! }; })
    .filter(p => p.x >= 0 && p.y >= 0 && p.x < map.width && p.y < map.height)
    .filter(p => !eventAtPoint(map, p.x, p.y))
    .filter(p => { const q = { x: p.x + inward.x, y: p.y + inward.y }; return reach.has(`${q.x},${q.y}`) && !eventAtPoint(map, q.x, q.y); });
  const depth = (p: Point): number => side === "north" ? p.y : side === "south" ? map.height - 1 - p.y : side === "west" ? p.x : map.width - 1 - p.x;
  const offCentre = (p: Point): number => side === "north" || side === "south" ? Math.abs(p.x - map.width / 2) : Math.abs(p.y - map.height / 2);
  const ranked = cells.sort((a, b) => depth(a) - depth(b) || offCentre(a) - offCentre(b));
  const best = ranked[0];
  if (!best) return undefined;
  return depth(best) === 0 || allowInner ? best : undefined;
}
