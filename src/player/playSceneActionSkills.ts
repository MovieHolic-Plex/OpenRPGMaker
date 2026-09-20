import { skillLineClear, skillRay, tickFieldStatus } from "@/battle/action/skillEffects";
import { swingArcOverlapsBody } from "@/battle/action/hitbox";
import { footprintBounds, pointRect, rectsOverlap } from "@/project/footprint";
import { inBounds, isPassable } from "@/project/collision";
import { store } from "@/project/store";
import { startPlayerRoute } from "./playerRouteState";
import { characterSpriteX, characterSpriteY } from "./characterDepth";
import { actionFieldSlow } from "./actionFieldSlow";
import type { ActionSkillProfile, Dir } from "@/project/types";
import type { PlaySceneContext, PlayerRouteState } from "./playSceneTypes";
import type { ActionEnemyState } from "./actionCombatTypes";

type Hit = (enemy: ActionEnemyState, profile: ActionSkillProfile, elementId?: string) => boolean;
type Position = (id: string) => { x: number; y: number } | null | undefined;
type Status = { remainingMs: number; tickMs: number };
type Trap = { x: number; y: number; remainingMs: number; profile: ActionSkillProfile; elementId?: string;
  object: ReturnType<PlaySceneContext["add"]["circle"]> };
type Dash = { route: PlayerRouteState; profile: ActionSkillProfile; elementId?: string; facing: Dir; hit: Set<string>; remainingMs: number };
type Skills = { detachShutdown?: () => void; cooldownMs: number; traps: Trap[]; dash?: Dash;
  statuses: Map<ActionEnemyState, { poison?: Status; slow?: Status; mover?: object }> };
const states = new WeakMap<PlaySceneContext, Skills>();
function stateFor(scene: PlaySceneContext): Skills {
  let state = states.get(scene);
  if (!state) {
    state = { cooldownMs: 0, traps: [], statuses: new Map() };
    states.set(scene, state);
    const cleanup = (): void => clearActionSkills(scene);
    scene.events.once("shutdown", cleanup);
    state.detachShutdown = () => { scene.events.off("shutdown", cleanup); };
  }
  return state;
}
export function clearActionSkills(scene: PlaySceneContext): void {
  const state = states.get(scene);
  if (!state) return;
  state.detachShutdown?.();
  for (const trap of state.traps) trap.object.destroy();
  for (const status of state.statuses.values()) if (status.mover) actionFieldSlow.delete(status.mover);
  if (state.dash && scene.playerRoute === state.dash.route) scene.playerRoute = null;
  states.delete(scene);
}
export function canCastActionProfile(scene: PlaySceneContext, profile: ActionSkillProfile): boolean {
  const state = stateFor(scene);
  return state.cooldownMs <= 0 && !state.dash && (profile.kind !== "dash" || (!scene.moving && !scene.playerRoute && !scene.playerHop))
    && (profile.kind !== "trap" || state.traps.length < 16);
}
export function markActionCast(scene: PlaySceneContext, profile: ActionSkillProfile): void {
  stateFor(scene).cooldownMs = profile.cooldownMs ?? 350;
}
export function applyActionFieldStatus(scene: PlaySceneContext, enemy: ActionEnemyState, profile: ActionSkillProfile): void {
  if (!profile.fieldStatus || enemy.hp <= 0 || enemy.dying) return;
  const state = stateFor(scene);
  const status = state.statuses.get(enemy) ?? {};
  status[profile.fieldStatus.kind] = { remainingMs: profile.fieldStatus.durationMs, tickMs: 0 };
  if (status.mover) actionFieldSlow.delete(status.mover);
  status.mover = scene.autonomousNPCs.get(enemy.eventId);
  if (status.slow && status.mover) actionFieldSlow.set(status.mover, 0.5);
  state.statuses.set(enemy, status);
}
function passable(scene: PlaySceneContext, x: number, y: number): boolean {
  return inBounds(scene.map, x, y) && isPassable(store.getCurrent(), scene.map, x, y);
}
function hitArc(scene: PlaySceneContext, profile: ActionSkillProfile, facing: Dir, position: Position, hit: Hit,
  elementId?: string, seen = new Set<string>()): void {
  for (const enemy of scene.actionCombatState?.enemies.values() ?? []) {
    if (seen.has(enemy.eventId) || enemy.hp <= 0 || enemy.dying) continue;
    const p = position(enemy.eventId);
    if (!p || !swingArcOverlapsBody(facing, scene.tileX, scene.tileY, profile.range, p.x, p.y, enemy.footprint)) continue;
    const body = footprintBounds(p.x, p.y, enemy.footprint);
    const tx = Math.max(body.left, Math.min(body.right, scene.tileX));
    const ty = Math.max(body.top, Math.min(body.bottom, scene.tileY));
    if (!skillLineClear(scene.tileX, scene.tileY, tx, ty, (x, y) => passable(scene, x, y))) continue;
    if (hit(enemy, profile, elementId)) seen.add(enemy.eventId);
  }
}
export function castActionFieldProfile(scene: PlaySceneContext, profile: ActionSkillProfile, elementId: string | undefined,
  position: Position, hit: Hit): void {
  const state = stateFor(scene);
  if (profile.kind === "melee") { hitArc(scene, profile, scene.facing, position, hit, elementId); return; }
  if (profile.kind === "dash") {
    startPlayerRoute(scene, Array.from({ length: profile.range }, () => ({ kind: "move" as const, dir: scene.facing })), false);
    const route = scene.playerRoute!;
    route.stopOnBlocked = true;
    route.moveDurationMs = 1000 / (profile.speedTilesPerSec ?? 6);
    state.dash = { route, profile, elementId, facing: scene.facing, hit: new Set(), remainingMs: profile.range * route.moveDurationMs + 1000 };
    hitArc(scene, { ...profile, range: 1 }, scene.facing, position, hit, elementId, state.dash.hit);
    return;
  }
  const direction = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[scene.facing]!;
  const cells = skillRay(scene.tileX, scene.tileY, direction[0]!, direction[1]!, profile.range, (x, y) => passable(scene, x, y));
  const cell = cells.at(-1) ?? { x: scene.tileX, y: scene.tileY };
  const object = scene.add.circle(characterSpriteX(cell.x), characterSpriteY(cell.y) - 8, 7, 0xffcc55, 0.4);
  object.setStrokeStyle(2, 0xffdd88); object.setDepth(100001);
  state.traps.push({ ...cell, profile, elementId, remainingMs: profile.durationMs ?? 5000, object });
}
export function updateActionSkills(scene: PlaySceneContext, deltaMs: number, position: Position, hit: Hit): void {
  const state = stateFor(scene);
  state.cooldownMs = Math.max(0, state.cooldownMs - deltaMs);
  if (state.dash) {
    const dash = state.dash;
    dash.remainingMs -= deltaMs;
    if (scene.playerRoute !== dash.route || dash.remainingMs <= 0) {
      if (scene.playerRoute === dash.route) scene.playerRoute = null;
      state.dash = undefined;
    } else hitArc(scene, { ...dash.profile, range: 1 }, dash.facing, position, hit, dash.elementId, dash.hit);
  }
  for (let i = state.traps.length - 1; i >= 0; i--) {
    const trap = state.traps[i]!;
    trap.remainingMs -= deltaMs;
    if (trap.remainingMs > 0) for (const enemy of scene.actionCombatState?.enemies.values() ?? []) {
      const p = position(enemy.eventId);
      if (!p || enemy.hp <= 0 || enemy.dying || !rectsOverlap(footprintBounds(p.x, p.y, enemy.footprint), pointRect(trap.x, trap.y))) continue;
      if (hit(enemy, trap.profile, trap.elementId)) { trap.remainingMs = 0; break; }
    }
    if (trap.remainingMs <= 0) { trap.object.destroy(); state.traps.splice(i, 1); }
  }
  for (const [enemy, effects] of state.statuses) {
    if (enemy.hp <= 0 || scene.actionCombatState?.enemies.get(enemy.eventId) !== enemy) {
      if (effects.mover) actionFieldSlow.delete(effects.mover);
      state.statuses.delete(enemy); continue;
    }
    const mover = scene.autonomousNPCs.get(enemy.eventId);
    if (effects.mover !== mover) {
      if (effects.mover) actionFieldSlow.delete(effects.mover);
      effects.mover = mover;
      if (mover && effects.slow) actionFieldSlow.set(mover, 0.5);
    }
    if (effects.poison) {
      const next = tickFieldStatus(effects.poison.remainingMs, effects.poison.tickMs, deltaMs);
      effects.poison = next.remainingMs > 0 ? next : undefined;
      if (next.ticks) hit(enemy, { kind: "melee", damage: Math.max(1, Math.ceil(enemy.maxHp * 0.05)) * next.ticks, range: 1 });
    }
    if (effects.slow) {
      effects.slow.remainingMs = Math.max(0, effects.slow.remainingMs - deltaMs);
      if (!effects.slow.remainingMs) { effects.slow = undefined; if (effects.mover) actionFieldSlow.delete(effects.mover); }
    }
    if (!effects.poison && !effects.slow) state.statuses.delete(enemy);
  }
}
