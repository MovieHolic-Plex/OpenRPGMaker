// editor/script/compile.ts — TypeScript script → sandbox JS, with type check, effects and summary.
//
// Used by the script editor (compile at save), the assistant tools (author/edit/check_script) and the
// headless dry run. Sync after `prepareScriptCompiler()`.
//
// - Transpile: `transpileModule` to CommonJS/ES2022. The runtime wraps the output in an async function, so
//   top-level `await` works; `import { x } from "@lib/id"` becomes `require("@lib/id")`.
// - Type check: an in-memory program with the generated game .d.ts (project ids as literal unions),
//   project library modules at `@lib/*`, and ES2022 libs only (no DOM, no Node). The script gets an
//   `export {}` appended so it is a module (top-level await allowed) without shifting line numbers.
import { buildGameApiDts, scriptDtsIds } from "@/project/script/dts";
import { SCRIPT_API_VERSION, SCRIPT_COMPILED_LIMIT, SCRIPT_SOURCE_LIMIT, scriptSourceHash, type ScriptEffects } from "@/project/script/types";
import type { Project } from "@/project/types";
import { analyzeScript, type ScriptDiagnostic } from "./analyze";
import { prepareScriptCompiler, scriptLibSource, scriptTs, type TypeScriptApi } from "./tsEnv";
import type * as TS from "typescript5";

export { prepareScriptCompiler, scriptCompilerReady } from "./tsEnv";
export type { ScriptDiagnostic } from "./analyze";

export interface ScriptCompileOptions {
  readonly project?: Project;
  /** Map whose event ids become the `EventId` type and the unknown-event check. */
  readonly mapId?: string;
  /** Compiling a library module: excluded from the `@lib/*` set it can import. */
  readonly libraryId?: string;
  /** Default true. False skips the (slower) type check — syntax errors and analyzer warnings still come back. */
  readonly typeCheck?: boolean;
}

export interface ScriptCompileResult {
  /** No error diagnostics (warnings allowed). */
  readonly ok: boolean;
  /** Runnable JS. Empty when the source has syntax errors or is empty. */
  readonly compiled: string;
  readonly diagnostics: ScriptDiagnostic[];
  readonly effects: ScriptEffects;
  readonly summary: string;
  readonly sourceHash: string;
  readonly apiVersion: number;
}

const LIB_ENTRY = "lib.es2022.d.ts"; // = SCRIPT_TS_LIB_ENTRY in tsLibSources.generated.ts
const libFileCache = new Map<string, TS.SourceFile>();
let dtsCache: { key: string; file: TS.SourceFile } | undefined;

function compilerOptions(ts: TypeScriptApi): TS.CompilerOptions {
  return {
    strict: true,
    noEmit: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    lib: [LIB_ENTRY],
    types: [],
    skipLibCheck: true,
    noImplicitReturns: false,
    allowUnreachableCode: true,
    paths: { "@lib/*": ["/lib/*"] },
  };
}

function diagnosticFrom(ts: TypeScriptApi, diagnostic: TS.Diagnostic, source: "syntax" | "type", lineLimit: number): ScriptDiagnostic {
  const position = diagnostic.file && diagnostic.start !== undefined ? diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start) : { line: 0, character: 0 };
  return {
    line: Math.min(lineLimit, position.line + 1),
    column: position.character + 1,
    message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
    severity: diagnostic.category === ts.DiagnosticCategory.Error ? "error" : diagnostic.category === ts.DiagnosticCategory.Warning ? "warning" : "info",
    source,
    code: diagnostic.code,
  };
}

function typeCheck(ts: TypeScriptApi, source: string, options: ScriptCompileOptions): ScriptDiagnostic[] {
  const dts = buildGameApiDts(scriptDtsIds(options.project, options.mapId));
  const files = new Map<string, string>([["/script.ts", `${source}\nexport {};\n`]]);
  for (const module of options.project?.scriptLibrary ?? []) {
    if (module.id !== options.libraryId) files.set(`/lib/${module.id}.ts`, module.source);
  }
  const compiler = compilerOptions(ts);
  const host: TS.CompilerHost = {
    getSourceFile(fileName, languageVersion) {
      if (fileName === "/game.d.ts") {
        if (dtsCache?.key !== dts) dtsCache = { key: dts, file: ts.createSourceFile(fileName, dts, languageVersion, true) };
        return dtsCache.file;
      }
      const text = files.get(fileName);
      if (text !== undefined) return ts.createSourceFile(fileName, text, languageVersion, true, ts.ScriptKind.TS);
      const lib = scriptLibSource(fileName);
      if (lib === undefined) return undefined;
      let cached = libFileCache.get(fileName);
      if (!cached) {
        cached = ts.createSourceFile(fileName, lib, languageVersion, true);
        libFileCache.set(fileName, cached);
      }
      return cached;
    },
    getDefaultLibFileName: () => `/${LIB_ENTRY}`,
    getDefaultLibLocation: () => "/",
    writeFile: () => undefined,
    getCurrentDirectory: () => "/",
    getDirectories: () => [],
    getCanonicalFileName: (fileName) => fileName,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => "\n",
    fileExists: (fileName) => fileName === "/game.d.ts" || files.has(fileName) || scriptLibSource(fileName) !== undefined,
    readFile: (fileName) => (fileName === "/game.d.ts" ? dts : files.get(fileName) ?? scriptLibSource(fileName)),
  };
  const program = ts.createProgram({ rootNames: ["/game.d.ts", "/script.ts"], options: compiler, host });
  const script = program.getSourceFile("/script.ts");
  const lineLimit = Math.max(1, source.split("\n").length);
  const out: ScriptDiagnostic[] = [];
  for (const diagnostic of [...program.getSyntacticDiagnostics(script), ...program.getSemanticDiagnostics(script)]) {
    out.push(diagnosticFrom(ts, diagnostic, "type", lineLimit));
  }
  // Problems inside imported library modules surface once, at the import, so the author knows where to look.
  for (const file of program.getSourceFiles()) {
    if (!file.fileName.startsWith("/lib/")) continue;
    const errors = program.getSemanticDiagnostics(file).filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
    if (errors.length) {
      out.push({ line: 1, column: 1, severity: "error", source: "type", message: `Library module @lib/${file.fileName.slice(5, -3)} has ${errors.length} type error(s); fix it first.` });
    }
  }
  return out;
}

/** Compiles one script (or library module). Requires `prepareScriptCompiler()` to have finished. */
export function compileScript(source: string, options: ScriptCompileOptions = {}): ScriptCompileResult {
  const ts = scriptTs();
  const sourceHash = scriptSourceHash(source);
  const diagnostics: ScriptDiagnostic[] = [];
  if (source.length > SCRIPT_SOURCE_LIMIT) {
    diagnostics.push({ line: 1, column: 1, severity: "error", source: "syntax", message: `Script is ${source.length} characters; the limit is ${SCRIPT_SOURCE_LIMIT}. Move shared code into a library module.` });
  }
  const transpiled = ts.transpileModule(source, {
    fileName: "/script.ts",
    reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, removeComments: false, sourceMap: false, inlineSourceMap: false },
  });
  const lineLimit = Math.max(1, source.split("\n").length);
  const syntax = (transpiled.diagnostics ?? []).map((diagnostic) => diagnosticFrom(ts, diagnostic, "syntax", lineLimit));
  diagnostics.push(...syntax);
  const analysis = analyzeScript(ts, source, { project: options.project, mapId: options.mapId });
  diagnostics.push(...analysis.diagnostics);
  if (!syntax.some((diagnostic) => diagnostic.severity === "error") && options.typeCheck !== false && source.trim()) {
    diagnostics.push(...typeCheck(ts, source, options));
  }
  const hasSyntaxError = syntax.some((diagnostic) => diagnostic.severity === "error");
  let compiled = hasSyntaxError || !source.trim() ? "" : transpiled.outputText;
  if (compiled.length > SCRIPT_COMPILED_LIMIT) {
    diagnostics.push({ line: 1, column: 1, severity: "error", source: "syntax", message: `Compiled script is too large (${compiled.length} > ${SCRIPT_COMPILED_LIMIT}).` });
    compiled = "";
  }
  diagnostics.sort((a, b) => a.line - b.line || a.column - b.column);
  return {
    ok: !diagnostics.some((diagnostic) => diagnostic.severity === "error"),
    compiled,
    diagnostics,
    effects: analysis.effects,
    summary: analysis.summary,
    sourceHash,
    apiVersion: SCRIPT_API_VERSION,
  };
}

/** Async convenience: loads the compiler if needed, then compiles. */
export async function compileScriptAsync(source: string, options: ScriptCompileOptions = {}): Promise<ScriptCompileResult> {
  await prepareScriptCompiler();
  return compileScript(source, options);
}

/** Model/human-readable diagnostics block ("L3:5 error: …"). English (TypeScript messages are English). */
export function formatScriptDiagnostics(diagnostics: readonly ScriptDiagnostic[], limit = 30): string {
  if (!diagnostics.length) return "No problems.";
  const lines = diagnostics.slice(0, limit).map((diagnostic) => `L${diagnostic.line}:${diagnostic.column} ${diagnostic.severity}: ${diagnostic.message}`);
  if (diagnostics.length > limit) lines.push(`… ${diagnostics.length - limit} more`);
  return lines.join("\n");
}

/** Fields to store on a `script` command after a successful compile. */
export function scriptCommandFields(source: string, result: ScriptCompileResult, name?: string): Extract<import("@/project/types").Command, { kind: "script" }> {
  return {
    kind: "script",
    source,
    compiled: result.compiled,
    ...(name?.trim() ? { name: name.trim() } : {}),
    ...(result.summary ? { summary: result.summary } : {}),
    effects: result.effects,
    sourceHash: result.sourceHash,
    apiVersion: result.apiVersion,
  };
}
