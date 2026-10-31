// player/script/engine.ts — lazy QuickJS-wasm loader for the script sandbox.
//
// The wasm (≈ 0.5 MB, embedded as base64 in the variant module) is a dynamic-import chunk: games without
// a `script` command never download it. The interpreter is synchronous, so the module must be ready before
// a script runs — boot paths call `preloadScriptEngine()` when `projectUsesScripts(project)`, and the
// `script` command itself polls (a short `wait` pause) while a late load finishes.
import type { QuickJSWASMModule } from "quickjs-emscripten-core";
import type { Command, Project } from "@/project/types";

let modulePromise: Promise<QuickJSWASMModule> | undefined;
let loadedModule: QuickJSWASMModule | undefined;
let loadFailure: string | undefined;

/** Starts (once) and awaits the QuickJS module load. Safe to call many times. Rejects only on a real load failure. */
export function preloadScriptEngine(): Promise<void> {
  modulePromise ??= (async () => {
    const [core, variant] = await Promise.all([
      import("quickjs-emscripten-core"),
      import("@jitl/quickjs-singlefile-browser-release-sync"),
    ]);
    const module = await core.newQuickJSWASMModuleFromVariant(variant.default);
    loadedModule = module;
    return module;
  })().catch((error: unknown) => {
    loadFailure = error instanceof Error ? error.message : String(error);
    throw error;
  });
  return modulePromise.then(() => undefined);
}

/** The loaded module, or undefined while loading / before the first preload. */
export function scriptEngineModule(): QuickJSWASMModule | undefined {
  return loadedModule;
}

/** Load error text when the wasm could not be loaded (e.g. a CSP without 'wasm-unsafe-eval'). */
export function scriptEngineLoadFailure(): string | undefined {
  return loadFailure;
}

/** Kick off the load without awaiting (used by the interpreter when a script runs before any preload). */
export function requestScriptEngine(): void {
  if (!modulePromise) void preloadScriptEngine().catch(() => undefined);
}

function commandsUseScripts(commands: unknown, depth: number): boolean {
  if (!Array.isArray(commands) || depth > 40) return false;
  for (const command of commands as Command[]) {
    if (!command || typeof command !== "object") continue;
    if (command.kind === "script") return true;
    for (const value of Object.values(command)) {
      if (Array.isArray(value) && value.length > 0) {
        const first = value[0] as unknown;
        if (first && typeof first === "object" && "kind" in first && commandsUseScripts(value, depth + 1)) return true;
        // Choice options / present-item options hold their commands in `branch`.
        if (first && typeof first === "object" && "branch" in first) {
          for (const option of value as { branch?: unknown }[]) if (commandsUseScripts(option?.branch, depth + 1)) return true;
        }
      }
    }
  }
  return false;
}

/** True when any event page, common event or troop page holds a `script` command. Cheap structural walk. */
export function projectUsesScripts(project: Project | undefined): boolean {
  if (!project) return false;
  for (const common of project.commonEvents ?? []) if (commandsUseScripts(common.commands, 0)) return true;
  for (const map of Object.values(project.maps ?? {})) {
    for (const event of map.events ?? []) {
      if (commandsUseScripts(event.commands, 0)) return true;
      for (const page of event.pages ?? []) if (commandsUseScripts(page.commands, 0)) return true;
    }
  }
  return false;
}
