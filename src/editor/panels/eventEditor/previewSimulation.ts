import { evalCondition, startSession } from "@/project/session";
import { store } from "@/project/store";
import type { Command, Condition, VariableOperand } from "@/project/types";
import type { PlaySession } from "@/project/session";

export interface PreviewSimState {
  switches: Record<string, boolean>;
  variables: Record<string, number>;
  gold: number;
  inventory: Record<string, number>;
  partyActorIds: string[];
  selfSwitches: Record<string, Partial<Record<string, boolean>>>;
  flags: Record<string, boolean>;
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

export function branchesOf(command: Command): BranchRef[] {
  if (command.kind === "fork") {
    const branches: BranchRef[] = [{ label: "참", commands: command.then }];
    if (command.else) branches.push({ label: "그 외", commands: command.else });
    return branches;
  }
  if (command.kind === "choices") {
    const branches: BranchRef[] = command.options.map((option, index) => ({
      label: option.text || `선택지 ${index + 1}`,
      commands: option.branch,
    }));
    if (command.cancelBehavior === "branch") branches.push({ label: "취소", commands: command.cancelBranch ?? [] });
    return branches;
  }
  if (command.kind === "loop") return [{ label: "반복", commands: command.body }];
  if (command.kind === "shop" && command.branchOnTransaction) {
    return [{ label: "구매/판매", commands: command.transactionBranch ?? [] }];
  }
  if (command.kind === "inn" && command.branchOnNotEnoughGold) {
    return [{ label: "골드 부족", commands: command.notEnoughBranch ?? [] }];
  }
  if (command.kind === "battleProcessing" && command.branchOnResult) {
    return [
      { label: "전투 승리", commands: command.victoryBranch ?? [] },
      { label: "전투 패배", commands: command.defeatBranch ?? [] },
      { label: "전투 도망", commands: command.escapeBranch ?? [] },
    ];
  }
  if (command.kind === "promoteActor") {
    return [
      { label: "성공", commands: command.successBranch ?? [] },
      { label: "실패", commands: command.failureBranch ?? [] },
    ];
  }
  if (command.kind === "evolveMonster") {
    return [
      { label: "성공", commands: command.successBranch ?? [] },
      { label: "실패", commands: command.failureBranch ?? [] },
    ];
  }
  return [];
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
    gold: session.gold,
    inventory: { ...session.inventory },
    partyActorIds: [...session.partyActorIds],
    selfSwitches: JSON.parse(JSON.stringify(session.selfSwitches)),
    flags: { ...session.flags },
  };
}

function cloneState(state: PreviewSimState): PreviewSimState {
  return {
    switches: { ...state.switches },
    variables: { ...state.variables },
    gold: state.gold,
    inventory: { ...state.inventory },
    partyActorIds: [...state.partyActorIds],
    selfSwitches: JSON.parse(JSON.stringify(state.selfSwitches)),
    flags: { ...state.flags },
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

      walkWithSimulation(command.then, depth + 1, state, steps, hostEventId, "참일 때", thenSkipped);
      if (command.else && command.else.length > 0) {
        walkWithSimulation(command.else, depth + 1, state, steps, hostEventId, "그 외", elseSkipped);
      }
      continue;
    }

    if (command.kind === "choices") {
      steps.push({ command, depth, branchLabel, simState: stateBefore, skipped });
      command.options.forEach((option, optionIndex) => {
        const branchState = cloneState(state);
        walkWithSimulation(
          option.branch,
          depth + 1,
          branchState,
          steps,
          hostEventId,
          option.text || `선택지 ${optionIndex + 1}`,
          skipped
        );
      });
      if (command.cancelBehavior === "branch") {
        const cancelState = cloneState(state);
        walkWithSimulation(command.cancelBranch ?? [], depth + 1, cancelState, steps, hostEventId, "취소할 때", skipped);
      }
      continue;
    }

    if (command.kind === "loop") {
      steps.push({ command, depth, branchLabel, simState: stateBefore, skipped });
      const result = walkWithSimulation(command.body, depth + 1, state, steps, hostEventId, "반복", skipped);
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
  const sessionLike = {
    switches: state.switches,
    selfSwitches: state.selfSwitches,
    variables: state.variables,
    timers: {} as Record<string, number>,
    gold: state.gold,
    inventory: state.inventory,
    partyActorIds: state.partyActorIds,
    flags: state.flags,
    actorVitals: {},
    currentMapId: "",
    x: 0,
    y: 0,
  };
  const result = evalCondition(sessionLike, condition, hostEventId);
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
