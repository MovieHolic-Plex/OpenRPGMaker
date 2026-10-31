// editor/script/scriptInsight.ts — a model-free, plain-language reading of a script for non-coders.
//
// `scriptFlow` turns the code into an if/else · choices · loop tree of plain lines. Readability rules (2026-11-01):
//  - no code identifiers: locals, consts, helpers and event ids read by the Korean names the script gives them in
//    comments (scriptLabels.ts — `const pct = …; // 할인율`, `// @label A: 이미 당김`, `/** @label 할인율 */`), else by a
//    reading of the identifier (`discountedPrice` → 「할인된 가격」), else they stay;
//  - switch/variable names are the short form (shortRecordName — the description in brackets/after a dash is dropped);
//  - conditions are sentences ending in 「…면」 (`sentence`: 「돈이 총액보다 적으면」, 「이 이벤트에서 이미 했으면」);
//  - message holes read «이름» (`${price}` → «할인된 가격»);
//  - a standalone comment line is a step heading node (`// 가격 계산`).
// The event list renders it as event-style lines (panels/eventEditor/scriptLines.ts) whenever the script does not
// convert to event commands exactly. Requires the TypeScript parser (`prepareScriptCompiler()`); pure otherwise.
// Wiki: openwiki/script-sandbox.md 「목록에서 읽히는 스크립트」.
import { shortRecordName } from "@/editor/shortRecordName";
import { SCRIPT_API_BY_NAME } from "@/project/script/apiSpec";
import type { ScriptRef } from "@/project/script/types";
import type { Project } from "@/project/types";
import type * as TS from "typescript5";
import { hasBatchim, josa, readIdentifier, readScriptLabels, type ScriptLabels } from "./scriptLabels";
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
        if (event) return event.name?.trim() || readIdentifier(id) || id;
      }
      return id;
    }
    case "selfSwitch": return `셀프 스위치 ${id.split(".").pop() ?? id}`;
    default: return id;
  }
}

/** Short display name: switches and variables drop their description part. */
function shortRef(project: Project | undefined, kind: ScriptRef["kind"], id: string): string {
  const name = scriptRefName(project, kind, id);
  return kind === "switch" || kind === "variable" ? shortRecordName(name) : name;
}

function isEventId(project: Project | undefined, id: string): boolean {
  if (!project) return false;
  return Object.values(project.maps).some((map) => map.events.some((event) => event.id === id));
}

function literalKind(ts: TypeScriptApi, node: TS.Expression): "number" | "string" | "boolean" | undefined {
  if (ts.isNumericLiteral(node)) return "number";
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(node.operand)) return "number";
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return "string";
  if (node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword) return "boolean";
  return undefined;
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
  /** Event command kind this step does the job of (list icon/category): changeGold, changeItem, setSwitch … */
  readonly like?: string;
}

export interface ScriptFlowBranch {
  readonly k: "branch";
  /** Condition (if) or prompt (choices) — the short form (「돈 < 총액」). */
  readonly head: string;
  /** The condition as a sentence ending in 「…면」 (「돈이 총액보다 적으면」). */
  readonly sentence: string;
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

/** A step heading written as a comment on its own line (`// 가격 계산`). */
export interface ScriptFlowHeading {
  readonly k: "heading";
  readonly text: string;
  readonly line: number;
}

export type ScriptFlowNode = ScriptFlowStep | ScriptFlowBranch | ScriptFlowLoop | ScriptFlowHeading;

interface FlowContext {
  readonly ts: TypeScriptApi;
  readonly file: TS.SourceFile;
  readonly project?: Project;
  readonly labels: ScriptLabels;
  /** Local names bound to showChoices results → their option texts. */
  readonly choices: Map<string, readonly string[]>;
  /** Local names bound to literal consts (tunables) → literal text, used to word conditions. */
  readonly consts: Map<string, string>;
  /** Local names bound to a value with a plain name (variable reads, the player, a loop item …) → that name. */
  readonly aliases: Map<string, string>;
  /** Literal list consts → their values (for 「순서」 conditions). */
  readonly lists: Map<string, readonly string[]>;
  /** Helper names imported from @lib modules → their labels. */
  readonly helpers: Map<string, string>;
  /** Heading lines already emitted (a one-line `for` body starts on the loop's own line). */
  readonly headingsShown: Set<number>;
  /** Words a literal `game.cmd({...})` the way the command list does (editor passes commandSummary). */
  readonly describeCommand?: (command: Record<string, unknown>) => string | undefined;
}

/** Plain name for a local identifier: the script's own label → alias → reading of the identifier → itself. */
function localName(ctx: FlowContext, identifier: string): string {
  return ctx.labels.names.get(identifier) ?? ctx.aliases.get(identifier) ?? ctx.helpers.get(identifier) ?? readIdentifier(identifier) ?? identifier;
}

/** True when the identifier has a non-code name. */
function hasPlainName(ctx: FlowContext, identifier: string): boolean {
  return localName(ctx, identifier) !== identifier;
}

/** Code text with locals swapped for their meaning — outside quotes and not after a `.` (consts → value, others → name). */
function readable(ctx: FlowContext, text: string): string {
  const parts = text.split(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/u);
  return parts.map((part, index) => {
    if (index % 2 === 1) {
      const inner = part.slice(1, -1);
      return isEventId(ctx.project, inner) ? scriptRefName(ctx.project, "event", inner) : part;
    }
    return part.replace(/(\.\s*)?\b([A-Za-z_$][\w$]*)\b/gu, (whole, dot: string | undefined, word: string) => {
      if (dot) return whole;
      if (word === "game" || word === "Math" || word === "true" || word === "false" || word === "null" || word === "undefined") return whole;
      const value = stripQuotes(ctx.consts.get(word));
      if (value !== undefined) return value;
      return localName(ctx, word);
    });
  }).join("").replace(/([가-힣」』]) ?\.(x|y)\b/gu, "$1의 $2");
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

function clip(text: string, limit: number): string {
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

function shortCode(ctx: FlowContext, node: TS.Node, limit = 70): string {
  // `x = a ? b : c`: read the right side on its own so the ternary wording does not swallow the target.
  if (ctx.ts.isBinaryExpression(node) && node.operatorToken.kind >= ctx.ts.SyntaxKind.FirstAssignment && node.operatorToken.kind <= ctx.ts.SyntaxKind.LastAssignment) {
    return clip(`${plainCode(ctx, readable(ctx, node.left.getText(ctx.file).trim()))} ${node.operatorToken.getText(ctx.file)} ${valueText(ctx, node.right)}`, limit);
  }
  if (ctx.ts.isExpression(node as TS.Expression)) return clip(valueText(ctx, node as TS.Expression), limit);
  return clip(plainCode(ctx, readable(ctx, node.getText(ctx.file).replace(/\s+/gu, " ").trim())), limit);
}

const MATH_WORD: Readonly<Record<string, string>> = { floor: "내림", ceil: "올림", round: "반올림", min: "최소", max: "최대", abs: "절댓값", trunc: "버림", sign: "부호" };

/**
 * Code text a non-coder can still read in a list line: game reads become names, Math helpers and operators
 * become words/symbols ("가격 = 내림(100 × (1 − 평판 ÷ 200))"). Text inside quotes is left alone.
 */
function plainCode(ctx: FlowContext, text: string): string {
  const named = text
    .replace(/game\.(getVar|getSwitch|itemCount|hasItem)\(\s*(["'])([^"']+)\2\s*\)/gu, (_whole, api: string, _q: string, id: string) => {
      if (api === "getVar") return shortRef(ctx.project, "variable", id);
      if (api === "getSwitch") return `스위치 「${shortRef(ctx.project, "switch", id)}」`;
      if (api === "itemCount") return `「${shortRef(ctx.project, "item", id)}」 개수`;
      return `「${shortRef(ctx.project, "item", id)}」 가짐`;
    })
    .replace(/game\.gold\(\)/gu, "돈")
    .replace(/game\.player\(\)/gu, "주인공")
    .replace(/game\.time\(\)\.hour/gu, "시각(시)")
    .replace(/game\.time\(\)\.minute/gu, "시각(분)");
  // Operators only outside string literals.
  const parts = named.split(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/u);
  return plainTernary(parts.map((part, index) => {
    if (index % 2 === 1) return part;
    return part
      .replace(/Math\.(floor|ceil|round|min|max|abs|trunc|sign)\(/gu, (_whole, name: string) => `${MATH_WORD[name] ?? name}(`)
      .replace(/\s*===\s*/gu, " = ")
      .replace(/\s*!==\s*/gu, " ≠ ")
      .replace(/\s*>=\s*/gu, " ≥ ")
      .replace(/\s*<=\s*/gu, " ≤ ")
      .replace(/\s*&&\s*/gu, " 그리고 ")
      .replace(/\s*\|\|\s*/gu, " 또는 ")
      .replace(/\s\*\s/gu, " × ")
      .replace(/\s\/\s/gu, " ÷ ")
      .replace(/\s-\s/gu, " − ")
      .replace(/\.length\b/gu, "의 개수");
  }).join(""));
}

/**
 * One `a ? b : c` (outside quotes, not `?.`/`??`) reads as 「(a 이면 b, 아니면 c)」. Nested or several
 * ternaries stay as code — a half-translated chain is harder to read than the original.
 */
function plainTernary(text: string): string {
  const marks: { char: string; at: number; depth: number }[] = [];
  let depth = 0;
  let quote = "";
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]!;
    if (quote) {
      if (char === "\\") i += 1;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'" || char === "`") quote = char;
    else if (char === "(" || char === "[" || char === "{") depth += 1;
    else if (char === ")" || char === "]" || char === "}") depth -= 1;
    else if (char === "?" && text[i + 1] !== "." && text[i + 1] !== "?" && text[i - 1] !== "?") marks.push({ char, at: i, depth });
    else if (char === ":") marks.push({ char, at: i, depth });
  }
  const ask = marks.filter((mark) => mark.char === "?");
  const colon = marks.filter((mark) => mark.char === ":");
  if (ask.length !== 1 || colon.length !== 1) return text;
  const [q] = ask;
  const [c] = colon;
  if (!q || !c || c.at < q.at || q.depth !== c.depth) return text;
  const head = text.slice(0, q.at).trimEnd();
  const yes = text.slice(q.at + 1, c.at).trim();
  const no = text.slice(c.at + 1).trimStart();
  if (q.depth > 0) return `${head} 이면 ${yes}, 아니면 ${no}`;
  return `(${head} 이면 ${yes}, 아니면 ${no})`;
}

/** A value expression as a reading: a top-level ternary is worded with the condition sentence. */
function valueText(ctx: FlowContext, node: TS.Expression): string {
  const inner = unwrap(ctx, node);
  const counted = countedConditions(ctx, inner);
  if (counted) {
    const switches = counted.map((text) => /^스위치 (「[^」]*」) 켜짐$/u.exec(text)?.[1]);
    return switches.every(Boolean) ? `켜진 스위치 수 (${switches.join(", ")})` : `맞는 것의 수 (${counted.join(", ")})`;
  }
  if (ctx.ts.isConditionalExpression(inner) && !ctx.ts.isConditionalExpression(unwrap(ctx, inner.whenTrue)) && !ctx.ts.isConditionalExpression(unwrap(ctx, inner.whenFalse))) {
    const clause = conditionClause(ctx, inner.condition);
    if (!clause.code) return `${finalForm(clause.stem)} ${valueText(ctx, inner.whenTrue)}, 아니면 ${valueText(ctx, inner.whenFalse)}`;
  }
  if (ctx.ts.isStringLiteral(inner) || ctx.ts.isNoSubstitutionTemplateLiteral(inner)) {
    return isEventId(ctx.project, inner.text) ? scriptRefName(ctx.project, "event", inner.text) : `「${inner.text}」`;
  }
  return plainCode(ctx, readable(ctx, inner.getText(ctx.file).replace(/\s+/gu, " ").trim()));
}

/** `(a ? 1 : 0) + (b ? 1 : 0) + …` → the short forms of a, b, … (a count of true conditions), else undefined. */
function countedConditions(ctx: FlowContext, node: TS.Expression): string[] | undefined {
  const terms: TS.Expression[] = [];
  const collect = (expr: TS.Expression): void => {
    const inner = unwrap(ctx, expr);
    if (ctx.ts.isBinaryExpression(inner) && inner.operatorToken.kind === ctx.ts.SyntaxKind.PlusToken) {
      collect(inner.left);
      collect(inner.right);
    } else terms.push(inner);
  };
  collect(node);
  if (terms.length < 2) return undefined;
  const out: string[] = [];
  for (const term of terms) {
    if (!ctx.ts.isConditionalExpression(term) || unwrap(ctx, term.whenTrue).getText(ctx.file) !== "1" || unwrap(ctx, term.whenFalse).getText(ctx.file) !== "0") return undefined;
    const clause = conditionClause(ctx, term.condition);
    if (clause.code) return undefined;
    out.push(clause.short);
  }
  return out;
}

/** True when a reading still shows code (identifiers, `?:`, quotes) outside 「」 and «» parts. */
function looksLikeCode(text: string): boolean {
  return /[A-Za-z_$][\w$]*|[?']/u.test(text.replace(/「[^」]*」|«[^»]*»/gu, "").replace(/의 [xy]\b/gu, ""));
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

/** A hole in a message: a known const shows its value, anything else reads «이름» (`${price * 3}` → «할인된 가격 × 3»). */
function hole(ctx: FlowContext, expr: TS.Expression): string {
  const text = expr.getText(ctx.file);
  const known = stripQuotes(ctx.consts.get(text));
  if (known !== undefined) return known;
  return `«${clip(valueText(ctx, expr), 30)}»`;
}

/** Message text: literals as-is, templates and `'a' + n` with «이름» holes. */
function messageText(ctx: FlowContext, node: TS.Expression | undefined): string {
  if (!node) return "";
  const inner = unwrap(ctx, node);
  const literal = literalString(ctx, inner);
  if (literal !== undefined) return literal;
  if (ctx.ts.isTemplateExpression(inner)) {
    let out = inner.head.text;
    for (const span of inner.templateSpans) out += `${hole(ctx, span.expression)}${span.literal.text}`;
    return out;
  }
  if (ctx.ts.isBinaryExpression(inner) && inner.operatorToken.kind === ctx.ts.SyntaxKind.PlusToken) {
    const side = (part: TS.Expression): string => {
      const value = unwrap(ctx, part);
      if (literalString(ctx, value) !== undefined || ctx.ts.isTemplateExpression(value)) return messageText(ctx, value);
      if (ctx.ts.isBinaryExpression(value) && value.operatorToken.kind === ctx.ts.SyntaxKind.PlusToken) return messageText(ctx, value);
      return hole(ctx, value);
    };
    return `${side(inner.left)}${side(inner.right)}`;
  }
  return hole(ctx, inner);
}

function refLabel(ctx: FlowContext, kind: ScriptRef["kind"], node: TS.Expression | undefined): string {
  const id = literalString(ctx, node);
  if (id === undefined) return node ? clip(valueText(ctx, node), 24) : "?";
  return shortRef(ctx.project, kind, id);
}

function numberText(ctx: FlowContext, node: TS.Expression | undefined): string {
  if (!node) return "";
  const text = node.getText(ctx.file).trim();
  return stripQuotes(ctx.consts.get(text)) ?? valueText(ctx, node);
}

function isPlainNumber(text: string): boolean {
  return /^-?\d+(?:\.\d+)?$/u.test(text);
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

/** Who an event-target argument means: this event, the player, a named event, or a loop item. */
function eventWho(ctx: FlowContext, node: TS.Expression | undefined): string {
  if (!node) return "이 이벤트";
  const id = literalString(ctx, node);
  if (id === "this") return "이 이벤트";
  if (id === "player") return "주인공";
  if (id !== undefined) return scriptRefName(ctx.project, "event", id);
  return clip(valueText(ctx, node), 20);
}

function selfSwitchStep(ctx: FlowContext, key: string, value: TS.Expression | undefined, target: TS.Expression | undefined): string {
  const on = value?.kind === ctx.ts.SyntaxKind.TrueKeyword;
  const off = value?.kind === ctx.ts.SyntaxKind.FalseKeyword;
  const who = eventWho(ctx, target);
  const label = ctx.labels.selfSwitches.get(key);
  if (label) {
    if (on) return `${josa(who, "을", "를")} 「${label}」 상태로 표시`;
    if (off) return `${who}의 「${label}」 표시 지우기`;
    return `${who}의 「${label}」 표시 바꾸기`;
  }
  if (key === "A" && (on || off)) {
    const where = target ? `${who}에서 ` : "이 이벤트에서 ";
    return on ? `${where}했다고 기억하기` : `${where}했다는 기억 지우기`;
  }
  return `${who} 기억 ${key} ${on ? "켬" : off ? "끔" : "바꿈"}`;
}

/** Plain-language step for a `game.*` call, or undefined when it is not a game call. */
function gameStep(ctx: FlowContext, expression: TS.Expression, line: number): ScriptFlowStep | undefined {
  const call = gameCall(ctx, expression);
  if (!call) return undefined;
  const [a0, a1, a2] = call.args;
  const step = (tone: ScriptFlowTone, text: string, like?: string): ScriptFlowStep => ({ k: "step", tone, text, line, ...(like ? { like } : {}) });
  switch (call.api) {
    case "showMessage": {
      const speaker = literalString(ctx, objectProp(ctx, a1, "speaker"));
      return step("say", `${speaker ? `${speaker}: ` : ""}「${messageText(ctx, a0)}」`, "text");
    }
    case "setSwitch": {
      const value = a1 ? unwrap(ctx, a1) : undefined;
      const word = value?.kind === ctx.ts.SyntaxKind.TrueKeyword ? "켬" : value?.kind === ctx.ts.SyntaxKind.FalseKeyword ? "끔" : `= ${value ? clip(valueText(ctx, value), 40) : "?"}`;
      return step("set", `스위치 「${refLabel(ctx, "switch", a0)}」 ${word}`, "setSwitch");
    }
    case "setVar": return step("set", `변수 「${refLabel(ctx, "variable", a0)}」 = ${numberText(ctx, a1)}`, "setVariable");
    case "addVar": {
      const delta = numberText(ctx, a1);
      return step("set", `변수 「${refLabel(ctx, "variable", a0)}」 ${delta.startsWith("-") ? `-= ${delta.slice(1)}` : `+= ${delta}`}`, "setVariable");
    }
    case "setText": return step("set", `글 변수 「${refLabel(ctx, "string", a0)}」 = ${messageText(ctx, a1)}`, "setVariable");
    case "setSelfSwitch": return step("set", selfSwitchStep(ctx, literalString(ctx, a0) ?? "?", a1 ? unwrap(ctx, a1) : undefined, a2), "setSelfSwitch");
    case "addGold": {
      const inner = a0 ? unwrap(ctx, a0) : undefined;
      if (inner && ctx.ts.isPrefixUnaryExpression(inner) && inner.operator === ctx.ts.SyntaxKind.MinusToken && !ctx.ts.isNumericLiteral(inner.operand)) {
        return step("set", `돈에서 ${numberText(ctx, inner.operand)}만큼 빼기`, "changeGold");
      }
      const amount = numberText(ctx, a0);
      if (isPlainNumber(amount)) return step("set", amount.startsWith("-") ? `돈 -${amount.slice(1)}` : `돈 +${amount}`, "changeGold");
      return step("set", `돈에 ${amount}만큼 더하기`, "changeGold");
    }
    case "addItem":
    case "removeItem": {
      const rawCount = a1 ? numberText(ctx, a1) : "1";
      const count = rawCount.includes(", 아니면") ? `(${rawCount})` : rawCount;
      const item = refLabel(ctx, "item", a0);
      const add = call.api === "addItem";
      if (isPlainNumber(count)) return step("set", `아이템 「${item}」 ${add ? "+" : "-"}${count}`, "changeItem");
      return step("set", `「${item}」 ${count}만큼 ${add ? "주기" : "빼앗기"}`, "changeItem");
    }
    case "transfer": return step("end", `맵 「${refLabel(ctx, "map", a0)}」(${numberText(ctx, a1)}, ${numberText(ctx, a2)})로 이동 — 이벤트 끝`, "transfer");
    case "wait": return step("fx", `기다리기 ${numberText(ctx, a0)}프레임`, "wait");
    case "callCommonEvent": return step("call", `공통 이벤트 「${refLabel(ctx, "commonEvent", a0)}」 부르기`, "callCommonEvent");
    case "battle": return step("call", `전투 「${refLabel(ctx, "troop", a0)}」`, "battle");
    case "shake": return step("fx", `화면 흔들기${a0 ? ` (세기 ${numberText(ctx, a0)}${a1 ? ` · ${numberText(ctx, a1)}프레임` : ""})` : ""}`, "showAnimation");
    case "moveEvent": return step("move", `${eventWho(ctx, a0)} 움직이기`, "moveEvent");
    case "inputNumber": return step("ask", "숫자 입력", "inputNumber");
    case "cmd": {
      const kind = literalString(ctx, objectProp(ctx, a0, "kind"));
      if (a0 && ctx.describeCommand) {
        try {
          const parsed = JSON.parse(unwrap(ctx, a0).getText(ctx.file)) as unknown;
          const text = parsed && typeof parsed === "object" ? ctx.describeCommand(parsed as Record<string, unknown>) : undefined;
          if (text) return step(kind === "text" || kind === "showMessage" ? "say" : "call", text, kind);
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

// ── conditions ───────────────────────────────────────────────────────────────

/**
 * A condition clause as a verb stem, so it can end a sentence (stem + 「(으)면」) or join another clause
 * (stem + 「고」 / 「거나」): 「돈이 총액보다 적」, 「이 이벤트에서 이미 했」, 「할인율이 0보다 크」.
 */
interface Clause {
  readonly stem: string;
  /** The short form (「돈 < 총액」) — the old head text. */
  readonly short: string;
  readonly code?: boolean;
}

/** stem + 으면/면 — 「적」 → 「적으면」, 「크」 → 「크면」, 「3이」 → 「3이면」. */
export function finalForm(stem: string): string {
  return `${stem}${hasBatchim(stem) ? "으면" : "면"}`;
}

/** A noun used as a predicate: 「3」 → 「3이」, 「사」 → 「사」 (copula 이 drops after a vowel). */
function copula(noun: string): string {
  return hasBatchim(noun) ? `${noun}이` : noun;
}

const COUNTISH = /돈|개수|소지금|골드|총액|가격|수량|횟수|금액|비용/u;

function compareClause(subject: string, word: string, value: string): string {
  const subj = josa(subject, "이", "가");
  const countish = COUNTISH.test(subject) || COUNTISH.test(value);
  switch (word) {
    case "=": return `${subj} ${copula(value)}`;
    case "≠": return `${subj} ${josa(value, "이", "가")} 아니`;
    case ">": return `${subj} ${value}보다 ${countish ? "많" : "크"}`;
    case "<": return `${subj} ${value}보다 ${countish ? "적" : "작"}`;
    case "≥": return `${subj} ${value} 이상이`;
    case "≤": return `${subj} ${value} 이하이`;
    default: return `${subj} ${word} ${copula(value)}`;
  }
}

function choiceLabel(ctx: FlowContext, node: TS.Expression, right: TS.Expression): string | undefined {
  const left = unwrap(ctx, node);
  if (!ctx.ts.isIdentifier(left) || !ctx.choices.has(left.text)) return undefined;
  const options = ctx.choices.get(left.text)!;
  const index = Number(right.getText(ctx.file));
  if (!Number.isInteger(index)) return undefined;
  const option = index === -1 ? "취소" : options[index];
  // 「1병 산다 («가격»G)」 → 「1병 산다」: the price hint belongs to the choice line, not to every condition on it
  return option === undefined ? undefined : option.replace(/\s*[(（][^()（）]*[)）]\s*$/u, "").trim() || option;
}

/** `a === 0 || a === 1` on one choice local → its option labels, else undefined. */
function choiceAnyOf(ctx: FlowContext, expr: TS.Expression): string[] | undefined {
  const node = unwrap(ctx, expr);
  if (!ctx.ts.isBinaryExpression(node)) return undefined;
  if (node.operatorToken.kind === ctx.ts.SyntaxKind.BarBarToken) {
    const left = choiceAnyOf(ctx, node.left);
    const right = choiceAnyOf(ctx, node.right);
    return left && right ? [...left, ...right] : undefined;
  }
  const word = COMPARE_WORD[node.operatorToken.getText(ctx.file)];
  if (word !== "=") return undefined;
  const label = choiceLabel(ctx, node.left, node.right);
  return label === undefined ? undefined : [label];
}

function selfSwitchClause(ctx: FlowContext, key: string, on: boolean, target?: TS.Expression): Clause {
  const label = ctx.labels.selfSwitches.get(key);
  const who = target ? eventWho(ctx, target) : "이 이벤트";
  const short = `${who} 기억 ${key} ${on ? "켜짐" : "꺼짐"}`;
  if (label) return { stem: on ? `${josa(who, "이", "가")} 「${label}」 상태이` : `${josa(who, "이", "가")} 아직 「${label}」 상태가 아니`, short };
  if (key === "A") return { stem: on ? `${who}에서 이미 했` : `${who}에서 아직 안 했`, short };
  return { stem: `${who} 기억 ${josa(key, "이", "가")} ${on ? "켜져 있" : "꺼져 있"}`, short };
}

function negateClause(clause: Clause): Clause {
  return { stem: `${clause.stem}${clause.stem.endsWith("아니") ? "" : "지 않"}`, short: `아님: ${clause.short}`, ...(clause.code ? { code: true } : {}) };
}

/** Plain-language condition clause, or a short code text (code: true). */
function conditionClause(ctx: FlowContext, node: TS.Expression): Clause {
  const ts = ctx.ts;
  const expr = unwrap(ctx, node);
  if (ts.isPrefixUnaryExpression(expr) && expr.operator === ts.SyntaxKind.ExclamationToken) {
    const call = gameCall(ctx, expr.operand);
    if (call?.api === "getSwitch") {
      const name = refLabel(ctx, "switch", call.args[0]);
      return { stem: `스위치 「${name}」${hasBatchim(name) ? "이" : "가"} 꺼져 있`, short: `스위치 「${name}」 꺼짐` };
    }
    if (call?.api === "getSelfSwitch") return selfSwitchClause(ctx, literalString(ctx, call.args[0]) ?? "?", false, call.args[1]);
    if (call?.api === "hasItem") {
      const name = refLabel(ctx, "item", call.args[0]);
      return { stem: `「${name}」${hasBatchim(name) ? "이" : "가"} 없`, short: `「${name}」 없음` };
    }
    if (call?.api === "eventAt") return { stem: `(${numberText(ctx, call.args[0])}, ${numberText(ctx, call.args[1])}) 칸에 다른 이벤트가 없`, short: shortCode(ctx, expr) };
    if (call?.api === "passable") return { stem: `(${numberText(ctx, call.args[0])}, ${numberText(ctx, call.args[1])}) 칸이 막혀 있`, short: shortCode(ctx, expr) };
    const operand = unwrap(ctx, expr.operand);
    if (ts.isIdentifier(operand) && hasPlainName(ctx, operand.text)) {
      const name = localName(ctx, operand.text);
      return { stem: `${josa(name, "이", "가")} 없`, short: `${name} 없음` };
    }
    const inner = conditionClause(ctx, expr.operand);
    return inner.code ? { stem: copula(shortCode(ctx, expr)), short: shortCode(ctx, expr), code: true } : negateClause(inner);
  }
  if (ts.isBinaryExpression(expr)) {
    const op = expr.operatorToken.kind;
    if (op === ts.SyntaxKind.AmpersandAmpersandToken || op === ts.SyntaxKind.BarBarToken) {
      const picks = op === ts.SyntaxKind.BarBarToken ? choiceAnyOf(ctx, expr) : undefined;
      if (picks?.length) {
        const list = picks.map((label) => `「${label}」`);
        const last = list.pop()!;
        const joined = list.length ? `${list.join(", ")}${list.length === 1 && !hasBatchim(list[0]!) ? "나" : "이나"} ${last}` : last;
        return { stem: `${josa(joined, "을", "를")} 골랐`, short: picks.map((label) => `「${label}」 고름`).join(" 또는 ") };
      }
      const left = conditionClause(ctx, expr.left);
      const right = conditionClause(ctx, expr.right);
      const and = op === ts.SyntaxKind.AmpersandAmpersandToken;
      if (left.code && right.code) return { stem: copula(shortCode(ctx, expr)), short: shortCode(ctx, expr), code: true };
      return { stem: `${left.stem}${and ? "고" : "거나"} ${right.stem}`, short: `${left.short} ${and ? "그리고" : "또는"} ${right.short}` };
    }
    const word = COMPARE_WORD[expr.operatorToken.getText(ctx.file)];
    if (word) {
      const left = unwrap(ctx, expr.left);
      const right = numberText(ctx, expr.right);
      const label = choiceLabel(ctx, left, expr.right);
      if (label !== undefined) {
        if (word === "=") return { stem: `「${label}」${hasBatchim(label) ? "을" : "를"} 골랐`, short: `「${label}」 고름` };
        if (word === "≠") return { stem: `「${label}」${hasBatchim(label) ? "을" : "를"} 고르지 않았`, short: `「${label}」 고름 아님` };
      }
      // ORDER[step] === N on a literal 「순서」 list
      if (ts.isElementAccessExpression(left) && ts.isIdentifier(left.expression) && ctx.lists.has(left.expression.text)) {
        const list = localName(ctx, left.expression.text);
        const index = valueText(ctx, left.argumentExpression);
        const short = `${list}[${index}] ${word} ${right}`;
        if (word === "=" && /순서|차례/u.test(list) && isPlainNumber(right)) return { stem: `${right}번이 지금 차례이`.replace(/차례이$/u, "차례"), short };
        return { stem: compareClause(`${list}의 ${index}번째 값`, word, right), short };
      }
      let subject: string | undefined;
      if (ts.isIdentifier(left)) subject = localName(ctx, left.text);
      const call = gameCall(ctx, left);
      if (call?.api === "getVar") subject = refLabel(ctx, "variable", call.args[0]);
      if (call?.api === "gold") subject = "돈";
      if (call?.api === "itemCount") subject = `「${refLabel(ctx, "item", call.args[0])}」 개수`;
      const leftText = left.getText(ctx.file);
      const clock = /^(?:game\.time\(\)|\w+)\.(hour|minute|phase)$/u.exec(leftText);
      if (clock) subject = clock[1] === "hour" ? "시각(시)" : clock[1] === "minute" ? "시각(분)" : "시간대";
      const readableSubject = subject ?? valueText(ctx, left);
      const code = subject === undefined && /[A-Za-z_$]/u.test(readableSubject.replace(/「[^」]*」/gu, ""));
      return { stem: compareClause(readableSubject, word, right), short: `${readableSubject} ${word} ${right}`, ...(code ? { code: true } : {}) };
    }
  }
  const call = gameCall(ctx, expr);
  if (call?.api === "getSwitch") {
    const name = refLabel(ctx, "switch", call.args[0]);
    return { stem: `스위치 「${name}」${hasBatchim(name) ? "이" : "가"} 켜져 있`, short: `스위치 「${name}」 켜짐` };
  }
  if (call?.api === "getSelfSwitch") return selfSwitchClause(ctx, literalString(ctx, call.args[0]) ?? "?", true, call.args[1]);
  if (call?.api === "hasItem") {
    const name = refLabel(ctx, "item", call.args[0]);
    return { stem: `「${name}」${hasBatchim(name) ? "을" : "를"} 가지고 있`, short: `「${name}」 가짐` };
  }
  if (call?.api === "passable") return { stem: `(${numberText(ctx, call.args[0])}, ${numberText(ctx, call.args[1])}) 칸으로 지나갈 수 있`, short: shortCode(ctx, expr) };
  if (call?.api === "eventAt") return { stem: `(${numberText(ctx, call.args[0])}, ${numberText(ctx, call.args[1])}) 칸에 다른 이벤트가 있`, short: shortCode(ctx, expr) };
  if (ts.isIdentifier(expr) && hasPlainName(ctx, expr.text)) {
    const name = localName(ctx, expr.text);
    return { stem: `${josa(name, "이", "가")} 있`, short: name };
  }
  const code = shortCode(ctx, expr);
  return { stem: copula(code), short: code, code: true };
}

function flowStatements(ctx: FlowContext, statements: readonly TS.Statement[]): ScriptFlowNode[] {
  const out: ScriptFlowNode[] = [];
  for (const statement of statements) {
    const at = lineOf(ctx, statement);
    const heading = ctx.labels.headings.get(at);
    if (heading && !ctx.headingsShown.has(at)) {
      ctx.headingsShown.add(at);
      out.push({ k: "heading", text: heading, line: at });
    }
    out.push(...flowStatement(ctx, statement));
  }
  return out;
}

function flowBlock(ctx: FlowContext, statement: TS.Statement | undefined): ScriptFlowNode[] {
  if (!statement) return [];
  return ctx.ts.isBlock(statement) ? flowStatements(ctx, statement.statements) : flowStatements(ctx, [statement]);
}

/** Names a declaration's value has for free: the player, this event, a named event, a variable read. */
function declarationAlias(ctx: FlowContext, init: TS.Expression): string | undefined {
  const call = gameCall(ctx, init);
  if (!call) return undefined;
  if (call.api === "player") return "주인공";
  if (call.api === "event") {
    const arg = call.args[0] ? unwrap(ctx, call.args[0]) : undefined;
    if (arg && gameCall(ctx, arg)?.api === "eventId") return "이 이벤트";
    const id = literalString(ctx, arg);
    if (id) return scriptRefName(ctx.project, "event", id);
  }
  if (call.api === "eventId") return "이 이벤트";
  if (call.api === "time") return "시계";
  if (call.api === "getVar" || call.api === "addVar") return refLabel(ctx, "variable", call.args[0]);
  if (call.api === "gold") return "돈";
  if (call.api === "itemCount") return `「${refLabel(ctx, "item", call.args[0])}」 개수`;
  return undefined;
}

/** The label a helper call reads by (`discountPercent(rep)` → 「할인율」), for a local that has no name of its own. */
function helperLabel(ctx: FlowContext, init: TS.Expression): string | undefined {
  const inner = unwrap(ctx, init);
  if (!ctx.ts.isCallExpression(inner) || !ctx.ts.isIdentifier(inner.expression)) return undefined;
  const name = localName(ctx, inner.expression.text);
  return name === inner.expression.text ? undefined : name;
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
        out.push({ k: "step", tone: "ask", text: `선택지: ${options.map((option) => `「${option}」`).join(" · ")}`, line, like: "choices" });
        continue;
      }
      if (call?.api === "inputNumber" && ts.isIdentifier(declaration.name)) {
        if (!ctx.labels.names.has(name)) ctx.aliases.set(name, "입력한 숫자");
        out.push({ k: "step", tone: "ask", text: "숫자 입력", line, like: "inputNumber" });
        continue;
      }
      const alias = ts.isIdentifier(declaration.name) ? declarationAlias(ctx, init) : undefined;
      if (alias && call?.api !== "addVar") {
        if (!ctx.labels.names.has(name)) ctx.aliases.set(name, alias);
        continue; // a read with a plain name needs no line of its own
      }
      if (call?.api === "addVar" && ts.isIdentifier(declaration.name) && !ctx.labels.names.has(name)) ctx.aliases.set(name, refLabel(ctx, "variable", call.args[0]));
      const literal = literalKind(ts, unwrap(ctx, init));
      if (literal && statement.declarationList.flags & ts.NodeFlags.Const) {
        ctx.consts.set(name, unwrap(ctx, init).getText(ctx.file));
        continue; // literal values are written into the lines that use them
      }
      const listInit = unwrap(ctx, init);
      if (ts.isArrayLiteralExpression(listInit) && listInit.elements.every((element) => literalKind(ts, unwrap(ctx, element)))) {
        const values = listInit.elements.map((element) => {
          const value = stripQuotes(element.getText(ctx.file)) ?? "";
          return isEventId(ctx.project, value) ? scriptRefName(ctx.project, "event", value) : value;
        });
        ctx.lists.set(name, values);
        out.push({ k: "step", tone: "set", text: `정해 둔 ${hasPlainName(ctx, name) ? localName(ctx, name) : `목록 ${name}`}: ${values.join(", ")}`, line });
        continue;
      }
      const step = gameStep(ctx, init, line);
      if (step && step.tone !== "calc") {
        out.push(step);
        continue;
      }
      // a computed local: 「할인율 구하기 (마을 평판)」, 「총액 정하기 — 할인된 가격 × 개수」
      const helper = helperLabel(ctx, init);
      if (helper && !ctx.labels.names.has(name) && !readIdentifier(name)) ctx.aliases.set(name, helper);
      const label = ctx.labels.names.get(name) ?? helper ?? localName(ctx, name);
      const inner = unwrap(ctx, init);
      if (helper && label === helper && ts.isCallExpression(inner)) {
        if (!ctx.labels.names.has(name)) ctx.aliases.set(name, helper);
        out.push({ k: "step", tone: "calc", text: `${helper} 구하기 (${inner.arguments.map((arg) => valueText(ctx, arg)).join(", ")})`, line });
        continue;
      }
      if (label !== name) {
        const value = valueText(ctx, init);
        const explicit = ctx.labels.names.has(name);
        if (looksLikeCode(value) && !explicit) {
          out.push({ k: "step", tone: "calc", text: `${name} = ${shortCode(ctx, init, 60)}`, line, code: true });
          continue;
        }
        if (!explicit) ctx.aliases.set(name, label);
        out.push({ k: "step", tone: "calc", text: looksLikeCode(value) ? `${label} 정하기 (계산)` : `${label} 정하기 — ${clip(value, 70)}`, line });
        continue;
      }
      out.push({ k: "step", tone: "calc", text: `${name} = ${shortCode(ctx, init, 60)}`, line, code: true });
    }
    return out;
  }
  if (ts.isIfStatement(statement)) {
    const cond = conditionClause(ctx, statement.expression);
    return [{
      k: "branch",
      head: cond.short,
      sentence: finalForm(cond.stem),
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
    const listNode = unwrap(ctx, statement.expression);
    const list = ts.isIdentifier(listNode) ? localName(ctx, listNode.text) : clip(valueText(ctx, statement.expression), 40);
    const item = ctx.labels.names.get(variable) ?? (/ 목록$/u.test(list) ? list.replace(/ 목록$/u, "") : readIdentifier(variable) ?? "항목");
    if (!ctx.labels.names.has(variable)) ctx.aliases.set(variable, `그 ${item}`);
    return [{ k: "loop", head: `${list}의 각 ${item}마다`, line, body: flowBlock(ctx, statement.statement) }];
  }
  if (ts.isForStatement(statement) || ts.isWhileStatement(statement) || ts.isDoStatement(statement)) {
    const head = ts.isWhileStatement(statement) && statement.expression.kind === ts.SyntaxKind.TrueKeyword
      ? "계속 반복 (멈출 때까지)"
      : ts.isForStatement(statement)
        ? `반복: ${shortCode(ctx, statement, 50).replace(/\{[\s\S]*$/u, "").trim()}`
        : `${finalForm(conditionClause(ctx, statement.expression).stem).replace(/면$/u, "는 동안")} 반복`;
    return [{ k: "loop", head, line, body: flowBlock(ctx, statement.statement) }];
  }
  if (ts.isReturnStatement(statement)) return [{ k: "step", tone: "end", text: "여기서 끝", line, like: "exitEvent" }];
  if (ts.isBreakStatement(statement)) return [{ k: "step", tone: "end", text: "반복 멈춤", line, like: "breakLoop" }];
  if (ts.isFunctionDeclaration(statement)) {
    const fn = statement.name?.text ?? "";
    const label = localName(ctx, fn);
    return [{ k: "step", tone: "calc", text: label !== fn ? `도움 계산 「${label}」` : `도움 함수 ${fn}`, line, code: label === fn }];
  }
  return [{ k: "step", tone: "calc", text: shortCode(ctx, statement), line, code: true }];
}

/** Helper labels from `import { a, b } from "@lib/<id>"` (the module's own @label comments, else a reading). */
function importedHelpers(ts: TypeScriptApi, file: TS.SourceFile, project: Project | undefined): Map<string, string> {
  const out = new Map<string, string>();
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const id = /^@lib\/(.+)$/u.exec(statement.moduleSpecifier.text)?.[1];
    const module = id ? (project as { scriptLibrary?: readonly { id: string; source?: string }[] } | undefined)?.scriptLibrary?.find((entry) => entry.id === id) : undefined;
    const labels = module?.source ? readScriptLabels(module.source).names : new Map<string, string>();
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const element of bindings.elements) {
      const original = (element.propertyName ?? element.name).text;
      const label = labels.get(original) ?? readIdentifier(original);
      if (label) out.set(element.name.text, label);
    }
  }
  return out;
}

/** Plain-language flow tree of a script. */
export function scriptFlow(
  source: string,
  project?: Project,
  ts: TypeScriptApi = scriptTs(),
  describeCommand?: FlowContext["describeCommand"],
): ScriptFlowNode[] {
  const file = ts.createSourceFile("/script.ts", source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const ctx: FlowContext = {
    ts,
    file,
    ...(project ? { project } : {}),
    ...(describeCommand ? { describeCommand } : {}),
    labels: readScriptLabels(source),
    choices: new Map(),
    consts: new Map(),
    aliases: new Map(),
    lists: new Map(),
    helpers: importedHelpers(ts, file, project),
    headingsShown: new Set(),
  };
  return flowStatements(ctx, file.statements);
}
