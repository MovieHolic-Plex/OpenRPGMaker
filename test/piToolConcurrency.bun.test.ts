import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { createAssistantMessageEventStream } from "@oh-my-pi/pi-ai";
import { runPiAgent } from "../scripts/lib/piAgentRuntime.ts";
import { CODEX_WEB_SEARCH_ENDPOINT } from "../scripts/lib/codexWebSearchRuntime.ts";
import { createBlankProject } from "../src/project/defaults.ts";
import type { PiAgentEvent, PiAgentRequest } from "../src/ai/piAgent/protocol.ts";

// Real Agent loop, adapter, registry, search parser and publication callback.
// Only the model and external search HTTP transport are scripted; no live credentials.
type Call = { name: string; args: Record<string, unknown> };
type Trace = { event: string; atMs: number; id?: string; name?: string; query?: string; ok?: boolean; title?: string }[];
const search = (query: string): Call => ({ name: "web_search", args: { query } });
const write = (title: string): Call => ({ name: "set_project_settings", args: { title } });
const read: Call = { name: "get_project_summary", args: {} };
const token = `test.${Buffer.from(JSON.stringify({ "https://api.openai.com/auth": { chatgpt_account_id: "fixture" } })).toString("base64url")}.test`;

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => { resolve = r; });
  return { promise, resolve };
}

function model(batches: Call[][], contexts: any[] = []) {
  let turn = 0;
  return (_model: unknown, context: any) => {
    contexts.push(structuredClone(context.messages));
    const calls = batches[turn++];
    const stream = createAssistantMessageEventStream();
    queueMicrotask(() => {
      const message: any = {
        role: "assistant", api: "gemini", provider: "google-antigravity", model: "scripted",
        usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0 },
        timestamp: Date.now(), stopReason: calls ? "toolUse" : "stop",
        content: calls ? calls.map((call, i) => ({ type: "toolCall", id: `${turn}-${i}`, name: call.name, arguments: call.args }))
          : [{ type: "text", text: "완료" }],
      };
      stream.push({ type: "start", partial: message } as never);
      stream.push({ type: "done", reason: message.stopReason, message } as never);
    });
    return stream;
  };
}

function request(overrides: Partial<PiAgentRequest> = {}): PiAgentRequest {
  return {
    provider: "google-antigravity", mode: "single", task: "독립 조회 후 제목 변경", mapIds: [],
    project: createBlankProject(), initialToolNames: ["get_project_summary", "set_project_settings"],
    maxTurns: 5, applyMode: "default", ...overrides,
  };
}

let restoreFetch: (() => void) | undefined;
afterEach(() => { restoreFetch?.(); restoreFetch = undefined; });

function fixture() {
  const start = performance.now();
  const trace: Trace = [];
  const events: PiAgentEvent[] = [];
  const record = (event: string, fields: Omit<Trace[number], "event" | "atMs"> = {}) => {
    trace.push({ event, atMs: Math.round((performance.now() - start) * 10) / 10, ...fields });
  };
  const onEvent = (event: PiAgentEvent) => {
    events.push(event);
    if (event.type === "tool_start" || event.type === "tool_end") {
      record(event.type, { id: event.id, name: event.name, ...(event.type === "tool_end" ? { ok: event.ok } : {}) });
    }
  };
  const installSearch = (respond: (query: string, signal: AbortSignal) => Promise<number | void>) => {
    const mock = spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      if (String(url) !== CODEX_WEB_SEARCH_ENDPOINT) throw new Error(`Unexpected network request: ${url}`);
      const body = JSON.parse(String(init?.body));
      const query = body.input[0].content[0].text as string;
      record("http_start", { query });
      const status = await respond(query, init!.signal as AbortSignal) ?? 200;
      record("http_end", { query });
      return new Response([
        { type: "response.output_text.delta", delta: `Evidence for ${query}` },
        { type: "response.completed", response: { output: [] } },
      ].map(e => `data: ${JSON.stringify(e)}\n\n`).join(""), { status });
    });
    restoreFetch = () => mock.mockRestore();
  };
  const evidence = (name: string) => {
    const dir = process.env.AI_PARALLEL_EVIDENCE_DIR;
    if (!dir) return;
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/${name}.json`, JSON.stringify({
      method: "Real single-agent Pi loop; scripted model and search HTTP responses; no live-model speed claim.", trace,
    }, null, 2) + "\n");
  };
  return { trace, events, record, onEvent, installSearch, evidence };
}

async function within(promise: Promise<void>, label: string) {
  let timer: ReturnType<typeof setTimeout>;
  try {
    await Promise.race([promise, new Promise<void>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Timed out: ${label}`)), 1500);
    })]);
  } finally { clearTimeout(timer!); }
}

describe("single-agent parallel tool execution", () => {
  test("two 200ms searches overlap in the default single-agent path", async () => {
    const f = fixture();
    let active = 0, peak = 0;
    f.installSearch(async () => {
      peak = Math.max(peak, ++active);
      await Bun.sleep(200);
      active--;
    });
    const done = await runPiAgent(request(), {
      streamFn: model([[search("timing alpha"), search("timing beta")]]) as never,
      codexApiKey: token, onEvent: f.onEvent, onCheckpoint: async () => {},
    });
    f.record("peak_concurrency", { title: String(peak) });
    f.evidence("timing");
    expect(done.stats.toolErrors).toBe(0);
    expect(peak).toBe(2);
  });

  test.each(["default", "auto", "yolo", "step", "review"] as const)("%s starts independent searches together, then writes", async applyMode => {
    const f = fixture();
    const bothStarted = deferred(), release = deferred();
    let running = 0;
    f.installSearch(async () => { if (++running === 2) bothStarted.resolve(); await release.promise; });
    const contexts: any[] = [];
    const batches = [[search("alpha"), search("beta"), read, write("after searches")]];
    if (applyMode === "step") batches[0].push({ name: "finish_stage", args: { title: "제목" } });
    const done = runPiAgent(request({ applyMode }), {
      streamFn: model(batches, contexts) as never, codexApiKey: token, onEvent: f.onEvent,
      onCheckpoint: async c => { f.record("publish", { title: c.project.meta.title }); },
    });
    // Consume a failure immediately so a failed assertion cannot leak an unhandled rejection.
    const settled = done.then(value => ({ value }), error => ({ error }));
    try {
      await within(bothStarted.promise, "both HTTP requests must start before either is released");
      expect(f.trace.filter(e => e.event === "http_start")).toHaveLength(2);
      expect(f.trace.some(e => e.event === "http_end")).toBe(false);
      expect(f.trace.some(e => e.event === "tool_start" && e.name === "set_project_settings")).toBe(false);
    } finally { release.resolve(); await settled; }
    const result = await done;
    expect(result.project.meta.title).toBe("after searches");
    expect(result.stats.toolErrors).toBe(0);
    const writeIndex = f.trace.findIndex(e => e.event === "tool_start" && e.name === "set_project_settings");
    expect(f.trace.slice(0, writeIndex).filter(e => e.event === "http_end")).toHaveLength(2);
    expect(f.trace.filter(e => e.event === "publish")).toHaveLength(applyMode === "review" ? 0 : 1);
    const results = contexts.at(-1).filter((m: any) => m.role === "toolResult" && m.toolName === "web_search");
    expect(results.map((m: any) => m.toolCallId).sort()).toEqual(["1-0", "1-1"]);
    expect(results.find((m: any) => m.toolCallId === "1-0").content[0].text).toContain("Evidence for alpha");
    expect(results.find((m: any) => m.toolCallId === "1-1").content[0].text).toContain("Evidence for beta");
    f.evidence(`parallel-${applyMode}`);
  });

  test.each([false, true])("publication blocks later reads and writes (fallback=%s)", async fallback => {
    const f = fixture(), entered = deferred(), release = deferred();
    let publications = 0;
    const done = runPiAgent(request({ initialToolNames: fallback ? ["get_project_summary"] : undefined }), {
      streamFn: model([[write("first"), read, write("second"), read]]) as never, onEvent: f.onEvent,
      onCheckpoint: async c => {
        f.record("publish_start", { title: c.project.meta.title });
        if (++publications === 1) { entered.resolve(); await release.promise; }
        f.record("publish_end", { title: c.project.meta.title });
        // Exercise replacement by the accepted project, not just mutation of the draft.
        return structuredClone(c.project);
      },
    });
    const settled = done.then(value => ({ value }), error => ({ error }));
    try {
      await within(entered.promise, "first publication");
      expect(f.trace.filter(e => e.event === "tool_start").map(e => e.name)).toEqual(["set_project_settings"]);
    } finally { release.resolve(); await settled; }
    expect((await done).project.meta.title).toBe("second");
    expect(f.trace.filter(e => e.event.startsWith("publish")).map(e => `${e.event}:${e.title}`))
      .toEqual(["publish_start:first", "publish_end:first", "publish_start:second", "publish_end:second"]);
    const reads = f.events.filter(e => e.type === "tool_end" && e.name === "get_project_summary");
    expect(JSON.stringify(reads[0])).toContain("first");
    expect(JSON.stringify(reads[1])).toContain("second");
    f.evidence(`publication-${fallback ? "fallback" : "native"}`);
  });

  test("stage approval holds later calls in the same model response", async () => {
    const f = fixture(), entered = deferred(), approve = deferred();
    const done = runPiAgent(request({ applyMode: "step" }), {
      streamFn: model([[write("first"), { name: "finish_stage", args: { title: "first" } }, read, write("second")]]) as never,
      onEvent: f.onEvent,
      onCheckpoint: async () => { f.record("approval_start"); entered.resolve(); await approve.promise; f.record("approval_end"); },
    });
    const settled = done.then(value => ({ value }), error => ({ error }));
    try {
      await within(entered.promise, "stage approval");
      expect(f.trace.filter(e => e.event === "tool_start").map(e => e.name)).toEqual(["set_project_settings", "finish_stage"]);
    } finally { approve.resolve(); await settled; }
    expect((await done).project.meta.title).toBe("second");
    f.evidence("stage-approval");
  });

  test("a rejected publication prevents remaining same-response calls", async () => {
    const f = fixture();
    await expect(runPiAgent(request(), {
      streamFn: model([[write("first"), read, write("forbidden")]]) as never, onEvent: f.onEvent,
      onCheckpoint: async () => { f.record("publish_rejected"); throw new Error("declined"); },
    })).rejects.toThrow("declined");
    expect(f.events.filter(e => e.type === "tool_end" && e.ok).length).toBe(0);
    f.evidence("rejected-publication");
  });

  test("one failed parallel search preserves the other result and permits recovery", async () => {
    const f = fixture();
    f.installSearch(async query => query === "failure" ? 503 : 200);
    const done = await runPiAgent(request(), {
      streamFn: model([[search("failure"), search("success")], [write("recovered")]]) as never,
      onEvent: f.onEvent, codexApiKey: token, onCheckpoint: async () => {},
    });
    expect(done.stats.toolErrors).toBe(1);
    expect(done.project.meta.title).toBe("recovered");
    expect(f.events.filter(e => e.type === "tool_end" && e.name === "web_search").map(e => e.type === "tool_end" && e.ok).sort())
      .toEqual([false, true]);
    f.evidence("partial-failure");
  });

  test("abort cancels both searches without running the queued write", async () => {
    const f = fixture(), bothStarted = deferred();
    const controller = new AbortController();
    let active = 0, aborted = 0, published = 0;
    f.installSearch(async (_query, signal) => {
      if (++active === 2) bothStarted.resolve();
      await new Promise<void>((_, reject) => {
        const abort = () => { aborted++; reject(new DOMException("Aborted", "AbortError")); };
        if (signal.aborted) abort(); else signal.addEventListener("abort", abort, { once: true });
      });
    });
    const done = runPiAgent(request(), {
      streamFn: model([[search("alpha"), search("beta"), write("forbidden")]]) as never,
      codexApiKey: token, onEvent: f.onEvent, signal: controller.signal,
      onCheckpoint: async () => { published++; },
    });
    const settled = done.then(value => ({ value }), error => ({ error }));
    try { await within(bothStarted.promise, "both searches before cancellation"); }
    finally { controller.abort(); await settled; }
    expect(aborted).toBe(2);
    expect(published).toBe(0);
    expect(f.events.some(e => e.type === "tool_end" && e.name === "set_project_settings" && e.ok)).toBe(false);
    f.evidence("abort");
  });
});
