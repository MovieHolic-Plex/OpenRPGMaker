// project/campusDoors.ts
// 캠퍼스(modern_campus) 야외 건물 문의 «연결 규칙» — 그려진 문은 전부 걸어서 닿고, 안으로 이어져야 한다. 순수 함수.
//
// 왜(2026-10-14 실조수 검증 2회): 구성기가 건물마다 문 그림을 찍는데 실내 연결은 조수가 건물마다 따로 불러야 했다.
// 본관 하나만 잇고 체육관·별관 문은 말없이 «죽은 문»으로 남았고, 이를 알리는 것은 link_campus_interior 결과의 안내 문장뿐이었다(강제 없음).
// 지금 규칙: ① 구성기는 연결할 건물에만 문 그림을 찍는다(나머지는 문 없는 벽면 — 장식 문 금지)
//          ② 문 그림이 있는 칸은 접근칸이 걷을 수 있고, 거기에 실내로 가는 이동 이벤트가 있고, 시작 칸에서 닿아야 한다 — 어기면 projectLint 가 error(campus-dead-door).
// 문 그림의 정체는 건물 키트의 «entrance» 부품 칸(위·아래 두 줄)의 타일 번호다 — 그 번호는 문에만 쓰인다(전 키트 전수 확인).

import type { CampusKit } from "./campusComposer";

export const CAMPUS_TEXTURE_KEY = "tex_modern_campus";

/** 번들 캠퍼스 칩셋 정의인가(ai/campusPolicy.isCampusTilesetDef 와 같은 판정 — project 계층이 ai 를 끌어오지 않게 복제). */
export function isCampusTileset(tileset: { readonly image?: { readonly type?: string; readonly id?: string } } | undefined): boolean {
  return tileset?.image?.type === "bundled" && tileset.image.id === CAMPUS_TEXTURE_KEY;
}

export interface CampusDoorCells {
  /** 키트 안 좌표(dx,w) 와 문 위·아래 줄(키트 맨 아래 두 줄). */
  readonly dx: number;
  readonly w: number;
  readonly topRow: number;
  readonly bottomRow: number;
}

export function campusDoorCells(kit: CampusKit): CampusDoorCells | undefined {
  if (!kit.door || kit.height < 2) return undefined;
  return { dx: kit.door.dx, w: kit.door.w, topRow: kit.height - 2, bottomRow: kit.height - 1 };
}

/** 키트가 문 칸에 쓰는 (윗층/바닥층) 타일 번호. 문 그림 판정의 기준이다. */
export function campusDoorTileIds(kits: Iterable<CampusKit>): { top: Set<number>; bottom: Set<number> } {
  const top = new Set<number>(), bottom = new Set<number>();
  for (const kit of kits) {
    const cells = campusDoorCells(kit);
    if (!cells) continue;
    for (let i = 0; i < cells.w; i++) {
      const c = cells.dx + i;
      for (const [row, set] of [[cells.topRow, top], [cells.bottomRow, bottom]] as const) {
        const r = kit.rows[row];
        for (const id of [r?.tiles[c], r?.upperTiles?.[c]]) if (id !== undefined && id >= 0) set.add(id);
      }
    }
  }
  return { top, bottom };
}

/**
 * 문 없는 벽면 — 문 칸을 «문 바로 옆 칸의 같은 줄 타일(벽)» 로 덮는다. 장식 문을 남기지 않기 위한 것이다.
 * 반환: 키트 좌표의 (dx+i, row) → 바꿀 타일(윗층/바닥층). 문 칸이 아닌 칸은 그대로다.
 */
export function plainFacadePatch(kit: CampusKit): { col: number; row: number; lower: number; upper: number }[] {
  const cells = campusDoorCells(kit);
  if (!cells) return [];
  const doorCols = new Set(Array.from({ length: cells.w }, (_, i) => cells.dx + i));
  const sideCol = !doorCols.has(cells.dx - 1) && cells.dx - 1 >= 0 ? cells.dx - 1 : cells.dx + cells.w;
  const out: { col: number; row: number; lower: number; upper: number }[] = [];
  for (const row of [cells.topRow, cells.bottomRow]) {
    const side = kit.rows[row];
    for (let i = 0; i < cells.w; i++) out.push({ col: cells.dx + i, row, lower: side?.tiles[sideCol] ?? -1, upper: side?.upperTiles?.[sideCol] ?? -1 });
  }
  return out;
}

// ───────────────────────── 죽은 문 검사 ─────────────────────────

export type DeadDoorReason = "no-approach" | "no-exit-link" | "unreachable";
export interface DeadDoor { readonly x: number; readonly y: number; readonly reason: DeadDoorReason; readonly message: string }

interface EventLike { readonly x: number; readonly y: number; readonly commands?: unknown; readonly pages?: readonly { readonly commands?: unknown }[] }

/** 이벤트(모든 페이지)가 존재하는 맵으로 가는 transfer 를 갖는가. */
export function eventTransfersToExistingMap(event: EventLike, mapExists: (mapId: string) => boolean): boolean {
  const walk = (commands: unknown): boolean => {
    if (!Array.isArray(commands)) return false;
    return commands.some((command) => {
      if (!command || typeof command !== "object") return false;
      const c = command as { kind?: unknown; mapId?: unknown; then?: unknown; else?: unknown };
      if (c.kind === "transfer" && typeof c.mapId === "string" && mapExists(c.mapId)) return true;
      return walk(c.then) || walk(c.else);
    });
  };
  return walk(event.commands) || (event.pages ?? []).some((page) => walk(page.commands));
}

/**
 * 맵에 그려진 문 그림(문 아래 칸 타일)마다: 접근칸(바로 아래)이 걸을 수 있나 · 거기에 실내 이동 이벤트가 있나 · 시작 칸에서 닿나.
 * `passable`·`reach` 는 호출자가 엔진 통행으로 준다(순수 함수 유지). reach 가 null 이면 도달 검사는 건너뛴다.
 */
export function findCampusDeadDoors(input: {
  readonly width: number;
  readonly height: number;
  readonly lowerTiles: readonly number[];
  readonly upperTiles: readonly number[];
  readonly events: readonly EventLike[];
  readonly doorBottomIds: ReadonlySet<number>;
  readonly passable: (x: number, y: number) => boolean;
  readonly reach: ((x: number, y: number) => boolean) | null;
  readonly mapExists: (mapId: string) => boolean;
}): DeadDoor[] {
  const out: DeadDoor[] = [];
  const { width: W, height: H } = input;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = y * W + x;
    if (!input.doorBottomIds.has(input.upperTiles[k] ?? -1) && !input.doorBottomIds.has(input.lowerTiles[k] ?? -1)) continue;
    const ay = y + 1;
    if (ay >= H || !input.passable(x, ay)) { out.push({ x, y, reason: "no-approach", message: `문 (${x},${y}) 아래 접근칸이 ${ay >= H ? "맵 밖" : "막혀"} 있다 — 걸어서 문 앞에 설 수 없다` }); continue; }
    if (!input.events.some((e) => e.x === x && e.y === ay && eventTransfersToExistingMap(e, input.mapExists))) {
      out.push({ x, y, reason: "no-exit-link", message: `문 (${x},${y}) 은 어디로도 이어지지 않는다 — 접근칸 (${x},${ay}) 에 실내로 가는 이동 이벤트가 없다(죽은 문)` });
      continue;
    }
    if (input.reach && !input.reach(x, ay)) out.push({ x, y, reason: "unreachable", message: `문 (${x},${y}) 의 접근칸 (${x},${ay}) 에 시작 칸에서 걸어 닿지 못한다` });
  }
  return out;
}
