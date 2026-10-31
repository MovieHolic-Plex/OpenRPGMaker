// editor/script/eventToScript.ts — event command list → readable TypeScript (the `game` API).
//
// Used by the assistant tool read_event_as_script: the model reads a page's logic as code instead of nested
// JSON. Common commands become direct calls (text → showMessage, choices → showChoices + if/else, forks on
// simple conditions → if, switch/variable/gold/item changes, wait, transfer, battle, common events). Anything
// without an exact game-API equivalent becomes `await game.cmd(<the exact command JSON>)`, so the output
// type-checks and behaves like the original page. Pure; no compiler needed.
import type { Command, Condition } from "@/project/types";

export interface EventToScriptResult {
  readonly source: string;
  /** Commands translated to direct game calls. */
  readonly translated: number;
  /** Commands kept as `game.cmd({...})` (no exact API equivalent). */
  readonly passthrough: number;
  /** Command kinds kept as game.cmd, for the summary. */
  readonly passthroughKinds: readonly string[];
}

type Rec = Record<string, unknown>;

const q = (value: string): string => JSON.stringify(value);
const IMPORT_LINE = /^\s*import\s[^;]*from\s+["']@lib\/[^"']+["'];?\s*$/u;

function onlyKeys(command: object, allowed: readonly string[]): boolean {
  return Object.keys(command).every((key) => key === "kind" || allowed.includes(key));
}

function isNum(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** VariableOperand → expression, or undefined when it is not a number / {kind:'var'}. */
function operand(value: unknown): string | undefined {
  if (isNum(value)) return String(value);
  if (value && typeof value === "object" && (value as Rec).kind === "var" && typeof (value as Rec).id === "string") return `game.getVar(${q((value as Rec).id as string)})`;
  return undefined;
}

/** `-x` for a literal, `-(expr)` otherwise. */
const negate = (value: string): string => (/^\d+(\.\d+)?$/u.test(value) ? `-${value}` : `-(${value})`);

const COMPARE: Readonly<Record<string, string>> = { "==": "===", "!=": "!==", ">=": ">=", "<=": "<=", ">": ">", "<": "<" };

/** Condition → boolean expression, or undefined when the condition has no direct game-API form. */
export function conditionExpression(condition: Condition | undefined): string | undefined {
  if (!condition || typeof condition !== "object") return undefined;
  const c = condition as Rec;
  switch (condition.kind) {
    case "switch":
      return typeof c.switchId === "string" ? `${condition.value === false ? "!" : ""}game.getSwitch(${q(c.switchId)})` : undefined;
    case "variable": {
      const op = COMPARE[String(c.op)];
      return typeof c.variableId === "string" && op && isNum(c.value) ? `game.getVar(${q(c.variableId)}) ${op} ${c.value}` : undefined;
    }
    case "selfSwitch":
      return typeof c.key === "string" ? `${condition.value === false ? "!" : ""}game.getSelfSwitch(${q(c.key)})` : undefined;
    case "item":
      return typeof c.itemId === "string" ? `${c.present === false ? "!" : ""}game.hasItem(${q(c.itemId)})` : undefined;
    case "gold": {
      const op = COMPARE[String(c.op)];
      return op && isNum(c.amount) ? `game.gold() ${op} ${c.amount}` : undefined;
    }
    case "timePhase":
      return typeof c.phase === "string" ? `game.time().phase === ${q(c.phase)}` : undefined;
    case "actor":
      return typeof c.actorId === "string" ? `${c.present === false ? "!" : ""}game.party().includes(${q(c.actorId)})` : undefined;
    case "all":
    case "any": {
      const list = Array.isArray(c.conditions) ? (c.conditions as Condition[]) : [];
      if (!list.length) return undefined;
      const parts = list.map(conditionExpression);
      if (parts.some((part) => part === undefined)) return undefined;
      return parts.length === 1 ? parts[0] : `(${parts.join(condition.kind === "all" ? " && " : " || ")})`;
    }
    case "not": {
      const inner = conditionExpression(c.condition as Condition);
      return inner === undefined ? undefined : `!(${inner})`;
    }
    default:
      return undefined;
  }
}

class Writer {
  readonly lines: string[] = [];
  readonly imports = new Set<string>();
  translated = 0;
  passthrough = 0;
  readonly kinds = new Set<string>();
  private counter = 0;

  name(base: string): string {
    this.counter += 1;
    return this.counter === 1 ? base : `${base}${this.counter}`;
  }

  line(depth: number, text: string): void {
    this.lines.push(`${"  ".repeat(depth)}${text}`);
  }

  cmd(depth: number, command: Command): void {
    this.passthrough += 1;
    this.kinds.add(command.kind);
    const json = JSON.stringify(command);
    this.line(depth, `await game.cmd(${json});`);
  }
}

function branchHasLabels(commands: readonly unknown[] | undefined): boolean {
  if (!Array.isArray(commands)) return false;
  return JSON.stringify(commands).includes('"kind":"label"') || JSON.stringify(commands).includes('"kind":"gotoLabel"');
}

function writeList(w: Writer, commands: readonly Command[] | undefined, depth: number, inLoop: boolean): void {
  for (const command of commands ?? []) writeCommand(w, command, depth, inLoop);
}

function writeBlock(w: Writer, head: string, body: readonly Command[] | undefined, depth: number, inLoop: boolean): void {
  w.line(depth, `${head} {`);
  writeList(w, body, depth + 1, inLoop);
  w.line(depth, "}");
}

function writeCommand(w: Writer, command: Command, depth: number, inLoop: boolean): void {
  if (!command || typeof command !== "object") return;
  const c = command as unknown as Rec;
  switch (command.kind) {
    case "text": {
      if (!onlyKeys(command, ["body", "speaker"]) || typeof c.body !== "string") return w.cmd(depth, command);
      const speaker = typeof c.speaker === "string" && c.speaker ? `, { speaker: ${q(c.speaker)} }` : "";
      w.translated += 1;
      return w.line(depth, `await game.showMessage(${q(c.body)}${speaker});`);
    }
    case "choices": {
      const options = Array.isArray(c.options) ? (c.options as Rec[]) : [];
      const simple = options.length > 0 && options.length <= 5
        && options.every((option) => option && typeof option.text === "string" && option.text && onlyKeys(option, ["text", "branch"]))
        && onlyKeys(command, ["options", "prompt", "cancelBehavior", "cancelBranch"])
        && (c.cancelBehavior === undefined || c.cancelBehavior === "disallow" || (c.cancelBehavior === "branch" && Array.isArray(c.cancelBranch)));
      if (!simple) return w.cmd(depth, command);
      const settings: string[] = [];
      if (typeof c.prompt === "string" && c.prompt) settings.push(`prompt: ${q(c.prompt)}`);
      if (c.cancelBehavior === "branch") settings.push(`cancel: "cancel"`);
      const name = w.name("choice");
      w.translated += 1;
      w.line(depth, `const ${name} = await game.showChoices([${options.map((option) => q(option.text as string)).join(", ")}]${settings.length ? `, { ${settings.join(", ")} }` : ""});`);
      const arms = options.map((option, index) => ({ test: `${name} === ${index}`, body: option.branch as Command[] | undefined }));
      if (c.cancelBehavior === "branch") arms.push({ test: `${name} === -1`, body: c.cancelBranch as Command[] });
      const filled = arms.filter((arm) => Array.isArray(arm.body) && arm.body.length > 0);
      filled.forEach((arm, index) => {
        w.line(depth, `${index === 0 ? "if" : "} else if"} (${arm.test}) {`);
        writeList(w, arm.body, depth + 1, inLoop);
      });
      if (filled.length) w.line(depth, "}");
      return;
    }
    case "fork": {
      const test = conditionExpression(c.condition as Condition);
      if (test === undefined || !onlyKeys(command, ["condition", "then", "else"])) return w.cmd(depth, command);
      w.translated += 1;
      w.line(depth, `if (${test}) {`);
      writeList(w, c.then as Command[], depth + 1, inLoop);
      if (Array.isArray(c.else) && c.else.length) {
        w.line(depth, "} else {");
        writeList(w, c.else as Command[], depth + 1, inLoop);
      }
      w.line(depth, "}");
      return;
    }
    case "loop": {
      if (branchHasLabels(c.body as Command[]) || !onlyKeys(command, ["body"])) return w.cmd(depth, command);
      w.translated += 1;
      return writeBlock(w, "while (true)", c.body as Command[], depth, true);
    }
    case "breakLoop":
      if (!inLoop) return w.cmd(depth, command);
      w.translated += 1;
      return w.line(depth, "break;");
    case "setSwitch": {
      if (typeof c.switchId !== "string" || !onlyKeys(command, ["switchId", "value"])) return w.cmd(depth, command);
      if (typeof c.value === "boolean") { w.translated += 1; return w.line(depth, `game.setSwitch(${q(c.switchId)}, ${c.value});`); }
      if (c.value === "toggle") { w.translated += 1; return w.line(depth, `game.setSwitch(${q(c.switchId)}, !game.getSwitch(${q(c.switchId)}));`); }
      return w.cmd(depth, command);
    }
    case "setSelfSwitch":
      if (typeof c.key !== "string" || typeof c.value !== "boolean" || !onlyKeys(command, ["key", "value"])) return w.cmd(depth, command);
      w.translated += 1;
      return w.line(depth, `game.setSelfSwitch(${q(c.key)}, ${c.value});`);
    case "setVariable": {
      const value = operand(c.value);
      if (typeof c.variableId !== "string" || value === undefined || !onlyKeys(command, ["variableId", "op", "value"])) return w.cmd(depth, command);
      const id = q(c.variableId);
      if (c.op === "=") { w.translated += 1; return w.line(depth, `game.setVar(${id}, ${value});`); }
      if (c.op === "+=") { w.translated += 1; return w.line(depth, `game.addVar(${id}, ${value});`); }
      if (c.op === "-=") { w.translated += 1; return w.line(depth, `game.addVar(${id}, ${negate(value)});`); }
      if (c.op === "*=") { w.translated += 1; return w.line(depth, `game.setVar(${id}, game.getVar(${id}) * ${value});`); }
      return w.cmd(depth, command);
    }
    case "changeGold": {
      const value = operand(c.amount);
      if (value === undefined || !onlyKeys(command, ["op", "amount"])) return w.cmd(depth, command);
      if (c.op === "+=") { w.translated += 1; return w.line(depth, `game.addGold(${value});`); }
      if (c.op === "-=") { w.translated += 1; return w.line(depth, `game.addGold(${negate(value)});`); }
      return w.cmd(depth, command);
    }
    case "changeItem": {
      const value = operand(c.amount);
      if (typeof c.itemId !== "string" || value === undefined || c.op !== "+=" || !onlyKeys(command, ["itemId", "op", "amount"])) return w.cmd(depth, command);
      w.translated += 1;
      return w.line(depth, `game.addItem(${q(c.itemId)}, ${value});`);
    }
    case "wait": {
      if (!isNum(c.ms) || !onlyKeys(command, ["ms"])) return w.cmd(depth, command);
      const frames = (c.ms * 60) / 1000;
      if (!Number.isInteger(frames)) return w.cmd(depth, command);
      w.translated += 1;
      return w.line(depth, `await game.wait(${frames});`);
    }
    case "transfer": {
      if (typeof c.mapId !== "string" || !isNum(c.x) || !isNum(c.y) || !onlyKeys(command, ["mapId", "x", "y", "direction", "fade"])) return w.cmd(depth, command);
      const opts: string[] = [];
      if (typeof c.direction === "string") opts.push(`direction: ${q(c.direction)}`);
      if (typeof c.fade === "string") opts.push(`fade: ${q(c.fade)}`);
      w.translated += 1;
      return w.line(depth, `await game.transfer(${q(c.mapId)}, ${c.x}, ${c.y}${opts.length ? `, { ${opts.join(", ")} }` : ""}); // ends the event`);
    }
    case "callCommonEvent":
      if (typeof c.commonEventId !== "string" || !onlyKeys(command, ["commonEventId"])) return w.cmd(depth, command);
      w.translated += 1;
      return w.line(depth, `await game.callCommonEvent(${q(c.commonEventId)});`);
    case "battleProcessing": {
      const allowed = ["troopId", "canEscape", "canLose", "branchOnResult", "victoryBranch", "defeatBranch", "escapeBranch"];
      if (typeof c.troopId !== "string" || !onlyKeys(command, allowed)) return w.cmd(depth, command);
      const opts = [`canEscape: ${c.canEscape === true}`, `canLose: ${c.canLose === true}`].join(", ");
      w.translated += 1;
      const branches = c.branchOnResult === true
        ? ([["victory", c.victoryBranch], ["defeat", c.defeatBranch], ["escape", c.escapeBranch]] as const).filter(([, body]) => Array.isArray(body) && body.length > 0)
        : [];
      if (!branches.length) return w.line(depth, `await game.battle(${q(c.troopId)}, { ${opts} });`);
      const name = w.name("result");
      w.line(depth, `const ${name} = await game.battle(${q(c.troopId)}, { ${opts} });`);
      branches.forEach(([result, body], index) => {
        w.line(depth, `${index === 0 ? "if" : "} else if"} (${name} === ${q(result)}) {`);
        writeList(w, body as Command[], depth + 1, inLoop);
      });
      w.line(depth, "}");
      return;
    }
    case "script": {
      // An existing script inlines as code: @lib imports hoist to the top, the rest goes in its own block.
      const source = typeof c.source === "string" ? c.source : "";
      const body: string[] = [];
      for (const line of source.split("\n")) {
        if (IMPORT_LINE.test(line)) w.imports.add(line.trim());
        else body.push(line);
      }
      w.translated += 1;
      w.line(depth, `{ // script${typeof c.name === "string" && c.name ? ` "${c.name}"` : ""}`);
      for (const line of body) w.line(depth + 1, line);
      w.line(depth, "}");
      return;
    }
    default:
      return w.cmd(depth, command);
  }
}

/** Converts a command list to a TypeScript script against the game API. */
export function commandsToScript(commands: readonly Command[], header: readonly string[] = []): EventToScriptResult {
  const w = new Writer();
  writeList(w, commands, 0, false);
  const lines = [
    ...header.map((line) => `// ${line}`),
    ...w.imports,
    ...(w.imports.size ? [""] : []),
    ...w.lines,
  ];
  return {
    source: `${lines.join("\n")}\n`,
    translated: w.translated,
    passthrough: w.passthrough,
    passthroughKinds: [...w.kinds].sort(),
  };
}
