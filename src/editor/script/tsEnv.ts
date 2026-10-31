// editor/script/tsEnv.ts — lazy TypeScript 5 (the `typescript5` alias; the repo's own `typescript` is the
// native TS 7 compiler with no JS API) plus the ES2022 lib .d.ts files scripts are checked against.
//
// Both are dynamic imports: the editor fetches them the first time a script is edited or compiled; Bun (headless
// tools, the compiled assistant worker) and Node/vitest import the same modules. The lib texts are a generated
// module (scripts/content/generate-script-ts-libs.mjs), so nothing reads node_modules at run time.
// Async to load, sync to use: call `prepareScriptCompiler()` (tool `prepare`, editor form open), then compile.
export type TypeScriptApi = typeof import("typescript5");

let ts: TypeScriptApi | undefined;
let libSources: Readonly<Record<string, string>> | undefined;
let loading: Promise<void> | undefined;

/** Loads TypeScript and the lib files once. Safe to call repeatedly and concurrently. */
export function prepareScriptCompiler(): Promise<void> {
  loading ??= (async () => {
    const [module, libs] = await Promise.all([import("typescript5"), import("./tsLibSources.generated")]);
    ts = ((module as { default?: TypeScriptApi }).default ?? module) as TypeScriptApi;
    libSources = libs.SCRIPT_TS_LIB_SOURCES;
  })().catch((error: unknown) => {
    loading = undefined;
    throw error;
  });
  return loading;
}

export function scriptCompilerReady(): boolean {
  return ts !== undefined && libSources !== undefined;
}

/** The loaded TypeScript API. Throws when `prepareScriptCompiler()` has not finished. */
export function scriptTs(): TypeScriptApi {
  if (!ts) throw new Error("TypeScript is not loaded yet; await prepareScriptCompiler() first");
  return ts;
}

export function scriptLibSource(fileName: string): string | undefined {
  const name = fileName.startsWith("/") ? fileName.slice(1) : fileName;
  return libSources && Object.hasOwn(libSources, name) ? libSources[name] : undefined;
}
