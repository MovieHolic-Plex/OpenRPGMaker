// 자물쇠 단계가 여는 길 — 다음 단계가 다른 장소면 그 자물쇠는 이 맵에서 그 장소로 가는 입구에 달린 것이다.
// 그 입구의 남은 문 칸에 앉히고, 문 칸이 없으면(한 칸 문·길 끝 출구) 입구 곁의 빈 칸에서 물건을 찾는다 — 다른 건물의 문으로 가지 않는다.
// 왜·증거는 openwiki/assistant-v2.md 「길을 여는 자물쇠는 그 입구에 달린다」.
import { isPassable } from "@/project/collision";
import type { GameMap, Project } from "@/project/types";
import { stepDoorCells } from "../place/entrances";
import { resolveWhere } from "../place/where";

type Cell = { x: number; y: number };

/** 이 맵에서 toMapId 로 옮기는 이벤트의 칸들. */
function gatesTo(map: GameMap, toMapId: string): Cell[] {
  const goes = (node: unknown): boolean => {
    if (Array.isArray(node)) return node.some(goes);
    if (!node || typeof node !== "object") return false;
    const cmd = node as { kind?: unknown; mapId?: unknown };
    return (cmd.kind === "transfer" && cmd.mapId === toMapId) || Object.values(node).some((v) => !!v && typeof v === "object" && goes(v));
  };
  return (map.events ?? []).filter((ev) => goes(ev.pages ?? [])).map((ev) => ({ x: ev.x, y: ev.y }));
}

/**
 * 이 맵에서 toMapId 로 가는 입구의 자리 — door = 그 입구의 남은 문 그림 칸(앞에 설 수 있는 것), near = 입구 앞 곁의 빈 칸.
 * 그 맵으로 바로 가는 이동이 이 맵에 없으면 undefined(부르는 쪽이 걸음 수로 고른다).
 */
export function wayOutSpot(project: Project, map: GameMap, toMapId: string, avoid: readonly Cell[]): { readonly near: Cell; readonly door?: Cell } | undefined {
  const gates = gatesTo(map, toMapId);
  const gate = gates[0];
  if (!gate) return undefined;
  const inside = (c: Cell) => c.x >= 0 && c.y >= 0 && c.x < map.width && c.y < map.height;
  const far = (c: Cell) => Math.min(...gates.map((g) => Math.abs(g.x - c.x) + Math.abs(g.y - c.y)));
  const taken = new Set(avoid.map((c) => `${c.x},${c.y}`));
  const door = stepDoorCells(project, map, toMapId)
    .filter((c) => !taken.has(`${c.x},${c.y}`) && inside({ x: c.x, y: c.y + 1 }) && isPassable(project, map, c.x, c.y + 1))
    .sort((a, b) => far(a) - far(b))[0];
  // 입구 앞: 문 그림 위의 이동이면 바로 아래 칸, 가장자리 길 끝이면 맵 안쪽으로 한 칸.
  const front = [{ x: gate.x, y: gate.y + 1 }, { x: gate.x + 1, y: gate.y }, { x: gate.x - 1, y: gate.y }, { x: gate.x, y: gate.y - 1 }]
    .find((c) => inside(c) && isPassable(project, map, c.x, c.y) && !gates.some((g) => g.x === c.x && g.y === c.y)) ?? gate;
  const near = resolveWhere(project, map, undefined, { avoid: [...avoid], role: "event", at: front }).cell;
  return { near, ...(door ? { door } : {}) };
}
