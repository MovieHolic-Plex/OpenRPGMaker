import { parseM2BattleCommand } from "@/battle/battleM2Commands";
import type { MutableBattler } from "@/battle/battleBattlers";
import type { Command } from "@/project/types";
import type { BattleEventContext } from "./battleEvents";

type M2Command = Extract<Command, { kind: "m2Command" }>;

export type M2BattleCommandExecutorOptions = {
  readonly actors: readonly MutableBattler[];
  readonly enemies: readonly MutableBattler[];
  readonly context: BattleEventContext;
  readonly revealEnemy?: (target: string) => void;
  readonly changeBattleback?: (resourceId: string) => void;
  readonly addExtraActorAction: (actorId: string, amount: number) => void;
  // m2-103: 전투 애니메이션을 필드에 띄운다. runtime 이 lastAnimation 을 세팅하도록 콜백.
  readonly showBattleAnimation?: (target: string, animationId: string) => void;
  // m2-105: 전투를 즉시 중단(승패 없이 종료 → escape 결과와 동등).
  readonly abortBattle?: () => void;
  // Calls enqueue an invocation; the event frame machine owns suspension and termination.
  readonly executeCommonEvent?: (commonEventId: string) => void;
  readonly executeTroopPage?: (pageId: string) => void;
};

export type M2BattleCommandExecution = {
  readonly handled: boolean;
  readonly forceEscape: boolean;
};

export function executeM2BattleCommand(command: M2Command, options: M2BattleCommandExecutorOptions): M2BattleCommandExecution {
  const parsed = parseM2BattleCommand(command);
  if (!parsed) return { handled: false, forceEscape: false };
  if ((parsed.kind === "changeEnemyHp" || parsed.kind === "changeEnemyMp" || parsed.kind === "changeEnemyState")
    && resolveEnemyTargets(options.enemies, parsed.target).length === 0) {
    return { handled: false, forceEscape: false };
  }
  switch (parsed.kind) {
    case "changeEnemyHp":
      for (const enemy of resolveEnemyTargets(options.enemies, parsed.target)) {
        enemy.hp = applyM2NumberOperation(enemy.hp, parsed.operation, parsed.value, enemy.maxHp);
      }
      return { handled: true, forceEscape: false };
    case "changeEnemyMp":
      for (const enemy of resolveEnemyTargets(options.enemies, parsed.target)) {
        enemy.mp = applyM2NumberOperation(enemy.mp, parsed.operation, parsed.value, enemy.maxMp);
      }
      return { handled: true, forceEscape: false };
    case "changeEnemyState":
      for (const enemy of resolveEnemyTargets(options.enemies, parsed.target)) {
        if (parsed.operation === "add") {
          if (!enemy.stateIds.includes(parsed.stateId)) {
            enemy.stateIds = [...enemy.stateIds, parsed.stateId];
            enemy.stateTurns[parsed.stateId] = 0;
          }
        } else {
          enemy.stateIds = enemy.stateIds.filter((id) => id !== parsed.stateId);
          delete enemy.stateTurns[parsed.stateId];
        }
      }
      return { handled: true, forceEscape: false };
    case "enemyEncounter":
      options.revealEnemy?.(parsed.target);
      return { handled: true, forceEscape: false };
    case "changeBattleback": {
      const resourceId = parsed.resourceId.trim();
      if (resourceId) options.changeBattleback?.(resourceId);
      return { handled: true, forceEscape: false };
    }
    case "showAnimation":
      if (parsed.animationId) options.showBattleAnimation?.(parsed.target, parsed.animationId);
      return { handled: true, forceEscape: false };
    case "abortBattle":
      // RM2K3 Abort Battle: 전투를 승패 없이 즉시 종료. 런타임은 escape 결과로 매핑.
      options.abortBattle?.();
      return { handled: true, forceEscape: true };
    case "battleEvents": {
      const pageId = parsed.target.trim();
      if (!pageId || !options.executeTroopPage) return { handled: true, forceEscape: false };
      options.executeTroopPage(pageId);
      return { handled: true, forceEscape: false };
    }
    case "callCommonEvent": {
      const id = parsed.commonEventId.trim();
      if (!id || !options.executeCommonEvent) return { handled: true, forceEscape: false };
      options.executeCommonEvent(id);
      return { handled: true, forceEscape: false };
    }
    case "forceEscape":
      return { handled: true, forceEscape: true };
    case "actionTimes": {
      const actor = resolveActorTarget(options.actors, parsed.target, options.context);
      if (!actor || parsed.amount <= 0) return { handled: true, forceEscape: false };
      options.addExtraActorAction(actor.recordId, parsed.amount);
      return { handled: true, forceEscape: false };
    }
  }
}

function resolveEnemyTargets(enemies: readonly MutableBattler[], target: string): readonly MutableBattler[] {
  if (target === "all") return enemies;
  const exact = enemies.find((enemy) => enemy.id === target || enemy.recordId === target);
  if (exact) return [exact];
  return [];
}

function resolveActorTarget(
  actors: readonly MutableBattler[],
  target: string,
  context: BattleEventContext
): MutableBattler | undefined {
  if (target) return actors.find((actor) => actor.id === target || actor.recordId === target);
  return context.activeActorId ? actors.find((actor) => actor.recordId === context.activeActorId) : undefined;
}

function applyM2NumberOperation(current: number, operation: "set" | "add" | "remove", value: number, max: number): number {
  switch (operation) {
    case "set":
      return clamp(value, max);
    case "add":
      return clamp(current + value, max);
    case "remove":
      return clamp(current - value, max);
  }
}

function clamp(value: number, max: number): number {
  return Math.min(max, Math.max(0, Math.trunc(value)));
}
