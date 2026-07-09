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
};

export type M2BattleCommandExecution = {
  readonly handled: boolean;
  readonly forceEscape: boolean;
};

export function executeM2BattleCommand(command: M2Command, options: M2BattleCommandExecutorOptions): M2BattleCommandExecution {
  const parsed = parseM2BattleCommand(command);
  if (!parsed) return { handled: false, forceEscape: false };
  switch (parsed.kind) {
    case "changeEnemyHp":
      for (const enemy of resolveEnemyTargets(options.enemies, parsed.target)) {
        enemy.hp = applyM2NumberOperation(enemy.hp, parsed.operation, parsed.value, enemy.maxHp);
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
  const firstAlive = enemies.find((enemy) => enemy.hp > 0);
  return firstAlive ? [firstAlive] : [];
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
