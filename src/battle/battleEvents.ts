import { executeM2BattleCommand as executeM2Command } from "@/battle/battleM2CommandExecutor";
import type { MutableBattler } from "@/battle/battleBattlers";
import type { BattleEventLogSnapshot, BattleEventStateSnapshot } from "@/battle/types";
import { compareVariableValue } from "@/project/conditionEvaluation";
import { conditionMatchesSeason, conditionMatchesTimePhase, type GameTime } from "@/project/gameTime";
import { clampFriendship } from "@/project/session";
import { evalRelationshipCondition, setRelationshipState, type RelationshipState } from "@/project/relationshipState";
import { resolveSocialKey, type SocialHost } from "@/project/socialKey";
import { transitionItemState } from "@/project/itemTransitions";
import { transitionActorEquipment } from "@/project/equipmentRules";
import { evalRoguelikeRunCondition, type RoguelikeRunState } from "@/project/roguelikeRun";
import { effectiveActorClassId, promoteActor as promoteActorClass, type ClassOverrideSession } from "@/project/sessionClass";
import type { ActorId, ActorInitialEquipment, Command, Condition, Project, ShowAnimationTarget, VariableOperand } from "@/project/types";
import type { BattleEventCondition, BattleEventPageRecord, TroopRecord } from "@/project/types/database";

export type BattleEventRuntimeState = {
  readonly switches: Record<string, boolean>;
  readonly variables: Record<string, number>;
  // 세션 셀프 스위치 스냅샷 사본(eventId → key → on). setSelfSwitch 가 여기 기록하고
  // 전투 종료 시 applyBattleRewardsToSession 이 세션에 되돌려 쓴다.
  readonly selfSwitches?: Record<string, Partial<Record<string, boolean>>>;
  // 직전 전투 처리 결과(전투 개시 시점 세션 battleResult 스냅샷). battleResult 조건 평가 기준.
  readonly battleResult?: "victory" | "defeat" | "escape";
  readonly roguelikeRun?: RoguelikeRunState;
  inventory: Record<string, number>;
  itemUseCharges?: Record<string, number>;
  partyActorIds?: string[];
  gold?: number;
  actorSkillIds?: Record<string, string[]>;
  actorExperience?: Record<string, number>;
  actorLevels?: Record<string, number>;
  actorBattleCommands?: Record<string, string[]>;
  // 레거시 호환 플래그(setFlag) — 세션 flags 스냅샷 사본. 전투 종료 시 write-back.
  flags?: Record<string, boolean>;
  // 타이머 잔여 초(timer 커맨드가 쓰고 timer 조건이 읽음). 전투 종료 시 write-back.
  timers?: Record<string, number>;
  // 세션 장비 스냅샷 사본(actorId → 장비). changeEquipment 가 여기 기록하고
  // 전투 종료 시 applyBattleRewardsToSession 이 세션 actorEquipment 로 write-back.
  actorEquipment?: Record<string, ActorInitialEquipment>;
  // 런타임 직업 오버라이드 사본(actorId → classId). promoteActor 가 여기 기록하고
  // 전투 종료 시 세션 classOverrides 로 write-back(맵 changeActorClass 와 동일 의미).
  classOverrides?: Record<string, string>;
  readonly gameTime?: GameTime;
  readonly npcActivities?: Record<string, string>;
  readonly friendship?: Record<string, number>;
  readonly relationships?: Record<string, RelationshipState>;
  // 전투가 실제로 쓴 관계 키만 모은다. 스냅숏에 지도 전체를 실으면 전투 중 맵에서 지운
  // 관계를 write-back 이 되살린다(setRelationshipState 는 single 을 삭제로 처리한다).
  relationshipWrites?: Record<string, RelationshipState>;
};

// Condition evaluation must read session-derived state through this declared surface.
// The player bridge contract test consumes the same keys, so a newly stateful condition
// cannot be added without also requiring that field at the real play-to-battle boundary.
export const BATTLE_CONDITION_SESSION_STATE_FIELDS = [
  "switches",
  "variables",
  "selfSwitches",
  "battleResult",
  "roguelikeRun",
  "inventory",
  "partyActorIds",
  "gold",
  "timers",
  "gameTime",
  "npcActivities",
  "friendship",
  "relationships",
] as const satisfies readonly (keyof BattleEventRuntimeState)[];

type BattleConditionRuntimeState = Pick<
  BattleEventRuntimeState,
  (typeof BATTLE_CONDITION_SESSION_STATE_FIELDS)[number]
>;

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
  // friendshipAtLeast 의 빈 npcKey를 characterId로 해석할 소유 이벤트. 상위 배틀 런타임이
  // ownerEventId와 project에서 해석하며, 직접 호출자는 생략해도 같은 방식으로 해석된다.
  readonly ownerEvent?: SocialHost;
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
  // gameOver/killPlayer: 전투를 패배(defeat)로 즉시 종결(abortBattle 의 defeat 대칭).
  // defeat 이후 처리(게임오버 vs 패배 복귀)는 canLose 의미론에 따라 호스트 파이프라인
  // (applyBattleRewardsToSession/playSceneBattle)이 결정한다.
  readonly endBattleAsDefeat?: () => void;
  // playAudio/stopAudio 명령: 호스트가 실제 오디오 엔진으로 라우팅.
  readonly playAudio?: (resourceId: string, loop: boolean) => void;
  readonly stopAudio?: () => void;
  // wait 명령(ms): 런타임이 전투 흐름을 지정 ms 동안 일시정지.
  // 배틀 이벤트 루프는 동기식이라 wait 이후의 명령도 즉시 실행되지만,
  // 런타임이 그 일시정지를 소비한다 — gauge 는 tick(pendingWaitMs), strict 는 타임라인 wait 엔트리.
  readonly wait?: (ms: number) => void;
  // changeEquipment/promoteActor 가 오버레이(state.actorEquipment/classOverrides)를 갱신한 뒤
  // 해당 액터 배틀러의 파생 스탯을 재계산한다. 산식은 battleBattlers 생성 로직과 공유
  // (refreshActorBattlerDerivedStats) — 런타임이 세션 paramBonuses 를 닫아 주입한다.
  // refreshSkills 는 전직처럼 클래스 스킬 셋이 바뀔 때만 true(장비 변경은 스킬 불변).
  readonly refreshActorDerivedStats?: (battler: MutableBattler, options?: { readonly refreshSkills?: boolean }) => void;
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

// 제어 흐름 kind 는 프레임 머신(executeBattleEventCommands)이 직접 처리한다.
// promoteActor 는 잎이 아니라 여기 속한다 — success/failure 분기를 fork 와 같은 활성 프레임으로
// 쌓아야 분기 안 gotoLabel 이 상위 라벨로 점프할 수 있다(맵 인터프리터 pushFrame 과 동형).
// 나머지(잎) kind 만 executeBattleEventCommand 로 위임 — assertNever 전수 분류는 잎 유니온 기준.
type BattleControlFlowKind = "fork" | "choices" | "label" | "gotoLabel" | "loop" | "breakLoop" | "promoteActor";
type BattleLeafCommand = Exclude<Command, { kind: BattleControlFlowKind }>;

// pc 기반 실행 프레임: 트룹 페이지/커먼 이벤트 본문과 fork/choices 분기, 루프 본문이 쌓인다.
type BattleExecFrame = {
  readonly commands: readonly Command[];
  pc: number;
  readonly loopBody?: boolean;
};

// 배틀 이벤트는 한 액션 비트 안에서 동기 실행되므로 맵 인터프리터(maxLoopIterations=100000,
// 프레임 단위 yield)보다 엄격한 상한을 둔다. 도달 시 unsupported 로그 후 해당 흐름을 끝낸다.
const MAX_BATTLE_LOOP_ITERATIONS = 10_000;
const MAX_BATTLE_LABEL_JUMPS = 10_000;

export function createBattleEventRuntime(options: BattleEventRuntimeOptions): BattleEventRuntime {
  const firedBattleEventPageIds = new Set<string>();
  const firedBattleEventPageRoundKeys = new Set<string>();
  const extraActorActions: Record<string, number> = {};
  const logs: BattleEventLogSnapshot[] = [];
  const ownerEvent = options.ownerEvent ?? findProjectEvent(options.project, options.ownerEventId);
  const conditionState: BattleConditionRuntimeState = options.state;
  // 소유 이벤트 없는 전투에서 소유자 의존 조건이 평가되면 종류별로 1회만 추적 로그를 남긴다
  // (조건 평가는 tick/라운드마다 반복되므로 매번 기록하면 eventLogs 가 범람한다).
  const loggedOwnerlessConditions = new Set<"selfSwitch" | "npcActivity">();

  function logOwnerlessConditionOnce(kind: "selfSwitch" | "npcActivity"): void {
    if (loggedOwnerlessConditions.has(kind)) return;
    loggedOwnerlessConditions.add(kind);
    logs.push({
      pageId: "external",
      round: 0,
      triggerId: "external",
      kind: "unsupported",
      detail: kind === "selfSwitch"
        ? "selfSwitch condition without owner event (treated as OFF)"
        : "npcActivity condition without owner event (treated as false)",
    });
  }

  function applyTroopEvents(context: BattleEventContext): BattleEventRuntimeResult {
    let forceEscape = false;
    if (options.troopRecord.battleEventPages.length === 0) return { forceEscape };
    for (const page of options.troopRecord.battleEventPages) {
      if (!shouldRunBattleEventPage(page, context)) continue;
      logs.push({ pageId: page.id, round: context.turn, triggerId: page.id, kind: "fired" });
      // Empty authored pages have no effects; compatibility must never invent commands.
      forceEscape = executeBattleEventCommands(page, page.commands, context, 0) || forceEscape;
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
      relationships: { ...(options.state.relationshipWrites ?? {}) },
      flags: { ...(options.state.flags ?? {}) },
      timers: { ...(options.state.timers ?? {}) },
      actorEquipment: Object.fromEntries(
        Object.entries(options.state.actorEquipment ?? {}).map(([actorId, equipment]) => [actorId, { ...equipment }])
      ),
      classOverrides: { ...(options.state.classOverrides ?? {}) },
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
    return page.span === "turn" || page.conditions.some((condition) =>
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
    // pc(program counter) 기반 프레임 머신: label/gotoLabel/loop/breakLoop 를 이 호출 본문
    // (트룹 페이지 또는 커먼 이벤트 본문) 로컬로 실행한다. 라벨 탐색 범위는 맵 인터프리터
    // gotoLabel(src/player/interpreter/stack.ts)과 동형 — "현재 활성 프레임 스택"이다.
    const frames: BattleExecFrame[] = [{ commands, pc: 0 }];
    let loopIterations = 0;
    let labelJumps = 0;
    while (frames.length > 0) {
      const frame = frames[frames.length - 1];
      if (!frame) break;
      if (frame.pc >= frame.commands.length) {
        frames.pop();
        if (frame.loopBody) {
          // 루프 본문이 정상 완료(breakLoop/gotoLabel 이탈 없이)되면 재진입한다.
          loopIterations += 1;
          if (loopIterations >= MAX_BATTLE_LOOP_ITERATIONS) {
            logUnsupported(page, context, "loop iteration limit reached");
          } else {
            frames.push({ commands: frame.commands, pc: 0, loopBody: true });
          }
        }
        continue;
      }
      const command = frame.commands[frame.pc];
      if (!command) {
        frame.pc += 1;
        continue;
      }
      frame.pc += 1;
      switch (command.kind) {
        case "fork": {
          const branch = evaluateCondition(command.condition) ? command.then : command.else ?? [];
          if (branch.length > 0) frames.push({ commands: branch, pc: 0 });
          break;
        }
        case "choices": {
          logs.push({ pageId: page.id, round: context.turn, triggerId: page.id, kind: "choices", detail: [command.prompt, command.options.map((option) => option.text).join("/")].filter(Boolean).join(" ") });
          const firstOption = command.options[0];
          if (firstOption && firstOption.branch.length > 0) frames.push({ commands: firstOption.branch, pc: 0 });
          break;
        }
        case "label":
          // 라벨 자체는 no-op(맵 인터프리터와 동일). gotoLabel 의 착지점.
          break;
        case "gotoLabel": {
          labelJumps += 1;
          if (labelJumps >= MAX_BATTLE_LABEL_JUMPS) {
            // label↔gotoLabel 역방향 순환 가드: 페이지 실행을 여기서 종료한다.
            logUnsupported(page, context, "gotoLabel jump limit reached");
            return forceEscape;
          }
          if (!jumpToLabel(frames, command.name)) {
            logUnsupported(page, context, `missing label: ${command.name}`);
          }
          break;
        }
        case "loop":
          // 빈 본문 루프는 무의미하므로 건너뛴다(맵 commandCatalog 와 동일).
          if (command.body.length > 0) frames.push({ commands: command.body, pc: 0, loopBody: true });
          break;
        case "promoteActor": {
          // 전직 판정/전이 후 success/failure 분기를 fork 와 같은 프레임으로 쌓는다
          // (맵 commandCatalog 의 pushFrame(branch) 대응 — 분기 내 gotoLabel 스코프 유지).
          const promoted = executePromoteActor(page, command, context);
          const branch = (promoted ? command.successBranch : command.failureBranch) ?? [];
          if (branch.length > 0) frames.push({ commands: branch, pc: 0 });
          break;
        }
        case "breakLoop": {
          let loopIndex = -1;
          for (let i = frames.length - 1; i >= 0; i -= 1) {
            if (frames[i]?.loopBody) {
              loopIndex = i;
              break;
            }
          }
          if (loopIndex < 0) {
            logUnsupported(page, context, "breakLoop outside loop");
          } else {
            // 루프 본문 프레임과 그 자식 프레임을 제거하면 부모 프레임의 pc 는
            // 이미 loop 다음 명령을 가리킨다(프레임별 pc 보존).
            frames.length = loopIndex;
          }
          break;
        }
        default:
          forceEscape = executeBattleEventCommand(page, command, context, depth) || forceEscape;
      }
    }
    return forceEscape;
  }

  // 맵 인터프리터 gotoLabel(stack.ts)과 동형: 활성 프레임 스택을 위에서부터 훑어
  // 라벨을 가진 프레임까지 스택을 자르고 그 프레임의 pc 를 라벨 위치로 옮긴다.
  // (라벨은 no-op 이므로 다음 스텝에서 라벨 다음 명령부터 실행된다.)
  function jumpToLabel(frames: BattleExecFrame[], name: string): boolean {
    for (let i = frames.length - 1; i >= 0; i -= 1) {
      const frame = frames[i];
      if (!frame) continue;
      for (let j = 0; j < frame.commands.length; j += 1) {
        const candidate = frame.commands[j];
        if (candidate?.kind === "label" && candidate.name === name) {
          frames.length = i + 1;
          frame.pc = j;
          return true;
        }
      }
    }
    return false;
  }

  // RM2K3 배틀 허용 커맨드 Change Class(전직): 맵 promoteActor(sessionClass)와 같은
  // 검증/전이 권위자를 배틀 이벤트 state 뷰로 실행한다. 배틀러 HP/MP 는 전투 SSOT 라
  // 뷰의 actorVitals 는 버림 객체 — 배틀러 쪽은 refreshActorDerivedStats 가 새 최대치로 클램프.
  function executePromoteActor(
    page: BattleEventPageRecord,
    command: Extract<Command, { kind: "promoteActor" }>,
    context: BattleEventContext
  ): boolean {
    const state = options.state;
    state.classOverrides ??= {};
    state.actorLevels ??= {};
    state.actorSkillIds ??= {};
    const battler = options.actors.find((entry) => entry.recordId === command.actorId || entry.id === command.actorId);
    // 세션 레벨 스냅샷이 비어 있으면 전투 중 레벨(배틀러)이 판정 기준이다(맵 actorLevels 와 동일 SSOT).
    if (battler?.level !== undefined && state.actorLevels[command.actorId] === undefined) {
      state.actorLevels[command.actorId] = battler.level;
    }
    const view: ClassOverrideSession = {
      classOverrides: state.classOverrides,
      actorLevels: state.actorLevels,
      actorSkillIds: state.actorSkillIds,
      actorVitals: {},
      switches: state.switches,
      variables: state.variables,
      inventory: state.inventory,
      itemUseCharges: state.itemUseCharges,
    };
    const result = promoteActorClass(view, options.project, command.actorId, command.toClassId || undefined);
    // promoteActor 는 아이템 소모 시 inventory/itemUseCharges 참조를 교체한다 — state 로 되받는다.
    state.inventory = view.inventory;
    state.itemUseCharges = view.itemUseCharges;
    // 맵 인터프리터와 동일한 성공 플래그(session.flags.promoteActorSuccess 대응, write-back 포함).
    state.flags ??= {};
    state.flags.promoteActorSuccess = result.ok;
    if (result.ok && battler) {
      options.refreshActorDerivedStats?.(battler, { refreshSkills: true });
    }
    logs.push({
      pageId: page.id,
      round: context.turn,
      triggerId: page.id,
      kind: "message",
      detail: result.ok ? `promoteActor ${command.actorId}→${result.classId}` : `promoteActor failed: ${result.reason}`,
    });
    return result.ok;
  }

  function executeBattleEventCommand(page: BattleEventPageRecord, command: BattleLeafCommand, context: BattleEventContext, depth: number): boolean {
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
      case "setRelationship": {
        const npcKey = command.npcKey?.trim();
        if (!npcKey || !options.state.relationships) {
          logUnsupported(page, context, command.kind);
          return false;
        }
        setRelationshipState(options.state, npcKey, command.state);
        options.state.relationshipWrites ??= {};
        options.state.relationshipWrites[npcKey] = command.state;
        return false;
      }
      case "getFriendship": {
        const npcKey = command.npcKey?.trim();
        options.state.variables[command.variableId] = npcKey ? clampFriendship(options.state.friendship?.[npcKey] ?? 0) : 0;
        return false;
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
      case "setFlag":
        // 레거시 호환 플래그 — 맵 인터프리터(commandCatalog)의 session.flags 쓰기와 동일 의미.
        // 세션 스냅샷 사본에 기록하고 전투 종료 시 applyBattleRewardsToSession 이 되돌려 쓴다.
        options.state.flags ??= {};
        options.state.flags[command.flag] = command.value;
        logs.push({ pageId: page.id, round: context.turn, triggerId: page.id, kind: "message", detail: `flag ${command.flag}=${command.value}` });
        return false;
      case "timer": {
        // 맵 timer 커맨드 스키마와 동일: set → seconds 로 설정, start → seconds 지정 시 설정.
        // 배틀 이벤트 상태는 남은 초만 가진다 — 진행(tick)/정지는 맵 씬(playSceneTimers) 소관이라
        // stop 은 남은 초를 유지한 채 기록만 남기고, write-back 시 세션 timers 로 병합된다.
        const timerId = command.timerId ?? "timer1";
        options.state.timers ??= {};
        if (command.action === "set") options.state.timers[timerId] = command.seconds ?? 0;
        if (command.action === "start" && command.seconds !== undefined) options.state.timers[timerId] = command.seconds;
        logs.push({ pageId: page.id, round: context.turn, triggerId: page.id, kind: "message", detail: `timer ${command.action} ${timerId}${command.seconds !== undefined ? ` ${command.seconds}s` : ""}` });
        return false;
      }
      case "showAnimation": {
        // m2-103 과 동일한 showBattleAnimation 콜백 라우팅(런타임이 lastAnimation 세팅).
        options.showBattleAnimation?.(resolveShowAnimationTargetId(command.target, context), command.animationId);
        logs.push({ pageId: page.id, round: context.turn, triggerId: page.id, kind: "message", detail: `showAnimation ${command.animationId}` });
        return false;
      }
      case "gameOver":
        // RM2K3 Game Over: 전투를 패배로 즉시 종결. defeat 이후 처리(게임오버 vs 패배 복귀)는
        // canLose 의미론에 따라 호스트가 결정한다(battleRewardsToSession/playSceneBattle).
        options.endBattleAsDefeat?.();
        logs.push({ pageId: page.id, round: context.turn, triggerId: page.id, kind: "message", detail: "gameOver→defeat" });
        return false;
      case "killPlayer":
        // killPlayer: 파티 전멸과 동일 의미 — 액터 HP 0 + defeat 종결(자연 패배 경로와 정합).
        for (const actor of options.actors) actor.hp = 0;
        options.endBattleAsDefeat?.();
        logs.push({ pageId: page.id, round: context.turn, triggerId: page.id, kind: "message", detail: ["killPlayer→defeat", command.message].filter(Boolean).join(" ") });
        return false;
      case "changeEquipment": {
        // RM2K3 배틀 허용 커맨드 Change Equipment: 맵 changeActorEquipment 와 동일한
        // 원자적 전이 권위자(transitionActorEquipment)를 배틀 이벤트 state 오버레이로 실행.
        const state = options.state;
        state.actorEquipment ??= {};
        const transition = transitionActorEquipment({
          project: options.project,
          actorId: command.actorId,
          classId: effectiveActorClassId(options.project, { classOverrides: state.classOverrides }, command.actorId),
          equipment: state.actorEquipment[command.actorId],
          inventory: state.inventory,
          slot: command.slot,
          equipmentId: command.equipmentId || undefined,
        });
        if (transition.kind === "rejected") {
          // 맵 경로는 거부를 무시하지만, 배틀 이벤트는 관측 가능해야 한다(무음 스킵 금지 규율).
          logs.push({ pageId: page.id, round: context.turn, triggerId: page.id, kind: "message", detail: `changeEquipment rejected: ${transition.reason}` });
          return false;
        }
        state.actorEquipment[command.actorId] = transition.equipment;
        state.inventory = transition.inventory;
        const battler = options.actors.find((entry) => entry.recordId === command.actorId || entry.id === command.actorId);
        if (battler) options.refreshActorDerivedStats?.(battler);
        logs.push({ pageId: page.id, round: context.turn, triggerId: page.id, kind: "message", detail: `changeEquipment ${command.actorId} ${command.slot}=${command.equipmentId || "none"}` });
        return false;
      }
      case "changeFace":
        // 메시지 스트립 프레젠테이션 상태 — 이벤트 로그 detail 로 반영
        // (battleDirectorDom 의 message 소비 경로와 동일한 채널, DOM 수정 없음).
        logs.push({ pageId: page.id, round: context.turn, triggerId: page.id, kind: "message", detail: command.resourceId ? `changeFace ${command.resourceId}` : "changeFace clear" });
        return false;
      case "displayTextSettings":
        // 메시지 표시 설정 프레젠테이션 상태 — 이벤트 로그 detail 로 반영.
        logs.push({ pageId: page.id, round: context.turn, triggerId: page.id, kind: "message", detail: `displayTextSettings ${command.format}/${command.position}` });
        return false;
      case "transfer":
      case "moveEvent":
      case "setEventGraphicPattern":
      case "changeTile":
      case "changeFactionStance":
        logUnsupported(page, context, command.kind);
        return false;
      case "battleProcessing":
      case "showPicture":
      case "erasePicture":
      case "shop":
      case "inn":
      case "ending":
      case "returnToTitle":
      case "inputNumber":
      case "enterHeroName":
      case "callMapEvent":
      case "cutsceneControl":
      case "checkpointSave":
      case "triggerEnding":
      case "setLighting":
      case "addLight":
      case "removeLight":
      case "setWeather":
      case "addFollower":
      case "removeFollower":
      // Step 0(2026-08-20): 스위치 fall-through 로 무음 스킵되던 16종을 명시적 unsupported 편입.
      // (openwiki/runtime-battle.md — 미지원 배틀 커맨드는 반드시 unsupported 로그를 남긴다.)
      // Step 3d(2026-08-20): promoteActor/changeEquipment 는 실제 실행으로 승격되어 목록에서 빠짐.
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
      case "runControl":
      // playMovie: 맵/공통은 플레이어 비디오 오버레이로 실제 재생되지만 전투 실행기는 없다
      // (guarantee: troop=partial). 여기서 미지원으로 기록하는 것이 그 계약의 실행 쪽이다.
      case "playMovie":
        logUnsupported(page, context, command.kind);
        return false;
      default:
        // 컴파일 타임 전수 분류: 새 Command kind 는 여기서 배틀 분류(실행/미지원)를 강제받는다.
        return assertNever(command);
    }
  }

  function addExtraActorAction(actorId: string, amount: number): void {
    extraActorActions[actorId] = (extraActorActions[actorId] ?? 0) + amount;
    logExternalMessage(`m2-108 actionTimes +${amount} (${actorId})`);
  }

  function logExternal(message: string): void {
    logs.push({ pageId: "external", round: 0, triggerId: "external", kind: "unsupported", detail: message });
  }

  function logExternalMessage(message: string): void {
    logs.push({ pageId: "external", round: 0, triggerId: "external", kind: "message", detail: message });
  }

  function evaluateCondition(condition: Condition): boolean {
    switch (condition.kind) {
      case "switch":
        return (conditionState.switches[condition.switchId] ?? false) === condition.value;
      case "variable": {
        const current = conditionState.variables[condition.variableId] ?? 0;
        return compareVariableValue(current, condition.op, condition.value);
      }
      case "selfSwitch": {
        // ownerEventId(전투를 기동한 맵 이벤트)가 있으면 그 이벤트의 셀프 스위치로 실제 평가.
        // 소유 이벤트가 없는 전투(랜덤 인카운터/필드 스폰)는 종전대로 OFF 취급하되 추적 로그를 남긴다.
        const ownerEventId = options.ownerEventId;
        if (!ownerEventId) {
          logOwnerlessConditionOnce("selfSwitch");
          return condition.value === false;
        }
        const own = (conditionState.selfSwitches ?? {})[ownerEventId];
        return (own?.[condition.key] ?? false) === condition.value;
      }
      case "actor":
        return (conditionState.partyActorIds ?? []).includes(condition.actorId) === condition.present;
      case "item":
        return ((conditionState.inventory[condition.itemId] ?? 0) > 0) === condition.present;
      case "gold":
        return compareVariableValue(conditionState.gold ?? 0, condition.op, condition.amount);
      case "timer": {
        const remaining = (conditionState.timers ?? {})[condition.timerId] ?? 0;
        return remaining <= condition.seconds;
      }
      case "timePhase":
        return conditionMatchesTimePhase(conditionState.gameTime, condition.phase);
      case "season":
        return conditionMatchesSeason(conditionState.gameTime, condition.season);
      case "npcActivity": {
        const ownerEventId = options.ownerEventId;
        if (!ownerEventId) {
          logOwnerlessConditionOnce("npcActivity");
          return false;
        }
        return conditionState.npcActivities?.[ownerEventId] === condition.activity;
      }
      case "friendshipAtLeast": {
        const npcKey = ownerEvent
          ? resolveSocialKey(ownerEvent, condition.npcKey)
          : condition.npcKey?.trim() || null;
        if (!npcKey) return false;
        return clampFriendship(conditionState.friendship?.[npcKey] ?? 0) >= clampFriendship(condition.value);
      }
      case "relationshipAtLeast": {
        const npcKey = ownerEvent
          ? resolveSocialKey(ownerEvent, condition.npcKey)
          : condition.npcKey?.trim() || null;
        return evalRelationshipCondition(conditionState, condition, npcKey);
      }
      case "battleResult":
        // 직전 전투 처리 결과(전투 개시 시점 세션 battleResult 스냅샷)로 실제 평가.
        // 진행 중인 이 전투의 결과가 아니라 "직전" 전투의 결과다(RM2K3 정합).
        return conditionState.battleResult === condition.result;
      case "run":
        return evalRoguelikeRunCondition(conditionState, condition);
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

  // showAnimation 타깃을 배틀러 id 로 해석: "player" → 현재 행동 액터(없으면 선두),
  // eventId → 해당 id/recordId 의 배틀러(적 우선), 좌표 타깃 → 화면("screen").
  function resolveShowAnimationTargetId(target: ShowAnimationTarget, context: BattleEventContext): string {
    if (target === "player") {
      const active = options.actors.find((actor) => actor.recordId === context.activeActorId) ?? options.actors[0];
      return active?.id ?? "screen";
    }
    if ("eventId" in target) {
      const battler = resolveEnemy(target.eventId)
        ?? options.actors.find((entry) => entry.id === target.eventId || entry.recordId === target.eventId);
      return battler?.id ?? target.eventId;
    }
    return "screen";
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
function findProjectEvent(project: Project, eventId: string | undefined): SocialHost | undefined {
  if (!eventId) return undefined;
  for (const map of Object.values(project.maps)) {
    const event = map.events.find((entry) => entry.id === eventId);
    if (event) return event;
  }
  return undefined;
}

function assertNever(value: never): never {
  void value;
  throw new Error("Unhandled battle event command kind");
}
