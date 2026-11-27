import type { QuickJSContext, QuickJSHandle, QuickJSRuntime, QuickJSWASMModule } from "quickjs-emscripten-core";
import { calendarOptionsOf, evalActorQueryCondition, type ActorQuerySession } from "@/project/conditionActorQueries";
import { authoredChoiceIndex, choiceView, choicesHaveConditions, type ChoiceView } from "@/project/choiceView";
import { withJosa } from "@/util/josa";
import { ownsMonsterSpecies } from "@/project/monsterOwnership";
import { floorActorExperience } from "@/project/actorModel";
import { growthEffects, permanentActorSkillIds } from '@/project/growth/runtime';
import { executeM2BattleCommand as executeM2Command } from "@/battle/battleM2CommandExecutor";
import type { MutableBattler } from "@/battle/battleBattlers";
import type { BattleEventChoiceSnapshot, BattleEventPauseSnapshot, BattleEventPauseResponse, BattleEventLogSnapshot, BattleEventStateSnapshot, BattleRuntimeOptions } from "@/battle/types";
import { compareVariableValue } from "@/project/conditionEvaluation";
import { conditionMatchesSeason, conditionMatchesTimePhase, type GameTime } from "@/project/gameTime";
import { clampFriendship } from "@/project/session";
import { evalRelationshipCondition, setRelationshipState, type RelationshipState } from "@/project/relationshipState";
import { resolveSocialKey, type SocialHost } from "@/project/socialKey";
import { transitionItemState } from "@/project/itemTransitions";
import { transitionActorEquipment } from "@/project/equipmentRules";
import { evalRoguelikeRunCondition, type RoguelikeRunState } from "@/project/roguelikeRun";
import { effectiveActorClassId, promoteActor as promoteActorClass, type ClassOverrideSession } from "@/project/sessionClass";
import { badgeContext } from "@/project/badgeProgress";
import { requestScriptEngine, scriptEngineLoadFailure, scriptEngineModule } from "@/player/script/engine";
import { SCRIPT_API } from "@/project/script/apiSpec";
import { findScriptModule, libraryIdFromSpecifier } from "@/project/script/library";
import { scriptCompiledIsFresh } from "@/project/script/types";
import type { ActorId, ActorInitialEquipment, Command, Condition, FaceGraphic, MessageWindowSettings, Project, ShowAnimationTarget, VariableOperand } from "@/project/types";
import type { BattleEventCondition, BattleEventPageRecord, TroopBattleGuest, TroopRecord } from "@/project/types/database";
import { normalizeTroopBattleGuests } from "@/project/databaseEnemyTroopRecordModel";

export type BattleEventRuntimeState = {
  gameOverRequest?: { gameOverId: string; message?: string };
  // m2-046 Tint Screen 이 쓰는 전투 화면 상태(색조·색 필터). 전투 화면 전용이다.
  screen?: import("@/battle/types").BattleScreenState;
  messageWindowSettings?: MessageWindowSettings;
  readonly switches: Record<string, boolean>;
  readonly variables: Record<string, number>;
  // 세션 셀프 스위치 스냅샷 사본(eventId → key → on). setSelfSwitch 가 여기 기록하고
  // 전투 종료 시 applyBattleRewardsToSession 이 세션에 되돌려 쓴다.
  readonly selfSwitches?: Record<string, Partial<Record<string, boolean>>>;
  // 직전 전투 처리 결과(전투 개시 시점 세션 battleResult 스냅샷). battleResult 조건 평가 기준.
  readonly battleResult?: "victory" | "defeat" | "escape";
  readonly roguelikeRun?: RoguelikeRunState;
  /** 현재 난이도 id(전투 개시 시점 세션). difficulty 조건 평가 기준. */
  readonly difficultyId?: string;
  inventory: Record<string, number>;
  itemUseCharges?: Record<string, number>;
  partyActorIds?: string[];
  readonly monsterInstances?: import("@/project/monsterOwnership").MonsterOwnershipState["monsterInstances"];
  readonly monsterParty?: readonly string[];
  readonly monsterBox?: readonly string[];
  gold?: number;
  actorSkillIds?: Record<string, string[]>;
  actorExperience?: Record<string, number>;
  actorLevels?: Record<string, number>;
  actorBattleCommands?: Record<string, string[]>;
  // 레거시 호환 플래그(setFlag) — 세션 flags 스냅샷 사본. 전투 종료 시 write-back.
  flags?: Record<string, boolean>;
  // 타이머 잔여 초(timer 커맨드가 쓰고 timer 조건이 읽음). 전투 종료 시 write-back.
  timers?: Record<string, number>;
  // 전투가 실제로 쓴 타이머만 모은다. 진행(tick)은 맵 씬(playSceneTimers) 소관이라
  // 진입 시점 사본 전체를 되돌려 쓰면 전투 중 만료된 타이머가 진입 값으로 되살아난다.
  timerWrites?: Record<string, number>;
  timerActivityWrites?: Record<string, boolean>;
  // 세션 장비 스냅샷 사본(actorId → 장비). changeEquipment 가 여기 기록하고
  // 전투 종료 시 applyBattleRewardsToSession 이 세션 actorEquipment 로 write-back.
  actorEquipment?: Record<string, ActorInitialEquipment>;
  // 런타임 직업 오버라이드 사본(actorId → classId). promoteActor 가 여기 기록하고
  // 전투 종료 시 경로·영구 스킬과 함께 권위 상태로 write-back.
  classOverrides?: Record<string, string>;
  promotionLineage?: import('@/project/growth/types').PromotionLineage;
  growthProgress?: import('@/project/growth/types').GrowthProgress;
  readonly gameTime?: GameTime;
  // 명작 공백 G1 — 페이지 조건(배우 수치·방향·회차·문자열)을 전투 이벤트 페이지도 읽는다. 전부 읽기 전용 스냅샷.
  readonly actorVitals?: Record<string, { readonly hp: number; readonly mp: number; readonly maxHp: number; readonly maxMp: number }>;
  readonly actorStateIds?: Record<string, readonly string[]>;
  readonly playerFacing?: import("@/project/types").Dir;
  readonly eventLocations?: Record<string, { readonly mapId: string; readonly x: number; readonly y: number; readonly direction?: import("@/project/types").Dir }>;
  readonly horror?: import("@/project/horrorState").HorrorState;
  stringVariables?: Record<string, string>;
  readonly clearHistory?: { readonly count: number; readonly endingIds: readonly string[] };
  readonly npcActivities?: Record<string, string>;
  readonly friendship?: Record<string, number>;
  friendshipWrites?: Record<string, number>;
  readonly relationships?: Record<string, RelationshipState>;
  /**
   * 전투를 시작한 필드 위치. `insideLocation` 조건이 이것과 `project.maps[currentMapId].locations`
   * 로 판정한다 — 전투 중에는 주인공이 움직이지 않으므로 개시 시점 좌표가 곧 그 전투의 위치다.
   * 없으면(직접 호출·구 브리지) 해석 불가 = 거짓이고 추적 로그가 남는다.
   */
  readonly currentMapId?: string;
  readonly x?: number;
  readonly y?: number;
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
  "difficultyId",
  "inventory",
  "partyActorIds",
  "monsterInstances",
  "monsterParty",
  "monsterBox",
  "gold",
  "timers",
  "gameTime",
  "npcActivities",
  "friendship",
  "relationships",
  "currentMapId",
  "x",
  "y",
  "actorLevels",
  "actorVitals",
  "actorStateIds",
  "playerFacing",
  "eventLocations",
  "horror",
  "flags",
  "stringVariables",
  "clearHistory",
] as const satisfies readonly (keyof BattleEventRuntimeState)[];

type BattleConditionRuntimeState = Pick<
  BattleEventRuntimeState,
  (typeof BATTLE_CONDITION_SESSION_STATE_FIELDS)[number]
>;

export type BattleEventContext = {
  readonly turn: number;
  readonly activeActorId?: ActorId;
  readonly currentActorCommandKind?: string;
  /** 지금 행동이 기술이면 그 기술 id(actorCommand 조건의 skillId 비교용). */
  readonly currentActorSkillId?: string;
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
  // moveEnemy(m2-218): 적을 전투장 좌표로 옮긴다. 옮겨졌으면 true.
  readonly moveEnemy?: (target: string, x: number, y: number, durationMs: number) => boolean;
  // m2-103 Show Animation: 런타임 lastAnimation 세팅을 위한 콜백.
  readonly showBattleAnimation?: (target: string, animationId: string) => void;
  // m2-105 Abort Battle: 전투 즉시 중단(런타임이 result/phase 갱신).
  readonly abortBattle?: () => void;
  // gameOver/killPlayer: 전투를 패배(defeat)로 즉시 종결(abortBattle 의 defeat 대칭).
  // defeat 이후 처리(게임오버 vs 패배 복귀)는 canLose 의미론에 따라 호스트 파이프라인
  // (applyBattleRewardsToSession/playSceneBattle)이 결정한다.
  readonly endBattleAsDefeat?: () => void;
  // playAudio/stopAudio 명령: 호스트가 실제 오디오 엔진으로 라우팅.
  // Reuse the runtime option contract so authored channel/volume/fade reach the host engine.
  readonly playAudio?: BattleRuntimeOptions["playAudio"];
  readonly stopAudio?: BattleRuntimeOptions["stopAudio"];
  // wait 명령(ms): 런타임이 전투 흐름을 지정 ms 동안 일시정지.
  // 배틀 이벤트 루프는 동기식이라 wait 이후의 명령도 즉시 실행되지만,
  // 런타임이 그 일시정지를 소비한다 — gauge 는 tick(pendingWaitMs), strict 는 타임라인 wait 엔트리.
  readonly wait?: (ms: number) => void;
  // changeEquipment/promoteActor 가 오버레이(state.actorEquipment/classOverrides)를 갱신한 뒤
  // 해당 액터 배틀러의 파생 스탯을 재계산한다. 산식은 battleBattlers 생성 로직과 공유
  // (refreshActorBattlerDerivedStats) — 런타임이 세션 paramBonuses 를 닫아 주입한다.
  // refreshSkills 는 전직처럼 클래스 스킬 셋이 바뀔 때만 true(장비 변경은 스킬 불변).
  readonly refreshActorDerivedStats?: (battler: MutableBattler, options?: { readonly refreshSkills?: boolean }) => void;
  /**
   * 트룹 손님(TroopRecord.battleGuests) 합류: 런타임이 그 배우의 배틀러를 이 전투에만 세운다.
   * 세운 배틀러의 이름을 돌려준다. 세울 수 없으면(배우 없음·이미 있음·몬스터 파티 전투) undefined.
   */
  readonly joinBattleGuest?: (guest: TroopBattleGuest) => string | undefined;
  /** Optional preloaded QuickJS module override (defaults to `scriptEngineModule()`). */
  readonly scriptModule?: QuickJSWASMModule;
};

export type BattleEventRuntimeResult =
  | { readonly kind: "complete" }
  | { readonly kind: "choice"; readonly request: BattleEventChoiceSnapshot }
  | { readonly kind: "pause"; readonly request: BattleEventPauseSnapshot }
  | { readonly kind: "terminated"; readonly result: "defeat" | "escape" };

export type BattleEventRuntime = {
  applyTroopEvents(context: BattleEventContext): BattleEventRuntimeResult;
  /**
   * RM2003 「이벤트 연결」 전투 명령이 부른 공통 이벤트를 다음 applyTroopEvents 앞머리에 끼운다(2026-10-02).
   * 그 행동 뒤 트룹 이벤트보다 먼저 돌고, 문장·선택지·기다림은 트룹 이벤트와 같은 정지·재개 흐름을 탄다.
   * 없는 공통 이벤트면 false.
   */
  queueCommonEvent(commonEventId: string): boolean;
  resumeChoice(requestId: number, index: number): BattleEventRuntimeResult | undefined;
  resumePause(requestId: number, response: BattleEventPauseResponse): BattleEventRuntimeResult | undefined;
  cancel(): void;
  consumeExtraActorAction(actorId: ActorId): boolean;
  logExternal(message: string): void;
  snapshot(): BattleEventStateSnapshot;
  logs(): readonly BattleEventLogSnapshot[];
};

// 제어 흐름 kind 는 프레임 머신(executeBattleEventCommands)이 직접 처리한다.
// promoteActor 는 잎이 아니라 여기 속한다 — success/failure 분기를 fork 와 같은 활성 프레임으로
// 쌓아야 분기 안 gotoLabel 이 상위 라벨로 점프할 수 있다(맵 인터프리터 pushFrame 과 동형).
// 나머지(잎) kind 만 executeBattleEventCommand 로 위임 — assertNever 전수 분류는 잎 유니온 기준.
type BattleControlFlowKind = "wait" | "inputWait" | "text" | "fork" | "choices" | "label" | "gotoLabel" | "loop" | "breakLoop" | "promoteActor";
type BattleLeafCommand = Exclude<Command, { kind: BattleControlFlowKind }>;

// pc 기반 실행 프레임: 트룹 페이지/커먼 이벤트 본문과 fork/choices 분기, 루프 본문이 쌓인다.
type BattleExecFrame = {
  readonly commands: readonly Command[];
  pc: number;
  readonly loopBody?: boolean;
  /** 이 루프 본문이 정상 완료된 횟수. loopBody 프레임만 쓴다. */
  loopIterations?: number;
};

// 배틀 이벤트는 한 액션 비트 안에서 동기 실행되므로 맵 인터프리터(maxLoopIterations=100000,
// 프레임 단위 yield)보다 엄격한 상한을 둔다. 도달 시 unsupported 로그 후 그 루프만 끝낸다.
// 상한은 루프 본문마다 따로 센다. 호출 하나에 카운터를 두면 앞 루프가 상한을 쓴 뒤
// 다음 루프가 한 바퀴 만에 끊긴다(맵 인터프리터 stack.ts 와 같은 계약).
type BattleInvocation = {
  readonly page: BattleEventPageRecord;
  readonly context: BattleEventContext;
  readonly depth: number;
  readonly frames: BattleExecFrame[];
  labelJumps: number;
};

/**
 * 전투 런타임이 해석할 수 없는 조건. 전투에는 소유 이벤트도 필드 좌표도 없다.
 * 조용히 참으로 통과시키지 않고 종류별 1회 로그를 남긴다.
 */
type OwnerlessConditionKind = "selfSwitch" | "npcActivity" | "insideLocation";

const OWNERLESS_CONDITION_DETAIL: Record<OwnerlessConditionKind, string> = {
  selfSwitch: "selfSwitch condition without owner event (treated as OFF)",
  npcActivity: "npcActivity condition without owner event (treated as false)",
  insideLocation: "insideLocation condition has no map position in battle (treated as false)",
};

const MAX_BATTLE_LOOP_ITERATIONS = 10_000;
const MAX_BATTLE_LABEL_JUMPS = 10_000;

export function createBattleEventRuntime(options: BattleEventRuntimeOptions): BattleEventRuntime {
  const firedBattleEventPageIds = new Set<string>();
  const firedBattleEventPageRoundKeys = new Set<string>();
  const extraActorActions: Record<string, number> = {};
  const logs: BattleEventLogSnapshot[] = [];
  const queuedCommonEvents: string[] = [];
  const invocations: BattleInvocation[] = [];
  let batch: { readonly context: BattleEventContext; nextPage: number } | undefined;
  let pendingChoice: { readonly command: Extract<Command, { kind: "choices" }>; readonly request: BattleEventChoiceSnapshot; readonly view?: ChoiceView } | undefined;
  let nextChoiceId = 0;
  let pendingPause: BattleEventPauseSnapshot | undefined;
  let nextPauseId = 0;
  let face: FaceGraphic | undefined;
  let settingsChanged = false;
  let stopped = false;
  const ownerEvent = options.ownerEvent ?? findProjectEvent(options.project, options.ownerEventId);
  const conditionState: BattleConditionRuntimeState = options.state;
  // 소유 이벤트 없는 전투에서 소유자 의존 조건이 평가되면 종류별로 1회만 추적 로그를 남긴다
  // (조건 평가는 tick/라운드마다 반복되므로 매번 기록하면 eventLogs 가 범람한다).
  const loggedOwnerlessConditions = new Set<OwnerlessConditionKind>();
  // 트룹 손님은 페이지 목록 뒤에 붙는 한 번짜리 가상 페이지다 — 같은 조건 평가·같은 정지/재개 흐름을 탄다.
  const guestPages = normalizeTroopBattleGuests(options.troopRecord.battleGuests).map((guest) => ({
    guest,
    page: { id: `battle-guest:${guest.actorId}`, name: `guest ${guest.actorId}`, conditions: guest.conditions, span: "battle", runOnce: true, commands: [] } satisfies BattleEventPageRecord,
  }));

  function logOwnerlessConditionOnce(kind: OwnerlessConditionKind): void {
    if (loggedOwnerlessConditions.has(kind)) return;
    loggedOwnerlessConditions.add(kind);
    logs.push({
      pageId: "external",
      round: 0,
      triggerId: "external",
      kind: "unsupported",
      detail: OWNERLESS_CONDITION_DETAIL[kind],
    });
  }

  function applyTroopEvents(context: BattleEventContext): BattleEventRuntimeResult {
    if (stopped) return { kind: "complete" };
    if (pendingChoice) return { kind: "choice", request: pendingChoice.request };
    if (pendingPause) return { kind: "pause", request: pendingPause };
    batch ??= { context: { ...context }, nextPage: 0 };
    // 실행 스택이라 마지막에 쌓은 것이 먼저 돈다 — 고른 순서대로 돌게 거꾸로 쌓는다.
    const queued = queuedCommonEvents.splice(0);
    for (const commonEventId of queued.reverse()) {
      const commonEvent = options.project.commonEvents.find((entry) => entry.id === commonEventId);
      if (!commonEvent) continue;
      const page: BattleEventPageRecord = { id: `command-common-event:${commonEventId}`, name: commonEvent.name, conditions: [], span: "battle", commands: commonEvent.commands };
      logs.push({ pageId: page.id, round: batch.context.turn, triggerId: page.id, kind: "fired", detail: `commonEvent ${commonEventId}` });
      pushInvocation(page, commonEvent.commands, batch.context, 1);
    }
    return drainBatch();
  }

  function queueCommonEvent(commonEventId: string): boolean {
    if (stopped || !options.project.commonEvents.some((entry) => entry.id === commonEventId)) return false;
    queuedCommonEvents.push(commonEventId);
    return true;
  }

  function drainBatch(): BattleEventRuntimeResult {
    while (batch) {
      const invocation = invocations.at(-1);
      if (invocation) {
        const step = executeBattleEventCommands(invocation);
        if (step.kind === "terminated") { cancel(); return step; }
        if (step.kind === "choice" || step.kind === "pause") return step;
        if (invocations.at(-1) === invocation && invocation.frames.length === 0) invocations.pop();
        continue;
      }
      const pageIndex = batch.nextPage++;
      const authoredPages = options.troopRecord.battleEventPages;
      const guestEntry = pageIndex >= authoredPages.length ? guestPages[pageIndex - authoredPages.length] : undefined;
      const page = authoredPages[pageIndex] ?? guestEntry?.page;
      if (!page) { batch = undefined; break; }
      const context = batch.context;
      if (!shouldRunBattleEventPage(page, context)) continue;
      if (guestEntry) {
        firedBattleEventPageIds.add(page.id);
        const name = options.joinBattleGuest?.(guestEntry.guest);
        if (!name) { logUnsupported(page, context, `battle guest ${guestEntry.guest.actorId} could not join`); continue; }
        logs.push({ pageId: page.id, round: context.turn, triggerId: page.id, kind: "fired", detail: `guest join ${guestEntry.guest.actorId}` });
        const body = guestEntry.guest.message ?? `${withJosa(name, "이/가")} 합류했다!`;
        pushInvocation(page, [{ kind: "text", body }], context, 0);
        continue;
      }
      logs.push({ pageId: page.id, round: context.turn, triggerId: page.id, kind: "fired" });
      if (pageRunsOnce(page)) firedBattleEventPageIds.add(page.id);
      if (pageHasRoundCadenceCondition(page)) firedBattleEventPageRoundKeys.add(pageRoundKey(page, context));
      pushInvocation(page, page.commands, context, 0);
    }
    return { kind: "complete" };
  }

  function pushInvocation(page: BattleEventPageRecord, commands: readonly Command[], context: BattleEventContext, depth: number): void {
    if (depth > 8) { logUnsupported(page, context, "common event recursion limit"); return; }
    invocations.push({ page, context, depth, frames: [{ commands, pc: 0 }], labelJumps: 0 });
  }

  function resumeChoice(requestId: number, index: number): BattleEventRuntimeResult | undefined {
    if (stopped || !pendingChoice || pendingChoice.request.id !== requestId || !Number.isInteger(index)) return;
    const { command, view } = pendingChoice;
    const authored = authoredChoiceIndex(view, index);
    if (authored === undefined) return;
    const branch = authored === -1 && command.cancelBehavior === "branch"
      ? command.cancelBranch ?? [] : command.options[authored]?.branch;
    if (!branch) return;
    const invocation = invocations.at(-1);
    if (!invocation) return;
    pendingChoice = undefined;
    if (branch.length > 0) invocation.frames.push({ commands: branch, pc: 0 });
    return drainBatch();
  }

  function resumePause(requestId: number, response: BattleEventPauseResponse): BattleEventRuntimeResult | undefined {
    if (stopped || !pendingPause || pendingPause.id !== requestId || pendingPause.kind !== response.kind) return;
    if (response.kind === "inputWait") {
      if (!Number.isInteger(response.keyCode) || response.keyCode < 0 || response.keyCode > 19) return;
      if (pendingPause.kind === "inputWait" && pendingPause.variableId) {
        options.state.variables[pendingPause.variableId] = response.keyCode;
      }
    }
    pendingPause = undefined;
    return drainBatch();
  }

  function cancel(): void {
    stopped = true;
    batch = undefined;
    pendingChoice = undefined;
    pendingPause = undefined;
    invocations.length = 0;
  }

  function consumeExtraActorAction(actorId: ActorId): boolean {
    const remaining = extraActorActions[actorId] ?? 0;
    if (remaining <= 0) return false;
    extraActorActions[actorId] = remaining - 1;
    return true;
  }

  function snapshot(): BattleEventStateSnapshot {
    return {
      ...(options.state.gameOverRequest ? { gameOverRequest: { ...options.state.gameOverRequest } } : {}),
      ...(options.state.screen ? { screen: { ...options.state.screen, filter: { ...options.state.screen.filter } } } : {}),
      messageWindowSettings: settingsChanged && options.state.messageWindowSettings ? { ...options.state.messageWindowSettings } : undefined,
      // 호출 시점 사본(#2586) — 이벤트가 나중에 스위치·변수·소지품을 바꿔도 이 스냅샷은 그대로다.
      switches: { ...options.state.switches },
      variables: { ...options.state.variables },
      selfSwitches: Object.fromEntries(
        Object.entries(options.state.selfSwitches ?? {}).map(([eventId, keys]) => [eventId, { ...keys }])
      ),
      inventory: { ...options.state.inventory },
      itemUseCharges: { ...(options.state.itemUseCharges ?? {}) },
      gold: options.state.gold ?? 0,
      partyActorIds: [...(options.state.partyActorIds ?? [])],
      actorSkillIds: structuredClone(options.state.actorSkillIds ?? {}),
      actorExperience: { ...(options.state.actorExperience ?? {}) },
      actorLevels: { ...(options.state.actorLevels ?? {}) },
      actorBattleCommands: { ...(options.state.actorBattleCommands ?? {}) },
      friendship: { ...(options.state.friendshipWrites ?? {}) },
      relationships: { ...(options.state.relationshipWrites ?? {}) },
      flags: { ...(options.state.flags ?? {}) },
      timers: { ...(options.state.timers ?? {}) },
      timerWrites: { ...(options.state.timerWrites ?? {}) },
      timerActivityWrites: { ...(options.state.timerActivityWrites ?? {}) },
      actorEquipment: Object.fromEntries(
        Object.entries(options.state.actorEquipment ?? {}).map(([actorId, equipment]) => [actorId, { ...equipment }])
      ),
      classOverrides: { ...(options.state.classOverrides ?? {}) },
      promotionLineage: structuredClone(options.state.promotionLineage),
      growthProgress: structuredClone(options.state.growthProgress),
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
        return context.activeActorId === condition.actorId && (!condition.commandId || condition.commandId === context.currentActorCommandKind)
          && (!condition.skillId || condition.skillId === context.currentActorSkillId);
      case "enemyState": {
        const living = options.enemies.filter((enemy) => enemy.hp > 0 && (!condition.enemyId || enemy.recordId === condition.enemyId));
        const has = living.some((enemy) => enemy.stateIds.includes(condition.stateId));
        return (condition.present ?? true) ? has : living.length > 0 && !has;
      }
      case "enemiesAlive": {
        const alive = options.enemies.filter((enemy) => enemy.hp > 0 && !enemy.hidden && (!condition.enemyId || enemy.recordId === condition.enemyId)).length;
        return alive <= Math.max(0, Math.trunc(condition.atMost));
      }
      default:
        // switch/variable/selfSwitch/actor/item/gold/timer/timePhase/season/npcActivity/friendshipAtLeast/
        // battleResult/all/any/not — 모두 Condition 유니온은 evaluateCondition 으로 위임.
        return evaluateCondition(condition);
    }
  }

  function executeBattleEventCommands(invocation: BattleInvocation): BattleEventRuntimeResult {
    const { page, context, depth, frames } = invocation;
    // Each call owns its label/loop scope. A pushed child yields to drainBatch;
    // a choice retains the complete invocation stack until explicit input.
    while (frames.length > 0 && invocations.at(-1) === invocation) {
      const frame = frames[frames.length - 1];
      if (!frame) break;
      if (frame.pc >= frame.commands.length) {
        frames.pop();
        if (frame.loopBody) {
          // 루프 본문이 정상 완료(breakLoop/gotoLabel 이탈 없이)되면 재진입한다.
          // 완료 횟수는 이 프레임의 것 — 같은 페이지의 다른 루프와 더하지 않는다.
          const iterations = (frame.loopIterations ?? 0) + 1;
          if (iterations >= MAX_BATTLE_LOOP_ITERATIONS) {
            logUnsupported(page, context, "loop iteration limit reached");
          } else {
            frames.push({ commands: frame.commands, pc: 0, loopBody: true, loopIterations: iterations });
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
        case "wait": {
          const ms = Math.max(0, Math.trunc(command.ms));
          logs.push({ pageId: page.id, round: context.turn, triggerId: page.id, kind: "message", detail: `wait ${ms}ms` });
          if (!(ms > 0)) break;
          pendingPause = { id: ++nextPauseId, kind: "wait", ms };
          return { kind: "pause", request: pendingPause };
        }
        case "inputWait":
          pendingPause = { id: ++nextPauseId, kind: "inputWait", variableId: command.variableId };
          return { kind: "pause", request: pendingPause };
        case "text":
          logs.push({ pageId: page.id, round: context.turn, triggerId: page.id, kind: "message", detail: [command.speaker, command.body].filter(Boolean).join(": ") });
          pendingPause = {
            id: ++nextPauseId, kind: "text", body: command.body, speaker: command.speaker,
            face: face ? { ...face } : undefined,
            settings: options.state.messageWindowSettings ? { ...options.state.messageWindowSettings } : undefined,
            autoAdvance: command.autoAdvance, emotion: command.emotion,
            ...(command.voiceResourceId ? { voiceResourceId: command.voiceResourceId } : {}),
          };
          return { kind: "pause", request: pendingPause };
        case "fork": {
          const branch = evaluateCondition(command.condition) ? command.then : command.else ?? [];
          if (branch.length > 0) frames.push({ commands: branch, pc: 0 });
          break;
        }
        case "choices": {
          logs.push({ pageId: page.id, round: context.turn, triggerId: page.id, kind: "choices", detail: [command.prompt, command.options.map((option) => option.text).join("/")].filter(Boolean).join(" ") });
          if (command.options.length === 0) { logUnsupported(page, context, "choices has no options"); break; }
          // 조건 붙은 줄(showWhen·enableWhen)은 맵 선택지와 같은 규칙으로 거른다(project/choiceView.ts).
          const view = choicesHaveConditions(command) ? choiceView(command, evaluateCondition) : undefined;
          if (view && view.options.length === 0) break;
          const request: BattleEventChoiceSnapshot = {
            id: ++nextChoiceId, pageId: page.id, round: context.turn,
            prompt: command.prompt, options: view ? view.options.map(option => ({ ...option })) : command.options.map(option => ({ text: option.text })),
            cancelBehavior: view ? view.cancelBehavior : command.cancelBehavior,
            settings: options.state.messageWindowSettings ? { ...options.state.messageWindowSettings } : undefined,
          };
          pendingChoice = { command, request, view };
          return { kind: "choice", request };
        }
        case "label":
          // 라벨 자체는 no-op(맵 인터프리터와 동일). gotoLabel 의 착지점.
          break;
        case "gotoLabel": {
          invocation.labelJumps += 1;
          if (invocation.labelJumps >= MAX_BATTLE_LABEL_JUMPS) {
            // label↔gotoLabel 역방향 순환 가드: 페이지 실행을 여기서 종료한다.
            logUnsupported(page, context, "gotoLabel jump limit reached");
            frames.length = 0;
            return { kind: "complete" };
          }
          if (!jumpToLabel(frames, command.name)) {
            logUnsupported(page, context, `missing label: ${command.name}`);
          }
          break;
        }
        case "loop":
          // 빈 본문 루프는 무의미하므로 건너뛴다(맵 commandCatalog 와 동일).
          if (command.body.length > 0) frames.push({ commands: command.body, pc: 0, loopBody: true, loopIterations: 0 });
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
        default: {
          const terminal = executeBattleEventCommand(page, command, context, depth);
          if (terminal) return { kind: "terminated", result: terminal === "defeat" ? "defeat" : "escape" };
        }
      }
    }
    return { kind: "complete" };
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
      promotionLineage: state.promotionLineage,
      growthProgress: state.growthProgress,
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
    state.promotionLineage = view.promotionLineage;
    state.actorSkillIds = view.actorSkillIds;
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

  function executeBattleEventCommand(page: BattleEventPageRecord, command: BattleLeafCommand, context: BattleEventContext, depth: number): boolean | "defeat" {
    switch (command.kind) {
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
        options.state.friendshipWrites ??= {};
        options.state.friendshipWrites[npcKey] = options.state.friendship[npcKey];
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
        pushInvocation(page, commonEvent.commands, context, depth + 1);
        return false;
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
          const current = options.state.actorLevels[id] ?? actor.level ?? 1;
          const level = Math.max(1, Math.min(99, applyVitalOperation(current, command.op, command.amount)));
          options.state.actorLevels[id] = level;
          actor.level = level;
          // EXP 도 새 레벨 바닥 이상으로(필드 changeLevel 과 같은 규칙).
          floorActorExperience(options.project, options.state, id);
          options.refreshActorDerivedStats?.(actor, { refreshSkills: true });
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
          const known = new Set(permanentActorSkillIds(options.project, options.state, id));
          if (action === "forget") {
            known.delete(command.skillId);
            options.state.actorSkillIds[id] = [...known];
            actor.skillIds = [...new Set([...actor.skillIds.filter((skillId) => skillId !== command.skillId), ...growthEffects(options.project, options.state, id).skillIds])];
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
          // 빈 actorId 는 파티에 null 을 남겨 다음 전투를 멈춘다 — 건너뛴다(DB 에 없는 배우는 actorBattlers 가 뺀다).
          const valid = typeof command.actorId === "string" && command.actorId.trim() !== "";
          if (valid && !list.includes(command.actorId)) list.push(command.actorId);
        } else if (command.action === "remove") {
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
          moveEnemy: options.moveEnemy,
          addExtraActorAction,
          showBattleAnimation: options.showBattleAnimation,
          abortBattle: options.abortBattle,
          executeCommonEvent: (commonEventId) => executeCommonEventById(page, commonEventId, context, depth + 1),
          executeTroopPage: (pageId) => executeTroopPageById(page, pageId, context, depth + 1),
          setScreen: (screen) => {
            options.state.screen = screen;
            logs.push({ pageId: page.id, round: context.turn, triggerId: page.id, kind: "message", detail: `tintScreen ${screen.tint}` });
          },
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
      case "playAudio":
        options.playAudio?.(command.resourceId, command.loop, command);
        logs.push({ pageId: page.id, round: context.turn, triggerId: page.id, kind: "message", detail: `playAudio ${command.resourceId}` });
        return false;
      case "stopAudio":
        options.stopAudio?.(command.channel);
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
        // Tick ownership stays with the map scene. Record the final activity as
        // well as the seconds so start/stop survives the returning commit.
        const timerId = command.timerId ?? "timer1";
        options.state.timers ??= {};
        if (command.action === "set") options.state.timers[timerId] = command.seconds ?? 0;
        if (command.action === "start" && command.seconds !== undefined) options.state.timers[timerId] = command.seconds;
        options.state.timerWrites ??= {};
        options.state.timerWrites[timerId] = options.state.timers[timerId] ?? 0;
        options.state.timerActivityWrites ??= {};
        options.state.timerActivityWrites[timerId] = command.action === "start";
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
        // gameOver 에는 메시지 필드가 없다 — 문구는 선택한 게임 오버 정의가 정한다.
        if (command.gameOverId) options.state.gameOverRequest = { gameOverId: command.gameOverId };
        options.endBattleAsDefeat?.();
        logs.push({ pageId: page.id, round: context.turn, triggerId: page.id, kind: "message", detail: "gameOver→defeat" });
        return "defeat";
      case "killPlayer":
        // killPlayer: 파티 전멸과 동일 의미 — 액터 HP 0 + defeat 종결(자연 패배 경로와 정합).
        for (const actor of options.actors) actor.hp = 0;
        if (command.gameOverId) options.state.gameOverRequest = { gameOverId: command.gameOverId, ...(command.message ? { message: command.message } : {}) };
        options.endBattleAsDefeat?.();
        logs.push({ pageId: page.id, round: context.turn, triggerId: page.id, kind: "message", detail: ["killPlayer→defeat", command.message].filter(Boolean).join(" ") });
        return "defeat";
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
        face = command.resourceId ? {
          resourceId: command.resourceId, position: command.position,
          flipHorizontally: command.flipHorizontally,
        } : undefined;
        logs.push({ pageId: page.id, round: context.turn, triggerId: page.id, kind: "message", detail: command.resourceId ? `changeFace ${command.resourceId}` : "changeFace clear" });
        return false;
      case "displayTextSettings":
        options.state.messageWindowSettings = {
          format: command.format, position: command.position,
          preventObscuringPlayer: command.preventObscuringPlayer,
          allowEventMovementDuringWait: command.allowEventMovementDuringWait,
        };
        settingsChanged = true;
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
      case "presentItem":
      case "enterHeroName":
      case "callMapEvent":
      case "cutsceneControl":
      case "checkpointSave":
      case "triggerEnding":
      case "setLighting":
      case "addLight":
      case "removeLight":
      case "showEmote":
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
      case "openCraftShop":
      case "applyItemUpgrade":
      case "equipTool":
      case "changeLifeSkillExp":
      case "moveMonster":
      case "openSaveMenu":
      case "planSchedule":
      case "runSchedule":
      case "spawnFieldEnemy":
      case "despawnFieldEnemy":
      case "tacticsBattle":
      case "advanceCropGrowth":
      case "runControl":
      // playMovie: 맵/공통은 플레이어 비디오 오버레이로 실제 재생되지만 전투 실행기는 없다
      // (guarantee: troop=partial). 여기서 미지원으로 기록하는 것이 그 계약의 실행 쪽이다.
      case "playMovie":
      // 난이도·파티 묶음·몬스터 놓아주기/교환/합성은 필드 명령이다(전투 중 파티·몬스터 저장소를 바꾸지 않는다).
      case "setDifficulty":
      case "storeParty":
      case "recallParty":
      case "removeMonster":
      case "tradeMonster":
      case "fuseMonsters":
        logUnsupported(page, context, command.kind);
        return false;
      case "script":
        executeBattleScript(page, command, context);
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
      case "monsterSpecies":
        return ownsMonsterSpecies(conditionState, condition.speciesId) === condition.present;
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
      case "insideLocation": {
        // 전투 중에는 주인공이 움직이지 않는다 — 전투 개시 시점 좌표가 이 전투의 위치다.
        // 좌표나 맵을 못 받은 호출(구 브리지·직접 호출)은 조용한 참 대신 거짓 + 추적 로그다.
        const map = conditionState.currentMapId ? options.project.maps[conditionState.currentMapId] : undefined;
        const location = map?.locations?.find((entry) => entry.id === condition.locationId);
        if (!location || conditionState.x === undefined || conditionState.y === undefined) {
          logOwnerlessConditionOnce("insideLocation");
          return false;
        }
        const inside =
          conditionState.x >= location.x &&
          conditionState.y >= location.y &&
          conditionState.x < location.x + Math.max(0, location.w) &&
          conditionState.y < location.y + Math.max(0, location.h);
        return inside === condition.inside;
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
      case "actorStat":
      case "actorState":
      case "partyLeader":
      case "partyKnowsSkill":
      case "badgeCount":
      case "partySize":
      case "facing":
      case "relativeFacing":
      case "hiding":
      case "pursuitActive":
      case "eventSeesPlayer":
      case "clearCount":
      case "endingSeen":
      case "newGamePlus":
      case "weekday":
      case "stringVariable":
        // 전투 개시 시점 세션 스냅샷으로 판정한다(전투 중 HP 는 트룹 조건 actorHp 가 본다).
        return evalActorQueryCondition(
          {
            ...conditionState,
            partyActorIds: conditionState.partyActorIds ?? [],
            actorVitals: conditionState.actorVitals ?? {},
            x: conditionState.x ?? 0,
            y: conditionState.y ?? 0,
            flags: conditionState.flags ?? {},
            currentMapId: conditionState.currentMapId ?? "",
          } satisfies ActorQuerySession,
          condition,
          { eventId: options.ownerEventId },
          { ...calendarOptionsOf(options.project), ...badgeContext(options.project), partySkillIds: () => new Set(options.actors.flatMap((battler) => battler.skillIds)) },
        );
      case "difficulty":
        return conditionState.difficultyId !== undefined && conditionState.difficultyId === condition.difficultyId;
      case "itemUsed":
        // 아이템을 «바라보는 대상에 사용»하는 것은 필드 메뉴 경로뿐이다 — 전투 이벤트에서는 항상 거짓.
        return false;
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

  function executeBattleScript(
    page: BattleEventPageRecord,
    command: Extract<Command, { kind: "script" }>,
    context: BattleEventContext,
  ): void {
    const label = command.name?.trim();
    const prefix = label ? `script (${label})` : "script";
    if (!command.compiled.trim()) {
      if (command.source.trim()) {
        logUnsupported(page, context, `${prefix} error: script is not compiled`);
      } else {
        logs.push({ pageId: page.id, round: context.turn, triggerId: page.id, kind: "message", detail: `${prefix} (empty)` });
      }
      return;
    }

    const module = options.scriptModule ?? scriptEngineModule();
    if (!module) {
      const loadError = scriptEngineLoadFailure();
      if (!loadError) requestScriptEngine();
      logUnsupported(
        page,
        context,
        loadError
          ? `${prefix} error: script engine failed to load (${loadError})`
          : `${prefix} error: script engine is not loaded (preloadScriptEngine required)`,
      );
      return;
    }

    const runResult = runBattleQuickJsScript(module, command.compiled, {
      project: options.project,
      troopRecord: options.troopRecord,
      ownerEventId: options.ownerEventId,
      actors: options.actors,
      enemies: options.enemies,
      state: options.state,
      context,
      changeActorVital,
      resolveActorTargets,
      resolveEnemy,
      clampVital,
      applyVitalOperation,
      refreshActorDerivedStats: options.refreshActorDerivedStats,
      onLog: (text) => {
        logs.push({ pageId: page.id, round: context.turn, triggerId: page.id, kind: "message", detail: `${prefix}: ${text}` });
      },
    });

    if (runResult.ok) {
      logs.push({ pageId: page.id, round: context.turn, triggerId: page.id, kind: "message", detail: `${prefix} ok` });
    } else {
      logUnsupported(page, context, `${prefix} error: ${runResult.message}`);
    }
  }

  function logUnsupported(page: BattleEventPageRecord, context: BattleEventContext, detail: string): void {
    logs.push({ pageId: page.id, round: context.turn, triggerId: page.id, kind: "unsupported", detail });
  }

  // M2 calls enqueue their own invocation, preserving the caller across input.
  function executeCommonEventById(page: BattleEventPageRecord, commonEventId: string, context: BattleEventContext, depth: number): void {
    const commonEvent = options.project.commonEvents.find((entry) => entry.id === commonEventId);
    if (!commonEvent) {
      logUnsupported(page, context, `missing common event: ${commonEventId}`);
      return;
    }
    logs.push({ pageId: page.id, round: context.turn, triggerId: page.id, kind: "fired", detail: `commonEvent ${commonEventId}` });
    pushInvocation(page, commonEvent.commands, context, depth);
  }

  // m2-104 Battle Events: 같은 트룹의 지정한 배틀 이벤트 페이지를 즉시 실행(RM2K3 전투 이벤트 호출).
  function executeTroopPageById(page: BattleEventPageRecord, pageId: string, context: BattleEventContext, depth: number): void {
    const targetPage = options.troopRecord.battleEventPages.find((entry) => entry.id === pageId);
    if (!targetPage) {
      logUnsupported(page, context, `missing troop page: ${pageId}`);
      return;
    }
    logs.push({ pageId: page.id, round: context.turn, triggerId: pageId, kind: "fired", detail: `troopPage ${pageId}` });
    pushInvocation(page, targetPage.commands, context, depth);
  }

  return { applyTroopEvents, queueCommonEvent, resumeChoice, resumePause, cancel, consumeExtraActorAction, logExternal, snapshot, logs: eventLogs };
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

// ── Battle QuickJS script sandbox ────────────────────────────────────────────────────────────────

const BATTLE_SCRIPT_MEMORY_LIMIT_BYTES = 16 * 1024 * 1024;
const BATTLE_SCRIPT_STACK_LIMIT_BYTES = 512 * 1024;
const BATTLE_SCRIPT_CPU_LIMIT_MS = 500;
const BATTLE_SCRIPT_WRAPPER_LINES = 1;
const BATTLE_SELF_SWITCH_KEYS = new Set(["A", "B", "C", "D"]);

const BATTLE_SCRIPT_AWAIT_NAMES: readonly string[] = SCRIPT_API.filter((entry) => entry.awaits).map((entry) => entry.name);
const BATTLE_SCRIPT_EXTRA_SYNC_NAMES = [
  "turn",
  "actors",
  "enemies",
  "getEnemy",
  "setEnemyHp",
  "setEnemyMp",
  "battleContext",
] as const;
const BATTLE_SCRIPT_SYNC_NAMES: readonly string[] = [
  ...SCRIPT_API.filter((entry) => !entry.awaits).map((entry) => entry.name),
  ...BATTLE_SCRIPT_EXTRA_SYNC_NAMES,
];

const BATTLE_SCRIPT_PRELUDE = `(() => {
  "use strict";
  const host = globalThis.__battleHost;
  delete globalThis.__battleHost;
  const call = host.call;
  const parse = JSON.parse, stringify = JSON.stringify;
  const unwrap = (text) => parse(text).v;
  const encode = (args) => stringify(args, (_key, value) => value === undefined ? null : value);
  const game = {};
  for (const name of ${JSON.stringify(BATTLE_SCRIPT_SYNC_NAMES)}) {
    game[name] = (...args) => unwrap(call(name, encode(args)));
  }
  for (const name of ${JSON.stringify(BATTLE_SCRIPT_AWAIT_NAMES)}) {
    game[name] = () => {
      throw new Error("game." + name + "() is an async/awaitable command and is not supported inside battle event scripts");
    };
  }
  Object.freeze(game);
  Object.defineProperty(globalThis, "game", { value: game, writable: false, configurable: false, enumerable: true });
  Math.random = () => unwrap(call("__random", "[]"));
  const show = (value) => { if (typeof value === "string") return value; try { return stringify(value) ?? String(value); } catch { return String(value); } };
  const log = (...values) => { call("log", stringify([values.map(show).join(" ")])); };
  globalThis.console = Object.freeze({ log, info: log, warn: log, error: log, debug: log });
  const modules = new Map();
  const require = (specifier) => {
    if (typeof specifier !== "string" || !specifier.startsWith("@lib/")) {
      throw new Error("Only project library modules can be imported: import { … } from \\"@lib/<id>\\" (got " + String(specifier) + ")");
    }
    const cached = modules.get(specifier);
    if (cached) return cached.exports;
    const source = unwrap(call("__lib", stringify([specifier])));
    const mod = { exports: {} };
    modules.set(specifier, mod);
    const factory = new Function("require", "exports", "module", source);
    factory(require, mod.exports, mod);
    return mod.exports;
  };
  return (fn) => { const mod = { exports: {} }; return fn(require, mod.exports, mod); };
})()`;

interface BattleScriptHostDeps {
  readonly project: Project;
  readonly troopRecord: TroopRecord;
  readonly ownerEventId?: string;
  readonly actors: readonly MutableBattler[];
  readonly enemies: readonly MutableBattler[];
  readonly state: BattleEventRuntimeState;
  readonly context: BattleEventContext;
  readonly changeActorVital: (actorId: string, kind: "hp" | "mp", op: "=" | "+=" | "-=", amount: number, amountMode?: "flat" | "percent") => void;
  readonly resolveActorTargets: (actorId: string | undefined) => readonly MutableBattler[];
  readonly resolveEnemy: (enemyId: string) => MutableBattler | undefined;
  readonly clampVital: (value: number, max: number) => number;
  readonly applyVitalOperation: (current: number, op: "=" | "+=" | "-=", amount: number) => number;
  readonly refreshActorDerivedStats?: (battler: MutableBattler, options?: { readonly refreshSkills?: boolean }) => void;
  readonly onLog: (message: string) => void;
}

function resolveScriptDefId(list: readonly { id: string; name: string }[] | undefined, value: string): string {
  if (!list || list.some((entry) => entry.id === value)) return value;
  return list.find((entry) => entry.name === value)?.id ?? value;
}

function requireScriptStr(api: string, args: readonly unknown[], index: number, name: string): string {
  const value = args[index];
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`game.${api}: ${name} must be a non-empty string`);
  }
  return value;
}

function optScriptStr(api: string, args: readonly unknown[], index: number, name: string): string | undefined {
  const value = args[index];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    throw new TypeError(`game.${api}: ${name} must be a string`);
  }
  return value;
}

function requireScriptInt(api: string, args: readonly unknown[], index: number, name: string): number {
  const value = args[index];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`game.${api}: ${name} must be a finite number`);
  }
  return Math.trunc(value);
}

function optScriptInt(api: string, args: readonly unknown[], index: number, name: string, fallback: number): number {
  const value = args[index];
  if (value === undefined || value === null) return fallback;
  return requireScriptInt(api, args, index, name);
}

function requireScriptBool(api: string, args: readonly unknown[], index: number, name: string): boolean {
  const value = args[index];
  if (typeof value !== "boolean") {
    throw new TypeError(`game.${api}: ${name} must be true or false`);
  }
  return value;
}

function formatBattleVmError(vm: QuickJSContext, handle: QuickJSHandle, timedOut: boolean): string {
  if (timedOut) {
    return `Battle script exceeded CPU budget (${BATTLE_SCRIPT_CPU_LIMIT_MS} ms). It was stopped.`;
  }
  let dumped: unknown;
  try {
    dumped = vm.dump(handle);
  } catch {
    dumped = "unknown error";
  }
  if (dumped && typeof dumped === "object") {
    const error = dumped as { name?: unknown; message?: unknown; stack?: unknown };
    const head = `${typeof error.name === "string" ? error.name : "Error"}: ${typeof error.message === "string" ? error.message : String(dumped)}`;
    const line = typeof error.stack === "string" ? /battle-script\.js:(\d+)/u.exec(error.stack)?.[1] : undefined;
    const text = line ? `${head} (compiled line ${Math.max(1, Number(line) - BATTLE_SCRIPT_WRAPPER_LINES)})` : head;
    return /out of memory/iu.test(text) ? `${text} — battle scripts may use at most 16 MB.` : text;
  }
  return String(dumped);
}

function battleActorSnapshot(deps: BattleScriptHostDeps, battler: MutableBattler) {
  return {
    id: battler.recordId,
    battlerId: battler.id,
    name: battler.name,
    level: battler.level ?? deps.state.actorLevels?.[battler.recordId] ?? 1,
    exp: deps.state.actorExperience?.[battler.recordId] ?? 0,
    hp: battler.hp,
    mp: battler.mp,
    maxHp: battler.maxHp,
    maxMp: battler.maxMp,
    defeated: battler.hp <= 0,
    stateIds: [...battler.stateIds],
    inParty: (deps.state.partyActorIds ?? deps.actors.map((entry) => entry.recordId)).includes(battler.recordId),
  };
}

function battleEnemySnapshot(battler: MutableBattler) {
  return {
    id: battler.id,
    recordId: battler.recordId,
    name: battler.name,
    hp: battler.hp,
    mp: battler.mp,
    maxHp: battler.maxHp,
    maxMp: battler.maxMp,
    defeated: battler.hp <= 0,
    hidden: Boolean(battler.hidden),
    stateIds: [...battler.stateIds],
  };
}

function runBattleQuickJsScript(
  module: QuickJSWASMModule,
  compiled: string,
  deps: BattleScriptHostDeps,
): { readonly ok: true } | { readonly ok: false; readonly message: string } {
  let rt: QuickJSRuntime | undefined;
  let vm: QuickJSContext | undefined;
  let promiseHandle: QuickJSHandle | undefined;
  let timedOut = false;

  // Local deterministic PRNG seeded from turn and troop id
  let rngSeed = (deps.context.turn + 1) * 2654435761;
  for (let i = 0; i < deps.troopRecord.id.length; i += 1) {
    rngSeed = Math.imul(rngSeed ^ deps.troopRecord.id.charCodeAt(i), 0x01000193);
  }
  const nextRand = (): number => {
    rngSeed ^= rngSeed << 13;
    rngSeed ^= rngSeed >>> 17;
    rngSeed ^= rngSeed << 5;
    return (rngSeed >>> 0) / 0x100000000;
  };

  const dispatchBattleHostCall = (name: string, args: readonly unknown[]): unknown => {
    switch (name) {
      case "__random":
        return nextRand();
      case "__lib": {
        const specifier = args[0];
        const id = typeof specifier === "string" ? libraryIdFromSpecifier(specifier) : undefined;
        if (!id) throw new Error(`Bad library import ${JSON.stringify(specifier)}; use "@lib/<id>"`);
        const libMod = findScriptModule(deps.project.scriptLibrary, id);
        if (!libMod) throw new Error(`Library module @lib/${id} does not exist in this project`);
        if (!libMod.compiled.trim() && libMod.source.trim()) {
          throw new Error(`Library module @lib/${id} is not compiled; open and save it in the editor`);
        }
        if (!scriptCompiledIsFresh(libMod)) {
          console.warn(`[battle-script] @lib/${id} was edited after its last compile; running the last compiled version`);
        }
        return libMod.compiled;
      }
      // Switches & variables
      case "getSwitch": {
        const id = resolveScriptDefId(deps.project.switches, requireScriptStr("getSwitch", args, 0, "id"));
        return deps.state.switches[id] ?? false;
      }
      case "setSwitch": {
        const id = resolveScriptDefId(deps.project.switches, requireScriptStr("setSwitch", args, 0, "id"));
        deps.state.switches[id] = requireScriptBool("setSwitch", args, 1, "value");
        return undefined;
      }
      case "getVar": {
        const id = resolveScriptDefId(deps.project.variables, requireScriptStr("getVar", args, 0, "id"));
        return deps.state.variables[id] ?? 0;
      }
      case "setVar": {
        const id = resolveScriptDefId(deps.project.variables, requireScriptStr("setVar", args, 0, "id"));
        deps.state.variables[id] = requireScriptInt("setVar", args, 1, "value");
        return undefined;
      }
      case "addVar": {
        const id = resolveScriptDefId(deps.project.variables, requireScriptStr("addVar", args, 0, "id"));
        const next = (deps.state.variables[id] ?? 0) + requireScriptInt("addVar", args, 1, "delta");
        deps.state.variables[id] = next;
        return next;
      }
      // String variables (글변수)
      case "getText": {
        const id = requireScriptStr("getText", args, 0, "id");
        return deps.state.stringVariables?.[id] ?? "";
      }
      case "setText": {
        const id = requireScriptStr("setText", args, 0, "id");
        const value = args[1];
        if (typeof value !== "string") throw new TypeError("game.setText: value must be a string");
        if (value.length > 10_000) throw new RangeError("game.setText: value is longer than 10,000 characters");
        deps.state.stringVariables ??= {};
        deps.state.stringVariables[id] = value;
        return undefined;
      }
      // Self switches
      case "getSelfSwitch": {
        const key = requireScriptStr("getSelfSwitch", args, 0, "key");
        if (!BATTLE_SELF_SWITCH_KEYS.has(key)) throw new TypeError('game.getSelfSwitch: key must be "A", "B", "C" or "D"');
        const eventId = optScriptStr("getSelfSwitch", args, 1, "eventId") ?? deps.ownerEventId;
        return eventId ? deps.state.selfSwitches?.[eventId]?.[key] ?? false : false;
      }
      case "setSelfSwitch": {
        const key = requireScriptStr("setSelfSwitch", args, 0, "key");
        if (!BATTLE_SELF_SWITCH_KEYS.has(key)) throw new TypeError('game.setSelfSwitch: key must be "A", "B", "C" or "D"');
        const value = requireScriptBool("setSelfSwitch", args, 1, "value");
        const eventId = optScriptStr("setSelfSwitch", args, 2, "eventId") ?? deps.ownerEventId;
        if (!eventId || !deps.state.selfSwitches) {
          throw new Error("game.setSelfSwitch: no owner event or selfSwitches state in this battle");
        }
        deps.state.selfSwitches[eventId] ??= {};
        deps.state.selfSwitches[eventId][key] = value;
        return undefined;
      }
      // Gold & items
      case "gold":
        return deps.state.gold ?? 0;
      case "addGold": {
        const delta = requireScriptInt("addGold", args, 0, "amount");
        deps.state.gold = Math.max(0, (deps.state.gold ?? 0) + delta);
        return deps.state.gold;
      }
      case "itemCount":
        return deps.state.inventory[requireScriptStr("itemCount", args, 0, "id")] ?? 0;
      case "hasItem": {
        const id = requireScriptStr("hasItem", args, 0, "id");
        const count = Math.max(1, optScriptInt("hasItem", args, 1, "count", 1));
        return (deps.state.inventory[id] ?? 0) >= count;
      }
      case "addItem": {
        const id = requireScriptStr("addItem", args, 0, "id");
        const count = optScriptInt("addItem", args, 1, "count", 1);
        if (count < 0) throw new RangeError("game.addItem: count must be >= 0");
        Object.assign(
          deps.state,
          transitionItemState(deps.state, deps.project.database.items, { kind: "grant", itemId: id, amount: count }),
        );
        return undefined;
      }
      case "removeItem": {
        const id = requireScriptStr("removeItem", args, 0, "id");
        const count = optScriptInt("removeItem", args, 1, "count", 1);
        if (count < 0) throw new RangeError("game.removeItem: count must be >= 0");
        if ((deps.state.inventory[id] ?? 0) < count) return false;
        Object.assign(
          deps.state,
          transitionItemState(deps.state, deps.project.database.items, { kind: "remove", itemId: id, amount: count }),
        );
        return true;
      }
      // Party & battle actors
      case "party":
        return [...(deps.state.partyActorIds ?? deps.actors.map((entry) => entry.recordId))];
      case "actor": {
        const id = requireScriptStr("actor", args, 0, "id");
        const found = deps.actors.find((entry) => entry.recordId === id || entry.id === id);
        return found ? battleActorSnapshot(deps, found) : undefined;
      }
      case "addToParty": {
        const id = requireScriptStr("addToParty", args, 0, "id").trim();
        deps.state.partyActorIds ??= [];
        if (id && !deps.state.partyActorIds.includes(id)) deps.state.partyActorIds.push(id);
        return undefined;
      }
      case "removeFromParty": {
        const id = requireScriptStr("removeFromParty", args, 0, "id");
        deps.state.partyActorIds = (deps.state.partyActorIds ?? []).filter((entry) => entry !== id);
        return undefined;
      }
      case "gainExp": {
        const actorId = requireScriptStr("gainExp", args, 0, "id");
        const amount = requireScriptInt("gainExp", args, 1, "amount");
        deps.state.actorExperience ??= {};
        for (const actor of deps.resolveActorTargets(actorId)) {
          const current = deps.state.actorExperience[actor.recordId] ?? 0;
          deps.state.actorExperience[actor.recordId] = Math.max(0, current + amount);
        }
        return undefined;
      }
      case "setLevel": {
        const actorId = requireScriptStr("setLevel", args, 0, "id");
        const level = Math.max(1, Math.min(99, requireScriptInt("setLevel", args, 1, "level")));
        deps.state.actorLevels ??= {};
        for (const actor of deps.resolveActorTargets(actorId)) {
          deps.state.actorLevels[actor.recordId] = level;
          actor.level = level;
          floorActorExperience(deps.project, deps.state, actor.recordId);
          deps.refreshActorDerivedStats?.(actor, { refreshSkills: true });
        }
        return undefined;
      }
      case "setHp": {
        const actorId = requireScriptStr("setHp", args, 0, "id");
        const hp = requireScriptInt("setHp", args, 1, "hp");
        deps.changeActorVital(actorId, "hp", "=", hp);
        return undefined;
      }
      case "setMp": {
        const actorId = requireScriptStr("setMp", args, 0, "id");
        const mp = requireScriptInt("setMp", args, 1, "mp");
        deps.changeActorVital(actorId, "mp", "=", mp);
        return undefined;
      }
      case "recoverAll": {
        const actorId = optScriptStr("recoverAll", args, 0, "id");
        for (const actor of deps.resolveActorTargets(actorId)) {
          actor.hp = actor.maxHp;
          actor.mp = actor.maxMp;
        }
        return undefined;
      }
      case "learnSkill": {
        const actorId = requireScriptStr("learnSkill", args, 0, "id");
        const skillId = requireScriptStr("learnSkill", args, 1, "skillId");
        deps.state.actorSkillIds ??= {};
        for (const actor of deps.resolveActorTargets(actorId)) {
          const known = new Set(permanentActorSkillIds(deps.project, deps.state, actor.recordId));
          known.add(skillId);
          deps.state.actorSkillIds[actor.recordId] = [...known];
          if (!actor.skillIds.includes(skillId)) actor.skillIds = [...actor.skillIds, skillId];
        }
        return undefined;
      }
      // Battle-specific context helpers
      case "turn":
        return deps.context.turn;
      case "actors":
        return deps.actors.map((entry) => battleActorSnapshot(deps, entry));
      case "enemies":
        return deps.enemies.map((entry) => battleEnemySnapshot(entry));
      case "getEnemy": {
        const enemy = deps.resolveEnemy(requireScriptStr("getEnemy", args, 0, "id"));
        return enemy ? battleEnemySnapshot(enemy) : undefined;
      }
      case "setEnemyHp": {
        const enemy = deps.resolveEnemy(requireScriptStr("setEnemyHp", args, 0, "id"));
        const hp = requireScriptInt("setEnemyHp", args, 1, "hp");
        if (enemy) enemy.hp = deps.clampVital(hp, enemy.maxHp);
        return enemy ? enemy.hp : undefined;
      }
      case "setEnemyMp": {
        const enemy = deps.resolveEnemy(requireScriptStr("setEnemyMp", args, 0, "id"));
        const mp = requireScriptInt("setEnemyMp", args, 1, "mp");
        if (enemy) enemy.mp = deps.clampVital(mp, enemy.maxMp);
        return enemy ? enemy.mp : undefined;
      }
      case "battleContext":
        return {
          turn: deps.context.turn,
          troopId: deps.troopRecord.id,
          activeActorId: deps.context.activeActorId ?? null,
          currentActorCommandKind: deps.context.currentActorCommandKind ?? null,
          currentActorSkillId: deps.context.currentActorSkillId ?? null,
          actors: deps.actors.map((entry) => battleActorSnapshot(deps, entry)),
          enemies: deps.enemies.map((entry) => battleEnemySnapshot(entry)),
        };
      // Utility & queries
      case "random": {
        const max = requireScriptInt("random", args, 0, "maxExclusive");
        if (max < 1 || max > 2 ** 31) throw new RangeError("game.random: maxExclusive must be between 1 and 2^31");
        return Math.floor(nextRand() * max);
      }
      case "log": {
        const text = args.map((value) => (typeof value === "string" ? value : JSON.stringify(value) ?? String(value))).join(" ");
        deps.onLog(text);
        return undefined;
      }
      case "mapId":
        return deps.state.currentMapId ?? "";
      case "eventId":
        return deps.ownerEventId;
      case "player":
        return {
          mapId: deps.state.currentMapId ?? "",
          x: deps.state.x ?? 0,
          y: deps.state.y ?? 0,
          direction: deps.state.playerFacing ?? "down",
        };
      case "time": {
        const time = deps.state.gameTime;
        if (!time) return { enabled: false, hour: 12, minute: 0, day: 1, season: "spring", year: 1, phase: "day" };
        return { enabled: true, hour: time.hour, minute: time.minute, day: time.day, season: time.season, year: time.year, phase: "day" };
      }
      case "playTime":
        return 0;
      case "events":
      case "event":
      case "eventAt":
      case "tileAt":
      case "passable":
        throw new Error(`game.${name}() is a map-only query and is not available inside battle event scripts`);
      default:
        throw new Error(`game.${name} is not available inside battle event scripts`);
    }
  };

  try {
    rt = module.newRuntime();
    rt.setMemoryLimit(BATTLE_SCRIPT_MEMORY_LIMIT_BYTES);
    rt.setMaxStackSize(BATTLE_SCRIPT_STACK_LIMIT_BYTES);
    const deadline = performance.now() + BATTLE_SCRIPT_CPU_LIMIT_MS;
    rt.setInterruptHandler(() => {
      if (performance.now() <= deadline) return false;
      timedOut = true;
      return true;
    });
    vm = rt.newContext();

    const hostObj = vm.newObject();
    const callFn = vm.newFunction("call", (nameHandle, argsHandle) => {
      const name = vm!.getString(nameHandle);
      const rawArgs = JSON.parse(vm!.getString(argsHandle)) as unknown;
      const parsedArgs = Array.isArray(rawArgs) ? rawArgs : [];
      return vm!.newString(JSON.stringify({ v: dispatchBattleHostCall(name, parsedArgs) }));
    });
    vm.setProp(hostObj, "call", callFn);
    vm.setProp(vm.global, "__battleHost", hostObj);
    callFn.dispose();
    hostObj.dispose();

    const preludeRes = vm.evalCode(BATTLE_SCRIPT_PRELUDE, "battle-prelude.js");
    if (preludeRes.error) {
      const message = formatBattleVmError(vm, preludeRes.error, timedOut);
      preludeRes.error.dispose();
      return { ok: false, message };
    }

    const wrapped = `(async function (require, exports, module) {\n${compiled}\n})`;
    const fnRes = vm.evalCode(wrapped, "battle-script.js");
    if (fnRes.error) {
      preludeRes.value.dispose();
      const message = formatBattleVmError(vm, fnRes.error, timedOut);
      fnRes.error.dispose();
      return { ok: false, message };
    }

    const started = vm.callFunction(preludeRes.value, vm.undefined, fnRes.value);
    preludeRes.value.dispose();
    fnRes.value.dispose();
    if (started.error) {
      const message = formatBattleVmError(vm, started.error, timedOut);
      started.error.dispose();
      return { ok: false, message };
    }
    promiseHandle = started.value;

    const jobs = rt.executePendingJobs();
    if (jobs.error) {
      const message = formatBattleVmError(vm, jobs.error, timedOut);
      jobs.error.dispose();
      return { ok: false, message };
    }

    const promiseState = vm.getPromiseState(promiseHandle);
    if (promiseState.type === "fulfilled") {
      if (promiseState.value.alive) promiseState.value.dispose();
      return { ok: true };
    }
    if (promiseState.type === "rejected") {
      const message = formatBattleVmError(vm, promiseState.error, timedOut);
      promiseState.error.dispose();
      return { ok: false, message };
    }
    return {
      ok: false,
      message: "Async/await operations that suspend execution are not supported inside battle event scripts.",
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };
  } finally {
    try {
      if (promiseHandle?.alive) promiseHandle.dispose();
      vm?.dispose();
      rt?.dispose();
    } catch (disposeError) {
      console.error("[battle-script] sandbox dispose failed", disposeError);
    }
  }
}
