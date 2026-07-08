import { executeM2BattleCommand as executeM2Command } from "@/battle/battleM2CommandExecutor";
import type { MutableBattler } from "@/battle/battleBattlers";
import type { BattleEventLogSnapshot, BattleEventStateSnapshot } from "@/battle/types";
import { compareVariableValue } from "@/project/conditionEvaluation";
import { conditionMatchesSeason, conditionMatchesTimePhase, type GameTime } from "@/project/gameTime";
import type { ActorId, Command, Condition, Project, VariableOperand } from "@/project/types";
import type { BattleEventCondition, BattleEventPageRecord, TroopRecord } from "@/project/types/database";

export type BattleEventRuntimeState = {
  readonly switches: Record<string, boolean>;
  readonly variables: Record<string, number>;
  readonly inventory: Record<string, number>;
  readonly partyActorIds?: readonly string[];
  readonly gold?: number;
  readonly timers?: Record<string, number>;
  readonly gameTime?: GameTime;
};

export type BattleEventContext = {
  readonly turn: number;
  readonly activeActorId?: ActorId;
  readonly currentActorCommandKind?: string;
};

export type BattleEventRuntimeOptions = {
  readonly project: Project;
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
  logs(): readonly BattleEventLogSnapshot[];
};

export function createBattleEventRuntime(options: BattleEventRuntimeOptions): BattleEventRuntime {
  const firedBattleEventPageIds = new Set<string>();
  const firedBattleEventPageRoundKeys = new Set<string>();
  const extraActorActions: Record<string, number> = {};
  const logs: BattleEventLogSnapshot[] = [];

  function applyTroopEvents(context: BattleEventContext): BattleEventRuntimeResult {
    let forceEscape = false;
    if (options.troopRecord.battleEventPages.length === 0) return { forceEscape };
    for (const page of options.troopRecord.battleEventPages) {
      if (!shouldRunBattleEventPage(page, context)) continue;
      logs.push({ pageId: page.id, round: context.turn, triggerId: page.id, kind: "fired" });
      if (page.commands.length === 0) {
        applyLegacyTroopPageFallback();
      } else {
        forceEscape = executeBattleEventCommands(page, page.commands, context, 0) || forceEscape;
      }
      if (pageRunsOnce(page)) firedBattleEventPageIds.add(page.id);
      if (pageHasRoundCadenceCondition(page)) firedBattleEventPageRoundKeys.add(pageRoundKey(page, context));
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

  function eventLogs(): readonly BattleEventLogSnapshot[] {
    return logs;
  }

  function shouldRunBattleEventPage(page: BattleEventPageRecord, context: BattleEventContext): boolean {
    if (pageRunsOnce(page) && firedBattleEventPageIds.has(page.id)) return false;
    if (pageHasRoundCadenceCondition(page) && firedBattleEventPageRoundKeys.has(pageRoundKey(page, context))) return false;
    return page.conditions.every((condition) => evaluateBattleEventCondition(condition, context));
  }

  function pageRunsOnce(page: BattleEventPageRecord): boolean {
    return page.runOnce ?? page.span === "battle";
  }

  function pageHasRoundCadenceCondition(page: BattleEventPageRecord): boolean {
    return page.conditions.some((condition) =>
      condition.kind === "turn"
      || condition.kind === "onRound"
      || condition.kind === "everyRound"
      || condition.kind === "enemyTurn"
      || condition.kind === "actorTurn"
    );
  }

  function pageRoundKey(page: BattleEventPageRecord, context: BattleEventContext): string {
    return `${page.id}:${context.turn}`;
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
      case "timePhase":
      case "season":
        return evaluateCondition(condition);
      case "turn":
        return condition.interval <= 0
          ? context.turn === condition.start
          : context.turn >= condition.start && (context.turn - condition.start) % condition.interval === 0;
      case "onRound":
        return context.turn === condition.round;
      case "everyRound": {
        const start = condition.start ?? 1;
        const interval = Math.max(1, condition.interval ?? 1);
        return context.turn >= start && (context.turn - start) % interval === 0;
      }
      case "enemyHp": {
        const enemy = resolveEnemy(condition.enemyId);
        return enemy ? percentInRange(enemy.hp, enemy.maxHp, condition) : false;
      }
      case "enemyHpBelow": {
        const enemies = condition.enemyId ? [resolveEnemy(condition.enemyId)].filter((entry): entry is MutableBattler => Boolean(entry)) : options.enemies;
        return enemies.some((enemy) => percentBelow(enemy.hp, enemy.maxHp, condition.percent));
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

  function executeBattleEventCommands(
    page: BattleEventPageRecord,
    commands: readonly Command[],
    context: BattleEventContext,
    depth: number
  ): boolean {
    let forceEscape = false;
    if (depth > 8) {
      logUnsupported(page, context, "common event recursion limit");
      return false;
    }
    for (const command of commands) {
      forceEscape = executeBattleEventCommand(page, command, context, depth) || forceEscape;
    }
    return forceEscape;
  }

  function executeBattleEventCommand(page: BattleEventPageRecord, command: Command, context: BattleEventContext, depth: number): boolean {
    switch (command.kind) {
      case "text":
        logs.push({ pageId: page.id, round: context.turn, triggerId: page.id, kind: "message", detail: [command.speaker, command.body].filter(Boolean).join(": ") });
        return false;
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
        return executeBattleEventCommands(page, evaluateCondition(command.condition) ? command.then : command.else ?? [], context, depth);
      case "choices": {
        logs.push({ pageId: page.id, round: context.turn, triggerId: page.id, kind: "choices", detail: [command.prompt, command.options.map((option) => option.text).join("/")].filter(Boolean).join(" ") });
        const firstOption = command.options[0];
        return firstOption ? executeBattleEventCommands(page, firstOption.branch, context, depth) : false;
      }
      case "callCommonEvent": {
        const commonEvent = options.project.commonEvents.find((entry) => entry.id === command.commonEventId);
        if (!commonEvent) {
          logUnsupported(page, context, `missing common event: ${command.commonEventId}`);
          return false;
        }
        return executeBattleEventCommands(page, commonEvent.commands, context, depth + 1);
      }
      case "changeActorHp":
        changeActorVital(command.actorId, "hp", command.op, command.amount);
        return false;
      case "changeActorMp":
        changeActorVital(command.actorId, "mp", command.op, command.amount);
        return false;
      case "recoverAll":
        for (const actor of resolveActorTargets(command.actorId)) {
          actor.hp = actor.maxHp;
          actor.mp = actor.maxMp;
        }
        return false;
      case "m2Command": {
        const result = executeM2Command(command, {
          actors: options.actors,
          enemies: options.enemies,
          context,
          revealEnemy: options.revealEnemy,
          changeBattleback: options.changeBattleback,
          addExtraActorAction,
        });
        if (!result.handled) logUnsupported(page, context, command.commandId);
        return result.forceEscape;
      }
      case "wait":
      case "inputWait":
      case "label":
      case "gotoLabel":
      case "transfer":
      case "moveEvent":
      case "setEventGraphicPattern":
      case "changeTile":
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
      case "loop":
      case "breakLoop":
      case "timer":
      case "inputNumber":
      case "changeFace":
      case "changeExp":
      case "changeLevel":
      case "changeEquipment":
      case "enterHeroName":
      case "setSelfSwitch":
      case "callMapEvent":
      case "cutsceneControl":
      case "checkpointSave":
      case "killPlayer":
      case "triggerEnding":
      case "setLighting":
      case "addLight":
      case "removeLight":
      case "setWeather":
      case "showAnimation":
      case "displayTextSettings":
      case "addFollower":
      case "removeFollower":
        logUnsupported(page, context, command.kind);
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
      case "timePhase":
        return conditionMatchesTimePhase(options.state.gameTime, condition.phase);
      case "season":
        return conditionMatchesSeason(options.state.gameTime, condition.season);
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

  function percentBelow(current: number, max: number, percent: number): boolean {
    const currentPercent = max <= 0 ? 0 : current / max * 100;
    return currentPercent <= percent;
  }

  function resolveEnemy(enemyId: string): MutableBattler | undefined {
    return options.enemies.find((entry) => entry.id === enemyId || entry.recordId === enemyId);
  }

  function resolveActorTargets(actorId: string | undefined): readonly MutableBattler[] {
    if (!actorId || actorId === "party" || actorId === "all") return options.actors;
    return options.actors.filter((actor) => actor.id === actorId || actor.recordId === actorId);
  }

  function changeActorVital(actorId: string, kind: "hp" | "mp", op: "=" | "+=" | "-=", amount: number): void {
    for (const actor of resolveActorTargets(actorId)) {
      const max = kind === "hp" ? actor.maxHp : actor.maxMp;
      actor[kind] = clampVital(applyVitalOperation(actor[kind], op, amount), max);
    }
  }

  function applyVitalOperation(current: number, op: "=" | "+=" | "-=", amount: number): number {
    switch (op) {
      case "=":
        return amount;
      case "+=":
        return current + amount;
      case "-=":
        return current - amount;
    }
  }

  function clampVital(value: number, max: number): number {
    return Math.max(0, Math.min(max, Math.trunc(value)));
  }

  function logUnsupported(page: BattleEventPageRecord, context: BattleEventContext, detail: string): void {
    logs.push({ pageId: page.id, round: context.turn, triggerId: page.id, kind: "unsupported", detail });
  }

  function applyLegacyTroopPageFallback(): void {
    const stateId = options.stateIds[0];
    const target = options.enemies.find((entry) => entry.hp > 0) ?? options.enemies[0];
    if (stateId && target && !target.stateIds.includes(stateId)) {
      target.stateIds = [...target.stateIds, stateId];
    }
  }

  return { applyTroopEvents, consumeExtraActorAction, snapshot, logs: eventLogs };
}
