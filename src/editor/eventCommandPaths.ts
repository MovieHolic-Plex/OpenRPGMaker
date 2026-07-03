import type { Command } from "@/project/types";

export const SHOP_TRANSACTION_BRANCH_INDEX = -1;
export const FORK_THEN_BRANCH_INDEX = -2;
export const FORK_ELSE_BRANCH_INDEX = -3;
export const CHOICE_CANCEL_BRANCH_INDEX = -4;
export const LOOP_BODY_BRANCH_INDEX = -5;

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
  if (branchIndex !== SHOP_TRANSACTION_BRANCH_INDEX) return null;
  if (!command.transactionBranch && mode === "create") command.transactionBranch = [];
  return command.transactionBranch ?? null;
}
