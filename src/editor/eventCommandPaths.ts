import type { Command } from "@/project/types";

export const SHOP_TRANSACTION_BRANCH_INDEX = -1;
export const SHOP_FAILED_TRANSACTION_BRANCH_INDEX = -12;
export const FORK_THEN_BRANCH_INDEX = -2;
export const FORK_ELSE_BRANCH_INDEX = -3;
export const CHOICE_CANCEL_BRANCH_INDEX = -4;
export const LOOP_BODY_BRANCH_INDEX = -5;
export const PROMOTE_SUCCESS_BRANCH_INDEX = -6;
export const PROMOTE_FAILURE_BRANCH_INDEX = -7;
export const INN_NOT_ENOUGH_BRANCH_INDEX = -8;
export const BATTLE_VICTORY_BRANCH_INDEX = -9;
export const BATTLE_DEFEAT_BRANCH_INDEX = -10;
export const BATTLE_ESCAPE_BRANCH_INDEX = -11;

type MissingBranchMode = "read" | "create";

type CommandPathResolveOptions = {
  readonly missingBranches?: MissingBranchMode;
};

function missingBranchMode(options?: CommandPathResolveOptions): MissingBranchMode {
  return options?.missingBranches ?? "read";
}

export function resolveCommandListAtPath(
  commands: Command[],
  containerPath: readonly number[],
  options?: CommandPathResolveOptions
): Command[] | null {
  let list: Command[] = commands;
  for (let index = 0; index < containerPath.length - 1; index += 2) {
    const commandIndex = containerPath[index];
    const branchIndex = containerPath[index + 1];
    if (commandIndex === undefined || branchIndex === undefined) return null;
    const command = list[commandIndex];
    if (!command) return null;
    const branch = resolveCommandBranch(command, branchIndex, options);
    if (!branch) return null;
    list = branch;
  }
  return list;
}

export function resolveRootCommandBranchList(
  rootCommand: Command,
  containerPath: readonly number[],
  options?: CommandPathResolveOptions
): Command[] | null {
  const rootBranchIndex = containerPath[0];
  if (rootBranchIndex === undefined) return null;
  let list = resolveCommandBranch(rootCommand, rootBranchIndex, options);
  if (!list) return null;
  for (let index = 1; index < containerPath.length - 1; index += 2) {
    const commandIndex = containerPath[index];
    const branchIndex = containerPath[index + 1];
    if (commandIndex === undefined || branchIndex === undefined) return null;
    const command = list[commandIndex];
    if (!command) return null;
    list = resolveCommandBranch(command, branchIndex, options);
    if (!list) return null;
  }
  return list;
}

// [P2] 크로스 컨테이너 드래그: 대상 컨테이너가 이동 대상 명령 자신의 분기(자손)인지 검사.
// 자기 분기 안으로 이동하면 명령이 자신을 삼켜 유실되므로 금지한다.
export function isContainerInsideCommand(itemPath: readonly number[], containerPath: readonly number[]): boolean {
  if (containerPath.length <= itemPath.length) return false;
  return itemPath.every((value, index) => containerPath[index] === value);
}

// [P2] 두 명령 리스트 사이(또는 같은 리스트 안)에서 명령을 이동한다.
// 같은 리스트면 기존 재정렬 규칙(toIndex 를 length-1 로 클램프), 다른 리스트면 끝 삽입 허용.
export function moveCommandBetweenLists(
  sourceList: Command[],
  fromIndex: number,
  targetList: Command[],
  toIndex: number
): boolean {
  const moving = sourceList[fromIndex];
  if (!moving) return false;
  if (sourceList === targetList) {
    const clamped = Math.max(0, Math.min(targetList.length - 1, toIndex));
    if (clamped === fromIndex) return false;
    sourceList.splice(fromIndex, 1);
    sourceList.splice(clamped, 0, moving);
    return true;
  }
  sourceList.splice(fromIndex, 1);
  const clamped = Math.max(0, Math.min(targetList.length, toIndex));
  targetList.splice(clamped, 0, moving);
  return true;
}

export function resolveCommandAtPath(commands: Command[], path: readonly number[]): Command | null {
  const commandIndex = path[path.length - 1];
  if (commandIndex === undefined) return null;
  const container = path.slice(0, -1);
  const list = resolveCommandListAtPath(commands, container);
  return list?.[commandIndex] ?? null;
}

function resolveCommandBranch(
  command: Command,
  branchIndex: number,
  options?: CommandPathResolveOptions
): Command[] | null {
  switch (command.kind) {
    case "choices":
      return resolveChoicesBranch(command, branchIndex, missingBranchMode(options));
    case "fork":
      return resolveForkBranch(command, branchIndex, missingBranchMode(options));
    case "loop":
      return branchIndex === LOOP_BODY_BRANCH_INDEX ? command.body : null;
    case "shop":
      return resolveShopBranch(command, branchIndex, missingBranchMode(options));
    case "inn":
      return resolveInnBranch(command, branchIndex, missingBranchMode(options));
    case "promoteActor":
      return resolvePromoteActorBranch(command, branchIndex, missingBranchMode(options));
    case "evolveMonster":
      return resolveEvolveMonsterBranch(command, branchIndex, missingBranchMode(options));
    case "battleProcessing":
      return resolveBattleProcessingBranch(command, branchIndex, missingBranchMode(options));
    default:
      return null;
  }
}

function resolveChoicesBranch(
  command: Extract<Command, { kind: "choices" }>,
  branchIndex: number,
  mode: MissingBranchMode
): Command[] | null {
  if (branchIndex === CHOICE_CANCEL_BRANCH_INDEX) {
    if (!command.cancelBranch && mode === "create") command.cancelBranch = [];
    return command.cancelBranch ?? null;
  }
  return command.options[branchIndex]?.branch ?? null;
}

function resolveForkBranch(
  command: Extract<Command, { kind: "fork" }>,
  branchIndex: number,
  mode: MissingBranchMode
): Command[] | null {
  if (branchIndex === FORK_THEN_BRANCH_INDEX) return command.then;
  if (branchIndex === FORK_ELSE_BRANCH_INDEX) {
    if (!command.else && mode === "create") command.else = [];
    return command.else ?? null;
  }
  return null;
}

function resolveShopBranch(
  command: Extract<Command, { kind: "shop" }>,
  branchIndex: number,
  mode: MissingBranchMode
): Command[] | null {
  const typed = command as unknown as Extract<Command, { kind: "shop" }> & { failedTransactionBranch?: Command[] };
  if (branchIndex === SHOP_TRANSACTION_BRANCH_INDEX) {
    if (!command.transactionBranch && mode === "create") command.transactionBranch = [];
    return command.transactionBranch ?? null;
  }
  if (branchIndex === SHOP_FAILED_TRANSACTION_BRANCH_INDEX) {
    if (!typed.failedTransactionBranch && mode === "create") typed.failedTransactionBranch = [];
    return typed.failedTransactionBranch ?? null;
  }
  return null;
}

function resolvePromoteActorBranch(
  command: Extract<Command, { kind: "promoteActor" }>,
  branchIndex: number,
  mode: MissingBranchMode
): Command[] | null {
  if (branchIndex === PROMOTE_SUCCESS_BRANCH_INDEX) {
    if (!command.successBranch && mode === "create") command.successBranch = [];
    return command.successBranch ?? null;
  }
  if (branchIndex === PROMOTE_FAILURE_BRANCH_INDEX) {
    if (!command.failureBranch && mode === "create") command.failureBranch = [];
    return command.failureBranch ?? null;
  }
  return null;
}

function resolveEvolveMonsterBranch(
  command: Extract<Command, { kind: "evolveMonster" }>,
  branchIndex: number,
  mode: MissingBranchMode
): Command[] | null {
  if (branchIndex === PROMOTE_SUCCESS_BRANCH_INDEX) {
    if (!command.successBranch && mode === "create") command.successBranch = [];
    return command.successBranch ?? null;
  }
  if (branchIndex === PROMOTE_FAILURE_BRANCH_INDEX) {
    if (!command.failureBranch && mode === "create") command.failureBranch = [];
    return command.failureBranch ?? null;
  }
  return null;
}

function resolveInnBranch(
  command: Extract<Command, { kind: "inn" }>,
  branchIndex: number,
  mode: MissingBranchMode
): Command[] | null {
  if (branchIndex !== INN_NOT_ENOUGH_BRANCH_INDEX) return null;
  if (!command.notEnoughBranch && mode === "create") command.notEnoughBranch = [];
  return command.notEnoughBranch ?? null;
}

function resolveBattleProcessingBranch(
  command: Extract<Command, { kind: "battleProcessing" }>,
  branchIndex: number,
  mode: MissingBranchMode
): Command[] | null {
  if (branchIndex === BATTLE_VICTORY_BRANCH_INDEX) {
    if (!command.victoryBranch && mode === "create") command.victoryBranch = [];
    return command.victoryBranch ?? null;
  }
  if (branchIndex === BATTLE_DEFEAT_BRANCH_INDEX) {
    if (!command.defeatBranch && mode === "create") command.defeatBranch = [];
    return command.defeatBranch ?? null;
  }
  if (branchIndex === BATTLE_ESCAPE_BRANCH_INDEX) {
    if (!command.escapeBranch && mode === "create") command.escapeBranch = [];
    return command.escapeBranch ?? null;
  }
  return null;
}
