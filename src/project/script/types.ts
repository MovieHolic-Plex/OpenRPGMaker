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
