// project/script/types.ts — sandboxed TypeScript script data shapes (player-safe: no compiler, no engine).
//
// A `script` event command carries the author's TypeScript source and the JavaScript the editor compiled
// at save time. The game runs only `compiled`, inside a QuickJS sandbox (src/player/script). Static
// effects (which switches/variables/items the script reads or writes) are extracted at save so the
// editor's validators keep seeing script logic. Wiki: openwiki/script-sandbox.md.

/** Bumped when the `game` API changes shape in a way old compiled scripts could notice. */
export const SCRIPT_API_VERSION = 1;

/** Kinds of project ids a script can name. */
export const SCRIPT_REF_KINDS = [
  "switch",
  "variable",
  "string",
  "selfSwitch",
  "item",
  "actor",
  "skill",
  "commonEvent",
  "map",
  "troop",
  "event",
  "resource",
  "animation",
  "library",
] as const;

export type ScriptRefKind = (typeof SCRIPT_REF_KINDS)[number];

export interface ScriptRef {
  readonly kind: ScriptRefKind;
  readonly id: string;
}

/** A call whose id argument is computed at run time — validators cannot see what it touches. */
export interface ScriptDynamicRef {
  readonly api: string;
  readonly line: number;
}

/** What a script touches, extracted from string-literal arguments at save time. */
export interface ScriptEffects {
  readonly reads: readonly ScriptRef[];
  readonly writes: readonly ScriptRef[];
  /** Flow targets: common events called, troops fought, maps transferred to, library modules imported. */
  readonly calls: readonly ScriptRef[];
  readonly dynamic: readonly ScriptDynamicRef[];
}

export const EMPTY_SCRIPT_EFFECTS: ScriptEffects = Object.freeze({ reads: [], writes: [], calls: [], dynamic: [] });

/**
 * A shared helper module in the project's script library. Scripts import it as `@lib/<id>`.
 * Same compile contract as the `script` command: `compiled` is CommonJS-style JavaScript.
 */
export interface ScriptModule {
  id: string;
  /** Human label shown in the editor. */
  name?: string;
  description?: string;
  source: string;
  compiled: string;
  effects?: ScriptEffects;
  sourceHash?: string;
  apiVersion?: number;
}

/**
 * One example situation for a script's plain-language card. Only the SETUP is stored; the editor computes
 * the outcome by running the script headless (src/editor/script/dryRun.ts), so results never drift from code.
 */
export interface ScriptExample {
  /** Short situation label in the author's language (e.g. "평판 10", "밤 22시"). */
  readonly label: string;
  readonly switches?: readonly { readonly id: string; readonly value: boolean }[];
  readonly variables?: readonly { readonly id: string; readonly value: number }[];
  readonly gold?: number;
  readonly items?: readonly { readonly id: string; readonly count: number }[];
  /** In-game clock before the run (Set Time). */
  readonly hour?: number;
  readonly minute?: number;
  /** Answers for choice windows in order (0-based; -1 = cancel). */
  readonly choices?: readonly number[];
  readonly numbers?: readonly number[];
  readonly battleResults?: readonly ("victory" | "defeat" | "escape")[];
}

/**
 * Plain-language explanation of a script, written by a model (assistant or the editor's AI box) for
 * non-coders. Bound to the source it describes: when `sourceHash` differs from `scriptSourceHash(source)` the
 * editor shows it as stale ("옛 코드 기준"). Chips, tunables and flow are extracted mechanically and need no hash.
 */
export interface ScriptExplanation {
  readonly sourceHash: string;
  /** 1-4 short sentences in the author's language. */
  readonly lines: readonly string[];
  readonly examples?: readonly ScriptExample[];
}

export const SCRIPT_EXPLANATION_LINE_LIMIT = 6;
export const SCRIPT_EXAMPLE_LIMIT = 8;

/** Lenient normalizer for stored/model-written explanations; drops anything malformed. */
export function normalizeScriptExplanation(raw: unknown): ScriptExplanation | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const record = raw as Record<string, unknown>;
  if (typeof record.sourceHash !== "string" || !record.sourceHash) return undefined;
  const lines = Array.isArray(record.lines)
    ? record.lines.filter((line): line is string => typeof line === "string" && line.trim().length > 0).map((line) => line.trim().slice(0, 400)).slice(0, SCRIPT_EXPLANATION_LINE_LIMIT)
    : [];
  if (!lines.length) return undefined;
  const examples = Array.isArray(record.examples)
    ? record.examples.map(normalizeScriptExample).filter((entry): entry is ScriptExample => !!entry).slice(0, SCRIPT_EXAMPLE_LIMIT)
    : [];
  return { sourceHash: record.sourceHash, lines, ...(examples.length ? { examples } : {}) };
}

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

export function normalizeScriptExample(raw: unknown): ScriptExample | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  if (typeof r.label !== "string" || !r.label.trim()) return undefined;
  const pairs = <V>(value: unknown, key: "value" | "count", ok: (v: unknown) => v is V) =>
    Array.isArray(value)
      ? value.filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object" && typeof (entry as Record<string, unknown>).id === "string" && ok((entry as Record<string, unknown>)[key]))
          .map((entry) => ({ id: entry.id as string, [key]: entry[key] as V }))
      : [];
  const switches = pairs(r.switches, "value", (v): v is boolean => typeof v === "boolean") as { id: string; value: boolean }[];
  const variables = pairs(r.variables, "value", finite) as { id: string; value: number }[];
  const items = pairs(r.items, "count", finite) as { id: string; count: number }[];
  const ints = (value: unknown): number[] => (Array.isArray(value) ? value.filter(finite).map((v) => Math.trunc(v)) : []);
  const choices = ints(r.choices);
  const numbers = ints(r.numbers);
  const battleResults = Array.isArray(r.battleResults)
    ? r.battleResults.filter((v): v is "victory" | "defeat" | "escape" => v === "victory" || v === "defeat" || v === "escape")
    : [];
  return {
    label: r.label.trim().slice(0, 80),
    ...(switches.length ? { switches } : {}),
    ...(variables.length ? { variables } : {}),
    ...(finite(r.gold) ? { gold: Math.max(0, Math.trunc(r.gold)) } : {}),
    ...(items.length ? { items } : {}),
    ...(finite(r.hour) ? { hour: Math.max(0, Math.min(23, Math.trunc(r.hour))) } : {}),
    ...(finite(r.minute) ? { minute: Math.max(0, Math.min(59, Math.trunc(r.minute))) } : {}),
    ...(choices.length ? { choices } : {}),
    ...(numbers.length ? { numbers } : {}),
    ...(battleResults.length ? { battleResults } : {}),
  };
}

export const SCRIPT_LIBRARY_ID_PATTERN = /^[a-z][a-z0-9_-]{0,39}$/u;
/** Source and compiled-code size caps (characters). Store uploads also cap project.json as a whole. */
export const SCRIPT_SOURCE_LIMIT = 64_000;
export const SCRIPT_COMPILED_LIMIT = 192_000;
export const SCRIPT_LIBRARY_LIMIT = 64;

/** djb2-style hash of the source; used to notice a source edited without recompiling. */
export function scriptSourceHash(source: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 5381;
  for (let index = 0; index < source.length; index += 1) {
    const code = source.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 0x01000193);
    h2 = (Math.imul(h2, 33) + code) | 0;
  }
  return `${(h1 >>> 0).toString(16).padStart(8, "0")}${(h2 >>> 0).toString(16).padStart(8, "0")}`;
}

/** Is the compiled JavaScript up to date with the source? Missing hash (hand-written compiled code) counts as fresh. */
export function scriptCompiledIsFresh(entry: { readonly source: string; readonly compiled: string; readonly sourceHash?: string }): boolean {
  if (!entry.compiled.trim()) return entry.source.trim().length === 0;
  return entry.sourceHash === undefined || entry.sourceHash === scriptSourceHash(entry.source);
}
