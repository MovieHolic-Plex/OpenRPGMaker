// editor/script/scriptToEvent.ts — TypeScript script → ordinary event commands ("명령으로 풀기").
//
// The reverse of eventToScript.ts, for a convertible subset only: the converter returns commands ONLY when
// they behave exactly like the script, otherwise a list of problems (line + stable code). It never guesses.
// The subset and the codes are documented in openwiki/script-sandbox.md 「스크립트 → 명령」.
//
// Equivalence comes from the runtime itself where possible: game calls with literal arguments are handed to
// the real `HOST_API` row (src/player/script/hostApi.ts) with a fake context — awaited calls return their
// command plan, sync writes are captured from the throwaway-frame `executeCommand` they would run. So a
// converted `game.addGold(-5)` is exactly the `changeGold` the script would have executed. Shapes the host
// builds around results (choices + `if (choice === i)`, battle + result branches, conditions) are mapped by
// hand to the command form that branches the same way.
//
// Sync, but needs the TypeScript parser: call `prepareScriptCompiler()` (compile.ts / tsEnv.ts) first.
import { HOST_API, type HostContext } from "@/player/script/hostApi";
import type { CommandExecution, Frame, InterpreterState } from "@/player/interpreter/types";
import { SCRIPT_API_BY_NAME } from "@/project/script/apiSpec";
import { resolveTimeSystem } from "@/project/gameTime";
import type { Command, Condition, Project } from "@/project/types";
import { scriptTs, type TypeScriptApi } from "./tsEnv";
import type * as TS from "typescript5";

/** Stable problem codes (see PROBLEM_TEXT). */
export type ScriptUnwrapProblemCode = string;

export interface ScriptUnwrapProblem {
  /** 1-based source line. */
  readonly line: number;
  readonly code: ScriptUnwrapProblemCode;
  /** The offending source line (trimmed, at most 80 characters). */
  readonly snippet: string;
}

export type ScriptUnwrapResult =
  | { readonly ok: true; readonly commands: Command[] }
  | { readonly ok: false; readonly problems: readonly ScriptUnwrapProblem[] };

export interface ScriptUnwrapOptions {
  /** Resolves switch/variable display names to ids like the runtime does, checks common event ids and the time system. */
  readonly project?: Project;
}

// ── problem texts ────────────────────────────────────────────────────────────
// ko = fixed literals (the DOM i18n catalog translates them; key = the Korean text), en = model-facing.

const PROBLEM_TEXT: Readonly<Record<string, { readonly ko: string; readonly en: string }>> = {
  syntax: { ko: "문법 오류가 있습니다", en: "The script has a syntax error." },
  import: { ko: "공용 모듈(@lib)을 가져옵니다", en: "Imports a library module (@lib)." },
  function: { ko: "함수를 만듭니다", en: "Defines a function." },
  "local-variable": { ko: "고정 값이 아닌 지역 변수를 씁니다", en: "Uses a local variable that is not a fixed literal value." },
  array: { ko: "배열이나 목록 칸을 씁니다", en: "Uses an array or indexes into a list." },
  formula: { ko: "계산식을 씁니다", en: "Computes a value with a formula." },
  condition: { ko: "명령의 조건으로 옮길 수 없는 조건입니다", en: "The condition has no event-command condition equivalent." },
  "loop-form": { ko: "while (true) 와 break 말고 다른 반복을 씁니다", en: "Uses a loop form other than while (true) with break." },
  "control-flow": { ko: "switch·try·continue 같은 흐름 제어를 씁니다", en: "Uses switch, try/catch, continue, labels or throw." },
  return: { ko: "return 으로 중간에 끝냅니다", en: "Ends early with return." },
  "dynamic-id": { ko: "id 를 계산해서 씁니다", en: "Computes an id instead of naming it literally." },
  "template-substitution": { ko: "글 안에 ${…} 로 값을 끼워 넣습니다", en: "Builds text with ${…} substitutions." },
  "unsupported-call": { ko: "같은 동작의 명령이 없는 호출입니다", en: "Calls something with no exact event-command equivalent." },
  random: { ko: "난수를 씁니다", en: "Uses random numbers." },
  "state-read": { ko: "게임 상태를 읽어 값으로 씁니다", en: "Reads game state into a value." },
  "choice-use": { ko: "선택지·전투 결과를 바로 뒤 if 말고 다른 곳에서 씁니다", en: "Uses a choice or battle result other than in the if chain right after it." },
  "other-event-self-switch": { ko: "다른 이벤트의 셀프 스위치를 씁니다", en: "Uses another event's self switch." },
  "missing-await": { ko: "기다리는 호출을 await 없이 부릅니다", en: "Calls a waiting game function without await." },
  "invalid-argument": { ko: "실행하면 오류가 나는 인자입니다", en: "These arguments make the call fail when it runs." },
  "invalid-command": { ko: "game.cmd 의 명령이 올바르지 않습니다", en: "The game.cmd object is not a valid event command." },
  "this-target": { ko: "'this' 대상은 이 명령으로 옮길 수 없습니다", en: "'this' as the target has no event-command equivalent for this call." },
  "implicit-map": { ko: "mapId 없는 setTile 은 지금 맵에 따라 달라집니다", en: "setTile without options.mapId depends on the current map." },
  other: { ko: "명령으로 바꿀 수 없는 문장입니다", en: "This statement has no event-command equivalent." },
};

/** All codes scriptToCommands can return. */
export const SCRIPT_UNWRAP_PROBLEM_CODES: readonly string[] = Object.keys(PROBLEM_TEXT);

/** Short plain-language reason. ko = fixed literal per code (the DOM i18n catalog translates it), en for the model. */
export function scriptUnwrapProblemText(problem: ScriptUnwrapProblem, lang: "ko" | "en"): string {
  const text = PROBLEM_TEXT[problem.code] ?? PROBLEM_TEXT.other!;
  return text[lang];
}

// ── runtime mirrors ──────────────────────────────────────────────────────────

/** Fake event id handed to the host as currentEventId, so 'this' targets are recognisable in plans. */
const THIS_EVENT = "\u0000this-event";

/** Sync game calls that write state through exactly one executeCommand (captured, not run). */
const CAPTURED_WRITES = new Set([
  "setSwitch", "setVar", "addVar", "addGold", "addItem", "addToParty", "removeFromParty",
  "gainExp", "setLevel", "setHp", "setMp", "recoverAll", "learnSkill",
]);
/** Awaited game calls whose plan is a fixed command list with no result value. */
const PLANNED_CALLS = new Set([
  "showMessage", "wait", "transfer", "moveEvent", "setTile", "playBgm", "playSe", "stopBgm",
  "shake", "flash", "fadeOut", "fadeIn", "showAnimation", "showEmote", "cmd",
]);
/** Game calls that only read state. */
const READ_CALLS = new Set([
  "getSwitch", "getVar", "getText", "getSelfSwitch", "gold", "itemCount", "hasItem", "party", "actor",
  "player", "mapId", "eventId", "events", "event", "eventAt", "tileAt", "passable", "time", "playTime",
]);

/** Same as hostApi resolveDefId: an exact display name resolves to its id. */
function resolveDefId(list: readonly { id: string; name: string }[] | undefined, value: string): string {
  if (!list || list.some((entry) => entry.id === value)) return value;
  return list.find((entry) => entry.name === value)?.id ?? value;
}

function hostContext(project: Project | undefined, captured: Command[]): HostContext {
  const state = {
    project,
    stack: [] as Frame[],
    currentEventId: THIS_EVENT,
    session: { variables: {}, switches: {}, inventory: {}, selfSwitches: {}, partyActorIds: [], currentMapId: "", gold: 0 },
  } as unknown as InterpreterState;
  return {
    state,
    exec: (_state, _frame, command): CommandExecution => {
      captured.push(JSON.parse(JSON.stringify(command)) as Command);
      return { kind: "continue" };
    },
  };
}

// ── converter ────────────────────────────────────────────────────────────────

type Literal = string | number | boolean | null | undefined | Literal[] | { [key: string]: Literal };

type Binding =
  | { readonly kind: "literal"; readonly value: Literal }
  | { readonly kind: "result" } // a choice / battle result: only its own if chain may read it
  | { readonly kind: "other" };

class NotConvertible extends Error {
  constructor(readonly node: TS.Node, readonly code: string) {
    super(code);
  }
}

const COMPARE_OPS = ["==", "!=", ">=", "<=", ">", "<"] as const;
type CompareOp = (typeof COMPARE_OPS)[number];
const FLIPPED: Readonly<Record<CompareOp, CompareOp>> = { "==": "==", "!=": "!=", ">=": "<=", "<=": ">=", ">": "<", "<": ">" };

class Converter {
  readonly problems: ScriptUnwrapProblem[] = [];
  private readonly scopes: Map<string, Binding>[] = [];
  private loopDepth = 0;

  constructor(
    private readonly ts: TypeScriptApi,
    private readonly file: TS.SourceFile,
    private readonly project: Project | undefined,
  ) {}

  report(node: TS.Node, code: string): void {
    const start = node.getStart(this.file);
    const line = this.file.getLineAndCharacterOfPosition(start).line;
    const text = (this.file.text.split("\n")[line] ?? "").trim();
    if (this.problems.some((problem) => problem.line === line + 1 && problem.code === code)) return;
    this.problems.push({ line: line + 1, code, snippet: text.length > 80 ? `${text.slice(0, 79)}…` : text });
  }

  // ── statements ──

  list(statements: readonly TS.Statement[]): Command[] {
    this.scopes.push(new Map());
    const out: Command[] = [];
    for (let index = 0; index < statements.length; index += 1) {
      const statement = statements[index]!;
      try {
        index += this.statement(statement, statements[index + 1], out);
      } catch (error) {
        if (!(error instanceof NotConvertible)) throw error;
        this.report(error.node, error.code);
      }
    }
    this.scopes.pop();
    return out;
  }

  /** Converts one statement into `out`. Returns how many FOLLOWING statements it consumed (0 or 1). */
  private statement(node: TS.Statement, next: TS.Statement | undefined, out: Command[]): number {
    const ts = this.ts;
    if (ts.isEmptyStatement(node)) return 0;
    if (ts.isBlock(node)) {
      out.push(...this.list(node.statements));
      return 0;
    }
    if (ts.isImportDeclaration(node) || ts.isImportEqualsDeclaration(node)) throw new NotConvertible(node, "import");
    if (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) throw new NotConvertible(node, "function");
    if (ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node)) return 0; // types do nothing at run time
    if (ts.isVariableStatement(node)) return this.variableStatement(node, next, out);
    if (ts.isExpressionStatement(node)) {
      out.push(...this.expressionStatement(node.expression));
      return 0;
    }
    if (ts.isIfStatement(node)) {
      out.push(this.fork(node));
      return 0;
    }
    if (ts.isWhileStatement(node)) {
      if (node.expression.kind !== ts.SyntaxKind.TrueKeyword) throw new NotConvertible(node, "loop-form");
      this.loopDepth += 1;
      try {
        out.push({ kind: "loop", body: this.body(node.statement) } as Command);
      } finally {
        this.loopDepth -= 1;
      }
      return 0;
    }
    if (ts.isBreakStatement(node)) {
      if (node.label || this.loopDepth === 0) throw new NotConvertible(node, "loop-form");
      out.push({ kind: "breakLoop" } as Command);
      return 0;
    }
    if (ts.isForStatement(node) || ts.isForOfStatement(node) || ts.isForInStatement(node) || ts.isDoStatement(node)) {
      throw new NotConvertible(node, "loop-form");
    }
    if (ts.isReturnStatement(node)) throw new NotConvertible(node, "return");
    if (ts.isContinueStatement(node) || ts.isSwitchStatement(node) || ts.isTryStatement(node) || ts.isThrowStatement(node) || ts.isLabeledStatement(node)) {
      throw new NotConvertible(node, "control-flow");
    }
    throw new NotConvertible(node, "other");
  }

  private body(node: TS.Statement): Command[] {
    return this.ts.isBlock(node) ? this.list(node.statements) : this.list([node]);
  }

  private bind(name: string, binding: Binding): void {
    this.scopes[this.scopes.length - 1]!.set(name, binding);
  }

  private lookup(name: string): Binding | undefined {
    for (let index = this.scopes.length - 1; index >= 0; index -= 1) {
      const found = this.scopes[index]!.get(name);
      if (found) return found;
    }
    return undefined;
  }

  private variableStatement(node: TS.VariableStatement, next: TS.Statement | undefined, out: Command[]): number {
    const ts = this.ts;
    const list = node.declarationList;
    if (!(list.flags & ts.NodeFlags.Const)) throw new NotConvertible(node, "local-variable");
    if (list.declarations.length === 1) {
      const declaration = list.declarations[0]!;
      const init = declaration.initializer ? this.unwrap(declaration.initializer) : undefined;
      const call = init && ts.isAwaitExpression(init) ? this.gameCall(init.expression) : undefined;
      if (call && ts.isIdentifier(declaration.name) && (call.name === "showChoices" || call.name === "battle")) {
        const name = declaration.name.text;
        const chain = next && ts.isIfStatement(next) && this.testsResult(next.expression, name) ? next : undefined;
        this.bind(name, { kind: "result" });
        out.push(call.name === "showChoices" ? this.choices(call, name, chain) : this.battle(call, name, chain));
        return chain ? 1 : 0;
      }
    }
    for (const declaration of list.declarations) {
      if (!ts.isIdentifier(declaration.name) || !declaration.initializer) throw new NotConvertible(declaration, "local-variable");
      const init = this.unwrap(declaration.initializer);
      if (ts.isArrowFunction(init) || ts.isFunctionExpression(init) || ts.isClassExpression(init)) throw new NotConvertible(declaration, "function");
      if (ts.isArrayLiteralExpression(init)) throw new NotConvertible(declaration, "array");
      if (ts.isObjectLiteralExpression(init)) throw new NotConvertible(declaration, "local-variable");
      const value = this.literal(init, "value");
      if (value !== null && typeof value === "object") throw new NotConvertible(declaration, "local-variable");
      this.bind(declaration.name.text, { kind: "literal", value });
    }
    return 0;
  }

  // ── expression statements: game calls ──

  private expressionStatement(expression: TS.Expression): Command[] {
    const ts = this.ts;
    const inner = this.unwrap(expression);
    if (ts.isAwaitExpression(inner)) {
      const call = this.gameCall(inner.expression);
      if (!call) throw new NotConvertible(inner, this.expressionCode(inner.expression, "value"));
      return this.callCommands(call, true);
    }
    const call = this.gameCall(inner);
    if (call) return this.callCommands(call, false);
    if (ts.isBinaryExpression(inner) && inner.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && inner.operatorToken.kind <= ts.SyntaxKind.LastAssignment) {
      throw new NotConvertible(inner, "local-variable");
    }
    if ((ts.isPrefixUnaryExpression(inner) || ts.isPostfixUnaryExpression(inner))
      && (inner.operator === ts.SyntaxKind.PlusPlusToken || inner.operator === ts.SyntaxKind.MinusMinusToken)) {
      throw new NotConvertible(inner, "local-variable");
    }
    throw new NotConvertible(inner, ts.isCallExpression(inner) ? this.expressionCode(inner, "value") : "other");
  }

  private callCommands(call: GameCall, awaited: boolean): Command[] {
    const entry = SCRIPT_API_BY_NAME.get(call.name);
    if (!entry) throw new NotConvertible(call.node, "unsupported-call");
    if (entry.awaits && !awaited) throw new NotConvertible(call.node, "missing-await");
    switch (call.name) {
      case "showChoices":
        return [this.choices(call, undefined, undefined)];
      case "battle":
        return [this.battle(call, undefined, undefined)];
      case "callCommonEvent": {
        const id = this.stringArg(call, 0);
        if (this.project && !this.project.commonEvents.some((common) => common.id === id)) throw new NotConvertible(call.node, "invalid-argument");
        return [{ kind: "callCommonEvent", commonEventId: id } as Command];
      }
      case "setSelfSwitch": {
        if (call.args.length > 2 && this.literal(call.args[2]!, "id") !== undefined) throw new NotConvertible(call.node, "other-event-self-switch");
        const key = this.literal(call.args[0] ?? call.node, "id");
        const value = this.literal(call.args[1] ?? call.node, "value");
        if (typeof key !== "string" || !["A", "B", "C", "D"].includes(key) || typeof value !== "boolean") throw new NotConvertible(call.node, "invalid-argument");
        return [{ kind: "setSelfSwitch", key, value } as Command];
      }
      case "setSwitch": {
        const toggle = this.toggleOf(call);
        if (toggle) return [toggle];
        break;
      }
      case "setVar":
      case "addVar": {
        const operand = this.variableOperand(call);
        if (operand) return [operand];
        break;
      }
      case "random":
        throw new NotConvertible(call.node, "random");
      default:
        break;
    }
    if (READ_CALLS.has(call.name)) throw new NotConvertible(call.node, "state-read");
    if (CAPTURED_WRITES.has(call.name)) return this.runHost(call, false);
    if (PLANNED_CALLS.has(call.name)) return this.runHost(call, true);
    throw new NotConvertible(call.node, "unsupported-call");
  }

  /** Runs the real HOST_API row with literal arguments and returns the command(s) the script would run. */
  private runHost(call: GameCall, planned: boolean): Command[] {
    const entry = SCRIPT_API_BY_NAME.get(call.name)!;
    const idArgs = new Set((entry.refs ?? []).map((ref) => ref.arg));
    const args = call.args.map((arg, index) => this.literal(arg, idArgs.has(index) ? "id" : "value"));
    const captured: Command[] = [];
    const ctx = hostContext(this.project, captured);
    let commands: Command[];
    try {
      const impl = HOST_API[call.name as keyof typeof HOST_API] as (ctx: HostContext, args: readonly unknown[]) => unknown;
      const result = impl(ctx, args);
      if (planned) {
        const plan = result as { commands: Command[]; result?: unknown };
        if (plan.result) throw new NotConvertible(call.node, "unsupported-call");
        commands = JSON.parse(JSON.stringify(plan.commands)) as Command[];
      } else {
        commands = captured;
        // addVar(x, -n) runs `+= -n`; the command form of the same change is `-= n`.
        for (const command of commands) {
          const change = command as { kind: string; op?: string; value?: unknown };
          if (change.kind === "setVariable" && change.op === "+=" && typeof change.value === "number" && change.value < 0) {
            change.op = "-=";
            change.value = -change.value;
          }
        }
      }
    } catch (error) {
      if (error instanceof NotConvertible) throw error;
      throw new NotConvertible(call.node, call.name === "cmd" ? "invalid-command" : "invalid-argument");
    }
    if (!commands.length) throw new NotConvertible(call.node, "unsupported-call");
    if (call.name === "setTile" && !(args[3] && typeof args[3] === "object" && typeof (args[3] as Record<string, unknown>).mapId === "string" && (args[3] as Record<string, unknown>).mapId)) {
      throw new NotConvertible(call.node, "implicit-map");
    }
    const text = JSON.stringify(commands);
    if (text.includes(JSON.stringify(THIS_EVENT).slice(1, -1))) {
      // moveEvent's "" already means "this event"; the other commands have no self target.
      if (call.name !== "moveEvent") throw new NotConvertible(call.node, "this-target");
      for (const command of commands) {
        const move = command as { eventId?: string };
        if (move.eventId === THIS_EVENT) move.eventId = "";
      }
    }
    return commands;
  }

  /** `game.setSwitch(x, !game.getSwitch(x))` → toggle. */
  private toggleOf(call: GameCall): Command | undefined {
    const value = call.args[1] ? this.unwrap(call.args[1]) : undefined;
    if (!value || !this.ts.isPrefixUnaryExpression(value) || value.operator !== this.ts.SyntaxKind.ExclamationToken) return undefined;
    const read = this.gameCall(value.operand);
    if (!read || read.name !== "getSwitch") return undefined;
    const id = this.switchId(this.stringArg(call, 0));
    if (this.switchId(this.stringArg(read, 0)) !== id) throw new NotConvertible(call.node, "formula");
    return { kind: "setSwitch", switchId: id, value: "toggle" } as unknown as Command;
  }

  /** setVar/addVar whose value reads a variable: `getVar(y)`, `-(getVar(y))`, `getVar(x) * n|getVar(y)`. */
  private variableOperand(call: GameCall): Command | undefined {
    const ts = this.ts;
    const raw = call.args[1] ? this.unwrap(call.args[1]) : undefined;
    if (!raw) return undefined;
    const id = (): string => this.variableId(this.stringArg(call, 0));
    const varRead = (node: TS.Expression): { kind: "var"; id: string } | undefined => {
      const read = this.gameCall(this.unwrap(node));
      return read && read.name === "getVar" ? { kind: "var", id: this.variableId(this.stringArg(read, 0)) } : undefined;
    };
    const direct = varRead(raw);
    if (direct) return { kind: "setVariable", variableId: id(), op: call.name === "setVar" ? "=" : "+=", value: direct } as Command;
    if (call.name === "addVar" && ts.isPrefixUnaryExpression(raw) && raw.operator === ts.SyntaxKind.MinusToken) {
      const negated = varRead(raw.operand);
      if (negated) return { kind: "setVariable", variableId: id(), op: "-=", value: negated } as Command;
    }
    if (call.name === "setVar" && ts.isBinaryExpression(raw) && raw.operatorToken.kind === ts.SyntaxKind.AsteriskToken) {
      const left = varRead(raw.left);
      if (!left) return undefined;
      if (left.id !== id()) throw new NotConvertible(call.node, "formula");
      const right = varRead(raw.right);
      if (right) return { kind: "setVariable", variableId: left.id, op: "*=", value: right } as Command;
      const factor = this.literal(raw.right, "value");
      if (typeof factor !== "number" || !Number.isInteger(factor)) throw new NotConvertible(call.node, "formula");
      return { kind: "setVariable", variableId: left.id, op: "*=", value: factor } as Command;
    }
    return undefined;
  }

  // ── choices and battles ──

  /** True when an if statement's test compares `name` with a literal. */
  private testsResult(test: TS.Expression, name: string): boolean {
    return this.resultArm(test, name) !== undefined;
  }

  private resultArm(test: TS.Expression, name: string): Literal | undefined {
    const ts = this.ts;
    const node = this.unwrap(test);
    if (!ts.isBinaryExpression(node)) return undefined;
    const op = node.operatorToken.kind;
    if (op !== ts.SyntaxKind.EqualsEqualsEqualsToken && op !== ts.SyntaxKind.EqualsEqualsToken) return undefined;
    const isName = (side: TS.Expression): boolean => {
      const inner = this.unwrap(side);
      return ts.isIdentifier(inner) && inner.text === name;
    };
    const other = isName(node.left) ? node.right : isName(node.right) ? node.left : undefined;
    if (!other) return undefined;
    try {
      const value = this.literal(other, "value");
      return typeof value === "number" || typeof value === "string" ? value : undefined;
    } catch {
      return undefined;
    }
  }

  /** Walks `if (name === a) {…} else if (name === b) {…}`; a final plain else is not convertible. */
  private resultChain(chain: TS.IfStatement | undefined, name: string, allowed: readonly Literal[]): Map<Literal, Command[]> {
    const arms = new Map<Literal, Command[]>();
    let node: TS.IfStatement | undefined = chain;
    while (node) {
      const value = this.resultArm(node.expression, name);
      if (value === undefined || !allowed.includes(value) || arms.has(value)) throw new NotConvertible(node.expression, "choice-use");
      arms.set(value, this.body(node.thenStatement));
      const otherwise: TS.Statement | undefined = node.elseStatement;
      if (!otherwise) break;
      if (!this.ts.isIfStatement(otherwise)) throw new NotConvertible(otherwise, "choice-use");
      node = otherwise;
    }
    return arms;
  }

  private choices(call: GameCall, name: string | undefined, chain: TS.IfStatement | undefined): Command {
    const args = call.args.map((arg) => this.literal(arg, "value"));
    let plan: { commands: Command[] };
    try {
      plan = HOST_API.showChoices(hostContext(this.project, []), args);
    } catch {
      throw new NotConvertible(call.node, "invalid-argument");
    }
    const shown = plan.commands[0] as unknown as { prompt?: string; options: { text: string }[]; cancelBehavior: string };
    const indices: Literal[] = shown.options.map((_, index) => index);
    if (shown.cancelBehavior === "branch") indices.push(-1);
    const arms = name ? this.resultChain(chain, name, indices) : new Map<Literal, Command[]>();
    return {
      kind: "choices",
      ...(shown.prompt ? { prompt: shown.prompt } : {}),
      options: shown.options.map((option, index) => ({ text: option.text, branch: arms.get(index) ?? [] })),
      // An absent cancelBehavior behaves like "disallow" (choiceCancellation.ts).
      ...(shown.cancelBehavior !== "disallow" ? { cancelBehavior: shown.cancelBehavior } : {}),
      ...(shown.cancelBehavior === "branch" ? { cancelBranch: arms.get(-1) ?? [] } : {}),
    } as unknown as Command;
  }

  private battle(call: GameCall, name: string | undefined, chain: TS.IfStatement | undefined): Command {
    const entry = SCRIPT_API_BY_NAME.get("battle")!;
    const idArgs = new Set((entry.refs ?? []).map((ref) => ref.arg));
    const args = call.args.map((arg, index) => this.literal(arg, idArgs.has(index) ? "id" : "value"));
    let base: Command;
    try {
      base = HOST_API.battle(hostContext(this.project, []), args).commands[0]!;
    } catch {
      throw new NotConvertible(call.node, "invalid-argument");
    }
    const arms = name && chain ? this.resultChain(chain, name, ["victory", "defeat", "escape"]) : new Map<Literal, Command[]>();
    if (!arms.size) return base;
    return {
      ...base,
      branchOnResult: true,
      ...(arms.has("victory") ? { victoryBranch: arms.get("victory") } : {}),
      ...(arms.has("defeat") ? { defeatBranch: arms.get("defeat") } : {}),
      ...(arms.has("escape") ? { escapeBranch: arms.get("escape") } : {}),
    } as Command;
  }

  // ── if / conditions ──

  private fork(node: TS.IfStatement): Command {
    const condition = this.condition(node.expression);
    const then = this.body(node.thenStatement);
    const otherwise = node.elseStatement ? this.body(node.elseStatement) : undefined;
    return { kind: "fork", condition, then, ...(otherwise ? { else: otherwise } : {}) } as Command;
  }

  condition(expression: TS.Expression): Condition {
    const ts = this.ts;
    const node = this.unwrapTypes(expression);
    if (ts.isParenthesizedExpression(node)) return this.condition(node.expression);
    if (ts.isBinaryExpression(node)) {
      const op = node.operatorToken.kind;
      if (op === ts.SyntaxKind.AmpersandAmpersandToken || op === ts.SyntaxKind.BarBarToken) {
        const kind = op === ts.SyntaxKind.AmpersandAmpersandToken ? "all" : "any";
        const parts: Condition[] = [];
        const collect = (side: TS.Expression): void => {
          const inner = this.unwrapTypes(side);
          if (ts.isBinaryExpression(inner) && inner.operatorToken.kind === op) {
            collect(inner.left);
            collect(inner.right);
          } else parts.push(this.condition(side));
        };
        collect(node);
        return { kind, conditions: parts } as Condition;
      }
      const compare = this.compareOp(op);
      if (compare) return this.comparison(node, compare);
      throw new NotConvertible(node, this.expressionCode(node, "value"));
    }
    if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.ExclamationToken) {
      const inner = this.condition(node.operand);
      const leaf = inner as Record<string, unknown>;
      const operand = this.unwrapTypes(node.operand);
      if (!ts.isParenthesizedExpression(operand)) {
        if ((inner.kind === "switch" || inner.kind === "selfSwitch") && leaf.value === true) return { ...inner, value: false } as Condition;
        if ((inner.kind === "item" || inner.kind === "actor") && leaf.present === true) return { ...inner, present: false } as Condition;
      }
      return { kind: "not", condition: inner } as Condition;
    }
    const call = this.gameCall(node);
    if (call) {
      switch (call.name) {
        case "getSwitch":
          return { kind: "switch", switchId: this.switchId(this.stringArg(call, 0)), value: true };
        case "getSelfSwitch": {
          if (call.args.length > 1 && this.literal(call.args[1]!, "id") !== undefined) throw new NotConvertible(call.node, "other-event-self-switch");
          const key = this.stringArg(call, 0);
          if (!["A", "B", "C", "D"].includes(key)) throw new NotConvertible(call.node, "invalid-argument");
          return { kind: "selfSwitch", key: key as "A", value: true };
        }
        case "hasItem": {
          const count = call.args[1] ? this.literal(call.args[1], "value") : 1;
          // hasItem(id, n) = at least max(1, trunc(n)); the item condition is "at least one".
          if (count !== undefined && count !== null && (typeof count !== "number" || Math.max(1, Math.trunc(count)) !== 1)) {
            throw new NotConvertible(call.node, "condition");
          }
          return { kind: "item", itemId: this.stringArg(call, 0), present: true };
        }
        default:
          break;
      }
    }
    const includes = this.partyIncludes(node);
    if (includes) return { kind: "actor", actorId: includes, present: true };
    throw new NotConvertible(node, call ? (call.name === "random" ? "random" : "condition") : this.expressionCode(node, "value"));
  }

  private compareOp(kind: TS.SyntaxKind): CompareOp | undefined {
    const k = this.ts.SyntaxKind;
    switch (kind) {
      case k.EqualsEqualsEqualsToken:
      case k.EqualsEqualsToken:
        return "==";
      case k.ExclamationEqualsEqualsToken:
      case k.ExclamationEqualsToken:
        return "!=";
      case k.GreaterThanEqualsToken:
        return ">=";
      case k.LessThanEqualsToken:
        return "<=";
      case k.GreaterThanToken:
        return ">";
      case k.LessThanToken:
        return "<";
      default:
        return undefined;
    }
  }

  /** `<query> <op> <literal>` (either side) → variable / gold / item / switch / timePhase condition. */
  private comparison(node: TS.BinaryExpression, op: CompareOp): Condition {
    const ts = this.ts;
    let query = this.unwrapTypes(node.left);
    let other = node.right;
    let compare = op;
    if (!this.isQuery(query)) {
      query = this.unwrapTypes(node.right);
      other = node.left;
      compare = FLIPPED[op];
    }
    if (!this.isQuery(query)) {
      const leftIsLiteral = (() => {
        try {
          this.literal(node.left, "value");
          return true;
        } catch {
          return false;
        }
      })();
      const code = this.expressionCode(leftIsLiteral ? node.right : node.left, "value");
      throw new NotConvertible(node, code === "other" ? "condition" : code);
    }
    const value = this.literal(other, "value");
    // game.time().phase === "night"
    if (ts.isPropertyAccessExpression(query)) {
      if (typeof value !== "string" || (compare !== "==" && compare !== "!=")) throw new NotConvertible(node, "condition");
      // Without a time system the script sees phase "day" but the command condition is false: only a project
      // with a time system makes "day" equivalent; other phases are false either way.
      if (!["morning", "day", "evening", "night"].includes(value)) throw new NotConvertible(node, "condition");
      if (value === "day" && !(this.project && resolveTimeSystem(this.project))) throw new NotConvertible(node, "condition");
      const leaf = { kind: "timePhase", phase: value } as Condition;
      return compare === "==" ? leaf : ({ kind: "not", condition: leaf } as Condition);
    }
    const call = this.gameCall(query)!;
    if (call.name === "getSwitch") {
      if (typeof value !== "boolean" || (compare !== "==" && compare !== "!=")) throw new NotConvertible(node, "condition");
      return { kind: "switch", switchId: this.switchId(this.stringArg(call, 0)), value: compare === "==" ? value : !value };
    }
    if (typeof value !== "number" || !Number.isFinite(value)) throw new NotConvertible(node, "condition");
    if (call.name === "getVar") return { kind: "variable", variableId: this.variableId(this.stringArg(call, 0)), op: compare, value };
    if (call.name === "gold") return { kind: "gold", op: compare, amount: value };
    // itemCount(id) compared with 0/1 = has / has not (counts are whole numbers).
    const itemId = this.stringArg(call, 0);
    const has = (compare === ">" && value === 0) || (compare === ">=" && value === 1) || (compare === "!=" && value === 0);
    const hasNot = (compare === "==" && value === 0) || (compare === "<" && value === 1) || (compare === "<=" && value === 0);
    if (!has && !hasNot) throw new NotConvertible(node, "condition");
    return { kind: "item", itemId, present: has };
  }

  private isQuery(node: TS.Expression): boolean {
    const ts = this.ts;
    if (ts.isPropertyAccessExpression(node) && node.name.text === "phase") {
      const time = this.gameCall(this.unwrapTypes(node.expression));
      return !!time && time.name === "time" && time.args.length === 0;
    }
    const call = this.gameCall(node);
    return !!call && ["getSwitch", "getVar", "gold", "itemCount"].includes(call.name);
  }

  /** `game.party().includes("id")` → the actor id. */
  private partyIncludes(node: TS.Expression): string | undefined {
    const ts = this.ts;
    if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression) || node.expression.name.text !== "includes") return undefined;
    const party = this.gameCall(this.unwrapTypes(node.expression.expression));
    if (!party || party.name !== "party" || node.arguments.length !== 1) return undefined;
    const id = this.literal(node.arguments[0]!, "id");
    if (typeof id !== "string") throw new NotConvertible(node, "dynamic-id");
    return id;
  }

  // ── literals ──

  private unwrapTypes(node: TS.Expression): TS.Expression {
    const ts = this.ts;
    let current = node;
    while (ts.isAsExpression(current) || ts.isSatisfiesExpression(current) || ts.isNonNullExpression(current) || ts.isTypeAssertionExpression(current)) {
      current = current.expression;
    }
    return current;
  }

  private unwrap(node: TS.Expression): TS.Expression {
    const ts = this.ts;
    let current = this.unwrapTypes(node);
    while (ts.isParenthesizedExpression(current)) current = this.unwrapTypes(current.expression);
    return current;
  }

  /** A compile-time literal (folding top-level/blocked `const` literals). Throws NotConvertible otherwise. */
  literal(expression: TS.Expression, role: "id" | "value"): Literal {
    const ts = this.ts;
    const node = this.unwrap(expression);
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    if (ts.isNumericLiteral(node)) return Number(node.text.replace(/_/gu, ""));
    if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (node.kind === ts.SyntaxKind.NullKeyword) return null;
    if (ts.isPrefixUnaryExpression(node) && (node.operator === ts.SyntaxKind.MinusToken || node.operator === ts.SyntaxKind.PlusToken)) {
      const value = this.literal(node.operand, "value");
      if (typeof value !== "number") throw new NotConvertible(node, "formula");
      return node.operator === ts.SyntaxKind.MinusToken ? -value : value;
    }
    if (ts.isIdentifier(node)) {
      if (node.text === "undefined") return undefined;
      const binding = this.lookup(node.text);
      if (binding?.kind === "literal") return binding.value;
      throw new NotConvertible(node, binding?.kind === "result" ? "choice-use" : role === "id" ? "dynamic-id" : "local-variable");
    }
    if (ts.isArrayLiteralExpression(node)) {
      return node.elements.map((element) => {
        if (ts.isSpreadElement(element) || ts.isOmittedExpression(element)) throw new NotConvertible(node, "array");
        return this.literal(element, "value");
      });
    }
    if (ts.isObjectLiteralExpression(node)) {
      const out: { [key: string]: Literal } = {};
      for (const property of node.properties) {
        if (ts.isPropertyAssignment(property) && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name) || ts.isNumericLiteral(property.name))) {
          out[property.name.text] = this.literal(property.initializer, "value");
        } else if (ts.isShorthandPropertyAssignment(property)) {
          out[property.name.text] = this.literal(property.name, "value");
        } else {
          throw new NotConvertible(property, ts.isMethodDeclaration(property) ? "function" : "dynamic-id");
        }
      }
      return out;
    }
    throw new NotConvertible(node, this.expressionCode(node, role));
  }

  /** Most specific code for a non-literal expression. */
  private expressionCode(expression: TS.Expression, role: "id" | "value"): string {
    const ts = this.ts;
    const node = this.unwrap(expression);
    if (ts.isTemplateExpression(node)) return "template-substitution";
    if (ts.isElementAccessExpression(node)) return "array";
    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) return "function";
    if (ts.isAwaitExpression(node)) return this.expressionCode(node.expression, role);
    if (ts.isCallExpression(node)) {
      const call = this.gameCall(node);
      if (call) return call.name === "random" ? "random" : READ_CALLS.has(call.name) ? "state-read" : "unsupported-call";
      const callee = node.expression;
      if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression) && callee.expression.text === "Math" && callee.name.text === "random") return "random";
      // A method on a local (list.includes(x), text.trim()) is the local's problem.
      if (ts.isPropertyAccessExpression(callee)) {
        const root = this.rootIdentifier(callee.expression);
        if (root && root !== "game" && root !== "Math" && root !== "JSON" && root !== "Number" && root !== "String") return this.expressionCode(callee.expression, role);
        if (root === "game") return this.expressionCode(callee.expression, role); // game.party().map(…), game.time().hour…
      }
      return "unsupported-call";
    }
    if (ts.isPropertyAccessExpression(node)) {
      const root = this.rootIdentifier(node.expression);
      if (root === "game") return ts.isIdentifier(node.expression) ? "unsupported-call" : "state-read";
      return root ? this.expressionCode(node.expression, role) : role === "id" ? "dynamic-id" : "other";
    }
    if (ts.isIdentifier(node)) {
      const binding = this.lookup(node.text);
      return binding?.kind === "result" ? "choice-use" : role === "id" ? "dynamic-id" : "local-variable";
    }
    if (ts.isBinaryExpression(node) || ts.isConditionalExpression(node) || ts.isPrefixUnaryExpression(node)) return role === "id" ? "dynamic-id" : "formula";
    return role === "id" ? "dynamic-id" : "other";
  }

  /** The identifier a property/call chain starts from (`a` for `a.b().c`). */
  private rootIdentifier(expression: TS.Expression): string | undefined {
    const ts = this.ts;
    let node = this.unwrap(expression);
    while (ts.isPropertyAccessExpression(node) || ts.isCallExpression(node) || ts.isElementAccessExpression(node)) node = this.unwrap(node.expression);
    return ts.isIdentifier(node) ? node.text : undefined;
  }

  // ── game calls ──

  gameCall(expression: TS.Expression): GameCall | undefined {
    const ts = this.ts;
    const node = this.unwrap(expression);
    if (!ts.isCallExpression(node) || node.questionDotToken) return undefined;
    const callee = node.expression;
    if (!ts.isPropertyAccessExpression(callee) || !ts.isIdentifier(callee.expression) || callee.expression.text !== "game" || callee.questionDotToken) return undefined;
    for (const arg of node.arguments) if (ts.isSpreadElement(arg)) throw new NotConvertible(arg, "array");
    return { name: callee.name.text, args: node.arguments, node };
  }

  private stringArg(call: GameCall, index: number): string {
    const arg = call.args[index];
    if (!arg) throw new NotConvertible(call.node, "invalid-argument");
    const value = this.literal(arg, "id");
    if (typeof value !== "string" || !value) throw new NotConvertible(arg, "invalid-argument");
    return value;
  }

  private switchId(value: string): string {
    return resolveDefId(this.project?.switches, value);
  }

  private variableId(value: string): string {
    return resolveDefId(this.project?.variables, value);
  }
}

interface GameCall {
  readonly name: string;
  readonly args: readonly TS.Expression[];
  readonly node: TS.CallExpression;
}

/**
 * Converts a script back into ordinary event commands — only when they behave exactly like the script.
 * Sync. Requires the TypeScript compiler loaded: `await prepareScriptCompiler()` (compile.ts / tsEnv.ts) first.
 */
export function scriptToCommands(source: string, options: ScriptUnwrapOptions = {}): ScriptUnwrapResult {
  const ts = scriptTs();
  const file = ts.createSourceFile("/script.ts", source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const parseDiagnostics = (file as unknown as { parseDiagnostics?: readonly TS.DiagnosticWithLocation[] }).parseDiagnostics ?? [];
  if (parseDiagnostics.length) {
    const lines = source.split("\n");
    const problems = parseDiagnostics.slice(0, 20).map((diagnostic): ScriptUnwrapProblem => {
      const line = file.getLineAndCharacterOfPosition(diagnostic.start).line;
      const text = (lines[line] ?? "").trim();
      return { line: line + 1, code: "syntax", snippet: text.length > 80 ? `${text.slice(0, 79)}…` : text };
    });
    return { ok: false, problems };
  }
  const converter = new Converter(ts, file, options.project);
  const commands = converter.list(file.statements);
  if (converter.problems.length) {
    return { ok: false, problems: [...converter.problems].sort((a, b) => a.line - b.line) };
  }
  return { ok: true, commands };
}
