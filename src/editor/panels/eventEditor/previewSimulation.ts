import { eventCommandBranches, type EventBranchKind } from "@/editor/eventCommandBranches";
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
  actorVitals: PlaySession["actorVitals"];
  currentMapId: PlaySession["currentMapId"];
  x: number;
  y: number;
  gameTime?: PlaySession["gameTime"];
  npcActivities?: PlaySession["npcActivities"];
  friendship?: PlaySession["friendship"];
  battleResult?: PlaySession["battleResult"];
  roguelikeRun?: PlaySession["roguelikeRun"];
}

export interface SimulatedStep {
  readonly command: Command;
  readonly depth: number;
  readonly branchLabel?: string;
  readonly simState: PreviewSimState;
  readonly forkTaken?: "then" | "else";
  readonly skipped?: boolean;
}

export interface ActiveFace {
  readonly resourceId: string;
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

function branchLabelOf(command: Command, kind: EventBranchKind): string | undefined {
  return eventCommandBranches(command).find((branch) => branch.kind === kind)?.label;
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
    actorVitals: structuredClone(state.actorVitals),
    currentMapId: state.currentMapId,
    x: state.x,
    y: state.y,
    ...(state.gameTime ? { gameTime: { ...state.gameTime } } : {}),
    ...(state.npcActivities ? { npcActivities: { ...state.npcActivities } } : {}),
    ...(state.friendship ? { friendship: { ...state.friendship } } : {}),
    ...(state.battleResult ? { battleResult: state.battleResult } : {}),
    ...(state.roguelikeRun ? { roguelikeRun: structuredClone(state.roguelikeRun) } : {}),
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
  hostEventId?: string
): SimulationResult {
  const initialState = createPreviewSimState();
  const steps: SimulatedStep[] = [];
  const state = cloneState(initialState);
  walkWithSimulation(commands, 0, state, steps, hostEventId, undefined);
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
  skipped = false
): WalkResult {
  for (const command of commands) {
    const stateBefore = cloneState(state);

    if (command.kind === "fork" && !skipped) {
      const taken = evalForkCondition(command.condition, state, hostEventId);
      steps.push({ command, depth, branchLabel, simState: stateBefore, forkTaken: taken, skipped });

      const thenSkipped = taken !== "then";
      const elseSkipped = taken !== "else";

      walkWithSimulation(command.then, depth + 1, state, steps, hostEventId, branchLabelOf(command, "forkThen"), thenSkipped);
      if (command.else && command.else.length > 0) {
        walkWithSimulation(command.else, depth + 1, state, steps, hostEventId, branchLabelOf(command, "forkElse"), elseSkipped);
      }
      continue;
    }

    if (command.kind === "choices") {
      steps.push({ command, depth, branchLabel, simState: stateBefore, skipped });
      // 선택지·취소 라벨도 정본에서 가져온다. 옵션은 순서가 그대로라 인덱스로 짝지어도 안전하다.
      const choiceBranches = eventCommandBranches(command);
      command.options.forEach((option, optionIndex) => {
        const branchState = cloneState(state);
        walkWithSimulation(
          option.branch,
          depth + 1,
          branchState,
          steps,
          hostEventId,
          choiceBranches[optionIndex]?.label,
          skipped
        );
      });
      const cancelBranch = choiceBranches.find((branch) => branch.kind === "choiceCancel");
      if (cancelBranch) {
        const cancelState = cloneState(state);
        walkWithSimulation(cancelBranch.commands, depth + 1, cancelState, steps, hostEventId, cancelBranch.label, skipped);
      }
      continue;
    }

    if (command.kind === "loop") {
      steps.push({ command, depth, branchLabel, simState: stateBefore, skipped });
      const result = walkWithSimulation(command.body, depth + 1, state, steps, hostEventId, branchLabelOf(command, "loopBody"), skipped);
      if (result.broke) continue;
      continue;
    }

    if (command.kind === "breakLoop") {
      steps.push({ command, depth, branchLabel, simState: stateBefore, skipped });
      return { broke: true };
    }

    if (command.kind === "gotoLabel" || command.kind === "label") {
      steps.push({ command, depth, branchLabel, simState: stateBefore, skipped });
      continue;
    }

    const branches = branchesOf(command);
    if (branches.length > 0) {
      steps.push({ command, depth, branchLabel, simState: stateBefore, skipped });
      for (const branch of branches) {
        const branchState = cloneState(state);
        walkWithSimulation(branch.commands, depth + 1, branchState, steps, hostEventId, branch.label, skipped);
      }
      continue;
    }

    if (!skipped) {
      applyCommandToState(command, state, hostEventId);
    }
    steps.push({ command, depth, branchLabel, simState: stateBefore, skipped });
  }
  return { broke: false };
}

function evalForkCondition(
  condition: Condition,
  state: PreviewSimState,
  hostEventId: string | undefined
): "then" | "else" {
  const result = evalCondition(previewSessionFromSimState(state), condition, hostEventId);
  return result ? "then" : "else";
}

function applyCommandToState(command: Command, state: PreviewSimState, hostEventId: string | undefined): void {
  switch (command.kind) {
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
