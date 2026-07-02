import { executeM2BattleCommand as executeM2Command } from "@/battle/battleM2CommandExecutor";
import type { MutableBattler } from "@/battle/battleBattlers";
import type { BattleEventStateSnapshot } from "@/battle/types";
import { compareVariableValue } from "@/project/conditionEvaluation";
import type { ActorId, Command, Condition, VariableOperand } from "@/project/types";
import type { BattleEventCondition, BattleEventPageRecord, TroopRecord } from "@/project/types/database";

export type BattleEventRuntimeState = {
  readonly switches: Record<string, boolean>;
  readonly variables: Record<string, number>;
  readonly inventory: Record<string, number>;
  readonly partyActorIds?: readonly string[];
  readonly gold?: number;
  readonly timers?: Record<string, number>;
};

export type BattleEventContext = {
  readonly turn: number;
  readonly activeActorId?: ActorId;
  readonly currentActorCommandKind?: string;
};

export type BattleEventRuntimeOptions = {
  readonly troopRecord: TroopRecord;
  readonly actors: readonly MutableBattler[];
  readonly enemies: readonly MutableBattler[];
  readonly stateIds: readonly string[];
  readonly state: BattleEventRuntimeState;
  readonly revealEnemy?: (target: string) => void;
  readonly changeBattleback?: (resourceId: string) => void;
};

export type BattleEventRuntimeResult = {
  readonly forceEscape: boolean;
};

export type BattleEventRuntime = {
  applyTroopEvents(context: BattleEventContext): BattleEventRuntimeResult;
  consumeExtraActorAction(actorId: ActorId): boolean;
  snapshot(): BattleEventStateSnapshot;
};

export function createBattleEventRuntime(options: BattleEventRuntimeOptions): BattleEventRuntime {
  const firedBattleEventPageIds = new Set<string>();
  const extraActorActions: Record<string, number> = {};

  function applyTroopEvents(context: BattleEventContext): BattleEventRuntimeResult {
    let forceEscape = false;
    if (options.troopRecord.battleEventPages.length === 0) return { forceEscape };
    for (const page of options.troopRecord.battleEventPages) {
      if (!shouldRunBattleEventPage(page, context)) continue;
      if (page.commands.length === 0) {
        applyLegacyTroopPageFallback();
      } else {
        forceEscape = executeBattleEventCommands(page.commands, context) || forceEscape;
      }
      if (page.span === "battle") firedBattleEventPageIds.add(page.id);
    }
    return { forceEscape };
  }

  function consumeExtraActorAction(actorId: ActorId): boolean {
    const remaining = extraActorActions[actorId] ?? 0;
    if (remaining <= 0) return false;
    extraActorActions[actorId] = remaining - 1;
    return true;
  }

  function snapshot(): BattleEventStateSnapshot {
    return {
      switches: options.state.switches,
      variables: options.state.variables,
      inventory: options.state.inventory,
    };
  }

  function shouldRunBattleEventPage(page: BattleEventPageRecord, context: BattleEventContext): boolean {
    if (page.span === "battle" && firedBattleEventPageIds.has(page.id)) return false;
    return page.conditions.every((condition) => evaluateBattleEventCondition(condition, context));
  }

  function evaluateBattleEventCondition(condition: BattleEventCondition, context: BattleEventContext): boolean {
    switch (condition.kind) {
      case "switch":
      case "variable":
      case "selfSwitch":
      case "actor":
      case "item":
      case "gold":
      case "timer":
        return evaluateCondition(condition);
      case "turn":
        return condition.interval <= 0
          ? context.turn === condition.start
          : context.turn >= condition.start && (context.turn - condition.start) % condition.interval === 0;
      case "enemyHp": {
        const enemy = options.enemies.find((entry) => entry.recordId === condition.enemyId);
        return enemy ? percentInRange(enemy.hp, enemy.maxHp, condition) : false;
      }
      case "actorHp": {
        const actor = options.actors.find((entry) => entry.recordId === condition.actorId);
        return actor ? percentInRange(actor.hp, actor.maxHp, condition) : false;
      }
      case "enemyTurn":
        return options.enemies.some((entry) => entry.recordId === condition.enemyId) && context.turn === condition.turn;
      case "actorTurn":
        return options.actors.some((entry) => entry.recordId === condition.actorId) && context.turn === condition.turn;
      case "actorCommand":
        return context.activeActorId === condition.actorId && (!condition.commandId || condition.commandId === context.currentActorCommandKind);
    }
  }

  function executeBattleEventCommands(commands: readonly Command[], context: BattleEventContext): boolean {
    let forceEscape = false;
    for (const command of commands) {
      forceEscape = executeBattleEventCommand(command, context) || forceEscape;
    }
    return forceEscape;
  }

  function executeBattleEventCommand(command: Command, context: BattleEventContext): boolean {
    switch (command.kind) {
      case "setSwitch":
        options.state.switches[command.switchId] = command.value;
        return false;
      case "setVariable":
        options.state.variables[command.variableId] = applyNumberOperation(
          options.state.variables[command.variableId] ?? 0,
          command.op,
          resolveOperand(command.value)
        );
        return false;
      case "changeItem": {
        const current = options.state.inventory[command.itemId] ?? 0;
        options.state.inventory[command.itemId] = Math.max(0, applyNumberOperation(current, command.op, command.amount));
        return false;
      }
      case "fork":
        return executeBattleEventCommands(evaluateCondition(command.condition) ? command.then : command.else ?? [], context);
      case "choices": {
        const firstOption = command.options[0];
        return firstOption ? executeBattleEventCommands(firstOption.branch, context) : false;
      }
      case "m2Command":
        return executeM2Command(command, {
          actors: options.actors,
          enemies: options.enemies,
          context,
          revealEnemy: options.revealEnemy,
          changeBattleback: options.changeBattleback,
          addExtraActorAction,
        });
      case "wait":
      case "inputWait":
      case "label":
      case "gotoLabel":
      case "text":
      case "transfer":
      case "moveEvent":
      case "changeTile":
      case "callCommonEvent":
      case "battleProcessing":
      case "learnSkill":
      case "changeGold":
      case "changeParty":
      case "showPicture":
      case "erasePicture":
      case "playAudio":
      case "stopAudio":
      case "shop":
      case "inn":
      case "gameOver":
      case "ending":
      case "returnToTitle":
      case "setFlag":
        return false;
    }
    return false;
  }

  function addExtraActorAction(actorId: string, amount: number): void {
    extraActorActions[actorId] = (extraActorActions[actorId] ?? 0) + amount;
  }

  function evaluateCondition(condition: Condition): boolean {
    switch (condition.kind) {
      case "switch":
        return (options.state.switches[condition.switchId] ?? false) === condition.value;
      case "variable": {
        const current = options.state.variables[condition.variableId] ?? 0;
        return compareVariableValue(current, condition.op, condition.value);
      }
      case "selfSwitch":
        // 배틀 이벤트에는 셀프 스위치 컨텍스트가 없으므로 항상 false(OFF) 취급.
        return condition.value === false;
      case "actor":
        return (options.state.partyActorIds ?? []).includes(condition.actorId) === condition.present;
      case "item":
        return ((options.state.inventory[condition.itemId] ?? 0) > 0) === condition.present;
      case "gold":
        return compareVariableValue(options.state.gold ?? 0, condition.op, condition.amount);
      case "timer": {
        const remaining = (options.state.timers ?? {})[condition.timerId] ?? 0;
        return remaining <= condition.seconds;
      }
    }
  }

  function resolveOperand(value: VariableOperand): number {
    if (typeof value === "number") return value;
    return options.state.variables[value.id] ?? 0;
  }

  function applyNumberOperation(current: number, op: "=" | "+=" | "-=" | "*=" | "/=", amount: number): number {
    switch (op) {
      case "=":
        return amount;
      case "+=":
        return current + amount;
      case "-=":
        return current - amount;
      case "*=":
        return current * amount;
      case "/=":
        return amount === 0 ? current : Math.trunc(current / amount);
    }
  }

  function percentInRange(current: number, max: number, range: { readonly minPercent: number; readonly maxPercent: number }): boolean {
    const percent = max <= 0 ? 0 : current / max * 100;
    return percent >= range.minPercent && percent <= range.maxPercent;
  }

  function applyLegacyTroopPageFallback(): void {
    const stateId = options.stateIds[0];
    const target = options.enemies.find((entry) => entry.hp > 0) ?? options.enemies[0];
    if (stateId && target && !target.stateIds.includes(stateId)) {
      target.stateIds = [...target.stateIds, stateId];
    }
  }

  return { applyTroopEvents, consumeExtraActorAction, snapshot };
}
