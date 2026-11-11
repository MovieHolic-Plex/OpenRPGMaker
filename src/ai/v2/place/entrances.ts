// 건물 입구 — 칩셋이 선언한 것만 읽는다: 구조 키트(tileset.structureKits)의 entrance 부품 칸. 타일 이름표의 낱말은 읽지 않는다.
// 왜: 이름표가 「…문」으로 끝나는 칸을 문으로 읽으면 구성기 칩셋에서는 걸어서 지나는 성문만 잡히고(집은 키트 한 덩이라 문 이름표가 따로 없다)
// 「신문」 같은 물건도 문이 된다. 키트는 어느 칸이 들어가는 문인지 스스로 적어 둔다 — 문 칸은 막힌 그림이고 바로 아래 칸이 문 앞이다.
import { isPassable } from "@/project/collision";
import type { GameMap, Project, TilesetDef } from "@/project/types";

export interface Entrance {
  /** 문 그림 칸(막힌 칸). */
  readonly x: number;
  readonly y: number;
  /** 문 앞 칸 — 걸어서 서는 칸. */
  readonly front: { readonly x: number; readonly y: number };
  /** 이 문을 적어 둔 키트의 이름. */
  readonly kit: string;
}

type Kit = { name?: string; id?: string; rows?: { tiles?: number[]; upperTiles?: number[] }[]; parts?: { kind?: string; dx?: number; dy?: number; w?: number; h?: number }[] };
type Meta = { role?: string; passage?: string } | undefined;

const LAYERS = ["lowerTiles", "lowerOverlayTiles", "upperTiles", "upperOverlayTiles"] as const;
/** 쓰기 도구가 타일셋을 복제하므로 객체가 아니라 id·크기로 기억한다. */
const cache = new Map<string, Map<number, string>>();

/** 키트의 entrance 부품 칸에 놓이는 그림 타일 → 그 키트 이름. 그 칸 밑에 깔리는 땅 타일(걷는 바닥)은 문 그림이 아니다. */
function entranceTiles(tileset: TilesetDef | undefined): Map<number, string> {
  const kits = ((tileset as { structureKits?: readonly Kit[] } | undefined)?.structureKits ?? []) as readonly Kit[];
  const meta = ((tileset as { tileMeta?: unknown } | undefined)?.tileMeta ?? []) as Meta[];
  const key = `${tileset?.id}|${meta.length}|${kits.length}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const out = new Map<number, string>();
  for (const kit of kits) for (const part of kit.parts ?? []) {
    if (part.kind !== "entrance" || typeof part.dx !== "number" || typeof part.dy !== "number") continue;
    for (let y = part.dy; y < part.dy + (part.h ?? 1); y++) for (let x = part.dx; x < part.dx + (part.w ?? 1); x++) {
      const row = kit.rows?.[y];
      for (const t of [row?.tiles?.[x], row?.upperTiles?.[x]]) {
        if (typeof t !== "number" || t < 0 || out.has(t)) continue;
        const m = meta[t];
        if (m && (m.passage === "passable" || m.role === "terrain" || m.role === "empty")) continue;
        out.set(t, String(kit.name ?? kit.id ?? ""));
      }
    }
  }
  if (cache.size > 64) cache.clear();
  cache.set(key, out);
  return out;
}

/** 이 맵에 놓인 건물들의 입구: 키트가 문이라고 적은 그림 칸 가운데 막힌 칸이고 바로 아래가 걸을 수 있는 칸인 것. 위에서 아래, 왼쪽에서 오른쪽 순. */
export function buildingEntrances(project: Project, map: GameMap): Entrance[] {
  const tiles = entranceTiles(project.tilesets[map.tilesetId]);
  if (!tiles.size) return [];
  const m = map as unknown as Record<string, ArrayLike<number> | undefined>;
  const out: Entrance[] = [];
  for (let y = 0; y < map.height - 1; y++) for (let x = 0; x < map.width; x++) {
    const i = y * map.width + x;
    let kit: string | undefined;
    for (const layer of LAYERS) { const t = m[layer]?.[i]; if (typeof t === "number" && t >= 0 && tiles.has(t)) { kit = tiles.get(t); break; } }
    if (kit === undefined || isPassable(project, map, x, y) || !isPassable(project, map, x, y + 1)) continue;
    out.push({ x, y, front: { x, y: y + 1 }, kit });
  }
  return out;
}
