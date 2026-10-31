// editor/script/analyze.ts — static read/write extraction and lint for script sources.
//
// Reads `game.<api>("literal", …)` calls using the `refs` table in SCRIPT_API, `game.cmd({ kind, …Id: "x" })`
// objects, and `@lib/<id>` imports. Non-literal ids are recorded as `dynamic` (validators then know they cannot
// see that reference). Also produces the one-line Korean summary non-coders see in the event list and
// warnings: un-awaited awaitable calls, unknown ids (with a "did you mean"), awaitable calls after transfer.
import { SCRIPT_API_BY_NAME, type ScriptApiEntry } from "@/project/script/apiSpec";
import type { ScriptDynamicRef, ScriptEffects, ScriptRef, ScriptRefKind } from "@/project/script/types";
import type { Project } from "@/project/types";
import { libraryIdFromSpecifier } from "@/project/script/library";
import { SCRIPT_CMD_ID_FIELDS as CMD_ID_FIELDS, scriptCmdAccess } from "@/project/script/effects";
import type { TypeScriptApi } from "./tsEnv";
import type * as TS from "typescript5";

export type ScriptDiagnosticSeverity = "error" | "warning" | "info";

export interface ScriptDiagnostic {
  /** 1-based. */
  readonly line: number;
  /** 1-based. */
  readonly column: number;
  readonly message: string;
  readonly severity: ScriptDiagnosticSeverity;
  readonly source: "syntax" | "type" | "analyzer";
  readonly code?: number;
}

export interface ScriptAnalysis {
  readonly effects: ScriptEffects;
  readonly diagnostics: ScriptDiagnostic[];
  /** Korean one-liner for the event list ("선택지 · 스위치 lever_1 · 돈"). */
  readonly summary: string;
  /** API names called, in first-call order. */
  readonly apis: string[];
}

function literalText(ts: TypeScriptApi, node: TS.Node | undefined): string | undefined {
  if (!node) return undefined;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return undefined;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0] ?? 0;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = row[j] ?? 0;
      row[j] = Math.min((row[j] ?? 0) + 1, (row[j - 1] ?? 0) + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = temp;
    }
  }
  return row[b.length] ?? 0;
}

/** Closest known id for a typo, or undefined. */
export function closestId(value: string, known: readonly string[]): string | undefined {
  let best: string | undefined;
  let bestScore = Number.POSITIVE_INFINITY;
  const lower = value.toLowerCase();
  for (const candidate of known) {
    const score = candidate.toLowerCase() === lower ? 0 : levenshtein(lower, candidate.toLowerCase());
    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best !== undefined && bestScore <= Math.max(2, Math.floor(value.length / 3)) ? best : undefined;
}

/** Ids (and accepted names) per ref kind for the unknown-id check. `undefined` = not checkable. */
export function knownScriptIds(project: Project | undefined, mapId?: string): Partial<Record<ScriptRefKind, readonly string[]>> {
  if (!project) return {};
  const db = project.database;
  const map = mapId ? project.maps[mapId] : undefined;
  return {
    switch: [...project.switches.map((entry) => entry.id), ...project.switches.map((entry) => entry.name)],
    variable: [...project.variables.map((entry) => entry.id), ...project.variables.map((entry) => entry.name)],
    item: db.items.map((entry) => entry.id),
    actor: db.actors.map((entry) => entry.id),
    skill: db.skills.map((entry) => entry.id),
    commonEvent: project.commonEvents.map((entry) => entry.id),
    map: Object.keys(project.maps),
    troop: db.troops.map((entry) => entry.id),
    ...(map ? { event: map.events.map((entry) => entry.id) } : {}),
    animation: (db.battleAnimations ?? []).map((entry) => entry.id),
    library: (project.scriptLibrary ?? []).map((entry) => entry.id),
  };
}

const REF_KIND_LABEL: Readonly<Record<ScriptRefKind, string>> = {
  switch: "switch",
  variable: "variable",
  string: "string variable",
  selfSwitch: "self switch",
  item: "item",
  actor: "actor",
  skill: "skill",
  commonEvent: "common event",
  map: "map",
  troop: "troop",
  event: "event",
  resource: "resource",
  animation: "animation",
  library: "library module",
};

/** Kinds whose ids are optional to declare (the engine accepts new switch/variable ids at run time). */
const SOFT_KINDS = new Set<ScriptRefKind>(["switch", "variable"]);

export function analyzeScript(
  ts: TypeScriptApi,
  source: string,
  options: { readonly project?: Project; readonly mapId?: string; readonly fileName?: string } = {}
): ScriptAnalysis {
  const file = ts.createSourceFile(options.fileName ?? "/script.ts", source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const reads: ScriptRef[] = [];
  const writes: ScriptRef[] = [];
  const calls: ScriptRef[] = [];
  const dynamic: ScriptDynamicRef[] = [];
  const diagnostics: ScriptDiagnostic[] = [];
  const apis: string[] = [];
  const known = knownScriptIds(options.project, options.mapId);
  const summaryIds = new Map<string, string[]>();

  const position = (node: TS.Node): { line: number; column: number } => {
    const at = file.getLineAndCharacterOfPosition(node.getStart(file));
    return { line: at.line + 1, column: at.character + 1 };
  };
  const warn = (node: TS.Node, message: string, severity: ScriptDiagnosticSeverity = "warning"): void => {
    diagnostics.push({ ...position(node), message, severity, source: "analyzer" });
  };
  const push = (access: "read" | "write" | "call", ref: ScriptRef): void => {
    const list = access === "read" ? reads : access === "write" ? writes : calls;
    if (!list.some((entry) => entry.kind === ref.kind && entry.id === ref.id)) list.push(ref);
  };
  const checkKnown = (node: TS.Node, kind: ScriptRefKind, id: string): void => {
    const list = known[kind];
    if (!list || list.includes(id)) return;
    const guess = closestId(id, list);
    const hint = guess ? ` Did you mean "${guess}"?` : "";
    const soft = SOFT_KINDS.has(kind) ? " It will be created when the script writes it, but no event or page condition uses it yet." : "";
    warn(node, `Unknown ${REF_KIND_LABEL[kind]} "${id}".${hint}${soft}`);
  };

  const visitGameCall = (node: TS.CallExpression, entry: ScriptApiEntry): void => {
    if (!apis.includes(entry.name)) apis.push(entry.name);
    for (const ref of entry.refs ?? []) {
      const argument = node.arguments[ref.arg];
      if (!argument) continue;
      const id = literalText(ts, argument);
      if (id === undefined) {
        dynamic.push({ api: entry.name, line: position(argument).line });
        continue;
      }
      push(ref.access, { kind: ref.kind, id });
      checkKnown(argument, ref.kind, id);
      if (ref.access !== "read") {
        const ids = summaryIds.get(entry.name) ?? [];
        if (!ids.includes(id)) ids.push(id);
        summaryIds.set(entry.name, ids);
      }
    }
    if (entry.name === "cmd") visitCmdObject(node.arguments[0]);
    if (entry.awaits) {
      const parent = node.parent;
      if (parent && (ts.isExpressionStatement(parent) || ts.isVoidExpression(parent))) {
        warn(node, `game.${entry.name}(...) is not awaited. Awaitable calls run one after another through the event system; write \`await game.${entry.name}(...)\` so the script waits for it.`);
      }
    }
  };

  const visitCmdObject = (argument: TS.Expression | undefined): void => {
    if (!argument || !ts.isObjectLiteralExpression(argument)) {
      if (argument) dynamic.push({ api: "cmd", line: position(argument).line });
      return;
    }
    let kind: string | undefined;
    const fields: [string, TS.Expression][] = [];
    for (const property of argument.properties) {
      if (!ts.isPropertyAssignment(property)) continue;
      const name = ts.isIdentifier(property.name) || ts.isStringLiteral(property.name) ? property.name.text : undefined;
      if (!name) continue;
      if (name === "kind") kind = literalText(ts, property.initializer);
      else fields.push([name, property.initializer]);
    }
    const access = scriptCmdAccess(kind);
    for (const [name, initializer] of fields) {
      const refKind = CMD_ID_FIELDS[name];
      if (!refKind) continue;
      const id = literalText(ts, initializer);
      if (id === undefined) {
        dynamic.push({ api: `cmd.${kind ?? "?"}.${name}`, line: position(initializer).line });
        continue;
      }
      push(access, { kind: refKind, id });
      checkKnown(initializer, refKind, id);
    }
  };

  let transferSeen: TS.Node | undefined;
  const visit = (node: TS.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const specifier = node.moduleSpecifier.text;
      const id = libraryIdFromSpecifier(specifier);
      if (id) {
        push("call", { kind: "library", id });
        checkKnown(node.moduleSpecifier, "library", id);
      } else {
        diagnostics.push({ ...position(node.moduleSpecifier), message: `Scripts can only import project library modules ("@lib/<id>"), not "${specifier}".`, severity: "error", source: "analyzer" });
      }
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "require") {
      diagnostics.push({ ...position(node), message: "Use `import { … } from \"@lib/<id>\"` instead of require().", severity: "warning", source: "analyzer" });
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && ts.isIdentifier(node.expression.expression) && node.expression.expression.text === "game") {
      const entry = SCRIPT_API_BY_NAME.get(node.expression.name.text);
      if (entry) {
        if (transferSeen && entry.awaits && entry.name !== "transfer") {
          warn(node, "This game call comes after game.transfer(...). A transfer ends the running event, so it will not run.", "warning");
          transferSeen = undefined;
        }
        visitGameCall(node, entry);
        if (entry.name === "transfer" && node.parent && ts.isAwaitExpression(node.parent)) transferSeen = node;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);

  return { effects: { reads, writes, calls, dynamic }, diagnostics, summary: summarize(apis, summaryIds), apis };
}

function summarize(apis: readonly string[], ids: ReadonlyMap<string, readonly string[]>): string {
  const parts: string[] = [];
  for (const name of apis) {
    const entry = SCRIPT_API_BY_NAME.get(name);
    if (!entry || entry.group === "query" || entry.name === "log" || entry.name.startsWith("get") || entry.name === "itemCount" || entry.name === "hasItem" || entry.name === "gold") continue;
    const named = ids.get(name) ?? [];
    const label = named.length ? `${entry.ko} ${named.slice(0, 2).join(", ")}${named.length > 2 ? "…" : ""}` : entry.ko;
    if (!parts.includes(label)) parts.push(label);
  }
  if (!parts.length) return apis.length ? "조건 확인" : "";
  return parts.length > 5 ? `${parts.slice(0, 5).join(" · ")} 외 ${parts.length - 5}` : parts.join(" · ");
}
