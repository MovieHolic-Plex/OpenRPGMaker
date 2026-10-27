// 받침 규칙(2026-10-14) — 「물체는 받쳐 주는 바닥 위에만」. 던전 층에서 횃불·화로·상자·통·기둥이 검은 허공에 떠 있고,
// 벽 조각이 바닥 한가운데 서 있고, 상자 이벤트가 천장 칸 위에 놓였다(사용자 스크린샷, qa-field-enemy fe1 · 지하 카타콤 던전 1층 48×38).
//
// 원인: 조수는 paint_tiles(바닥·천장 사각 칠하기)와 stamp_object(키트 찍기)를 절대 좌표로 따로 불렀고, 어느 쪽도 「이 칸 밑이 바닥인가」를
// 보지 않았다. 키트 메타의 「땅 위에 찍는다」는 문장일 뿐 실행기가 지키지 않았고, 천장을 다시 칠하면 이미 찍은 물체가 허공에 남았으며,
// run_lint·check_reachability 는 「바닥 위 물체」를 보지 않아 0건으로 통과했다(trace.json: stamp_object 113건 전부 ok, run_lint 0/0/0).
//
// 이 모듈은 한 곳에서 세 가지를 맡는다.
//   1) 찍기 전 검사(checkGroundSupportForStamp) — stamp_object 가 부른다. 어기면 거절하고 가까운 올바른 자리를 알려 준다.
//   2) 맵 린트(groundSupportIssues) — projectLint 가 부른다. 천장 위 물체·벽 위에 선 물체·바닥에 걸린 벽 횃불·천장 칸 이벤트는 error 라서,
//      천장을 다시 칠하다 물체 밑을 지우는 길(paint_tiles)까지 커밋에서 막힌다.
//   3) 벽이 허공을 향함(warning) — 벽 앞면 맨 아랫줄 바로 남쪽이 천장이면 그 벽은 아무것도 가리지 않는 조각이다.
// 범위: 던전 테마(themes 에 dungeon/던전) 키트가 있는 타일셋만 본다. 다른 칩셋·야외 맵의 동작은 그대로다.
import type { GameMap, StructureKitDef, TilesetDef } from "./types";

export type SupportSurface = "ceiling" | "wall" | "ground" | "empty";
export type SupportKind = "stand" | "mount" | "door" | "face";

/** 한 칸 그림 번호 → 받침 종류. 천장 = 「어두운 천장」 칸(허공), wall = 벽 앞면·막힌 벽, ground = 그 밖(걷는 바닥·물·풀 …). */
export function supportSurfaceOf(ts: TilesetDef, tile: number): SupportSurface {
  if (tile < 0) return "empty";
  const meta = ts.tileMeta?.[tile];
  const tags = meta?.tags ?? [];
  // 천장 태그(ceiling·천장)도 천장이다 — gap 탑 링 바깥 어둠(29775)은 이름표가 「탑 바깥 어둠」이라 이름만 보면 벽으로 셌다(2026-10-23).
  if (tags.includes("wall")) return tags.includes("ceiling") || tags.includes("천장") || /천장|ceiling/i.test(meta?.label ?? "") ? "ceiling" : "wall";
  return "ground";
}

const isDungeonKit = (kit: StructureKitDef): boolean => (kit.ai?.themes ?? []).some((t) => t === "dungeon" || t === "던전");
/** 벽 앞면에 붙는 물건 — 바닥 위에 서면 허공에 걸린 것처럼 보인다. */
const WALL_MOUNT = /torch-wall|banner|niche|chains|sconce|wall-lamp|vines|hanging-chain|tower-window|lever-(up|down)|timber-frame|ore-vein|icicles|stalactites|ossuary/;
/** 물·용암 위에 놓여도 되는 물건(배·말뚝·유목·그물). 그 밖은 액체 칸 위에 서면 걸을 수 없는 칸에 물건이 뜬 것이다. */
const LIQUID_OK = /boat|dock|driftwood|fish-net|bridge|lily|raft/;
const isLiquidTile = (ts: TilesetDef, tile: number): boolean => tile >= 0 && (ts.tileMeta?.[tile]?.tags ?? []).includes("water");
/** 벽에 뚫린 문·아치 — 그 밑 줄은 벽 앞면 위, 바로 남쪽은 걷는 바닥. */
const WALL_DOOR = /arch-|secret-door|door-/;
/** 통로 목에 끼우는 내리닫이 쇠창살문(tileGate.ts) — 목보다 넓은 문틀 칸은 일부러 목 양끝 벽 위에 얹힌다. */
const NECK_GATE = /portcullis/;

/** 키트 → 받침 규칙 종류. 던전 테마 키트만(그 밖은 null — 이 모듈이 보지 않는다). */
export function kitSupportKind(kit: StructureKitDef): SupportKind | null {
  if (!isDungeonKit(kit)) return null;
  const role = String(kit.ai?.role ?? "");
  const id = kit.id;
  if (role === "prop") return WALL_MOUNT.test(id) ? "mount" : WALL_DOOR.test(id) ? "door" : "stand";
  if (role === "wall" && !/ceiling/.test(id)) return "face";
  return null;
}

export interface SupportEntry {
  readonly kitId: string;
  readonly kitName: string;
  readonly kind: "stand" | "mount" | "door";
  /** 이 그림이 키트의 맨 아랫줄에 있나(맨 아랫줄만 바닥에 닿는다). */
  readonly bottom: boolean;
}

const indexCache = new WeakMap<object, ReadonlyMap<number, SupportEntry>>();

/** 위층 그림 번호 → 받침 규칙. 키트 목록이 바뀌지 않는 한 한 번만 만든다. */
export function groundSupportIndex(ts: TilesetDef): ReadonlyMap<number, SupportEntry> {
  const kits = ts.structureKits;
  if (!kits?.length) return EMPTY;
  const cached = indexCache.get(kits);
  if (cached) return cached;
  const index = new Map<number, SupportEntry>();
  for (const kit of kits) {
    const kind = kitSupportKind(kit);
    if (!kind || kind === "face") continue;
    kit.rows.forEach((row, dy) => {
      for (const tile of row.upperTiles ?? []) {
        if (tile < 0 || index.has(tile)) continue;
        index.set(tile, { kitId: kit.id, kitName: kit.name ?? kit.id, kind, bottom: dy === kit.height - 1 });
      }
    });
  }
  indexCache.set(kits, index);
  return index;
}
const EMPTY: ReadonlyMap<number, SupportEntry> = new Map();

const at = (map: GameMap, x: number, y: number): number => (x < 0 || y < 0 || x >= map.width || y >= map.height ? -1 : map.lowerTiles[y * map.width + x] ?? -1);
const SURFACE_KO: Record<SupportSurface, string> = { ceiling: "천장(검은 허공)", wall: "벽", ground: "바닥", empty: "빈 칸" };

// ---------- 찍기 전 검사 ----------

interface Cell { readonly dx: number; readonly dy: number }
const drawnCells = (kit: StructureKitDef): Cell[] => {
  const out: Cell[] = [];
  kit.rows.forEach((row, dy) => {
    for (let dx = 0; dx < kit.width; dx += 1) if ((row.tiles[dx] ?? -1) >= 0 || (row.upperTiles?.[dx] ?? -1) >= 0) out.push({ dx, dy });
  });
  return out;
};

/** 키트를 (x,y) 왼쪽 위에 찍을 때 어기는 받침 규칙을 사람이 읽을 말로(어기지 않으면 null). 칸 단위 사유 목록. */
function supportProblems(map: GameMap, ts: TilesetDef, kit: StructureKitDef, kind: SupportKind, x: number, y: number): string[] {
  const problems: string[] = [];
  const cells = drawnCells(kit);
  for (const { dx, dy } of cells) {
    const X = x + dx, Y = y + dy;
    if (X < 0 || Y < 0 || X >= map.width || Y >= map.height) continue;
    const surface = supportSurfaceOf(ts, at(map, X, Y));
    const bottom = dy === kit.height - 1;
    if (kind === "face") continue;
    if (surface === "ceiling") problems.push(`(${X},${Y}) 가 ${SURFACE_KO.ceiling} 칸이다 — 허공에는 물체를 놓지 않는다`);
    else if (kind !== "mount" && surface === "ground" && isLiquidTile(ts, at(map, X, Y)) && !LIQUID_OK.test(kit.id)) problems.push(`(${X},${Y}) 가 물·용암 칸이다 — 걸을 수 없는 칸 위에는 물체를 놓지 않는다(배·말뚝만 예외)`);
    else if (kind === "stand" && bottom && surface === "wall" && !NECK_GATE.test(kit.id)) problems.push(`(${X},${Y}) 밑이 벽이다 — 물체는 걷는 바닥 위에 선다`);
    else if (kind === "mount" && surface !== "wall") problems.push(`(${X},${Y}) 가 ${SURFACE_KO[surface]} 칸이다 — 벽 앞면에 거는 물건은 벽 칸에만 건다`);
  }
  if (kind === "door") {
    const bottomCells = cells.filter((c) => c.dy === kit.height - 1);
    for (const { dx } of bottomCells) {
      const X = x + dx, Y = y + kit.height;
      if (X < 0 || X >= map.width || Y >= map.height) continue;
      if (supportSurfaceOf(ts, at(map, X, Y)) !== "ground") problems.push(`(${X},${Y}) 문 앞이 걷는 바닥이 아니다 — 문·아치 바로 남쪽은 바닥이어야 드나들 수 있다`);
    }
  }
  if (kind === "face") {
    const bottomY = y + kit.height - 1;
    for (let dx = 0; dx < kit.width; dx += 1) {
      const X = x + dx, Y = bottomY + 1;
      if (X < 0 || X >= map.width || Y >= map.height) continue;
      const south = supportSurfaceOf(ts, at(map, X, Y));
      if (south === "ceiling" || south === "empty") problems.push(`(${X},${Y}) 벽 앞면 바로 남쪽이 ${SURFACE_KO[south]} 칸이다 — 벽은 바닥을 마주 보게 세운다(바닥을 먼저 칠한 뒤 그 윗줄에 벽을 찍는다)`);
    }
  }
  return problems;
}

/** 놓을 수 있는 가까운 왼위 자리(반지름 순). 맵에 다 들어가고 위층이 비어 있는 자리만. */
function alternativesFor(map: GameMap, ts: TilesetDef, kit: StructureKitDef, kind: SupportKind, x: number, y: number, want = 3): [number, number][] {
  const found: [number, number][] = [];
  const cells = drawnCells(kit);
  for (let radius = 1; radius <= 10 && found.length < want; radius += 1) {
    for (let dy = -radius; dy <= radius && found.length < want; dy += 1) for (let dx = -radius; dx <= radius && found.length < want; dx += 1) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
      const px = x + dx, py = y + dy;
      if (px < 0 || py < 0 || px + kit.width > map.width || py + kit.height > map.height) continue;
      if (supportProblems(map, ts, kit, kind, px, py).length) continue;
      if (cells.some((c) => (map.upperTiles[(py + c.dy) * map.width + px + c.dx] ?? -1) >= 0 && (kit.rows[c.dy]?.upperTiles?.[c.dx] ?? -1) >= 0)) continue;
      found.push([px, py]);
    }
  }
  return found;
}

/**
 * stamp_object 의 키트 놓기 규칙 한 줄. 던전 테마 키트가 아니면 null(다른 칩셋은 그대로).
 * 어기면 어느 칸이 왜 틀렸는지와 가까운 올바른 자리를 돌려준다 — 모델은 「좌표를 다시 계산」하지 않고 그 자리로 옮긴다.
 */
export function checkGroundSupportForStamp(map: GameMap, ts: TilesetDef, kit: StructureKitDef, x: number, y: number): string | null {
  const kind = kitSupportKind(kit);
  if (!kind) return null;
  const problems = supportProblems(map, ts, kit, kind, x, y);
  if (!problems.length) return null;
  const alt = alternativesFor(map, ts, kit, kind, x, y);
  const head = `「${kit.name ?? kit.id}」 받침 규칙:`;
  const shown = problems.slice(0, 4).join(" / ") + (problems.length > 4 ? ` … 외 ${problems.length - 4}칸` : "");
  const advice = kind === "face"
    ? "먼저 바닥(걷는 칸)을 칠하고, 벽은 그 바닥의 북쪽 변에 붙여 찍는다."
    : kind === "mount" ? "벽 앞면(어두운 돌벽 칸)에 건다 — show_map_region 으로 벽 칸 좌표를 확인한다."
      : kind === "door" ? "벽 앞면 두 줄에 걸치게 찍고 그 바로 남쪽은 바닥으로 둔다."
        : "바닥을 칠한 칸 위에만 놓는다. 방 안 바닥 좌표는 show_map_region 으로 확인한다.";
  const near = alt.length ? ` 가까운 올바른 자리(왼위): ${alt.map(([ax, ay]) => `(${ax},${ay})`).join(" · ")}.` : " 둘레 10칸 안에 올바른 자리가 없다 — 먼저 그 둘레를 바닥으로 칠한다.";
  return `${head} ${shown}. ${advice}${near}`;
}

// ---------- 맵 린트 ----------

export interface SupportIssue {
  readonly severity: "error" | "warning";
  readonly code: string;
  readonly x: number;
  readonly y: number;
  readonly eventId?: string;
  readonly message: string;
}

const MAX_ISSUES_PER_MAP = 80;

/** 이 타일셋이 받침 규칙의 대상인가(던전 테마 키트가 하나라도 있나). */
export function usesGroundSupport(ts: TilesetDef | undefined): boolean {
  return !!ts && groundSupportIndex(ts).size > 0;
}

/**
 * 맵 하나의 받침 위반. 칸마다 한 건이라 기준선(커밋 전)과 칸 단위로 대조된다 — 이미 있던 위반은 새 오류가 아니고,
 * 새로 만든 위반만 커밋을 막는다. 결정적 순서(y→x)라 같은 맵이면 같은 목록이다.
 */
export function groundSupportIssues(map: GameMap, ts: TilesetDef | undefined, opts: { readonly events?: boolean; readonly tiles?: boolean } = {}): SupportIssue[] {
  if (!ts || !usesGroundSupport(ts)) return [];
  const index = groundSupportIndex(ts);
  const issues: SupportIssue[] = [];
  const W = map.width, H = map.height;
  const layers = [map.upperTiles, map.upperOverlayTiles].filter((l): l is number[] => Array.isArray(l) && l.length === W * H);
  const scanTiles = opts.tiles !== false;
  for (let y = 0; scanTiles && y < H && issues.length < MAX_ISSUES_PER_MAP; y += 1) {
    for (let x = 0; x < W && issues.length < MAX_ISSUES_PER_MAP; x += 1) {
      for (const layer of layers) {
        const entry = index.get(layer[y * W + x] ?? -1);
        if (!entry) continue;
        const surface = supportSurfaceOf(ts, at(map, x, y));
        let why: string | null = null;
        if (surface === "ceiling") why = `${SURFACE_KO.ceiling} 위에 놓였다`;
        else if (entry.kind !== "mount" && surface === "ground" && isLiquidTile(ts, at(map, x, y)) && !LIQUID_OK.test(entry.kitId)) why = "물·용암 칸 위에 놓였다(걸을 수 없는 칸)";
        else if (entry.kind === "stand" && entry.bottom && surface === "wall" && !NECK_GATE.test(entry.kitId)) why = "벽 칸 위에 서 있다";
        else if (entry.kind === "mount" && surface !== "wall") why = `${SURFACE_KO[surface]} 칸에 걸려 있다(벽 앞면에만 건다)`;
        else if (entry.kind === "door" && entry.bottom) {
          const south = y + 1 < H ? supportSurfaceOf(ts, at(map, x, y + 1)) : "ground";
          if (south !== "ground") why = `문 앞(${x},${y + 1})이 ${SURFACE_KO[south]} 칸이라 드나들 수 없다`;
        }
        if (why) {
          issues.push({ severity: "error", code: "ground-support", x, y,
            message: `받침 없는 물체: (${x},${y}) 「${entry.kitName}」 이(가) ${why} — 걷는 바닥 위로 옮기거나, 그 칸을 바닥으로 칠한 뒤 다시 놓는다. 물체 밑 바닥을 천장·벽으로 덮어 칠하지 않는다.` });
          break;
        }
      }
    }
  }
  if (opts.events !== false) {
    for (const event of map.events ?? []) {
      if (issues.length >= MAX_ISSUES_PER_MAP) break;
      // 보이지 않는 자동·병렬 이벤트(맵 진입 분위기·날씨, 도착 장면)는 칸에 선 물체가 아니다 — 받침을 따지지 않는다
      // (set_scene_mood 가 (0,0) 에 두는 날씨 이벤트가 던전 맵 허공 칸이라 거절됐다, 2026-10-26).
      if (isInvisibleLogicEvent(event)) continue;
      const surface = supportSurfaceOf(ts, at(map, event.x, event.y));
      if (surface === "ceiling") {
        issues.push({ severity: "error", code: "ground-support", x: event.x, y: event.y, eventId: event.id,
          message: `받침 없는 이벤트: ${event.id} (${event.x},${event.y}) 가 ${SURFACE_KO.ceiling} 칸 위에 있다 — 상자·NPC·이동 지점은 걷는 바닥 칸에만 둔다.` });
      }
    }
  }
  // 벽 앞면 맨 아랫줄 바로 남쪽이 천장 = 아무것도 가리지 않는 벽 조각(경고). 가로로 이어진 칸은 한 건.
  for (let y = 0; scanTiles && y < H - 1 && issues.length < MAX_ISSUES_PER_MAP; y += 1) {
    let x = 0;
    while (x < W && issues.length < MAX_ISSUES_PER_MAP) {
      if (supportSurfaceOf(ts, at(map, x, y)) === "wall" && supportSurfaceOf(ts, at(map, x, y + 1)) === "ceiling") {
        const x0 = x;
        while (x + 1 < W && supportSurfaceOf(ts, at(map, x + 1, y)) === "wall" && supportSurfaceOf(ts, at(map, x + 1, y + 1)) === "ceiling") x += 1;
        issues.push({ severity: "warning", code: "ground-support", x: x0, y,
          message: `허공을 향한 벽: (${x0},${y})${x > x0 ? `~(${x},${y})` : ""} 벽 앞면 바로 남쪽이 천장이다 — 벽은 걷는 바닥을 마주 보게 세우고, 바닥이 없으면 벽을 지운다.` });
      }
      x += 1;
    }
  }
  return issues;
}

/** 모든 페이지가 그림 없는(투명) 자동·병렬 실행 이벤트 — 맵 논리용이라 바닥 받침이 필요 없다. */
function isInvisibleLogicEvent(event: { trigger?: { kind?: string }; pages?: readonly { trigger?: { kind?: string }; graphic?: unknown }[] }): boolean {
  const pages = event.pages ?? [];
  if (pages.length === 0) return event.trigger?.kind === "auto" || event.trigger?.kind === "parallel";
  return pages.every((page) => {
    const g = page.graphic as { transparent?: boolean; sprite?: unknown; tileId?: unknown } | undefined;
    const invisible = !g || g.transparent === true || (!g.sprite && g.tileId === undefined);
    const kind = page.trigger?.kind ?? event.trigger?.kind;
    return invisible && (kind === "auto" || kind === "parallel" || kind === "action");
  }) && pages.some((page) => { const k = page.trigger?.kind ?? event.trigger?.kind; return k === "auto" || k === "parallel"; });
}
