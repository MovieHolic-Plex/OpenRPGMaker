/**
 * 옆에서 보는 필드(GameMap.sideView). 기존 타일 필드를 그대로 쓰되 한 칸 걸음 단위로
 * 중력을 건다 — 발밑(아래 칸)이 막혀 있지 않으면 한 칸씩 떨어지고, 위 방향키는 점프,
 * 사다리·밧줄(지형 기록 climbable)에서는 위아래로 오른다. N 칸 넘게 떨어지면 파티가 피해를 입는다.
 *
 * 판정은 순수 함수(planSideViewTick)로 두고, 씬 쪽(playSceneMovement)은 그 결과를 걸음으로 옮기기만 한다.
 */
import { inBounds, isPassable } from "@/project/collision";
import { terrainRecordAt } from "@/project/terrainAt";
import { applyTerrainWalkDamage } from "@/project/terrainStep";
import type { GameMap, Project } from "@/project/types";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes";

export const DEFAULT_SIDE_VIEW_JUMP_TILES = 2;
export const DEFAULT_SIDE_VIEW_FALL_TILES = 4;
export const DEFAULT_SIDE_VIEW_FALL_DAMAGE = 10;

export interface SideViewGrid {
  /** 몸이 들어갈 수 없는 칸(맵 밖 포함). */
  solid(x: number, y: number): boolean;
  /** 사다리·밧줄 칸. 이 칸에서는 떨어지지 않고 위아래로 오른다. */
  climbable(x: number, y: number): boolean;
}

export interface SideViewSettings {
  readonly jumpTiles: number;
  /** 이 칸 수를 **넘게** 떨어지면 피해를 입는다. */
  readonly fallDamageTiles: number;
  /** 넘은 한 칸마다 파티 전원이 받는 피해. */
  readonly fallDamagePerTile: number;
}

export interface SideViewState {
  /** 지금 자유 낙하로 내려온 칸 수. 착지하면 0 으로 돌아간다. */
  fallTiles: number;
  /** 점프에서 아직 더 올라갈 칸 수. */
  jumpRemaining: number;
}

export type SideViewPlanKind = "none" | "walk" | "climb" | "jump" | "fall";

export interface SideViewPlan {
  readonly kind: SideViewPlanKind;
  readonly dx: -1 | 0 | 1;
  readonly dy: -1 | 0 | 1;
  /** 이번 틱에 착지했다면 그때까지 떨어진 칸 수. */
  readonly landedFallTiles?: number;
}

export function isSideViewMap(map: Pick<GameMap, "sideView"> | undefined): boolean {
  return map?.sideView === true;
}

export function resolveSideViewSettings(map: Pick<GameMap, "sideViewJumpTiles" | "sideViewFallTiles" | "sideViewFallDamage">): SideViewSettings {
  const whole = (value: number | undefined, fallback: number, min: number): number =>
    typeof value === "number" && Number.isFinite(value) ? Math.max(min, Math.trunc(value)) : fallback;
  return {
    jumpTiles: whole(map.sideViewJumpTiles, DEFAULT_SIDE_VIEW_JUMP_TILES, 0),
    fallDamageTiles: whole(map.sideViewFallTiles, DEFAULT_SIDE_VIEW_FALL_TILES, 0),
    fallDamagePerTile: whole(map.sideViewFallDamage, DEFAULT_SIDE_VIEW_FALL_DAMAGE, 0),
  };
}

/** 프로젝트 타일 통행·지형 기록으로 격자 질의를 만든다. */
export function sideViewGridFor(project: Project, map: GameMap): SideViewGrid {
  return {
    solid: (x, y) => !inBounds(map, x, y) || !isPassable(project, map, x, y),
    climbable: (x, y) => inBounds(map, x, y) && terrainRecordAt(project, { mapId: map.id, x, y })?.record.climbable === true,
  };
}

function axis(value: number): -1 | 0 | 1 {
  return value > 0 ? 1 : value < 0 ? -1 : 0;
}

/**
 * 멈춰 선 한 틱의 다음 걸음을 정한다. state 는 제자리에서 갱신된다.
 * 우선순위: 착지 판정 → 점프 상승 → 자유 낙하 → (발 딛고 있을 때) 오르기/점프/걷기.
 */
export function planSideViewTick(
  grid: SideViewGrid,
  x: number,
  y: number,
  state: SideViewState,
  input: { readonly x: number; readonly y: number },
  settings: SideViewSettings,
): SideViewPlan {
  const ix = axis(input.x);
  const iy = axis(input.y);
  const onLadder = grid.climbable(x, y);
  const footing = onLadder || grid.solid(x, y + 1) || grid.climbable(x, y + 1);
  let landedFallTiles: number | undefined;
  if (footing && state.jumpRemaining === 0 && state.fallTiles > 0) {
    landedFallTiles = state.fallTiles;
    state.fallTiles = 0;
  }
  const plan = (kind: SideViewPlanKind, dx: -1 | 0 | 1, dy: -1 | 0 | 1): SideViewPlan =>
    landedFallTiles === undefined ? { kind, dx, dy } : { kind, dx, dy, landedFallTiles };

  if (state.jumpRemaining > 0) {
    if (!grid.solid(x, y - 1)) {
      state.jumpRemaining -= 1;
      const dx = ix !== 0 && !grid.solid(x + ix, y - 1) && !grid.solid(x + ix, y) ? ix : 0;
      return plan("jump", dx, -1);
    }
    // 머리가 천장에 닿았다 — 상승을 끝내고 떨어진다.
    state.jumpRemaining = 0;
  }
  if (!footing) {
    state.fallTiles += 1;
    const dx = ix !== 0 && !grid.solid(x + ix, y + 1) && !grid.solid(x + ix, y) ? ix : 0;
    return plan("fall", dx, 1);
  }
  if (iy < 0) {
    if ((onLadder || grid.climbable(x, y - 1)) && !grid.solid(x, y - 1)) return plan("climb", 0, -1);
    if (!onLadder && settings.jumpTiles > 0 && !grid.solid(x, y - 1)) {
      state.jumpRemaining = settings.jumpTiles - 1;
      const dx = ix !== 0 && !grid.solid(x + ix, y - 1) && !grid.solid(x + ix, y) ? ix : 0;
      return plan("jump", dx, -1);
    }
  }
  if (iy > 0 && (onLadder || grid.climbable(x, y + 1)) && !grid.solid(x, y + 1)) return plan("climb", 0, 1);
  if (ix !== 0 && !grid.solid(x + ix, y)) return plan("walk", ix, 0);
  return plan("none", 0, 0);
}

/** 떨어진 칸 수에 대한 낙하 피해(파티 전원 같은 양). */
export function sideViewFallDamage(fallTiles: number, settings: SideViewSettings): number {
  const over = Math.trunc(fallTiles) - settings.fallDamageTiles;
  return over > 0 ? over * settings.fallDamagePerTile : 0;
}

/** 착지 피해를 세션에 적용한다. 파티가 모두 쓰러졌으면 defeated. */
export function applySideViewLanding(
  project: Project,
  session: PlaySessionLike,
  fallTiles: number,
  settings: SideViewSettings,
): { readonly damage: number; readonly defeated: boolean } {
  const damage = sideViewFallDamage(fallTiles, settings);
  if (damage <= 0) return { damage: 0, defeated: false };
  const result = applyTerrainWalkDamage(project, session, damage);
  return { damage: result.applied, defeated: result.defeated };
}

/** 씬마다 한 벌. 맵이 바뀌면 새로 시작한다(다른 맵에서 떨어지던 칸 수가 이어지지 않게). */
const runtimeStates = new WeakMap<object, { mapId: string; state: SideViewState }>();

export function sideViewStateFor(scene: object, mapId: string): SideViewState {
  const entry = runtimeStates.get(scene);
  if (entry && entry.mapId === mapId) return entry.state;
  const state: SideViewState = { fallTiles: 0, jumpRemaining: 0 };
  runtimeStates.set(scene, { mapId, state });
  return state;
}
