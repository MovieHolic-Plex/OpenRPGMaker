import { executeM2BattleCommand as executeM2Command } from "@/battle/battleM2CommandExecutor";
import type { MutableBattler } from "@/battle/battleBattlers";
import type { BattleEventLogSnapshot, BattleEventStateSnapshot } from "@/battle/types";
import { compareVariableValue } from "@/project/conditionEvaluation";
import { conditionMatchesSeason, conditionMatchesTimePhase, type GameTime } from "@/project/gameTime";
import { clampFriendship } from "@/project/session";
import { transitionItemState } from "@/project/itemTransitions";
import type { ActorId, Command, Condition, Project, VariableOperand } from "@/project/types";
import type { BattleEventCondition, BattleEventPageRecord, TroopRecord } from "@/project/types/database";

export type BattleEventRuntimeState = {
  readonly switches: Record<string, boolean>;
  readonly variables: Record<string, number>;
  // 세션 셀프 스위치 스냅샷 사본(eventId → key → on). setSelfSwitch 가 여기 기록하고
  // 전투 종료 시 applyBattleRewardsToSession 이 세션에 되돌려 쓴다.
  readonly selfSwitches?: Record<string, Partial<Record<string, boolean>>>;
  // 직전 전투 처리 결과(전투 개시 시점 세션 battleResult 스냅샷). battleResult 조건 평가 기준.
  readonly battleResult?: "victory" | "defeat" | "escape";
  inventory: Record<string, number>;
  itemUseCharges?: Record<string, number>;
  partyActorIds?: string[];
  gold?: number;
  actorSkillIds?: Record<string, string[]>;
  actorExperience?: Record<string, number>;
  actorLevels?: Record<string, number>;
  actorBattleCommands?: Record<string, string[]>;
  readonly timers?: Record<string, number>;
  readonly gameTime?: GameTime;
  readonly friendship?: Record<string, number>;
};

export type BattleEventContext = {
  readonly turn: number;
  readonly activeActorId?: ActorId;
  readonly currentActorCommandKind?: string;
};

export type BattleEventRuntimeOptions = {
  readonly project: Project;
  readonly troopRecord: TroopRecord;
  // 이 전투를 기동한 맵 이벤트 id. selfSwitch 조건/setSelfSwitch 커맨드의 소유 이벤트.
  // 랜덤 인카운터/필드 스폰 등 소유 이벤트가 없는 전투는 undefined(조건 false + 추적 로그).
  readonly ownerEventId?: string;
  readonly actors: readonly MutableBattler[];
  readonly enemies: readonly MutableBattler[];
  readonly stateIds: readonly string[];
  readonly state: BattleEventRuntimeState;
  readonly revealEnemy?: (target: string) => void;
  readonly changeBattleback?: (resourceId: string) => void;
  // m2-103 Show Animation: 런타임 lastAnimation 세팅을 위한 콜백.
  readonly showBattleAnimation?: (target: string, animationId: string) => void;
  // m2-105 Abort Battle: 전투 즉시 중단(런타임이 result/phase 갱신).
  readonly abortBattle?: () => void;
  // playAudio/stopAudio 명령: 호스트가 실제 오디오 엔진으로 라우팅.
  readonly playAudio?: (resourceId: string, loop: boolean) => void;
  readonly stopAudio?: () => void;
  // wait 명령(ms): 런타임이 전투 흐름을 지정 ms 동안 일시정지.
  // 배틀 이벤트 루프는 동기식이라 wait 이후의 명령도 즉시 실행되지만,
  // 런타임 tick 이 pendingWaitMs 를 소진하기 전까지 게이지/턴 진행을 멈춘다.
  readonly wait?: (ms: number) => void;
  // SC4 (H3): strict 흐름에서는 extra actor action 을 부여할 수 없다(동기식 라운드).
  // 이 콜백이 false 를 반환하면 actionTimes 명령은 unsupported 로그를 남긴다.
  readonly canGrantExtraAction?: () => boolean;
};

export type BattleEventRuntimeResult = {
  readonly forceEscape: boolean;
};

export type BattleEventRuntime = {
  applyTroopEvents(context: BattleEventContext): BattleEventRuntimeResult;
  consumeExtraActorAction(actorId: ActorId): boolean;
  logExternal(message: string): void;
  snapshot(): BattleEventStateSnapshot;
  logs(): readonly BattleEventLogSnapshot[];
};

export function createBattleEventRuntime(options: BattleEventRuntimeOptions): BattleEventRuntime {
  const firedBattleEventPageIds = new Set<string>();
  const firedBattleEventPageRoundKeys = new Set<string>();
  const extraActorActions: Record<string, number> = {};
  const logs: BattleEventLogSnapshot[] = [];
  // 소유 이벤트 없는 전투에서 selfSwitch 조건이 평가되면 1회만 추적 로그를 남긴다
  // (조건 평가는 tick/라운드마다 반복되므로 매번 기록하면 eventLogs 가 범람한다).
  let loggedSelfSwitchWithoutOwner = false;

  function logSelfSwitchWithoutOwnerOnce(): void {
    if (loggedSelfSwitchWithoutOwner) return;
    loggedSelfSwitchWithoutOwner = true;
    logs.push({
      pageId: "external",
      round: 0,
      triggerId: "external",
      kind: "unsupported",
      detail: "selfSwitch condition without owner event (treated as OFF)",
    });
  }

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
      selfSwitches: Object.fromEntries(
        Object.entries(options.state.selfSwitches ?? {}).map(([eventId, keys]) => [eventId, { ...keys }])
      ),
      inventory: options.state.inventory,
      itemUseCharges: { ...(options.state.itemUseCharges ?? {}) },
      gold: options.state.gold ?? 0,
      partyActorIds: [...(options.state.partyActorIds ?? [])],
      actorSkillIds: { ...(options.state.actorSkillIds ?? {}) },
      actorExperience: { ...(options.state.actorExperience ?? {}) },
      actorLevels: { ...(options.state.actorLevels ?? {}) },
      actorBattleCommands: { ...(options.state.actorBattleCommands ?? {}) },
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
      default:
        // switch/variable/selfSwitch/actor/item/gold/timer/timePhase/season/npcActivity/friendshipAtLeast/
        // battleResult/all/any/not — 모두 Condition 유니온은 evaluateCondition 으로 위임.
        return evaluateCondition(condition);
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
      case "setSwitch": {
        const raw = command.value;
        const next = typeof raw === "boolean"
          ? raw
          : raw === "toggle"
            ? !(options.state.switches[command.switchId] ?? false)
            : (options.state.variables[raw.id] ?? 0) !== 0;
        options.state.switches[command.switchId] = next;
        return false;
      }
      case "setVariable":
        options.state.variables[command.variableId] = applyNumberOperation(
          options.state.variables[command.variableId] ?? 0,
          command.op,
          resolveOperand(command.value)
        );
        return false;
      case "changeItem": {
        const current = options.state.inventory[command.itemId] ?? 0;
        const amount = typeof command.amount === "number"
          ? command.amount
          : options.state.variables[command.amount.id] ?? 0;
        const next = Math.max(0, applyNumberOperation(current, command.op, amount));
        const action = command.op === "="
          ? { kind: "assign" as const, itemId: command.itemId, count: next }
          : next >= current
            ? { kind: "grant" as const, itemId: command.itemId, amount: next - current }
            : { kind: "remove" as const, itemId: command.itemId, amount: current - next };
        Object.assign(
          options.state,
          transitionItemState(options.state, options.project.database.items, action)
        );
        return false;
      }
      case "changeFriendship": {
        const npcKey = command.npcKey?.trim();
        if (!npcKey || !options.state.friendship) {
          logUnsupported(page, context, command.kind);
          return false;
        }
        options.state.friendship[npcKey] = clampFriendship((options.state.friendship[npcKey] ?? 0) + command.delta);
        return false;
      }
      case "getFriendship": {
        const npcKey = command.npcKey?.trim();
        options.state.variables[command.variableId] = npcKey ? clampFriendship(options.state.friendship?.[npcKey] ?? 0) : 0;
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
        changeActorVital(command.actorId, "hp", command.op, command.amount, command.amountMode);
        return false;
      case "changeActorMp":
        changeActorVital(command.actorId, "mp", command.op, command.amount, command.amountMode);
        return false;
      case "recoverAll":
        for (const actor of resolveActorTargets(command.actorId)) {
          actor.hp = actor.maxHp;
          actor.mp = actor.maxMp;
        }
        return false;
      case "changeGold": {
        const current = options.state.gold ?? 0;
        const amount = typeof command.amount === "number"
          ? command.amount
          : options.state.variables[command.amount.id] ?? 0;
        options.state.gold = Math.max(0, applyVitalOperation(current, command.op, amount));
        logs.push({ pageId: page.id, round: context.turn, triggerId: page.id, kind: "message", detail: `gold→${options.state.gold}` });
        return false;
      }
      case "changeExp": {
        options.state.actorExperience ??= {};
        const amount = typeof command.amount === "number"
          ? command.amount
          : options.state.variables[command.amount.id] ?? 0;
        for (const actor of resolveActorTargets(command.actorId)) {
          const id = actor.recordId;
          const current = options.state.actorExperience[id] ?? 0;
          options.state.actorExperience[id] = Math.max(0, applyVitalOperation(current, command.op, amount));
        }
        logs.push({ pageId: page.id, round: context.turn, triggerId: page.id, kind: "message", detail: `changeExp ${command.actorId || "party"}` });
        return false;
      }
      case "changeLevel": {
        options.state.actorLevels ??= {};
        for (const actor of resolveActorTargets(command.actorId)) {
          const id = actor.recordId;
          const current = options.state.actorLevels[id] ?? 1;
          options.state.actorLevels[id] = Math.max(1, Math.min(99, applyVitalOperation(current, command.op, command.amount)));
        }
        logs.push({ pageId: page.id, round: context.turn, triggerId: page.id, kind: "message", detail: `changeLevel ${command.actorId}` });
        return false;
      }
      case "learnSkill": {
        options.state.actorSkillIds ??= {};
        const action = command.action ?? "learn";
        const targets = resolveActorTargets(command.actorId);
        for (const actor of targets) {
          const id = actor.recordId;
          const known = new Set(options.state.actorSkillIds[id] ?? actor.skillIds);
          if (action === "forget") {
            known.delete(command.skillId);
            options.state.actorSkillIds[id] = [...known];
            actor.skillIds = actor.skillIds.filter((skillId) => skillId !== command.skillId);
            continue;
          }
          known.add(command.skillId);
          options.state.actorSkillIds[id] = [...known];
          if (!actor.skillIds.includes(command.skillId)) {
            actor.skillIds = [...actor.skillIds, command.skillId];
          }
        }
        logs.push({ pageId: page.id, round: context.turn, triggerId: page.id, kind: "message", detail: `learnSkill ${action} ${command.skillId}` });
        return false;
      }
      case "changeParty": {
        options.state.partyActorIds ??= [];
        const list = options.state.partyActorIds;
        if (command.action === "add") {
          if (!list.includes(command.actorId)) list.push(command.actorId);
        } else {
          options.state.partyActorIds = list.filter((id) => id !== command.actorId);
        }
        logs.push({ pageId: page.id, round: context.turn, triggerId: page.id, kind: "message", detail: `changeParty ${command.action} ${command.actorId}` });
        return false;
      }
      case "m2Command": {
        const result = executeM2Command(command, {
          actors: options.actors,
          enemies: options.enemies,
          context,
          revealEnemy: options.revealEnemy,
          changeBattleback: options.changeBattleback,
          addExtraActorAction,
          showBattleAnimation: options.showBattleAnimation,
          abortBattle: options.abortBattle,
          executeCommonEvent: (commonEventId) => executeCommonEventById(page, commonEventId, context, depth + 1),
          executeTroopPage: (pageId) => executeTroopPageById(page, pageId, context, depth + 1),
        });
        if (!result.handled) logUnsupported(page, context, command.commandId);
        return result.forceEscape;
      }
      case "setSelfSwitch": {
        // 소유 이벤트(ownerEventId)의 셀프 스위치를 스냅샷 사본에 기록.
        // 전투 종료 시 applyBattleRewardsToSession 이 세션에 되돌려 쓴다.
        const ownerEventId = options.ownerEventId;
        const selfSwitches = options.state.selfSwitches;
        if (!ownerEventId || !selfSwitches) {
          logUnsupported(page, context, `${command.kind} (no owner event)`);
          return false;
        }
        selfSwitches[ownerEventId] ??= {};
        selfSwitches[ownerEventId][command.key] = command.value;
        logs.push({ pageId: page.id, round: context.turn, triggerId: page.id, kind: "message", detail: `selfSwitch ${command.key}=${command.value}` });
        return false;
      }
      case "wait": {
        const ms = "ms" in command ? command.ms : 0;
        options.wait?.(ms);
        logs.push({ pageId: page.id, round: context.turn, triggerId: page.id, kind: "message", detail: `wait ${ms}ms` });
        return false;
      }
      case "inputWait":
        // 전투 중 입력 대기는 UI 연동이 필요. acknowledged 로그.
        logs.push({ pageId: page.id, round: context.turn, triggerId: page.id, kind: "message", detail: "inputWait" });
        return false;
      case "playAudio":
        options.playAudio?.(command.resourceId, command.loop);
        logs.push({ pageId: page.id, round: context.turn, triggerId: page.id, kind: "message", detail: `playAudio ${command.resourceId}` });
        return false;
      case "stopAudio":
        options.stopAudio?.();
        logs.push({ pageId: page.id, round: context.turn, triggerId: page.id, kind: "message", detail: "stopAudio" });
        return false;
      case "label":
      case "gotoLabel":
      case "transfer":
      case "moveEvent":
      case "setEventGraphicPattern":
      case "changeTile":
      case "battleProcessing":
      case "showPicture":
      case "erasePicture":
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
      case "changeEquipment":
      case "enterHeroName":
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
      // Step 0(2026-08-20): 스위치 fall-through 로 무음 스킵되던 16종을 명시적 unsupported 편입.
      // (openwiki/runtime-battle.md — 미지원 배틀 커맨드는 반드시 unsupported 로그를 남긴다.)
      case "promoteActor":
      case "giveMonster":
      case "evolveMonster":
      case "openChest":
      case "advanceTime":
      case "setTime":
      case "sleepUntilMorning":
      case "craftRecipe":
      case "applyItemUpgrade":
      case "equipTool":
      case "changeLifeSkillExp":
      case "moveMonster":
      case "openSaveMenu":
      case "spawnFieldEnemy":
      case "despawnFieldEnemy":
      case "advanceCropGrowth":
        logUnsupported(page, context, command.kind);
        return false;
      default:
        // 컴파일 타임 전수 분류: 새 Command kind 는 여기서 배틀 분류(실행/미지원)를 강제받는다.
        return assertNever(command);
    }
  }

  function addExtraActorAction(actorId: string, amount: number): void {
    if (options.canGrantExtraAction && !options.canGrantExtraAction()) {
      logExternal("m2-108 actionTimes unsupported in strict flow");
      return;
    }
    extraActorActions[actorId] = (extraActorActions[actorId] ?? 0) + amount;
  }

  function logExternal(message: string): void {
    logs.push({ pageId: "external", round: 0, triggerId: "external", kind: "unsupported", detail: message });
  }

  function evaluateCondition(condition: Condition): boolean {
    switch (condition.kind) {
      case "switch":
        return (options.state.switches[condition.switchId] ?? false) === condition.value;
      case "variable": {
        const current = options.state.variables[condition.variableId] ?? 0;
        return compareVariableValue(current, condition.op, condition.value);
      }
      case "selfSwitch": {
        // ownerEventId(전투를 기동한 맵 이벤트)가 있으면 그 이벤트의 셀프 스위치로 실제 평가.
        // 소유 이벤트가 없는 전투(랜덤 인카운터/필드 스폰)는 종전대로 OFF 취급하되 추적 로그를 남긴다.
        const ownerEventId = options.ownerEventId;
        if (!ownerEventId) {
          logSelfSwitchWithoutOwnerOnce();
          return condition.value === false;
        }
        const own = (options.state.selfSwitches ?? {})[ownerEventId];
        return (own?.[condition.key] ?? false) === condition.value;
      }
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
      case "npcActivity":
        return false;
      case "friendshipAtLeast": {
        const npcKey = condition.npcKey?.trim();
        if (!npcKey) return false;
        return clampFriendship(options.state.friendship?.[npcKey] ?? 0) >= clampFriendship(condition.value);
      }
      case "battleResult":
        // 직전 전투 처리 결과(전투 개시 시점 세션 battleResult 스냅샷)로 실제 평가.
        // 진행 중인 이 전투의 결과가 아니라 "직전" 전투의 결과다(RM2K3 정합).
        return options.state.battleResult === condition.result;
      case "all":
        return condition.conditions.every((child) => evaluateCondition(child));
      case "any":
        return condition.conditions.some((child) => evaluateCondition(child));
      case "not":
        return !evaluateCondition(condition.condition);
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

  function changeActorVital(
    actorId: string,
    kind: "hp" | "mp",
    op: "=" | "+=" | "-=",
    amount: number,
    amountMode?: "flat" | "percent"
  ): void {
    for (const actor of resolveActorTargets(actorId)) {
      const max = kind === "hp" ? actor.maxHp : actor.maxMp;
      const raw = Math.trunc(amount);
      const delta = amountMode === "percent" ? Math.trunc((Math.max(0, max) * raw) / 100) : raw;
      actor[kind] = clampVital(applyVitalOperation(actor[kind], op, delta), max);
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

  // m2-106 Call Common Event (M2 형식): 커먼 이벤트 commands 를 동일한 배틀 컨텍스트에서 재귀 실행.
  function executeCommonEventById(page: BattleEventPageRecord, commonEventId: string, context: BattleEventContext, depth: number): boolean {
    const commonEvent = options.project.commonEvents.find((entry) => entry.id === commonEventId);
    if (!commonEvent) {
      logUnsupported(page, context, `missing common event: ${commonEventId}`);
      return false;
    }
    logs.push({ pageId: page.id, round: context.turn, triggerId: page.id, kind: "fired", detail: `commonEvent ${commonEventId}` });
    return executeBattleEventCommands(page, commonEvent.commands, context, depth);
  }

  // m2-104 Battle Events: 같은 트룹의 지정한 배틀 이벤트 페이지를 즉시 실행(RM2K3 전투 이벤트 호출).
  function executeTroopPageById(page: BattleEventPageRecord, pageId: string, context: BattleEventContext, depth: number): boolean {
    const targetPage = options.troopRecord.battleEventPages.find((entry) => entry.id === pageId);
    if (!targetPage) {
      logUnsupported(page, context, `missing troop page: ${pageId}`);
      return false;
    }
    logs.push({ pageId: page.id, round: context.turn, triggerId: pageId, kind: "fired", detail: `troopPage ${pageId}` });
    return executeBattleEventCommands(page, targetPage.commands, context, depth);
  }

  return { applyTroopEvents, consumeExtraActorAction, logExternal, snapshot, logs: eventLogs };
}

// playSceneInterpreter 의 default: assertNever(step) 전례를 따르는 로컬 전수 검증 헬퍼.
// (src/battle 은 자립 모듈이므로 @/player/playSceneTypes 를 역참조하지 않는다.)
function assertNever(value: never): never {
  void value;
  throw new Error("Unhandled battle event command kind");
}
