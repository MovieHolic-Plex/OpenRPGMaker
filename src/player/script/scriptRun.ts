// player/script/scriptRun.ts — one sandboxed execution of a compiled script (one QuickJS runtime + context).
//
// Isolation: a fresh QuickJS runtime per run, 16 MB heap, 512 KB stack, CPU budget (per slice and in total),
// no DOM / network / storage / timers. The only way out is `game` (built in the prelude from two host
// functions and frozen). Math.random and Date are replaced by the saved game RNG and the play clock, so a
// replay of the same save behaves the same.
//
// Driving: the interpreter is synchronous. `pump()` runs pending jobs until the script either queues an
// awaitable game call (→ "request": the caller runs those commands as a child frame and then calls
// `resolveCurrent()`), finishes ("done"), or fails ("error"). Every handle we create is disposed before the
// context — a leaked handle aborts the release wasm build on `rt.dispose()`.
import type {
  QuickJSContext,
  QuickJSDeferredPromise,
  QuickJSHandle,
  QuickJSRuntime,
  QuickJSWASMModule,
} from "quickjs-emscripten-core";
import { SCRIPT_API } from "@/project/script/apiSpec";
import { findScriptModule, libraryIdFromSpecifier } from "@/project/script/library";
import { scriptCompiledIsFresh } from "@/project/script/types";
import { nextSessionRandom } from "@/project/session";
import type { Command } from "@/project/types";
import { HOST_API, type AwaitPlan, type HostContext } from "./hostApi";

export const SCRIPT_MEMORY_LIMIT_BYTES = 16 * 1024 * 1024;
export const SCRIPT_STACK_LIMIT_BYTES = 512 * 1024;
/** One uninterrupted stretch of script code (between two game calls). */
export const SCRIPT_SLICE_LIMIT_MS = 500;
/** All script code of one run together (waiting for the player does not count). */
export const SCRIPT_TOTAL_LIMIT_MS = 3000;
/** Awaitable calls queued without being awaited (protects against `for(;;) game.wait(1)`). */
const QUEUE_LIMIT = 1000;
/** Lines the VM wrapper adds before the compiled code (for error line numbers). */
const WRAPPER_LINES = 1;

export type ScriptOutcome =
  | { readonly kind: "request"; readonly commands: Command[] }
  | { readonly kind: "done" }
  | { readonly kind: "error"; readonly message: string };

interface QueuedCall {
  readonly api: string;
  readonly plan: AwaitPlan;
  readonly deferred: QuickJSDeferredPromise;
}

const SYNC_NAMES = SCRIPT_API.filter((entry) => !entry.awaits).map((entry) => entry.name);
const AWAIT_NAMES = SCRIPT_API.filter((entry) => entry.awaits).map((entry) => entry.name);

/** Runs inside the VM before the script. Returns `run(fn)` which calls the wrapped script with require/exports/module. */
const PRELUDE = `(() => {
  "use strict";
  const host = globalThis.__host;
  delete globalThis.__host;
  const call = host.call, callAsync = host.callAsync;
  const parse = JSON.parse, stringify = JSON.stringify;
  const unwrap = (text) => parse(text).v;
  const encode = (args) => stringify(args, (key, value) => value === undefined ? null : value);
  const game = {};
  for (const name of ${JSON.stringify(SYNC_NAMES)}) game[name] = (...args) => unwrap(call(name, encode(args)));
  for (const name of ${JSON.stringify(AWAIT_NAMES)}) game[name] = (...args) => callAsync(name, encode(args)).then(unwrap);
  Object.freeze(game);
  Object.defineProperty(globalThis, "game", { value: game, writable: false, configurable: false, enumerable: true });
  Math.random = () => unwrap(call("__random", "[]"));
  const now = unwrap(call("__now", "[]"));
  const RealDate = Date;
  function FakeDate(...args) {
    if (!new.target) return new RealDate(now).toString();
    return args.length === 0 ? new RealDate(now) : new RealDate(...args);
  }
  FakeDate.prototype = RealDate.prototype;
  FakeDate.now = () => now;
  FakeDate.parse = RealDate.parse;
  FakeDate.UTC = RealDate.UTC;
  globalThis.Date = FakeDate;
  const show = (value) => { if (typeof value === "string") return value; try { return stringify(value) ?? String(value); } catch { return String(value); } };
  const log = (...values) => { call("log", stringify([values.map(show).join(" ")])); };
  globalThis.console = Object.freeze({ log, info: log, warn: log, error: log, debug: log });
  const modules = new Map();
  const require = (specifier) => {
    if (typeof specifier !== "string" || !specifier.startsWith("@lib/")) throw new Error("Only project library modules can be imported: import { … } from \\"@lib/<id>\\" (got " + String(specifier) + ")");
    const cached = modules.get(specifier);
    if (cached) return cached.exports;
    const source = unwrap(call("__lib", stringify([specifier])));
    const module = { exports: {} };
    modules.set(specifier, module);
    const factory = new Function("require", "exports", "module", source);
    factory(require, module.exports, module);
    return module.exports;
  };
  return (fn) => { const module = { exports: {} }; return fn(require, module.exports, module); };
})()`;

function formatVmError(dumped: unknown): string {
  if (dumped && typeof dumped === "object") {
    const error = dumped as { name?: unknown; message?: unknown; stack?: unknown };
    const head = `${typeof error.name === "string" ? error.name : "Error"}: ${typeof error.message === "string" ? error.message : String(dumped)}`;
    const line = typeof error.stack === "string" ? /script\.js:(\d+)/u.exec(error.stack)?.[1] : undefined;
    return line ? `${head} (compiled line ${Math.max(1, Number(line) - WRAPPER_LINES)})` : head;
  }
  return String(dumped);
}

export class ScriptRun {
  private readonly rt: QuickJSRuntime;
  private readonly vm: QuickJSContext;
  private promise: QuickJSHandle | undefined;
  private readonly queue: QueuedCall[] = [];
  private current: QueuedCall | undefined;
  private cpuMs = 0;
  private deadline = Number.POSITIVE_INFINITY;
  private interruptReason: "slice" | "total" | undefined;
  private disposed = false;
  /** Set only while the VM runs (start / resolveCurrent), so a parked run never keeps the interpreter alive. */
  private activeCtx: HostContext | undefined;

  constructor(module: QuickJSWASMModule, readonly command: Command) {
    this.rt = module.newRuntime();
    this.rt.setMemoryLimit(SCRIPT_MEMORY_LIMIT_BYTES);
    this.rt.setMaxStackSize(SCRIPT_STACK_LIMIT_BYTES);
    this.rt.setInterruptHandler(() => {
      if (performance.now() <= this.deadline) return false;
      this.interruptReason = this.cpuMs + SCRIPT_SLICE_LIMIT_MS >= SCRIPT_TOTAL_LIMIT_MS ? "total" : "slice";
      return true;
    });
    this.vm = this.rt.newContext();
    this.installHost();
  }

  get isDisposed(): boolean {
    return this.disposed;
  }

  /** Evaluates the prelude and the script body, then pumps until the first request / completion / error. */
  start(ctx: HostContext, compiled: string): ScriptOutcome {
    return this.withCtx(ctx, () => this.startInner(compiled));
  }

  /** The awaited game call's commands finished: resolve its promise and continue the script. */
  resolveCurrent(ctx: HostContext): ScriptOutcome {
    return this.withCtx(ctx, () => this.resolveInner(ctx));
  }

  /** True while the run waits for the commands of an awaited game call. */
  get waiting(): boolean {
    return this.current !== undefined;
  }

  private withCtx(ctx: HostContext, work: () => ScriptOutcome): ScriptOutcome {
    this.activeCtx = ctx;
    try {
      return work();
    } finally {
      this.activeCtx = undefined;
    }
  }

  private get ctx(): HostContext {
    if (!this.activeCtx) throw new Error("game calls are only possible while the script runs");
    return this.activeCtx;
  }

  private startInner(compiled: string): ScriptOutcome {
    const vm = this.vm;
    const runner = this.timed(() => vm.evalCode(PRELUDE, "prelude.js"));
    if (runner.error) return this.errorOutcome(runner.error);
    const wrapped = `(async function (require, exports, module) {\n${compiled}\n})`;
    const fn = this.timed(() => vm.evalCode(wrapped, "script.js"));
    if (fn.error) {
      runner.value.dispose();
      return this.errorOutcome(fn.error);
    }
    const started = this.timed(() => vm.callFunction(runner.value, vm.undefined, fn.value));
    runner.value.dispose();
    fn.value.dispose();
    if (started.error) return this.errorOutcome(started.error);
    this.promise = started.value;
    return this.pump();
  }

  private resolveInner(ctx: HostContext): ScriptOutcome {
    const call = this.current;
    this.current = undefined;
    if (call) {
      let payload: string;
      try {
        payload = JSON.stringify({ v: call.plan.result?.(ctx) });
      } catch (error) {
        payload = "";
        const message = this.vm.newError(error instanceof Error ? error.message : String(error));
        call.deferred.reject(message);
        message.dispose();
      }
      if (payload) {
        const value = this.vm.newString(payload);
        call.deferred.resolve(value);
        value.dispose();
      }
      call.deferred.dispose();
    }
    return this.pump();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    try {
      for (const call of [...(this.current ? [this.current] : []), ...this.queue]) {
        if (call.deferred.alive) call.deferred.dispose();
      }
      this.queue.length = 0;
      this.current = undefined;
      if (this.promise?.alive) this.promise.dispose();
      this.vm.dispose();
      this.rt.dispose();
    } catch (error) {
      console.error("[script] sandbox dispose failed", error);
    }
  }

  private pump(): ScriptOutcome {
    if (this.disposed) return { kind: "error", message: "script sandbox was already closed" };
    const jobs = this.timed(() => this.rt.executePendingJobs());
    if (jobs.error) {
      const message = this.describeError(jobs.error);
      jobs.error.dispose();
      return { kind: "error", message };
    }
    const next = this.queue.shift();
    if (next) {
      this.current = next;
      return { kind: "request", commands: next.plan.commands };
    }
    const promise = this.promise;
    if (!promise) return { kind: "done" };
    const state = this.vm.getPromiseState(promise);
    if (state.type === "fulfilled") {
      if (state.value.alive) state.value.dispose();
      return { kind: "done" };
    }
    if (state.type === "rejected") {
      const message = this.describeError(state.error);
      state.error.dispose();
      return { kind: "error", message };
    }
    return {
      kind: "error",
      message: "The script is waiting for something that never finishes. Only `await` game.* calls (there are no timers or fetch in scripts).",
    };
  }

  private timed<T>(work: () => T): T {
    const remaining = SCRIPT_TOTAL_LIMIT_MS - this.cpuMs;
    const started = performance.now();
    this.deadline = started + Math.max(1, Math.min(SCRIPT_SLICE_LIMIT_MS, remaining));
    try {
      return work();
    } finally {
      this.cpuMs += performance.now() - started;
      this.deadline = Number.POSITIVE_INFINITY;
    }
  }

  private errorOutcome(handle: QuickJSHandle): ScriptOutcome {
    const message = this.describeError(handle);
    handle.dispose();
    return { kind: "error", message };
  }

  private describeError(handle: QuickJSHandle): string {
    if (this.interruptReason === "slice") {
      return `The script ran for more than ${SCRIPT_SLICE_LIMIT_MS} ms without a game call (infinite loop?). It was stopped.`;
    }
    if (this.interruptReason === "total" || this.cpuMs >= SCRIPT_TOTAL_LIMIT_MS) {
      return `The script used more than ${SCRIPT_TOTAL_LIMIT_MS} ms of CPU in total. It was stopped.`;
    }
    let dumped: unknown;
    try {
      dumped = this.vm.dump(handle);
    } catch {
      dumped = "unknown error";
    }
    const text = formatVmError(dumped);
    return /out of memory/iu.test(text) ? `${text} — scripts may use at most ${SCRIPT_MEMORY_LIMIT_BYTES / 1024 / 1024} MB.` : text;
  }

  private installHost(): void {
    const vm = this.vm;
    const host = vm.newObject();
    const call = vm.newFunction("call", (nameHandle, argsHandle) => {
      const name = vm.getString(nameHandle);
      const args = parseArgs(vm.getString(argsHandle));
      return vm.newString(JSON.stringify({ v: this.callSync(name, args) }));
    });
    const callAsync = vm.newFunction("callAsync", (nameHandle, argsHandle) => {
      const name = vm.getString(nameHandle);
      const args = parseArgs(vm.getString(argsHandle));
      const impl = (HOST_API as unknown as Record<string, (ctx: HostContext, args: readonly unknown[]) => unknown>)[name];
      if (!impl || !AWAIT_NAMES.includes(name as (typeof AWAIT_NAMES)[number])) throw new Error(`game.${name} is not an awaitable game call`);
      if (this.queue.length >= QUEUE_LIMIT) throw new Error(`More than ${QUEUE_LIMIT} game calls were started without await. Await each awaitable game call.`);
      const plan = impl(this.ctx, args) as AwaitPlan;
      const deferred = vm.newPromise();
      this.queue.push({ api: name, plan, deferred });
      return deferred.handle.dup();
    });
    vm.setProp(host, "call", call);
    vm.setProp(host, "callAsync", callAsync);
    vm.setProp(vm.global, "__host", host);
    call.dispose();
    callAsync.dispose();
    host.dispose();
  }

  private callSync(name: string, args: readonly unknown[]): unknown {
    switch (name) {
      case "__random":
        return nextSessionRandom(this.ctx.state.session, "misc");
      case "__now":
        // A fixed calendar origin plus play time: deterministic per save, still moves forward between runs.
        return Date.UTC(2000, 0, 1) + Math.floor((this.ctx.state.session.playTimeSeconds ?? 0) * 1000);
      case "__lib":
        return this.librarySource(args[0]);
      default: {
        const impl = (HOST_API as unknown as Record<string, (ctx: HostContext, args: readonly unknown[]) => unknown>)[name];
        if (!impl || !SYNC_NAMES.includes(name as (typeof SYNC_NAMES)[number])) throw new Error(`game.${name} is not a game function`);
        return impl(this.ctx, args);
      }
    }
  }

  private librarySource(specifier: unknown): string {
    const id = typeof specifier === "string" ? libraryIdFromSpecifier(specifier) : undefined;
    if (!id) throw new Error(`Bad library import ${JSON.stringify(specifier)}; use "@lib/<id>"`);
    const module = findScriptModule(this.ctx.state.project?.scriptLibrary, id);
    if (!module) throw new Error(`Library module @lib/${id} does not exist in this project`);
    if (!module.compiled.trim() && module.source.trim()) throw new Error(`Library module @lib/${id} is not compiled; open and save it in the editor`);
    if (!scriptCompiledIsFresh(module)) console.warn(`[script] @lib/${id} was edited after its last compile; running the last compiled version`);
    return module.compiled;
  }
}

function parseArgs(text: string): unknown[] {
  const parsed = JSON.parse(text) as unknown;
  return Array.isArray(parsed) ? parsed : [];
}
