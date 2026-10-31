// editor/script/scriptInsight.ts — mechanical, model-free views of a script for non-coders.
//
// The event editor's script card (panels/eventEditor/commandBodyScript.ts) shows three things that come straight
// from the code, so they can never drift from it:
//   - tunables: top-level `const NAME = <literal>` values (numbers, strings, booleans, literal lists) the author
//     can edit in place — the edit rewrites only that literal and recompiles;
//   - flow: an if/else · choices · loop tree with plain-language boxes (conditions on switches/variables/items/
//     gold/self switches/choice picks are worded; anything else shows as a short code box);
//   - chips: what the script reads/writes/calls, from the compiler's effects, with project names.
// The model-written sentence summary lives on the command (`explanation`, bound to sourceHash) — not here.
// Requires the TypeScript parser (`prepareScriptCompiler()`); pure otherwise. Wiki: openwiki/script-sandbox.md.
import { SCRIPT_API_BY_NAME } from "@/project/script/apiSpec";
import type { ScriptEffects, ScriptRef } from "@/project/script/types";
import type { Project } from "@/project/types";
import type * as TS from "typescript5";
import { scriptTs, type TypeScriptApi } from "./tsEnv";

// ── names ────────────────────────────────────────────────────────────────────

/** Plain project name for a script ref id (falls back to the id). */
export function scriptRefName(project: Project | undefined, kind: ScriptRef["kind"], id: string): string {
  if (!project) return id;
  const named = (list: readonly { id: string; name?: string }[] | undefined): string | undefined => {
    const found = list?.find((entry) => entry.id === id)?.name?.trim();
    return found || undefined;
  };
  switch (kind) {
    case "switch": return named(project.switches) ?? id;
    case "variable": return named(project.variables) ?? id;
    case "item": return named(project.database.items) ?? id;
    case "actor": return named(project.database.actors) ?? id;
    case "skill": return named(project.database.skills) ?? id;
    case "commonEvent": return named(project.commonEvents) ?? id;
    case "troop": return named(project.database.troops) ?? id;
    case "map": return named(Object.values(project.maps)) ?? id;
    case "event": {
      for (const map of Object.values(project.maps)) {
        const event = map.events.find((entry) => entry.id === id);
        if (event) return event.name?.trim() || id;
      }
      return id;
    }
    case "selfSwitch": return `셀프 스위치 ${id.split(".").pop() ?? id}`;
    default: return id;
  }
}

const KIND_LABEL: Partial<Record<ScriptRef["kind"], string>> = {
  switch: "스위치",
  variable: "변수",
  string: "글 변수",
  selfSwitch: "셀프 스위치",
  item: "아이템",
  actor: "인물",
  skill: "스킬",
  commonEvent: "공통 이벤트",
  map: "맵",
  troop: "적 그룹",
  event: "이벤트",
  resource: "자료",
  animation: "애니메이션",
  library: "공용 모듈",
};

export interface ScriptChip {
  readonly access: "read" | "write" | "call" | "dynamic";
  readonly kind: ScriptRef["kind"] | "dynamic";
  readonly id: string;
  /** "스위치 · 창고 문 열림" */
  readonly label: string;
}

/** Read / write / call chips from compiler effects, with project names. Self switches read+written show once each. */
export function scriptChips(effects: ScriptEffects | undefined, project: Project | undefined): ScriptChip[] {
  if (!effects) return [];
  const out: ScriptChip[] = [];
  const seen = new Set<string>();
  const add = (access: ScriptChip["access"], ref: ScriptRef): void => {
    const key = `${access}:${ref.kind}:${ref.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    const kindLabel = KIND_LABEL[ref.kind] ?? ref.kind;
    const name = ref.kind === "selfSwitch" ? (ref.id.split(".").pop() ?? ref.id) : ref.kind === "library" ? `@lib/${ref.id}` : scriptRefName(project, ref.kind, ref.id);
    out.push({ access, kind: ref.kind, id: ref.id, label: `${kindLabel} · ${name}` });
  };
  for (const ref of effects.reads) add("read", ref);
  for (const ref of effects.writes) add("write", ref);
  for (const ref of effects.calls) add("call", ref);
  for (const entry of effects.dynamic) {
    const key = `dynamic:${entry.api}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const api = SCRIPT_API_BY_NAME.get(entry.api.replace(/^cmd\..*/u, "cmd"));
    out.push({ access: "dynamic", kind: "dynamic", id: entry.api, label: `${api?.ko ?? entry.api} — 계산된 대상(검사기 밖)` });
  }
  return out;
}

// ── tunables ─────────────────────────────────────────────────────────────────

export interface ScriptTunable {
  readonly name: string;
  /** 1-based line of the declaration. */
  readonly line: number;
  /** Source offsets of the initializer literal (without a trailing `as const`). */
  readonly start: number;
  readonly end: number;
  readonly kind: "number" | "string" | "boolean" | "list";
  /** Value as the author edits it: `3`, `안녕`, `true`, `3, 1, 4, 2`. */
  readonly value: string;
  /** Trailing or preceding line comment, if any (used as the label). */
  readonly comment?: string;
  /** For lists: element kind and quote char to rebuild the literal. */
  readonly listOf?: "number" | "string";
  readonly quote?: string;
}

function literalKind(ts: TypeScriptApi, node: TS.Expression): "number" | "string" | "boolean" | undefined {
  if (ts.isNumericLiteral(node)) return "number";
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(node.operand)) return "number";
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return "string";
  if (node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword) return "boolean";
  return undefined;
}

function commentNear(source: string, statementStart: number, statementEnd: number): string | undefined {
  const lineEnd = source.indexOf("\n", statementEnd);
  const tail = source.slice(statementEnd, lineEnd < 0 ? source.length : lineEnd);
  const trailing = /\/\/\s*(.+)$/u.exec(tail);
  if (trailing?.[1]) return trailing[1].trim();
  const before = source.slice(0, statementStart).replace(/[ \t]*$/u, "");
  const lastLine = before.slice(before.lastIndexOf("\n", before.length - 2) + 1).trim();
  const leading = /^\/\/\s*(.+)$/u.exec(lastLine) ?? /^\/\*\*?\s*(.+?)\s*\*\/$/u.exec(lastLine);
  return leading?.[1]?.trim() || undefined;
}

/** Top-level `const NAME = literal` declarations (numbers, strings, booleans, lists of numbers or strings). */
export function scriptTunables(source: string, ts: TypeScriptApi = scriptTs()): ScriptTunable[] {
  const file = ts.createSourceFile("/script.ts", source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const out: ScriptTunable[] = [];
  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement) || !(statement.declarationList.flags & ts.NodeFlags.Const)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
      let init = declaration.initializer;
      if (ts.isAsExpression(init) || ts.isSatisfiesExpression(init)) init = init.expression;
      const line = file.getLineAndCharacterOfPosition(declaration.getStart(file)).line + 1;
      const comment = commentNear(source, statement.getStart(file), statement.getEnd());
      const base = { name: declaration.name.text, line, start: init.getStart(file), end: init.getEnd(), ...(comment ? { comment } : {}) };
      const kind = literalKind(ts, init);
      if (kind) {
        const value = kind === "string" ? (init as TS.StringLiteral).text : init.getText(file);
        const quote = kind === "string" ? init.getText(file)[0] : undefined;
        out.push({ ...base, kind, value, ...(quote ? { quote } : {}) });
        continue;
      }
      if (ts.isArrayLiteralExpression(init) && init.elements.length > 0 && init.elements.length <= 24) {
        const kinds = init.elements.map((element) => literalKind(ts, element));
        const first = kinds[0];
        if ((first === "number" || first === "string") && kinds.every((entry) => entry === first)) {
          const values = init.elements.map((element) => (first === "string" ? (element as TS.StringLiteral).text : element.getText(file)));
          const quote = first === "string" ? init.elements[0]!.getText(file)[0] : undefined;
          out.push({ ...base, kind: "list", listOf: first, value: values.join(", "), ...(quote ? { quote } : {}) });
        }
      }
    }
  }
  return out;
}

function quoteString(value: string, quote = '"'): string {
  if (quote === "`") return `\`${value.replace(/[`\\$]/gu, (ch) => `\\${ch}`)}\``;
  const q = quote === "'" ? "'" : '"';
  return `${q}${value.replace(/\\/gu, "\\\\").replace(new RegExp(q, "gu"), `\\${q}`).replace(/\n/gu, "\\n")}${q}`;
}

/**
 * New source with one tunable's literal replaced by the edited value, or an error message (Korean, shown under
 * the field). Only that literal changes — comments, `as const` and the rest of the file stay byte-identical.
 */
export function setScriptTunable(source: string, tunable: ScriptTunable, edited: string): { source: string } | { error: string } {
  const text = edited.trim();
  let literal: string;
  switch (tunable.kind) {
    case "number":
      if (!/^-?\d+(\.\d+)?$/u.test(text)) return { error: "숫자를 넣어 주세요." };
      literal = text;
      break;
    case "boolean":
      if (text !== "true" && text !== "false") return { error: "true 또는 false 입니다." };
      literal = text;
      break;
    case "string":
      literal = quoteString(edited, tunable.quote);
      break;
    case "list": {
      const parts = text.split(",").map((part) => part.trim()).filter((part) => part.length > 0);
      if (!parts.length) return { error: "값을 쉼표로 나눠 넣어 주세요." };
      if (tunable.listOf === "number") {
        if (parts.some((part) => !/^-?\d+(\.\d+)?$/u.test(part))) return { error: "숫자를 쉼표로 나눠 넣어 주세요." };
        literal = `[${parts.join(", ")}]`;
      } else {
        literal = `[${parts.map((part) => quoteString(part, tunable.quote)).join(", ")}]`;
      }
      break;
    }
  }
  return { source: `${source.slice(0, tunable.start)}${literal}${source.slice(tunable.end)}` };
}

// ── flow ─────────────────────────────────────────────────────────────────────

export type ScriptFlowTone = "say" | "set" | "fx" | "move" | "call" | "calc" | "end" | "ask";

export interface ScriptFlowStep {
  readonly k: "step";
  readonly tone: ScriptFlowTone;
  readonly text: string;
  readonly line: number;
  /** True when the text is raw code (no plain-language wording). */
  readonly code?: boolean;
}

export interface ScriptFlowBranch {
  readonly k: "branch";
  /** Condition (if) or prompt (choices). */
  readonly head: string;
  readonly code?: boolean;
  readonly line: number;
  readonly arms: readonly { readonly label: string; readonly body: readonly ScriptFlowNode[] }[];
}

export interface ScriptFlowLoop {
  readonly k: "loop";
  readonly head: string;
  readonly line: number;
  readonly body: readonly ScriptFlowNode[];
}

export type ScriptFlowNode = ScriptFlowStep | ScriptFlowBranch | ScriptFlowLoop;

interface FlowContext {
  readonly ts: TypeScriptApi;
  readonly file: TS.SourceFile;
  readonly project?: Project;
  /** Local names bound to showChoices results → their option texts. */
  readonly choices: Map<string, readonly string[]>;
  /** Local names bound to literal consts (tunables) → literal text, used to word conditions. */
  readonly consts: Map<string, string>;
  /** Local names bound to a variable read (`const p = game.getVar("v")`) → 「변수 이름」. */
  readonly aliases: Map<string, string>;
  /** Words a literal `game.cmd({...})` the way the command list does (editor passes commandSummary). */
  readonly describeCommand?: (command: Record<string, unknown>) => string | undefined;
}

/** Code text with known locals swapped for their meaning (consts → value, variable reads → 변수 「이름」). */
function readable(ctx: FlowContext, text: string): string {
  if (!ctx.consts.size && !ctx.aliases.size) return text;
  return text.replace(/\b[A-Za-z_$][\w$]*\b/gu, (word) => ctx.aliases.get(word) ?? stripQuotes(ctx.consts.get(word)) ?? word);
}

function stripQuotes(text: string | undefined): string | undefined {
  if (text === undefined) return undefined;
  return /^(["'`])[\s\S]*\1$/u.test(text) ? text.slice(1, -1) : text;
}

const COMPARE_WORD: Readonly<Record<string, string>> = {
  "===": "=", "==": "=", "!==": "≠", "!=": "≠", ">=": "≥", "<=": "≤", ">": ">", "<": "<",
};

function lineOf(ctx: FlowContext, node: TS.Node): number {
  return ctx.file.getLineAndCharacterOfPosition(node.getStart(ctx.file)).line + 1;
}

function shortCode(ctx: FlowContext, node: TS.Node, limit = 70): string {
  const text = readable(ctx, node.getText(ctx.file).replace(/\s+/gu, " ").trim());
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

function unwrap(ctx: FlowContext, node: TS.Expression): TS.Expression {
  let current = node;
  for (;;) {
    if (ctx.ts.isAwaitExpression(current) || ctx.ts.isParenthesizedExpression(current) || ctx.ts.isAsExpression(current) || ctx.ts.isNonNullExpression(current)) current = current.expression;
    else return current;
  }
}

/** `game.X(...)` call → [api name, args], else undefined. */
function gameCall(ctx: FlowContext, node: TS.Expression): { api: string; args: readonly TS.Expression[] } | undefined {
  const inner = unwrap(ctx, node);
  if (!ctx.ts.isCallExpression(inner)) return undefined;
  const callee = inner.expression;
  if (!ctx.ts.isPropertyAccessExpression(callee) || !ctx.ts.isIdentifier(callee.expression) || callee.expression.text !== "game") return undefined;
  return { api: callee.name.text, args: inner.arguments };
}

function literalString(ctx: FlowContext, node: TS.Expression | undefined): string | undefined {
  if (!node) return undefined;
  const inner = unwrap(ctx, node);
  if (ctx.ts.isStringLiteral(inner) || ctx.ts.isNoSubstitutionTemplateLiteral(inner)) return inner.text;
  return undefined;
}

/** Message text: literals as-is, templates with `{expr}` holes. */
function messageText(ctx: FlowContext, node: TS.Expression | undefined): string {
  if (!node) return "";
  const inner = unwrap(ctx, node);
  const literal = literalString(ctx, inner);
  if (literal !== undefined) return literal;
  if (ctx.ts.isTemplateExpression(inner)) {
    let out = inner.head.text;
    for (const span of inner.templateSpans) {
      const expr = span.expression.getText(ctx.file);
      const known = stripQuotes(ctx.consts.get(expr));
      out += `${known ?? `{${readable(ctx, expr)}}`}${span.literal.text}`;
    }
    return out;
  }
  return `{${shortCode(ctx, inner, 40)}}`;
}

function refLabel(ctx: FlowContext, kind: ScriptRef["kind"], node: TS.Expression | undefined): string {
  const id = literalString(ctx, node);
  if (id === undefined) return node ? shortCode(ctx, node, 24) : "?";
  return scriptRefName(ctx.project, kind, id);
}

function numberText(ctx: FlowContext, node: TS.Expression | undefined): string {
  if (!node) return "";
  const text = node.getText(ctx.file).trim();
  return stripQuotes(ctx.consts.get(text)) ?? readable(ctx, text);
}

function objectProp(ctx: FlowContext, node: TS.Expression | undefined, name: string): TS.Expression | undefined {
  if (!node) return undefined;
  const inner = unwrap(ctx, node);
  if (!ctx.ts.isObjectLiteralExpression(inner)) return undefined;
  for (const prop of inner.properties) {
    if (ctx.ts.isPropertyAssignment(prop) && (ctx.ts.isIdentifier(prop.name) || ctx.ts.isStringLiteral(prop.name)) && prop.name.text === name) return prop.initializer;
  }
  return undefined;
}

/** Plain-language step for a `game.*` call, or undefined when it is not a game call. */
function gameStep(ctx: FlowContext, expression: TS.Expression, line: number): ScriptFlowStep | undefined {
  const call = gameCall(ctx, expression);
  if (!call) return undefined;
  const [a0, a1, a2] = call.args;
  const step = (tone: ScriptFlowTone, text: string): ScriptFlowStep => ({ k: "step", tone, text, line });
  switch (call.api) {
    case "showMessage": {
      const speaker = literalString(ctx, objectProp(ctx, a1, "speaker"));
      return step("say", `${speaker ? `${speaker}: ` : ""}「${messageText(ctx, a0)}」`);
    }
    case "setSwitch": {
      const value = a1 ? unwrap(ctx, a1) : undefined;
      const word = value?.kind === ctx.ts.SyntaxKind.TrueKeyword ? "켬" : value?.kind === ctx.ts.SyntaxKind.FalseKeyword ? "끔" : `= ${value ? shortCode(ctx, value, 30) : "?"}`;
      return step("set", `스위치 「${refLabel(ctx, "switch", a0)}」 ${word}`);
    }
    case "setVar": return step("set", `변수 「${refLabel(ctx, "variable", a0)}」 = ${numberText(ctx, a1)}`);
    case "addVar": {
      const delta = numberText(ctx, a1);
      return step("set", `변수 「${refLabel(ctx, "variable", a0)}」 ${delta.startsWith("-") ? `-= ${delta.slice(1)}` : `+= ${delta}`}`);
    }
    case "setText": return step("set", `글 변수 「${refLabel(ctx, "string", a0)}」 = ${messageText(ctx, a1)}`);
    case "setSelfSwitch": {
      const value = a1 ? unwrap(ctx, a1) : undefined;
      const word = value?.kind === ctx.ts.SyntaxKind.TrueKeyword ? "켬" : value?.kind === ctx.ts.SyntaxKind.FalseKeyword ? "끔" : "바꿈";
      const other = a2 ? ` (${literalString(ctx, a2) !== undefined ? refLabel(ctx, "event", a2) : `이벤트 ${refLabel(ctx, "event", a2)}`})` : "";
      return step("set", `셀프 스위치 ${literalString(ctx, a0) ?? "?"}${other} ${word}`);
    }
    case "addGold": {
      const amount = numberText(ctx, a0);
      return step("set", amount.startsWith("-") ? `돈 -${amount.slice(1)}` : `돈 +${amount}`);
    }
    case "addItem": return step("set", `아이템 「${refLabel(ctx, "item", a0)}」 +${a1 ? numberText(ctx, a1) : "1"}`);
    case "removeItem": return step("set", `아이템 「${refLabel(ctx, "item", a0)}」 -${a1 ? numberText(ctx, a1) : "1"}`);
    case "transfer": return step("end", `맵 「${refLabel(ctx, "map", a0)}」(${numberText(ctx, a1)}, ${numberText(ctx, a2)})로 이동 — 이벤트 끝`);
    case "wait": return step("fx", `기다리기 ${numberText(ctx, a0)}프레임`);
    case "callCommonEvent": return step("call", `공통 이벤트 「${refLabel(ctx, "commonEvent", a0)}」 부르기`);
    case "battle": return step("call", `전투 「${refLabel(ctx, "troop", a0)}」`);
    case "shake": return step("fx", `화면 흔들기${a0 ? ` (세기 ${numberText(ctx, a0)}${a1 ? ` · ${numberText(ctx, a1)}프레임` : ""})` : ""}`);
    case "moveEvent": {
      const target = literalString(ctx, a0);
      const who = target === "player" ? "주인공" : target === "this" ? "이 이벤트" : target ? scriptRefName(ctx.project, "event", target) : shortCode(ctx, a0!, 20);
      return step("move", `${who} 움직이기`);
    }
    case "inputNumber": return step("ask", "숫자 입력");
    case "cmd": {
      const kind = literalString(ctx, objectProp(ctx, a0, "kind"));
      if (a0 && ctx.describeCommand) {
        try {
          const parsed = JSON.parse(unwrap(ctx, a0).getText(ctx.file)) as unknown;
          const text = parsed && typeof parsed === "object" ? ctx.describeCommand(parsed as Record<string, unknown>) : undefined;
          if (text) return step(kind === "text" || kind === "showMessage" ? "say" : "call", text);
        } catch {
          // not plain JSON (computed fields) — fall through to the kind name
        }
      }
      return step("call", `명령 ${kind ?? "?"}`);
    }
    default: {
      const entry = SCRIPT_API_BY_NAME.get(call.api);
      const tone: ScriptFlowTone = entry?.group === "screen" || entry?.group === "audio" ? "fx" : entry?.group === "map" ? "move" : entry?.awaits ? "call" : "calc";
      const arg = literalString(ctx, a0);
      return step(tone, `${entry?.ko ?? call.api}${arg ? ` 「${arg}」` : ""}`);
    }
  }
}

/** Plain-language condition, or a short code text (code: true). */
function conditionText(ctx: FlowContext, node: TS.Expression): { text: string; code?: boolean } {
  const ts = ctx.ts;
  const expr = unwrap(ctx, node);
  if (ts.isPrefixUnaryExpression(expr) && expr.operator === ts.SyntaxKind.ExclamationToken) {
    const call = gameCall(ctx, expr.operand);
    if (call?.api === "getSwitch") return { text: `스위치 「${refLabel(ctx, "switch", call.args[0])}」 꺼짐` };
    if (call?.api === "getSelfSwitch") return { text: `셀프 스위치 ${literalString(ctx, call.args[0]) ?? "?"} 꺼짐` };
    if (call?.api === "hasItem") return { text: `「${refLabel(ctx, "item", call.args[0])}」 없음` };
    const inner = conditionText(ctx, expr.operand);
    return inner.code ? { text: shortCode(ctx, expr), code: true } : { text: `아님: ${inner.text}` };
  }
  if (ts.isBinaryExpression(expr)) {
    const op = expr.operatorToken.kind;
    if (op === ts.SyntaxKind.AmpersandAmpersandToken || op === ts.SyntaxKind.BarBarToken) {
      const left = conditionText(ctx, expr.left);
      const right = conditionText(ctx, expr.right);
      if (left.code && right.code) return { text: shortCode(ctx, expr), code: true };
      return { text: `${left.text} ${op === ts.SyntaxKind.AmpersandAmpersandToken ? "그리고" : "또는"} ${right.text}` };
    }
    const word = COMPARE_WORD[expr.operatorToken.getText(ctx.file)];
    if (word) {
      const left = unwrap(ctx, expr.left);
      const right = numberText(ctx, expr.right);
      // choice pick
      if (ts.isIdentifier(left) && ctx.choices.has(left.text)) {
        const options = ctx.choices.get(left.text)!;
        const index = Number(expr.right.getText(ctx.file));
        const label = Number.isInteger(index) ? (index === -1 ? "취소" : options[index]) : undefined;
        if (label !== undefined) return { text: `「${label}」 고름${word === "≠" ? " 아님" : ""}` };
      }
      if (ts.isIdentifier(left) && ctx.aliases.has(left.text)) return { text: `${ctx.aliases.get(left.text)} ${word} ${right}` };
      const call = gameCall(ctx, left);
      if (call?.api === "getVar") return { text: `변수 「${refLabel(ctx, "variable", call.args[0])}」 ${word} ${right}` };
      if (call?.api === "gold") return { text: `돈 ${word} ${right}` };
      if (call?.api === "itemCount") return { text: `「${refLabel(ctx, "item", call.args[0])}」 개수 ${word} ${right}` };
      const leftText = left.getText(ctx.file);
      const clock = /^(?:game\.time\(\)|\w+)\.(hour|minute|phase)$/u.exec(leftText);
      if (clock) return { text: `${clock[1] === "hour" ? "시각(시)" : clock[1] === "minute" ? "시각(분)" : "시간대"} ${word} ${right}` };
    }
  }
  const call = gameCall(ctx, expr);
  if (call?.api === "getSwitch") return { text: `스위치 「${refLabel(ctx, "switch", call.args[0])}」 켜짐` };
  if (call?.api === "getSelfSwitch") return { text: `셀프 스위치 ${literalString(ctx, call.args[0]) ?? "?"} 켜짐` };
  if (call?.api === "hasItem") return { text: `「${refLabel(ctx, "item", call.args[0])}」 가짐` };
  return { text: shortCode(ctx, expr), code: true };
}

function flowStatements(ctx: FlowContext, statements: readonly TS.Statement[]): ScriptFlowNode[] {
  const out: ScriptFlowNode[] = [];
  for (const statement of statements) out.push(...flowStatement(ctx, statement));
  return out;
}

function flowBlock(ctx: FlowContext, statement: TS.Statement | undefined): ScriptFlowNode[] {
  if (!statement) return [];
  return ctx.ts.isBlock(statement) ? flowStatements(ctx, statement.statements) : flowStatement(ctx, statement);
}

function flowStatement(ctx: FlowContext, statement: TS.Statement): ScriptFlowNode[] {
  const ts = ctx.ts;
  const line = lineOf(ctx, statement);
  if (ts.isBlock(statement)) return flowStatements(ctx, statement.statements);
  if (ts.isImportDeclaration(statement) || ts.isEmptyStatement(statement) || ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement)) return [];
  if (ts.isExpressionStatement(statement)) {
    const step = gameStep(ctx, statement.expression, line);
    return [step ?? { k: "step", tone: "calc", text: shortCode(ctx, statement.expression), line, code: true }];
  }
  if (ts.isVariableStatement(statement)) {
    const out: ScriptFlowNode[] = [];
    for (const declaration of statement.declarationList.declarations) {
      const name = ts.isIdentifier(declaration.name) ? declaration.name.text : declaration.name.getText(ctx.file);
      const init = declaration.initializer;
      if (!init) continue;
      const call = gameCall(ctx, init);
      if (call?.api === "showChoices" && call.args[0] && ts.isArrayLiteralExpression(unwrap(ctx, call.args[0]))) {
        const options = (unwrap(ctx, call.args[0]) as TS.ArrayLiteralExpression).elements.map((element) => messageText(ctx, element));
        ctx.choices.set(name, options);
        out.push({ k: "step", tone: "ask", text: `선택지: ${options.map((option) => `「${option}」`).join(" · ")}`, line });
        continue;
      }
      if (call?.api === "getVar" && ts.isIdentifier(declaration.name)) {
        ctx.aliases.set(name, `변수 「${refLabel(ctx, "variable", call.args[0])}」`);
        continue;
      }
      if (call?.api === "addVar" && ts.isIdentifier(declaration.name)) ctx.aliases.set(name, `변수 「${refLabel(ctx, "variable", call.args[0])}」`);
      const literal = literalKind(ts, unwrap(ctx, init));
      if (literal && statement.declarationList.flags & ts.NodeFlags.Const) {
        ctx.consts.set(name, unwrap(ctx, init).getText(ctx.file));
        continue; // tunables are shown in their own panel
      }
      if (ts.isArrayLiteralExpression(unwrap(ctx, init)) && statement.parent && ts.isSourceFile(statement.parent)) continue; // list tunables
      const step = gameStep(ctx, init, line);
      if (step && step.tone !== "calc") {
        out.push(step);
        continue;
      }
      out.push({ k: "step", tone: "calc", text: `${name} ← ${shortCode(ctx, init, 60)}`, line, code: true });
    }
    return out;
  }
  if (ts.isIfStatement(statement)) {
    const cond = conditionText(ctx, statement.expression);
    return [{
      k: "branch",
      head: cond.text,
      ...(cond.code ? { code: true } : {}),
      line,
      arms: [
        { label: "예", body: flowBlock(ctx, statement.thenStatement) },
        { label: "아니오", body: flowBlock(ctx, statement.elseStatement) },
      ],
    }];
  }
  if (ts.isForOfStatement(statement) || ts.isForInStatement(statement)) {
    const variable = statement.initializer.getText(ctx.file).replace(/^(const|let|var)\s+/u, "");
    return [{ k: "loop", head: `${shortCode(ctx, statement.expression, 40)}의 각 ${variable}마다`, line, body: flowBlock(ctx, statement.statement) }];
  }
  if (ts.isForStatement(statement) || ts.isWhileStatement(statement) || ts.isDoStatement(statement)) {
    const head = ts.isWhileStatement(statement) && statement.expression.kind === ts.SyntaxKind.TrueKeyword
      ? "계속 반복 (멈출 때까지)"
      : `반복: ${shortCode(ctx, ts.isForStatement(statement) ? statement : statement.expression, 50).replace(/\{[\s\S]*$/u, "").trim()}`;
    return [{ k: "loop", head, line, body: flowBlock(ctx, statement.statement) }];
  }
  if (ts.isReturnStatement(statement)) return [{ k: "step", tone: "end", text: "여기서 끝", line }];
  if (ts.isBreakStatement(statement)) return [{ k: "step", tone: "end", text: "반복 멈춤", line }];
  if (ts.isFunctionDeclaration(statement)) return [{ k: "step", tone: "calc", text: `도움 함수 ${statement.name?.text ?? ""}`, line, code: true }];
  return [{ k: "step", tone: "calc", text: shortCode(ctx, statement), line, code: true }];
}

/** Plain-language flow tree of a script. */
export function scriptFlow(
  source: string,
  project?: Project,
  ts: TypeScriptApi = scriptTs(),
  describeCommand?: FlowContext["describeCommand"],
): ScriptFlowNode[] {
  const file = ts.createSourceFile("/script.ts", source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const ctx: FlowContext = { ts, file, ...(project ? { project } : {}), ...(describeCommand ? { describeCommand } : {}), choices: new Map(), consts: new Map(), aliases: new Map() };
  return flowStatements(ctx, file.statements);
}

/** Counts steps whose wording is raw code (the "계산" share). */
export function scriptFlowStats(nodes: readonly ScriptFlowNode[]): { readonly steps: number; readonly code: number } {
  let steps = 0;
  let code = 0;
  const visit = (list: readonly ScriptFlowNode[]): void => {
    for (const node of list) {
      steps += 1;
      if (node.k === "step" && node.code) code += 1;
      if (node.k === "branch") {
        if (node.code) code += 1;
        for (const arm of node.arms) visit(arm.body);
      }
      if (node.k === "loop") visit(node.body);
    }
  };
  visit(nodes);
  return { steps, code };
}
