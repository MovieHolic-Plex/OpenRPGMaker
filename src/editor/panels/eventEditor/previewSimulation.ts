import { eventCommandBranches } from "@/editor/eventCommandBranches";
import { createInterpreter } from "@/player/interpreter";
import { evalCondition, startSession } from "@/project/session";
import { store } from "@/project/store";
import type { Command, Condition, VariableOperand } from "@/project/types";
import type { PlaySession } from "@/project/session";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes";

export interface PreviewSimState {
  switches: Record<string, boolean>;
  variables: Record<string, number>;
  timers: Record<string, number>;
  gold: number;
  inventory: Record<string, number>;
  partyActorIds: string[];
  selfSwitches: Record<string, Partial<Record<string, boolean>>>;
  flags: Record<string, boolean>;
  face?: ActiveFace;
  actorVitals: PlaySession["actorVitals"];
  currentMapId: PlaySession["currentMapId"];
  x: number;
  y: number;
  gameTime?: PlaySession["gameTime"];
  npcActivities?: PlaySession["npcActivities"];
  friendship?: PlaySession["friendship"];
  battleResult?: PlaySession["battleResult"];
  roguelikeRun?: PlaySession["roguelikeRun"];
  itemUseCharges?: PlaySession["itemUseCharges"];
  collections?: PlaySession["collections"];
  unlockedRecipeIds?: PlaySession["unlockedRecipeIds"];
  equippedToolItemId?: PlaySession["equippedToolItemId"];
}

export type ForkVerdict = "then" | "else" | "unknown";

export interface SimulatedStep {
  readonly command: Command;
  readonly depth: number;
  readonly branchLabel?: string;
  readonly simState: PreviewSimState;
  readonly forkTaken?: "then" | "else" | "unknown";
  readonly skipped?: boolean;
  /**
   * 이 단계가 가리키는 명령의 편집 경로(`[명령칸, 분기칸, 명령칸, …]`) — 목록·스토리와
   * **같은** 주소 체계다. 플로우 보기가 «미리보기의 현재 단계» 를 짚을 때 이걸로 찾는다.
   *
   * 인덱스로 짝지으면 안 된다: `breakLoop` 는 뒤 명령을 걷지 않고 빠져나오므로
   * 「단계 n번째」와 「노드 n번째」가 어긋난다. 경로는 그런 조기 종료에 영향받지 않는다.
   */
  readonly path: readonly number[];
}

export interface ActiveFace {
  readonly resourceId: string;
  readonly position?: "left" | "right";
  readonly flipHorizontally?: boolean;
}

export interface SimulationResult {
  readonly steps: readonly SimulatedStep[];
  readonly finalState: PreviewSimState;
}

export type BranchRef = { readonly label: string; readonly commands: readonly Command[] };

/**
 * 분기 열거는 `eventCommandBranches` 가 정본이다. 여기는 라벨+명령만 쓰는 얇은 어댑터다.
 * 예전에는 이 함수가 자기 목록을 들고 있어서 상점 실패 분기를 빠뜨렸다 — 다시 만들지 말 것.
 */
export function branchesOf(command: Command): BranchRef[] {
  return eventCommandBranches(command).map((branch) => ({ label: branch.label, commands: branch.commands }));
}

export function createPreviewSimState(): PreviewSimState {
  const project = store.getCurrent();
  const session = startSession(project);
  return snapshotSession(session);
}

function snapshotSession(session: PlaySession): PreviewSimState {
  return {
    switches: { ...session.switches },
    variables: { ...session.variables },
    timers: { ...session.timers },
    gold: session.gold,
    inventory: { ...session.inventory },
    partyActorIds: [...session.partyActorIds],
    selfSwitches: structuredClone(session.selfSwitches),
    flags: { ...session.flags },
    actorVitals: structuredClone(session.actorVitals),
    currentMapId: session.currentMapId,
    x: session.x,
    y: session.y,
    ...(session.gameTime ? { gameTime: { ...session.gameTime } } : {}),
    ...(session.npcActivities ? { npcActivities: { ...session.npcActivities } } : {}),
    ...(session.friendship ? { friendship: { ...session.friendship } } : {}),
    ...(session.battleResult ? { battleResult: session.battleResult } : {}),
    ...(session.roguelikeRun ? { roguelikeRun: structuredClone(session.roguelikeRun) } : {}),
    ...(session.itemUseCharges ? { itemUseCharges: structuredClone(session.itemUseCharges) } : {}),
    ...(session.collections ? { collections: structuredClone(session.collections) } : {}),
    ...(session.unlockedRecipeIds ? { unlockedRecipeIds: [...session.unlockedRecipeIds] } : {}),
    ...(session.equippedToolItemId !== undefined ? { equippedToolItemId: session.equippedToolItemId } : {}),
  };
}

function cloneState(state: PreviewSimState): PreviewSimState {
  return {
    switches: { ...state.switches },
    variables: { ...state.variables },
    timers: { ...state.timers },
    gold: state.gold,
    inventory: { ...state.inventory },
    partyActorIds: [...state.partyActorIds],
    selfSwitches: structuredClone(state.selfSwitches),
    flags: { ...state.flags },
    ...(state.face ? { face: { ...state.face } } : {}),
    actorVitals: structuredClone(state.actorVitals),
    currentMapId: state.currentMapId,
    x: state.x,
    y: state.y,
    ...(state.gameTime ? { gameTime: { ...state.gameTime } } : {}),
    ...(state.npcActivities ? { npcActivities: { ...state.npcActivities } } : {}),
    ...(state.friendship ? { friendship: { ...state.friendship } } : {}),
    ...(state.battleResult ? { battleResult: state.battleResult } : {}),
    ...(state.roguelikeRun ? { roguelikeRun: structuredClone(state.roguelikeRun) } : {}),
    ...(state.itemUseCharges ? { itemUseCharges: structuredClone(state.itemUseCharges) } : {}),
    ...(state.collections ? { collections: structuredClone(state.collections) } : {}),
    ...(state.unlockedRecipeIds ? { unlockedRecipeIds: [...state.unlockedRecipeIds] } : {}),
    ...(state.equippedToolItemId !== undefined ? { equippedToolItemId: state.equippedToolItemId } : {}),
  };
}

export function previewSessionFromSimState(state: PreviewSimState): PlaySessionLike {
  return {
    switches: state.switches,
    selfSwitches: state.selfSwitches,
    variables: state.variables,
    timers: state.timers,
    gold: state.gold,
    inventory: state.inventory,
    partyActorIds: state.partyActorIds,
    flags: state.flags,
    actorVitals: state.actorVitals,
    currentMapId: state.currentMapId,
    x: state.x,
    y: state.y,
    gameTime: state.gameTime,
    npcActivities: state.npcActivities,
    friendship: state.friendship,
    battleResult: state.battleResult,
    roguelikeRun: state.roguelikeRun,
  };
}

export function simulatePageCommands(
  commands: readonly Command[],
  hostEventId?: string,
  mapId?: string
): SimulationResult {
  const initialState = createPreviewSimState();
  const steps: SimulatedStep[] = [];
  const state = cloneState(initialState);
  walkWithSimulation(commands, 0, state, steps, hostEventId, undefined, [], mapId);
  return { steps, finalState: state };
}

type WalkResult = { broke: boolean };

function walkWithSimulation(
  commands: readonly Command[],
  depth: number,
  state: PreviewSimState,
  steps: SimulatedStep[],
  hostEventId: string | undefined,
  branchLabel: string | undefined,
  pathPrefix: readonly number[],
  mapId?: string,
  skipped = false
): WalkResult {
  for (let index = 0; index < commands.length; index += 1) {
    const command = commands[index]!;
    const path = [...pathPrefix, index];
    const stateBefore = cloneState(state);

    if (command.kind === "fork" && !skipped) {
      const taken = evalForkCondition(command.condition, state, hostEventId, mapId);
      steps.push({ command, depth, branchLabel, simState: stateBefore, forkTaken: taken, skipped, path });
      // 판정 불가(unknown)면 양쪽 다 skipped — 어느 쪽도 「실행된다」고 단정하지 않는다.
      // 판정 가능해도 분기는 각자 복제된 상태를 받는다 — 먼저 걷는 분기의 쓰기가
      // 뒤 분기 스텝의 before 스냅샷을 오염시키던 구형 공유-state 검사를 고쳤다.
      for (const branch of eventCommandBranches(command)) {
        const branchSkipped = taken === "unknown"
          ? true
          : branch.kind === "forkElse" ? taken !== "else" : taken !== "then";
        walkWithSimulation(
          branch.commands, depth + 1, cloneState(state), steps, hostEventId, branch.label,
          [...path, branch.branchIndex], mapId, branchSkipped,
        );
      }
      if (taken !== "unknown") {
        const takenBranch = eventCommandBranches(command).find((branch) =>
          branch.kind === "forkElse" ? taken === "else" : taken === "then");
        if (takenBranch) applyCommandsToState(takenBranch.commands, state, hostEventId, mapId);
      }
      continue;
    }

    if (command.kind === "breakLoop") {
      steps.push({ command, depth, branchLabel, simState: stateBefore, skipped, path });
      return { broke: true };
    }

    if (command.kind === "gotoLabel" || command.kind === "label") {
      steps.push({ command, depth, branchLabel, simState: stateBefore, skipped, path });
      continue;
    }

    // 반복은 몸통이 실제로 실행되므로 state 를 공유하고, 선택지·상점 같은 «갈라지는» 분기는
    // 서로 오염되지 않도록 각 분기가 복사본을 받는다.
    const sharesState = command.kind === "loop";
    const branches = eventCommandBranches(command);
    if (branches.length > 0) {
      steps.push({ command, depth, branchLabel, simState: stateBefore, skipped, path });
      for (const branch of branches) {
        walkWithSimulation(
          branch.commands, depth + 1, sharesState ? state : cloneState(state), steps, hostEventId,
          branch.label, [...path, branch.branchIndex], mapId, skipped,
        );
      }
      continue;
    }

    if (!skipped) {
      applyCommandToState(command, state, hostEventId);
    }
    steps.push({ command, depth, branchLabel, simState: stateBefore, skipped, path });
  }
  return { broke: false };
}

function evalForkCondition(
  condition: Condition,
  state: PreviewSimState,
  hostEventId: string | undefined,
  mapId?: string
): ForkVerdict {
  // insideLocation 은 명시된 맵의 기하가 없으면 판정 불가 — map context 없이 evalCondition 에
  // 맡기면 「로케이션 없음 = 거짓」으로 else-taken 을 단정해 뱃지(판정 불가)와 어긋났다.
  // 시작 맵으로 폴백하지 않는다: 편집 중인 맵이 아닌 기하로 판정하는 것은 지어낸 답이다.
  const locations = resolvePreviewLocations(mapId);
  if ((conditionNeedsMap(condition) && !locations) || conditionNeedsUnsimulatedState(condition)) return "unknown";
  const session = previewSessionFromSimState(state);
  const result = evalCondition(session, condition, hostEventId, locations ? { map: { locations } } : undefined);
  return result ? "then" : "else";
}

/**
 * The preview can replay authored switches/variables, but it does not own a
 * clock, battle result, NPC scheduler, or roguelike run. Returning unknown for
 * those leaves both branches visibly possible instead of presenting a stale
 * editor session as a definitive runtime decision.
 */
function conditionNeedsUnsimulatedState(condition: Condition): boolean {
  switch (condition.kind) {
    case "monsterSpecies":
    case "timer":
    case "timePhase":
    case "season":
    case "npcActivity":
    case "friendshipAtLeast":
    case "relationshipAtLeast":
    case "battleResult":
    case "run":
    case "actorStat":
    case "actorState":
    case "partyLeader":
    case "partySize":
    case "facing":
    case "relativeFacing":
    case "hiding":
    case "pursuitActive":
    case "clearCount":
    case "endingSeen":
    case "newGamePlus":
    case "weekday":
    case "stringVariable":
    case "difficulty":
    case "itemUsed":
      return true;
    case "all":
    case "any":
      return condition.conditions.some(conditionNeedsUnsimulatedState);
    case "not":
      return conditionNeedsUnsimulatedState(condition.condition);
    default:
      return false;
  }
}

function conditionNeedsMap(condition: Condition): boolean {
  switch (condition.kind) {
    case "insideLocation":
      return true;
    case "all":
    case "any":
      return condition.conditions.some(conditionNeedsMap);
    case "not":
      return conditionNeedsMap(condition.condition);
    default:
      return false;
  }
}

/**
 * 미리보기 판정용 로케이션 기하. 명시된 맵만 본다 — 시작 맵 폴백은 없다.
 * 호출부가 맵을 모르면 undefined 를 돌려 판정 불가(unknown)로 이끈다.
 */
export function resolvePreviewLocations(mapId?: string): readonly { readonly id: string; readonly x: number; readonly y: number; readonly w: number; readonly h: number }[] | undefined {
  if (!mapId) return undefined;
  return store.getCurrent().maps[mapId]?.locations;
}

/** taken 분기의 명령들을 순서대로 상태에 적용한다(중첩 fork 포함). */
function applyCommandsToState(
  commands: readonly Command[],
  state: PreviewSimState,
  hostEventId: string | undefined,
  mapId?: string
): void {
  for (const command of commands) {
    if (command.kind === "fork") {
      const taken = evalForkCondition(command.condition, state, hostEventId, mapId);
      if (taken === "unknown") continue;
      const takenBranch = eventCommandBranches(command).find((branch) =>
        branch.kind === "forkElse" ? taken === "else" : taken === "then");
      if (takenBranch) applyCommandsToState(takenBranch.commands, state, hostEventId, mapId);
      continue;
    }
    if (command.kind === "breakLoop" || command.kind === "gotoLabel" || command.kind === "label") continue;
    const branches = eventCommandBranches(command);
    if (branches.length > 0) continue;
    applyCommandToState(command, state, hostEventId);
  }
}

function applyCommandToState(command: Command, state: PreviewSimState, hostEventId: string | undefined): void {
  switch (command.kind) {
    case "changeFace": {
      if (command.resourceId) {
        state.face = {
          resourceId: command.resourceId,
          position: command.position,
          flipHorizontally: command.flipHorizontally,
        };
      } else {
        delete state.face;
      }
      break;
    }
    case "craftRecipe":
    case "applyItemUpgrade": {
      const project = store.getCurrent();
      const session = Object.assign(startSession(project), state);
      createInterpreter([command], session, project).start();
      Object.assign(state, snapshotSession(session));
      break;
    }
    case "setSwitch": {
      if (command.value === "toggle") {
        state.switches[command.switchId] = !state.switches[command.switchId];
      } else if (typeof command.value === "object" && command.value !== null && command.value.kind === "var") {
        state.switches[command.switchId] = (state.variables[command.value.id] ?? 0) !== 0;
      } else {
        state.switches[command.switchId] = command.value as boolean;
      }
      break;
    }
    case "setVariable": {
      const val = resolveVariableOperand(command.value, state);
      applyVariableOp(state, command.variableId, command.op, val);
      break;
    }
    case "setSelfSwitch": {
      if (hostEventId) {
        if (!state.selfSwitches[hostEventId]) {
          state.selfSwitches[hostEventId] = {};
        }
        state.selfSwitches[hostEventId]![command.key] = command.value;
      }
      break;
    }
    case "setFlag": {
      state.flags[command.flag] = command.value;
      state.switches[command.flag] = command.value;
      break;
    }
    case "changeGold": {
      const amount = resolveVariableOperand(command.amount, state);
      if (command.op === "=") state.gold = Math.max(0, amount);
      else if (command.op === "+=") state.gold = Math.max(0, state.gold + amount);
      else state.gold = Math.max(0, state.gold - amount);
      break;
    }
    case "changeItem": {
      const amount = resolveVariableOperand(command.amount, state);
      const current = state.inventory[command.itemId] ?? 0;
      const next =
        command.op === "=" ? amount
        : command.op === "+=" ? current + amount
        : current - amount;
      if (next <= 0) delete state.inventory[command.itemId];
      else state.inventory[command.itemId] = next;
      break;
    }
    case "changeParty": {
      if (command.action === "add") {
        if (!state.partyActorIds.includes(command.actorId)) {
          state.partyActorIds.push(command.actorId);
        }
      } else if (command.action === "lead") {
        state.partyActorIds = [command.actorId, ...state.partyActorIds.filter((id) => id !== command.actorId)];
      } else {
        state.partyActorIds = state.partyActorIds.filter((id) => id !== command.actorId);
      }
      break;
    }
    default:
      break;
  }
}

function resolveVariableOperand(operand: VariableOperand, state: PreviewSimState): number {
  if (typeof operand === "number") return operand;
  return state.variables[operand.id] ?? 0;
}

function clampSimValue(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const truncated = Math.trunc(value);
  return Math.max(-9_999_999, Math.min(9_999_999, truncated));
}

function applyVariableOp(
  state: PreviewSimState,
  variableId: string,
  op: "=" | "+=" | "-=" | "*=" | "/=",
  value: number
): void {
  const cur = state.variables[variableId] ?? 0;
  switch (op) {
    case "=":
      state.variables[variableId] = clampSimValue(value);
      break;
    case "+=":
      state.variables[variableId] = clampSimValue(cur + value);
      break;
    case "-=":
      state.variables[variableId] = clampSimValue(cur - value);
      break;
    case "*=":
      state.variables[variableId] = clampSimValue(cur * value);
      break;
    case "/=": {
      if (value === 0) break;
      state.variables[variableId] = clampSimValue(Math.trunc(cur / value));
      break;
    }
  }
}

export function getSimSwitch(state: PreviewSimState, switchId: string): boolean {
  return state.switches[switchId] ?? false;
}

export function getSimVariable(state: PreviewSimState, variableId: string): number {
  return state.variables[variableId] ?? 0;
}

export function getSimItem(state: PreviewSimState, itemId: string): number {
  return state.inventory[itemId] ?? 0;
}
