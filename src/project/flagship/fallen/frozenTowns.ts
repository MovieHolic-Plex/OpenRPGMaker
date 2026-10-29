/**
 * 『폴른 스타』 마을 고정(2026-10-29). 왕도 아스텔(fs_hub)·새벽샘·서리나루는 author_beodeul_town 으로 짓는데,
 * 생성기 개선(#3900 마을 나무 덩이·덤불 등)이 같은 시드에서 다른 배치를 내자 옛 배치에 묶인 2막 좌표
 * (HUB_ARRIVE (52,25)·뚜껑 문 골목·B4 개구멍 등)가 덤불에 묻혀 굽기가 깨졌다.
 *
 * 데모는 생성기 출력 변화에 흔들리면 안 된다 — chrono-bell 빌드 동안만 author_beodeul_town 을 가로채,
 * frozenTowns.json 에 기록된 마을(맵·반환 data·타일셋 꼬리 덧붙임·맵 나무 덧붙임)을 그대로 깐다.
 * 문·건물 이벤트·문 앞 칸(data.doors)·광장 칸은 생성기가 낸 그대로라 뒤 단계(장 구성기 출입구·실내 잇기·1막 이벤트)는 바뀌지 않는다.
 *
 * 스냅숏 갱신은 의도적으로만: scripts/content/fallen/snapshot-towns.mts. 기록에 없는 마을 id 는 생성기를 그대로 부르고,
 * 같은 id 인데 인자가 다르면 멈춘다(빌더 인자를 바꿨으면 스냅숏도 다시 뽑아야 한다).
 * FS_FROZEN_TOWNS=off 면 가로채지 않는다(스냅숏 뽑기용).
 */
import type { GameMap, Project } from "@/project/types";
import { getTool } from "@/editor/tools/toolRegistry";
import { isPassable } from "@/project/collision";
import frozen from "./frozenTowns.json";

type Rec = Record<string, unknown>;
interface TilesetAppend { readonly baseCount: number; readonly count: number; readonly arrays: Readonly<Record<string, readonly unknown[]>> }
interface FrozenTown {
  readonly args: Rec;
  readonly tilesetId: string;
  /** 생성기가 돌려준 결과(summary·warnings·data) 그대로. */
  readonly result: { readonly summary: string; readonly data: unknown };
  readonly map: GameMap;
  readonly tilesets: Readonly<Record<string, TilesetAppend>>;
  readonly mapTreeAppend: readonly unknown[];
}

const TOWNS = (frozen as unknown as { towns: Record<string, FrozenTown> }).towns;
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** 인자 비교 — 키 순서와 무관하게. */
function sameArgs(a: Rec, b: Rec): boolean {
  const norm = (v: unknown): unknown =>
    Array.isArray(v) ? v.map(norm) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v as Rec).sort().map((k) => [k, norm((v as Rec)[k])])) : v;
  return JSON.stringify(norm(a)) === JSON.stringify(norm(b));
}

/** 기록 때와 지금의 타일셋 길이가 다르면(번들 칩셋에 그림이 늘면) 덧붙인 칸 번호를 지금 꼬리로 옮긴다. */
function shiftTile(t: unknown, base: number, delta: number, shift: number): unknown {
  return typeof t === "number" && t >= base && t < base + delta ? t + shift : t;
}

const LAYER_KEYS = ["lowerTiles", "upperTiles", "lowerOverlayTiles", "upperOverlayTiles"] as const;

function shiftMapTiles(map: GameMap, base: number, delta: number, shift: number): void {
  const m = map as unknown as Rec;
  for (const key of LAYER_KEYS) {
    const tiles = m[key];
    if (Array.isArray(tiles)) m[key] = tiles.map((t) => shiftTile(t, base, delta, shift));
  }
  // 건물 찍기 기록의 「찍기 전 타일」(지우기 복원용). afterHash 는 덧칠 감지 힌트일 뿐이라 그대로 둔다.
  for (const placement of (m.structurePlacements as { before?: Record<string, unknown> }[] | undefined) ?? []) {
    for (const [k, tiles] of Object.entries(placement.before ?? {})) {
      if (Array.isArray(tiles)) placement.before![k] = tiles.map((t) => shiftTile(t, base, delta, shift));
    }
  }
  // 이벤트 그림이 타일인 경우(문짝 등) — graphic.tileId.
  for (const event of map.events ?? []) for (const page of (event as unknown as { pages?: Rec[] }).pages ?? []) {
    const g = page.graphic as Rec | undefined;
    if (g && typeof g.tileId === "number") g.tileId = shiftTile(g.tileId, base, delta, shift);
  }
}

function installTown(draft: Project, town: FrozenTown): unknown {
  const map = clone(town.map);
  for (const [tilesetId, append] of Object.entries(town.tilesets)) {
    const ts = draft.tilesets[tilesetId] as unknown as Rec | undefined;
    if (!ts) throw new Error(`[fallen-star] 고정 마을 ${map.id}: 타일셋 ${tilesetId} 이 없다`);
    const now = Number(ts.count);
    const delta = append.count - append.baseCount;
    const shift = now - append.baseCount;
    for (const [key, tail] of Object.entries(append.arrays)) {
      const items = clone(tail) as unknown[];
      const moved = shift === 0 ? items : key === "tileGrafts"
        ? items.map((g) => ({ ...(g as Rec), targetTile: shiftTile((g as Rec).targetTile, append.baseCount, delta, shift) }))
        : items;
      const current = Array.isArray(ts[key]) ? (ts[key] as unknown[]) : [];
      // 칸마다 하나씩인 배열(통행·우선·지형·이름표)은 지금 길이가 칸 수와 같아야 꼬리에 붙는다.
      if (key !== "tileGrafts" && current.length !== now) {
        throw new Error(`[fallen-star] 고정 마을 ${map.id}: 타일셋 ${tilesetId}.${key} 길이 ${current.length} ≠ 칸 수 ${now}`);
      }
      ts[key] = [...current, ...moved];
    }
    ts.count = now + delta;
    if (shift !== 0 && tilesetId === map.tilesetId) shiftMapTiles(map, append.baseCount, delta, shift);
  }
  draft.maps[map.id] = map;
  const tree = (draft as unknown as { mapTree?: { children?: unknown[] } }).mapTree;
  if (tree && town.mapTreeAppend.length) {
    const have = new Set((tree.children ?? []).map((n) => (n as { mapId?: string }).mapId));
    tree.children = [...(tree.children ?? []), ...clone(town.mapTreeAppend).filter((n) => !have.has((n as { mapId?: string }).mapId))];
  }
  return clone(town.result);
}

/** fn 을 도는 동안 author_beodeul_town 이 기록된 마을이면 스냅숏을 깐다. */
export function withFrozenTowns<T>(fn: () => T): T {
  if (typeof process !== "undefined" && process.env?.FS_FROZEN_TOWNS === "off") return fn();
  const tool = getTool("author_beodeul_town") as unknown as { run: (draft: Project, args: Rec) => unknown } | undefined;
  if (!tool) throw new Error("[fallen-star] author_beodeul_town 도구가 없다");
  const realRun = tool.run;
  tool.run = function frozenTownRun(draft: Project, args: Rec) {
    const id = String(args.id ?? "");
    const town = TOWNS[id];
    if (!town) return realRun.call(tool, draft, args);
    if (!sameArgs(town.args, args)) {
      throw new Error(`[fallen-star] 고정 마을 ${id} 의 인자가 스냅숏과 다르다 — 빌더 인자를 바꿨으면 scripts/content/fallen/snapshot-towns.mts 로 다시 뽑아라.\n  스냅숏: ${JSON.stringify(town.args)}\n  지금:   ${JSON.stringify(args)}`);
    }
    if (draft.maps[id]) throw new Error(`[fallen-star] 고정 마을 ${id}: 같은 id 맵이 이미 있다`);
    return installTown(draft, town);
  };
  try { return fn(); }
  finally { tool.run = realRun; }
}

export const FROZEN_TOWN_IDS: readonly string[] = Object.keys(TOWNS);

/**
 * 고정 좌표 확인 — 2막은 왕도 배치의 칸에 묶여 있다. 마을이 다른 배치로 지어지면(스냅숏을 다시 뽑았거나 고정이 꺼졌으면)
 * 커밋 무결성 오류(transfer-impassable) 대신 어느 좌표가 왜 깨졌는지 바로 말한다.
 */
export function assertTownAnchors(
  project: Project, mapId: string,
  anchors: readonly { readonly what: string; readonly x: number; readonly y: number }[],
): void {
  const map = project.maps[mapId];
  if (!map) throw new Error(`[fallen-star] 고정 좌표 확인: 맵 ${mapId} 이 없다`);
  const bad = anchors.filter((a) => !isPassable(project, map, a.x, a.y));
  if (!bad.length) return;
  const frozenNote = TOWNS[mapId] || TOWNS[mapId.replace(/_\d+$/u, "")]
    ? "스냅숏(frozenTowns.json)을 다시 뽑았다면 2막 좌표도 함께 옮겨라"
    : "이 마을은 스냅숏에 없어 생성기 출력에 따라 바뀐다 — scripts/content/fallen/snapshot-towns.mts 로 고정하라";
  throw new Error(`[fallen-star] ${mapId} 고정 좌표가 막혔다: ${bad.map((a) => `${a.what} (${a.x},${a.y})`).join(", ")} — 마을 배치가 바뀌었다. ${frozenNote}.`);
}
