// project/placementSurface.ts
// 「이 물건은 어떤 자리에 놓이는가」를 기계가 검사한다 — 배치 면(PlacementZone) 판정의 유일한 정본.
//
// 왜 이 파일이 생겼나: 같은 뜻이 세 군데 흩어져 있었고 셋 다 집행되지 않았다.
//  - `placementRules` 자유 문장 → AI 프롬프트에 100자로 잘려 들어가는 산문(검사 없음)
//  - `PROP_SURFACE` 상수표 → 실내 절차 생성 전용 + 편집 UI 없음 + 화덕이 표에 없었다
//  - 「화덕은 북벽에 붙여 배치」 주석 → 그 뜻을 손으로 다시 구현한 절차 코드
// 이제 조건은 데이터고, 판정은 여기 하나뿐이다.
//
// ─────────────────────────────────────────────────────────────────────────────
// 판정 규약 (이 두 줄이 전부다)
//
//  1. **기준선은 사각의 맨 아랫줄**이다(발밑). 그 위 줄들은 벽에 걸쳐도 된다.
//     키 큰 물건 때문이다 — 화덕(1×2)은 아래 칸이 바닥이고 위 칸이 벽면이라,
//     "사각 전체가 바닥" 같은 규약으로는 어떤 zone 도 만족할 수 없다.
//     사각 전체를 봐야 하는 경우(집처럼 큰 것)는 zone `clearArea` 로 따로 고른다.
//  2. **방향 검사는 기준선에서 그 방향으로 한 칸**을 본다. 북쪽이면 기준선 바로 위 줄 —
//     그 칸이 사각 안이든 밖이든 상관없이 **찍기 전 맵의 상태**를 본다.
//     화덕이면 (기준선 위) = 사각의 윗칸 = 벽면. 절차 코드가 하던 검사와 정확히 같다.
//
// 벽 = 통행 불가 칸 **또는 맵 밖**. 맵 밖을 벽으로 세는 이유는 맵 경계도 등을 댈 수 있는 면이기
// 때문이다. 바닥 = 맵 안 + 통행 가능.
// ─────────────────────────────────────────────────────────────────────────────

import { isPassable } from "./collision";
import { TILE } from "./defaults/constants";
import type {
  ClusterRule,
  GameMap,
  PlacementFacing,
  PlacementSurfaceCondition,
  PlacementZone,
  Project,
} from "./types";

export type Facing4 = "north" | "south" | "east" | "west";

export const PLACEMENT_ZONES: readonly PlacementZone[] = [
  "anyFloor",
  "clearArea",
  "openFloor",
  "againstWall",
  "corner",
  "wallFace",
];

export const PLACEMENT_FACINGS: readonly PlacementFacing[] = ["any", "north", "south", "east", "west"];

const FACING4: readonly Facing4[] = ["north", "south", "east", "west"];

export interface SurfaceRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** 배치 면 규칙의 최소 단위 — 조건(강도 포함)에서 강도를 뺀 것. */
export interface PlacementSurfaceRule {
  readonly zone: PlacementZone;
  readonly facing?: PlacementFacing;
}

/**
 * 벽·바닥 판정을 주입한다.
 * 맵이면 `mapSurfaceProbe`, 아직 맵이 아닌 것(절차 생성 중 · 유닛 테스트)이면 직접 만든다.
 * `isWall` 은 **맵 밖 좌표로도 불린다** — 구현이 스스로 경계를 판단해야 한다.
 */
export interface SurfaceProbe {
  readonly isWall: (x: number, y: number) => boolean;
  readonly isFloor: (x: number, y: number) => boolean;
}

/** 맵 + 타일셋 통행 플래그로 만드는 표준 프로브. 찍기 **전** 상태를 본다. */
export function mapSurfaceProbe(project: Project, map: GameMap): SurfaceProbe {
  const inside = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < map.width && y < map.height;
  const floor = (x: number, y: number): boolean => inside(x, y) && isPassable(project, map, x, y);
  return {
    isFloor: floor,
    // 맵 밖은 벽으로 센다 — 맵 경계도 등을 댈 수 있는 면이다.
    isWall: (x, y) => !inside(x, y) || !isPassable(project, map, x, y),
  };
}

/**
 * **지형만** 보는 프로브 — 하위 레이어의 통행 플래그만 읽고 상위 레이어(가구·소품)는 없는 것으로 본다.
 *
 * 이미 찍혀 있는 맵을 되볼 때 쓴다(projectLint). 통 하나가 놓였다고 그 칸이 «벽»이 되면
 * 벽에 등을 댄 물건이 갑자기 위반으로 뒤집힌다 — 벽은 지형이고, 소품은 지형이 아니다.
 */
export function mapTerrainSurfaceProbe(project: Project, map: GameMap): SurfaceProbe {
  const inside = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < map.width && y < map.height;
  const bare: GameMap = { ...map, upperTiles: new Array<number>(map.lowerTiles.length).fill(TILE.EMPTY), upperTileStacks: undefined };
  const floor = (x: number, y: number): boolean => inside(x, y) && isPassable(project, bare, x, y);
  return {
    isFloor: floor,
    isWall: (x, y) => !inside(x, y) || !isPassable(project, bare, x, y),
  };
}

/** 타일 id 집합으로 벽을 판정하는 프로브 — 통행 플래그가 아직 없는 절차 생성 단계용. */
export function tileSetSurfaceProbe(input: {
  readonly wallTiles: ReadonlySet<number>;
  readonly tileAt: (x: number, y: number) => number | undefined;
  readonly width: number;
  readonly height: number;
}): SurfaceProbe {
  const inside = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < input.width && y < input.height;
  const wall = (x: number, y: number): boolean => {
    if (!inside(x, y)) return true;
    const tile = input.tileAt(x, y);
    return tile !== undefined && input.wallTiles.has(tile);
  };
  return { isFloor: (x, y) => inside(x, y) && !wall(x, y), isWall: wall };
}

export interface PlacementSurfaceCheck {
  readonly ok: boolean;
  readonly zone: PlacementZone;
  readonly facing: PlacementFacing;
  /** 지금 실제로 벽에 붙어 있는 방향들 — 실패 메시지에 "지금은 서쪽에 붙어 있습니다"로 쓴다. */
  readonly satisfiedFacings: readonly Facing4[];
  /** 사람 말로 쓴 결과 한 줄. 통과해도 채워 넣는다(디버깅·보고용). */
  readonly reason: string;
}

/**
 * 한 사각이 한 규칙을 만족하는지.
 * `rect` 는 **찍으려는 자리**이고, 프로브는 **찍기 전** 지형을 본다.
 */
export function checkPlacementSurface(input: {
  readonly probe: SurfaceProbe;
  readonly rect: SurfaceRect;
  readonly rule: PlacementSurfaceRule;
}): PlacementSurfaceCheck {
  const { probe, rect } = input;
  const zone = input.rule.zone;
  const facing = input.rule.facing ?? "any";
  const satisfied = FACING4.filter((direction) => sideIsWall(probe, rect, direction));

  const baseline = baselineCells(rect);
  const nonFloorBase = baseline.filter((cell) => !probe.isFloor(cell.x, cell.y)).length;
  const done = (ok: boolean, reason: string): PlacementSurfaceCheck =>
    ({ facing, ok, reason, satisfiedFacings: satisfied, zone });

  switch (zone) {
    case "anyFloor":
      return nonFloorBase > 0
        ? done(false, `발밑 ${nonFloorBase}칸이 바닥이 아닙니다`)
        : done(true, "발밑이 모두 바닥입니다");

    case "clearArea": {
      const blocked = allCells(rect).filter((cell) => !probe.isFloor(cell.x, cell.y)).length;
      return blocked > 0
        ? done(false, `자리 안 ${blocked}칸이 빈 땅이 아닙니다`)
        : done(true, "자리 전체가 빈 땅입니다");
    }

    case "openFloor":
      if (nonFloorBase > 0) return done(false, `발밑 ${nonFloorBase}칸이 바닥이 아닙니다`);
      return satisfied.length > 0
        ? done(false, `벽에서 떨어져 있어야 하는데 ${facingListText(satisfied)}이 벽입니다`)
        : done(true, "네 방향 모두 트여 있습니다");

    case "againstWall": {
      if (nonFloorBase > 0) return done(false, `발밑 ${nonFloorBase}칸이 바닥이 아닙니다`);
      if (facing === "any") {
        return satisfied.length > 0
          ? done(true, `${facingListText(satisfied)}이 벽입니다`)
          : done(false, "네 방향 어느 쪽도 벽이 아닙니다");
      }
      if (satisfied.includes(facing)) return done(true, `${facingLabel(facing)}이 벽입니다`);
      return done(
        false,
        satisfied.length > 0
          ? `${facingLabel(facing)}이 벽이 아닙니다 — 지금 붙어 있는 쪽은 ${facingListText(satisfied)}입니다`
          : `${facingLabel(facing)}이 벽이 아닙니다 — 어느 쪽도 벽에 닿아 있지 않습니다`,
      );
    }

    case "corner": {
      if (nonFloorBase > 0) return done(false, `발밑 ${nonFloorBase}칸이 바닥이 아닙니다`);
      const vertical = satisfied.some((direction) => direction === "north" || direction === "south");
      const horizontal = satisfied.some((direction) => direction === "east" || direction === "west");
      return vertical && horizontal
        ? done(true, `${facingListText(satisfied)}이 벽입니다`)
        : done(false, `구석이 아닙니다 — 세로·가로 양쪽이 벽이어야 하는데 지금은 ${satisfied.length === 0 ? "어느 쪽도 벽이 아닙니다" : `${facingListText(satisfied)}만 벽입니다`}`);
    }

    case "wallFace": {
      const nonWall = baseline.filter((cell) => !probe.isWall(cell.x, cell.y)).length;
      return nonWall > 0
        ? done(false, `벽면에 붙여야 하는데 ${nonWall}칸이 벽이 아닙니다`)
        : done(true, "벽면 위입니다");
    }
  }
}

/** 조건 목록을 한 번에 검사한다 — hard 위반과 soft 경고를 갈라 돌려준다. */
export interface PlacementSurfaceVerdict {
  readonly blocked: readonly PlacementSurfaceFailure[];
  readonly warnings: readonly PlacementSurfaceFailure[];
}

export interface PlacementSurfaceFailure {
  readonly condition: PlacementSurfaceCondition;
  readonly check: PlacementSurfaceCheck;
  /** 사람에게 그대로 보여줄 한 줄. condition.message 가 있으면 그걸 앞세운다. */
  readonly text: string;
}

export function evaluatePlacementConditions(input: {
  readonly probe: SurfaceProbe;
  readonly rect: SurfaceRect;
  readonly conditions: readonly PlacementSurfaceCondition[] | undefined;
}): PlacementSurfaceVerdict {
  const blocked: PlacementSurfaceFailure[] = [];
  const warnings: PlacementSurfaceFailure[] = [];
  for (const condition of input.conditions ?? []) {
    const check = checkPlacementSurface({ probe: input.probe, rect: input.rect, rule: condition });
    if (check.ok) continue;
    const failure: PlacementSurfaceFailure = {
      check,
      condition,
      text: condition.message?.trim()
        ? `${condition.message.trim()} (${check.reason})`
        : `${describePlacementSurface(condition)}에 놓아야 합니다 — ${check.reason}`,
    };
    if (condition.strength === "hard") blocked.push(failure);
    else warnings.push(failure);
  }
  return { blocked, warnings };
}

// ── 라벨 · 파싱 ──────────────────────────────────────────────────────────────

export function placementZoneLabel(zone: PlacementZone): string {
  switch (zone) {
    case "anyFloor":
      return "아무 바닥";
    case "clearArea":
      return "빈 땅(자리 전체)";
    case "openFloor":
      return "벽에서 떨어진 바닥";
    case "againstWall":
      return "벽에 붙은 바닥";
    case "corner":
      return "구석 바닥";
    case "wallFace":
      return "벽면";
  }
}

export function facingLabel(facing: PlacementFacing): string {
  switch (facing) {
    case "north":
      return "북쪽(위)";
    case "south":
      return "남쪽(아래)";
    case "east":
      return "동쪽(오른쪽)";
    case "west":
      return "서쪽(왼쪽)";
    case "any":
      return "아무 쪽";
  }
}

/** "북쪽(위) 벽에 붙은 바닥" 처럼 조건 한 줄을 사람 말로. */
export function describePlacementSurface(rule: PlacementSurfaceRule): string {
  const zone = placementZoneLabel(rule.zone);
  if (rule.zone !== "againstWall") return zone;
  const facing = rule.facing ?? "any";
  return facing === "any" ? zone : `${facingLabel(facing)} 벽에 붙은 바닥`;
}

export function asPlacementZone(value: unknown): PlacementZone | undefined {
  return PLACEMENT_ZONES.find((zone) => zone === value);
}

export function asPlacementFacing(value: unknown): PlacementFacing | undefined {
  return PLACEMENT_FACINGS.find((facing) => facing === value);
}

/** `surface` 클러스터 규칙의 params → 규칙. 형식이 틀리면 undefined(조용히 건너뛴다). */
export function surfaceRuleFromClusterRule(rule: ClusterRule): PlacementSurfaceRule | undefined {
  if (rule.kind !== "surface") return undefined;
  const zone = asPlacementZone(rule.params.zone);
  if (!zone) return undefined;
  const facing = asPlacementFacing(rule.params.facing);
  return facing ? { facing, zone } : { zone };
}

// ── 내부 ────────────────────────────────────────────────────────────────────

function baselineCells(rect: SurfaceRect): readonly { readonly x: number; readonly y: number }[] {
  const y = rect.y + Math.max(1, rect.h) - 1;
  const cells: { x: number; y: number }[] = [];
  for (let x = rect.x; x < rect.x + Math.max(1, rect.w); x += 1) cells.push({ x, y });
  return cells;
}

function allCells(rect: SurfaceRect): readonly { readonly x: number; readonly y: number }[] {
  const cells: { x: number; y: number }[] = [];
  for (let y = rect.y; y < rect.y + Math.max(1, rect.h); y += 1) {
    for (let x = rect.x; x < rect.x + Math.max(1, rect.w); x += 1) cells.push({ x, y });
  }
  return cells;
}

/** 기준선에서 한 칸 그 방향 — 그 줄(또는 칸)이 **전부** 벽인가. */
function sideIsWall(probe: SurfaceProbe, rect: SurfaceRect, direction: Facing4): boolean {
  const baseline = baselineCells(rect);
  if (baseline.length === 0) return false;
  switch (direction) {
    case "north":
      return baseline.every((cell) => probe.isWall(cell.x, cell.y - 1));
    case "south":
      return baseline.every((cell) => probe.isWall(cell.x, cell.y + 1));
    case "west": {
      const first = baseline[0]!;
      return probe.isWall(first.x - 1, first.y);
    }
    case "east": {
      const last = baseline[baseline.length - 1]!;
      return probe.isWall(last.x + 1, last.y);
    }
  }
}

function facingListText(facings: readonly Facing4[]): string {
  return facings.map((facing) => facingLabel(facing)).join("·");
}
