import { acceptanceRecord, parseAcceptanceCriteria, type AcceptanceCriterion, type RequirementWithdrawalAction } from "./assistantAcceptance";
import { acceptanceFingerprint, selectedPath } from "./assistantAcceptanceEvaluation";
import { getTool } from "@/editor/tools/toolRegistry";
import type { JsonSchema } from "@/editor/tools/types";

export interface RequestSourceSpan { readonly start: number; readonly end: number; readonly quote: string }
export interface RequestSourceBinding {
  readonly source: RequestSourceSpan;
  readonly role: "preserve" | "prohibit" | "value" | "width" | "height" | "count" | "minimum" | "maximum" | "coordinate";
  readonly criterionIndex: number;
  readonly fieldPath: readonly string[];
}
export interface RequestSourceUnit {
  readonly bindings?: readonly RequestSourceBinding[];
  readonly withdrawal?: RequirementWithdrawalAction & { readonly source: "user" };
  readonly id: string;
  readonly source: RequestSourceSpan;
  readonly coverage: "uncovered" | "unsupported" | "declared";
  readonly criteria: readonly AcceptanceCriterion[] | null;
  readonly unresolvedReason?: string;
  readonly supersededBy?: string;
  readonly archivedEvidence?: readonly { readonly expected: string; readonly observed: string; readonly passed: boolean }[];
}
export interface RequestSource {
  readonly requestId: string;
  readonly rawInstruction: string;
  readonly authoring?: boolean;
  readonly units: readonly RequestSourceUnit[];
}

interface SourceToken { readonly kind: "literal" | "separator" | "format"; readonly start: number; readonly end: number }
/** One lexical scan owns boundaries AND literal constraints. No semantic/genre decisions. */
function sourceTokens(raw: string): SourceToken[] {
  const tokens: SourceToken[] = [];
  const word = (char: string | undefined): boolean => char !== undefined && /[\p{L}\p{N}_]/u.test(char);
  for (let i = 0; i < raw.length;) {
    const start = i, char = raw[i];
    if (i === 0 || raw[i - 1] === "\n") {
      const marker = /^[ \t]*(?:\d+[.)]|[-*•])[ \t]+/u.exec(raw.slice(i));
      if (marker) { i += marker[0].length; tokens.push({ kind: "format", start, end: i }); continue; }
    }
    if (char === '"' || (char === "'" && !word(raw[i - 1]))) {
      i++;
      while (i < raw.length) {
        if (raw[i] === "\\") { i += Math.min(2, raw.length - i); continue; }
        if (raw[i] === char && !(char === "'" && word(raw[i - 1]) && word(raw[i + 1]))) { i++; break; }
        i++;
      }
      tokens.push({ kind: "literal", start, end: i }); continue;
    }
    if (char === "." && /\d/u.test(raw[i - 1] ?? "") && /\d/u.test(raw[i + 1] ?? "")) { i++; continue; }
    if (/[.!?;\n]/u.test(char ?? "")) { tokens.push({ kind: "separator", start, end: ++i }); continue; }
    if (/\s/u.test(char ?? "")) {
      const separator = /^\s+(?:and|then|그리고|또한)\s+/iu.exec(raw.slice(i));
      if (separator) { i += separator[0].length; tokens.push({ kind: "separator", start, end: i }); continue; }
    }
    i++;
  }
  return tokens;
}

/** Coverage inventory, not an intent/genre classifier. Quoted literals remain indivisible. */
export function createRequestSource(requestId: string, rawInstruction: string): RequestSource {
  const units: RequestSourceUnit[] = [];
  let start = 0;
  const append = (end: number): void => {
    const raw = rawInstruction.slice(start, end);
    const quote = raw.trim().replace(/^[-*•]\s+/u, "");
    if (quote) {
      const offset = start + raw.indexOf(quote);
      units.push({ id: `${requestId}:source:${units.length}`, source: { start: offset, end: offset + quote.length, quote }, coverage: "uncovered", criteria: null });
    }
  };
  for (const token of sourceTokens(rawInstruction)) {
    if (token.kind === "literal") continue;
    if (token.kind === "separator") append(token.start);
    start = token.end;
  }
  append(rawInstruction.length);
  return { requestId, rawInstruction, units };
}
export function parseRequestSourceSpan(raw: string, value: unknown): RequestSourceSpan | null {
  if (!acceptanceRecord(value) || Object.keys(value).some(key => !["start", "end", "quote"].includes(key))
    || typeof value.start !== "number" || typeof value.end !== "number" || !Number.isSafeInteger(value.start) || !Number.isSafeInteger(value.end)
    || value.start < 0 || value.end <= value.start || value.end > raw.length || value.quote !== raw.slice(value.start, value.end)) return null;
  return { start: value.start, end: value.end, quote: raw.slice(value.start, value.end) };
}
const within = (inner: RequestSourceSpan, outer: RequestSourceSpan): boolean => inner.start >= outer.start && inner.end <= outer.end;
const preservation = /\b(?:preserve|unchanged|without|never|not|no|keep|don't|cannot)\b|유지|보존|금지|말고|없이|하지\s*마/giu;
function preservationSpans(source: RequestSourceSpan): RequestSourceSpan[] {
  const literals = sourceTokens(source.quote).filter(token => token.kind === "literal");
  return [...source.quote.matchAll(preservation)]
    .filter(match => !literals.some(token => match.index < token.end && match.index + match[0].length > token.start))
    .map(match => ({ start: source.start + match.index, end: source.start + match.index + match[0].length, quote: match[0] }));
}
/** Answer demotion also requires numeric coverage; the ordinary write gate stays preservation-only. */
export function hasUnresolvedWriteConstraint(requests: readonly RequestSource[], includeNumeric = false): boolean {
  return requests.some(request => request.authoring !== false && request.units.some(unit => !unit.supersededBy && !unit.withdrawal && unit.coverage !== "declared"
    && (preservationSpans(unit.source).length > 0 || (includeNumeric && /\d/u.test(unit.source.quote)))));
}
/** Bind authored values/identities, never criterion discriminators or path metadata. */
function scalarBindingField(criterion: AcceptanceCriterion, path: readonly string[]): boolean {
  const index = (key: string | undefined): boolean => key !== undefined && /^(?:0|[1-9]\d*)$/u.test(key);
  if (criterion.kind === "valueEquals" && path.length === 1 && path[0] === "value") return true;
  if ("target" in criterion && path.length === 2 && path[0] === "target") return path[1] === "mapId" || path[1] === "newMapName";
  if (criterion.kind === "mapCount" && path.length === 3 && path[0] === "targets" && index(path[1])) return path[2] === "mapId" || path[2] === "newMapName";
  if ("subject" in criterion && path.length === 2 && path[0] === "subject") return ["id", "mapId", "eventId"].includes(path[1] ?? "");
  if ("collection" in criterion && path.length === 2 && path[0] === "collection") return path[1] === "mapId";
  if ("selector" in criterion && path.length === 3 && path[0] === "selector" && index(path[2])) return path[1] === "ids" || path[1] === "names";
  if (criterion.kind !== "toolVerdict" || path[0] !== "args" || path.length < 2) return false;
  // Use the registered native schema, not arbitrary fields in a model's args.
  // Undeclared/dynamic-map leaves remain unresolved rather than guessed.
  let schema: JsonSchema | undefined = getTool(criterion.tool)?.parameters;
  for (const key of path.slice(1)) {
    if (schema?.type === "array" && index(key)) schema = schema.items;
    else if (schema?.type === "object" && schema.properties && Object.hasOwn(schema.properties, key)) schema = schema.properties[key];
    else return false;
  }
  return schema !== undefined && (schema.type === undefined
    ? !schema.properties && !schema.items
    : typeof schema.type === "string" && ["string", "number", "integer", "boolean"].includes(schema.type));
}
function parseBindings(raw: string, unit: RequestSourceUnit, entry: Record<string, unknown>, criteria: readonly AcceptanceCriterion[]): readonly RequestSourceBinding[] | null {
  if (!Array.isArray(entry.bindings)) return null;
  const bindings: RequestSourceBinding[] = [];
  const numericBounds: RequestSourceSpan[] = [];
  const literalBounds: RequestSourceSpan[] = [];
  const constraints = preservationSpans(unit.source);
  const preserved = new Set<number>();
  const boundFields = new Map<string, RequestSourceSpan>();
  const bindOnce = (key: string, source: RequestSourceSpan): boolean => {
    const previous = boundFields.get(key);
    if (previous && (previous.start !== source.start || previous.end !== source.end)) return false;
    boundFields.set(key, source);
    return true;
  };
  for (const value of entry.bindings) {
    if (!acceptanceRecord(value) || Object.keys(value).some(key => !["source", "role", "criterionIndex", "fieldPath"].includes(key))) return null;
    const source = parseRequestSourceSpan(raw, value.source);
    if (!source || !within(source, unit.source) || typeof value.criterionIndex !== "number" || !Number.isSafeInteger(value.criterionIndex)) return null;
    const criterion = criteria[value.criterionIndex];
    if (!criterion || !Array.isArray(value.fieldPath) || !value.fieldPath.every(key => typeof key === "string" && !["__proto__", "constructor", "prototype"].includes(key))) return null;
    const field = selectedPath(criterion, value.fieldPath);
    const role = value.role;
    if (role === "preserve" || role === "prohibit") {
      const supported = ["entityPreserve", "membershipPreserve", "preserve"].includes(criterion.kind)
        || (criterion.kind === "entityCount" && criterion.comparison === "eq" && criterion.count === 0);
      const matches = constraints.filter(constraint => within(constraint, source));
      // A broad anchor or repeated predicate cannot discharge independent markers.
      if (!supported || matches.length !== 1) return null;
      const constraint = matches[0]!;
      if (!bindOnce(acceptanceFingerprint(["preserve", criterion]), constraint)) return null;
      preserved.add(constraint.start);
    } else if (role === "value") {
      if (!scalarBindingField(criterion, value.fieldPath)) return null;
      if (typeof field === "string") {
        if (!(source.quote === JSON.stringify(field) || source.quote === `'${field}'`)) return null;
        literalBounds.push(source);
      } else if (typeof field === "number") {
        if (!/^-?\d+(?:\.\d+)?$/u.test(source.quote) || Number(source.quote) !== field) return null;
      } else if (typeof field === "boolean" || field === null) {
        if (source.quote !== JSON.stringify(field)) return null;
      } else return null;
      numericBounds.push(source);
    } else {
      const numeric = Number(source.quote);
      if (!/^-?\d+(?:\.\d+)?$/u.test(source.quote) || !Number.isFinite(numeric) || field !== numeric) return null;
      const fieldName = value.fieldPath.at(-1);
      if (role === "width" || role === "height" || role === "count") {
        if (fieldName !== role) return null;
        if (role === "count" && criterion.kind === "entityCount" && criterion.comparison !== "eq") return null;
      } else if (role === "minimum" || role === "maximum") {
        if (criterion.kind !== "entityCount" || criterion.comparison !== (role === "minimum" ? "gte" : "lte")) return null;
        const prefix = raw.slice(Math.max(unit.source.start, source.start - 12), source.start);
        if (!(role === "minimum" ? /(?:at least|minimum|>=|최소)\s*$/iu : /(?:at most|maximum|<=|최대)\s*$/iu).test(prefix)) return null;
      } else if (role === "coordinate") {
        if (fieldName !== "x" && fieldName !== "y") return null;
      } else return null;
      numericBounds.push(source);
    }
    bindings.push({ source, role, criterionIndex: value.criterionIndex, fieldPath: value.fieldPath });
    // Canonical content, not array index: duplicate criteria do not create fields.
    if (role !== "preserve" && role !== "prohibit"
      && !bindOnce(acceptanceFingerprint(["field", criterion, value.fieldPath]), source)) return null;
  }
  for (const match of unit.source.quote.matchAll(/\d+(?:\.\d+)?/gu)) {
    const start = unit.source.start + match.index;
    if (!numericBounds.some(source => start >= source.start && start + match[0].length <= source.end)) return null;
  }
  for (const token of sourceTokens(unit.source.quote).filter(token => token.kind === "literal")) {
    const start = unit.source.start + token.start, end = unit.source.start + token.end;
    if (!literalBounds.some(source => start >= source.start && end <= source.end)) return null;
  }
  return constraints.every(constraint => preserved.has(constraint.start)) ? bindings : null;
}

/** Model-assisted traceability, not proof of complete natural-language understanding. */
export function extractRequestCoverage(source: RequestSource, payload: unknown): readonly RequestSourceUnit[] {
  const entries = acceptanceRecord(payload) && Array.isArray(payload.entries) ? payload.entries : [];
  return source.units.map(unit => {
    if (unit.coverage === "declared" || unit.withdrawal || unit.supersededBy) return unit; // frozen on first valid adoption
    for (const entry of entries) {
      if (!acceptanceRecord(entry) || Object.keys(entry).some(key => !["source", "criteria", "bindings", "unresolvedReason"].includes(key)) || !Array.isArray(entry.source) || entry.source.length !== 1) continue;
      const anchor = parseRequestSourceSpan(source.rawInstruction, entry.source[0]);
      // A quote around two obligations cannot lend one predicate to both.
      if (!anchor || anchor.start !== unit.source.start || anchor.end !== unit.source.end) continue;
      const criteria = parseAcceptanceCriteria(entry.criteria);
      const bindings = criteria ? parseBindings(source.rawInstruction, unit, entry, criteria) : null;
      if (!criteria || !bindings) return { ...unit, coverage: "unsupported", criteria: null, unresolvedReason: typeof entry.unresolvedReason === "string" ? entry.unresolvedReason : "Missing supported predicates or source constraint bindings" };
      return { ...unit, coverage: "declared", criteria: structuredClone(criteria), bindings: structuredClone(bindings), unresolvedReason: undefined };
    }
    return unit;
  });
}
