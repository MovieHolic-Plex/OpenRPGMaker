import { expect, test, type Page, type Route } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { HarnessSnapshot } from "../../src/ai/assistantSession";

// Real panel/session/tools/apply/store. Only HTTP transports are fixtures.
// Browser execution belongs to the integrating lead; --list validates discovery.
test.use({ serviceWorkers: "block" });
test.setTimeout(300_000);
const root = path.resolve(".omo/evidence/ai-unbounded/browser");
const NO_PROGRESS_MS = 15_000;
type Call = { name: string; args: Record<string, unknown> };
type Reply = { calls?: Call[]; content?: string; status?: number };
type SlimActivity = {
  instruction?: string;
  pending?: boolean;
  stoppedReason?: string;
  execution?: { state: string; segment?: number };
  orphaned?: boolean;
  ok?: boolean;
  proposedCalls?: number;
  appliedCalls?: number;
  acceptance?: { status?: string } | null;
};
type SlimAudit =
  | { kind: "user"; text: string }
  | { kind: "tool"; name: string; deferred?: boolean }
  | { kind: "status"; text: string };
type TerminalExecution = { state: string; segment?: number };
type TerminalRecord = {
  instruction: string;
  result: SlimActivity & { execution: TerminalExecution };
};
type Fixture = {
  unexpected: string[];
  http: unknown[];
  initial: Awaited<ReturnType<typeof inspect>>;
  awaitingTerminal: Array<{ raw: string; resolve: (value: TerminalRecord) => void }>;
  appliedTitles: string[];
  bootAt: number;
  progressListeners: Array<() => void>;
};
const title = (value: string): Call => ({ name: "set_title_screen", args: { title: value, reason: "Fixture requested checkpoint" } });
const anchor = (raw: string, quote = raw) => ({ start: raw.indexOf(quote), end: raw.indexOf(quote) + quote.length, quote });
const valueEntry = (raw: string, quote: string, value: string) => ({ source: [anchor(raw, quote)], criteria: [{ kind: "valueEquals", subject: { kind: "project" }, path: ["meta", "title"], value }], bindings: [{ source: anchor(raw, JSON.stringify(value)), role: "value", criterionIndex: 0, fieldPath: ["value"] }] });
function signal<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
async function bounded<T>(promise: Promise<T>): Promise<T> {
  let deadline: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => {
      deadline = setTimeout(() => reject(new Error("Missing subscribed fixture signal")), 120_000);
    })]);
  } finally { clearTimeout(deadline); }
}
async function boundedTerminal<T>(promise: Promise<T>): Promise<T> {
  let deadline: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => {
      deadline = setTimeout(() => reject(new Error("Missing subscribed terminal activity")), 240_000);
    })]);
  } finally { clearTimeout(deadline); }
}
async function boundedInspect<T>(promise: Promise<T>): Promise<T> {
  let deadline: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => {
      deadline = setTimeout(() => reject(new Error("Missing inspect snapshot")), 15_000);
    })]);
  } finally { clearTimeout(deadline); }
}
async function waitAppliedHold(fixture: Fixture, count: number): Promise<void> {
  if (fixture.appliedTitles.length >= count) return;
  await new Promise<void>((resolve, reject) => {
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    const stop = () => { clearTimeout(watchdog); };
    const fail = () => {
      stop();
      reject(new Error(`Missing applied checkpoint progress at ${fixture.appliedTitles.length}/${count}`));
    };
    const arm = () => {
      clearTimeout(watchdog);
      watchdog = setTimeout(fail, NO_PROGRESS_MS);
    };
    const onProgress = () => {
      arm();
      if (fixture.appliedTitles.length >= count) {
        stop();
        resolve();
      }
    };
    fixture.progressListeners.push(onProgress);
    arm();
    if (fixture.appliedTitles.length >= count) {
      stop();
      resolve();
    }
  });
}
async function reply(route: Route, response: Reply, index: number, tokens: number) {
  if (response.status) return route.fulfill({ status: response.status, json: { error: { message: "fixture authorization required", type: "authentication_error", code: "invalid_api_key" } } });
  const calls = response.calls?.map((call, i) => ({ id: `fixture_${index}_${i}`, type: "function", function: { name: call.name, arguments: JSON.stringify(call.args) } }));
  // llmClient supports JSON responses even when the request prefers streaming.
  await route.fulfill({ json: { choices: [{ index: 0, message: { role: "assistant", content: response.content ?? null, ...(calls ? { tool_calls: calls } : {}) }, finish_reason: calls ? "tool_calls" : "stop" }], usage: { prompt_tokens: 100, completion_tokens: tokens, total_tokens: 100 + tokens } } });
}
function terminalRecord(slim: SlimActivity): TerminalRecord {
  if (slim.instruction === undefined) throw new Error("Missing terminal instruction");
  if (slim.execution === undefined) throw new Error("Missing terminal activity execution");
  return { instruction: slim.instruction, result: { ...slim, execution: slim.execution } };
}
async function inspect(page: Page) {
  return boundedInspect(page.evaluate(() => {
    const fn = (window as unknown as { fixtureInspect?: () => {
      title: string;
      mapId: string;
      map: { width: number; height: number };
      item: { id: string; name: string };
      checkpoints: string[];
      harness: { execution: HarnessSnapshot["execution"]; requests: HarnessSnapshot["requests"]; audit: SlimAudit[] } | null;
    } }).fixtureInspect;
    if (fn === undefined) throw new Error("Missing fixture inspect hook");
    return fn();
  }));
}
async function boot(page: Page, options: { agentMode?: "auto" | "chat"; confirm?: boolean; tokens?: boolean } = {}): Promise<Fixture> {
  const origin = new URL(String(test.info().project.use.baseURL)).origin;
  const unexpected: string[] = [], http: unknown[] = [];
  const awaitingTerminal: Fixture["awaitingTerminal"] = [];
  const appliedTitles: string[] = [];
  const progressListeners: Array<() => void> = [];
  await page.exposeBinding("fixtureAppliedCheckpoint", (_source, title: string) => {
    if (typeof title !== "string" || title.length === 0) return;
    appliedTitles.push(title);
    http.push({ at: Date.now(), mark: "checkpoint.applied", title, count: appliedTitles.length });
    for (const listener of progressListeners) listener();
  });
  await page.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.pathname.endsWith("/v1/chat/completions")) throw new Error("Completion route not installed");
    if (url.pathname.endsWith("/auth/status")) return route.fulfill({ json: { connected: true, authKind: "oauth", expired: false, env: false } });
    if (url.pathname.includes("/rest/v1/")) {
      http.push({ at: Date.now(), method: request.method(), path: url.pathname, interceptedRemote: true });
      return route.fulfill({ json: [] });
    }
    if (url.pathname === "/__oprn/ai-activity" || url.pathname === "/__oprn/edit-activity") {
      const body = request.postDataJSON() as { instruction?: string; result?: SlimActivity & { acceptance?: { status?: string } | null } };
      const slim: SlimActivity = {
        instruction: body?.instruction,
        pending: body?.result?.pending,
        stoppedReason: body?.result?.stoppedReason,
        execution: body?.result?.execution,
        orphaned: body?.result?.orphaned,
        ok: body?.result?.ok,
        proposedCalls: body?.result?.proposedCalls,
        appliedCalls: body?.result?.appliedCalls,
        acceptance: body?.result?.acceptance == null ? body?.result?.acceptance : { status: body.result.acceptance.status },
      };
      http.push({ at: Date.now(), path: url.pathname, ...slim });
      if (url.pathname === "/__oprn/ai-activity" && slim.instruction && slim.pending !== true && slim.stoppedReason !== undefined) {
        http.push({ at: Date.now(), mark: "activity.terminal", instruction: slim.instruction });
        const payload = terminalRecord(slim);
        for (const waiter of awaitingTerminal) if (waiter.raw === slim.instruction) waiter.resolve(payload);
      }
      return route.fulfill({ json: { ok: true } });
    }
    if (url.origin === origin && request.method() === "GET" && !url.pathname.startsWith("/__oprn/") && !url.pathname.startsWith("/api/")) {
      try {
        const fetched = await route.fetch({ timeout: 15_000 });
        return route.fulfill({ status: fetched.status(), headers: fetched.headers(), body: await fetched.body() });
      } catch (error) {
        http.push({ at: Date.now(), mark: "static.fetch.fail", path: url.pathname, error: String(error) });
        await route.abort("failed");
        return;
      }
    }
    unexpected.push(`${request.method()} ${url.origin}${url.pathname}`);
    await route.abort("blockedbyclient");
  });
  await page.addInitScript(settings => {
    localStorage.setItem("rpg-zzu:editor-ui-mode", "standard");
    for (const key of ["oprn:editor-welcome-dismissed", "oprn:standard-welcome-seen", "oprn:coachmarks-basic-v1"]) localStorage.setItem(key, "1");
    localStorage.setItem("oprn:ai-config", JSON.stringify({ configVersion: 2, agentMode: settings.agentMode ?? "auto", autonomyLevel: settings.confirm ? "confirm" : "balanced", maxToolCalls: settings.tokens ? 8 : 1, maxTokens: 512 }));
  }, options);
  const ready = page.getByTestId("login-guest").or(page.getByTestId("ai-input")).first().waitFor({ state: "visible", timeout: 90_000 });
  await page.goto("/?blankProject=1&aiBridge=0", { waitUntil: "domcontentloaded" });
  await ready;
  if (await page.getByTestId("login-guest").isVisible()) await page.getByTestId("login-guest").click();
  await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 60_000 });
  const bootAt = Date.now();
  http.push({ at: bootAt, mark: "boot.canvas" });
  await page.evaluate(async () => {
    const modulePath = "/src/project/store.ts";
    const { store } = await import(modulePath);
    if (store.isRemotePersistenceEnabled()) throw new Error("Fixture must boot local-only");
    const checkpoints: string[] = [];
    const surface = window as unknown as {
      fixtureCheckpoints: string[];
      fixtureAppliedCheckpoint: (title: string) => Promise<void>;
      fixtureInspect: () => {
        title: string;
        mapId: string;
        map: { width: number; height: number };
        item: { id: string; name: string };
        checkpoints: string[];
        harness: { execution: unknown; requests: unknown; audit: unknown[] } | null;
      };
    };
    surface.fixtureCheckpoints = checkpoints;
    let previous = store.getCurrent().meta.title;
    store.subscribe(() => {
      const next = store.getCurrent().meta.title;
      if (next !== previous) {
        checkpoints.push(next);
        previous = next;
        void surface.fixtureAppliedCheckpoint(next);
      }
    });
    surface.fixtureInspect = () => {
      const project = store.getCurrent();
      const item = project.database.items[0];
      if (item === undefined) throw new Error("Fixture project missing item");
      const harness = window.__oprnAiHarness?.();
      const audit: unknown[] = [];
      for (const entry of harness?.audit ?? []) {
        if (entry.kind === "user") audit.push({ kind: "user", text: entry.text });
        else if (entry.kind === "tool") audit.push({ kind: "tool", name: entry.name, deferred: entry.deferred });
        else if (entry.kind === "status" && String(entry.text ?? "").startsWith("run_state")) audit.push({ kind: "status", text: entry.text });
      }
      return JSON.parse(JSON.stringify({
        title: project.meta.title,
        mapId: project.startMapId,
        map: { width: project.maps[project.startMapId].width, height: project.maps[project.startMapId].height },
        item: { id: item.id, name: item.name },
        checkpoints,
        harness: harness ? { execution: harness.execution ?? null, requests: harness.requests ?? [], audit } : null,
      }));
    };
  });
  return { unexpected, http, initial: await inspect(page), awaitingTerminal, appliedTitles, bootAt, progressListeners };
}
async function installProvider(page: Page, raw: string, entries: unknown[], fixture: Fixture, writer: (index: number) => Promise<Reply> | Reply, options: { planned?: boolean; tokens?: boolean } = {}) {
  let writers = 0;
  await page.route("**/v1/chat/completions", async route => {
    const request = route.request().postDataJSON();
    let response: Reply, phase: string;
    if (request.response_format?.type === "json_object") {
      const userMessages = request.messages.filter((message: { role: string }) => message.role === "user");
      const texts: string[] = userMessages.map((message: { content: string }) => message.content);
      // Wire fields, never prompt prose: wiki is a JSON payload with sources;
      // intent embeds the machine-consumed requestSource JSON line.
      const objects = texts.flatMap(text => text.split("\n").filter(line => line.startsWith("{")).map(line => JSON.parse(line)));
      if (objects.some(value => Array.isArray(value.sources) && Array.isArray(value.currentDocuments))) {
        phase = "wiki"; response = { content: JSON.stringify({ upserts: [] }) };
      } else if (objects.some(value => value.requestSource?.rawInstruction === raw)) {
        phase = "intent"; response = { content: JSON.stringify({ mode: "modify", space: "none", facility: null, targetMapId: null, useSelection: false, clarify: null, clarifyOptions: [], needsPlan: options.planned ?? false, resetsContext: false, tools: ["set_title_screen", "resize_map"], summary: "fixture", requestRequirements: { entries } }) };
      } else throw new Error(`Unknown structured provider request: ${JSON.stringify(objects)}`);
    } else if (!request.tools?.length) {
      phase = "planner";
      response = { content: JSON.stringify(options.planned ? { action: "new_plan", goal: raw, layers: [{ id: "titles", title: "Title checkpoints", items: Array.from({ length: 64 }, (_, i) => ({ id: `title_${i + 1}`, title: `Checkpoint ${i + 1}`, instruction: "Apply the next fixture title", successTools: ["set_title_screen"] })) }] } : { action: "direct" }) };
    } else {
      phase = "writer"; response = await writer(++writers);
    }
    fixture.http.push({
      at: Date.now(), phase, index: writers,
      tools: request.tools?.length ?? 0, messageCount: request.messages?.length ?? 0,
      writerName: response.calls?.[0]?.name, status: response.status ?? 200,
    });
    await reply(route, response, fixture.http.length, options.tokens ? 512 : 20);
  });
  return () => writers;
}
function terminal(fixture: Fixture, raw: string) {
  const held = signal<TerminalRecord>();
  fixture.awaitingTerminal.push({ raw, resolve: held.resolve });
  return boundedTerminal(held.promise.then((record) => {
    fixture.http.push({ at: Date.now(), mark: "terminal.resolve", instruction: raw });
    return record;
  }));
}
async function send(page: Page, raw: string) {
  await page.getByTestId("ai-input").fill(raw);
  await page.getByTestId("ai-send").click();
}
async function capture(page: Page, fixture: Fixture, label: string) {
  const directory = path.join(root, test.info().title.replace(/[^a-zA-Z0-9-]/g, "_"));
  mkdirSync(directory, { recursive: true });
  const shot = path.join(directory, `${label}.png`);
  const json = path.join(directory, `${label}.json`);
  const viewed = await inspect(page);
  const sticky = await page.getByTestId("ai-sticky-checklist").getAttribute("data-status", { timeout: 2_000 }).catch(() => null);
  const segment = await page.getByTestId("ai-autonomous-budget").getAttribute("data-segment", { timeout: 2_000 }).catch(() => null);
  const jsonAt = Date.now();
  writeFileSync(json, JSON.stringify({
    label, sticky, segment, jsonAt,
    title: viewed.title, map: viewed.map,
    item: viewed.item ? { id: viewed.item.id, name: viewed.item.name } : null,
    checkpoints: viewed.checkpoints,
    appliedCount: fixture.appliedTitles.length,
    appliedElapsedMs: jsonAt - fixture.bootAt,
    appliedTitles: fixture.appliedTitles,
    execution: viewed.harness?.execution ?? null,
    userAuditCount: viewed.harness?.audit.filter((entry) => entry.kind === "user").length ?? 0,
    requestUnits: viewed.harness?.requests?.[0]?.units?.length ?? 0,
    http: fixture.http, unexpected: fixture.unexpected,
  }, null, 2));
  const screenshotAt = Date.now();
  fixture.http.push({ at: screenshotAt, mark: `capture.screenshot.${label}`, jsonAt });
  await page.screenshot({ path: shot });
}

for (const variant of ["auto", "chat", "tokens", "confirm"] as const) test(`B1 64-segments-one-send ${variant}`, async ({ page }) => {
  const options = { agentMode: variant === "chat" ? "chat" as const : "auto" as const, tokens: variant === "tokens", confirm: variant === "confirm" };
  const f = await boot(page, options), raw = 'Set project title to exactly "Final 64"';
  const release = signal();
  const count = await installProvider(page, raw, [valueEntry(raw, raw, "Final 64")], f, async index => {
    if (index > 64) throw new Error("Extra writer request after final target");
    if (index === 56) await bounded(release.promise);
    return { calls: [title(index === 64 ? "Final 64" : `Stage ${index}`)] };
  }, { planned: true, tokens: options.tokens });
  let done = terminal(f, raw);
  const hold55 = waitAppliedHold(f, 55);
  await send(page, raw);
  if (options.confirm) {
    const preview = await done;
    expect(preview.result.execution.state).toBe("preview");
    expect(count()).toBe(0);
    done = terminal(f, "continue");
    await send(page, "continue");
  }
  try {
    await hold55;
    const current = await inspect(page);
    expect(current.checkpoints).toEqual(Array.from({ length: 55 }, (_, i) => `Stage ${i + 1}`));
    expect(current.harness?.execution?.segment).toBeGreaterThan(48);
    expect(await page.getByTestId("ai-autonomous-budget").getAttribute("data-segment")).not.toBeNull();
    await capture(page, f, "held-55");
    release.resolve();
    const record = await done, completed = await inspect(page);
    expect(record.result.execution.state).toBe("verified-local");
    expect(record.result.proposedCalls).toBe(0);
    expect(completed.title).toBe("Final 64");
    expect(completed.checkpoints).toHaveLength(64);
    expect(count()).toBe(64);
    expect(completed.harness?.audit.filter(entry => entry.kind === "user")).toHaveLength(options.confirm ? 2 : 1);
    expect(f.unexpected).toEqual([]);
    await capture(page, f, "complete");
  } finally { release.resolve(); }
});

test("B2 scope-cannot-shrink", async ({ page }) => {
  const f = await boot(page), mapId = f.initial.mapId;
  const clauses = ['Set title to "Kept title"', "Resize current map to 22x17", "Preserve the existing item name"];
  const raw = clauses.join("; ");
  const entries = [valueEntry(raw, clauses[0], "Kept title"),
    { source: [anchor(raw, clauses[1])], criteria: [{ kind: "mapDimensions", target: { mapId }, width: 22, height: 17 }], bindings: ["width", "height"].map((role, i) => ({ source: anchor(raw, i === 0 ? "22" : "17"), role, criterionIndex: 0, fieldPath: [role] })) },
    { source: [anchor(raw, clauses[2])], criteria: [{ kind: "entityPreserve", subject: { kind: "database", collection: "items", id: f.initial.item.id }, path: ["name"] }], bindings: [{ source: anchor(raw, "Preserve"), role: "preserve", criterionIndex: 0, fieldPath: [] }] },
  ];
  const held = signal(), release = signal();
  const hostile = { goal: "Title only", layers: [{ title: "Title", items: [{ id: "weak", title: "Title", instruction: "title only", successTools: ["set_title_screen"] }] }] };
  await installProvider(page, raw, entries, f, async index => {
    if (index === 1) return { calls: [title("Kept title")] };
    if (index === 2) return { calls: [{ name: "set_work_plan", args: hostile }] };
    if (index === 3) return { calls: [{ name: "skip_work_item", args: { itemId: "weak", reason: "fixture attempted waiver" } }] };
    if (index === 4) return { calls: [{ name: "repair_acceptance", args: { itemId: "request-1:source:1", criteria: [{ kind: "mapDimensions", target: { mapId }, width: 21, height: 17 }] } }] };
    if (index === 5) return { content: "done" };
    if (index === 6) { held.resolve(); await bounded(release.promise); return { calls: [{ name: "resize_map", args: { mapId, width: 22, height: 17 } }] }; }
    throw new Error("Unexpected B2 writer");
  });
  const done = terminal(f, raw); await send(page, raw);
  try {
    await bounded(held.promise);
    const state = await inspect(page);
    expect(state.harness?.requests?.[0]?.units).toHaveLength(3);
    expect(state.harness?.requests?.[0]?.units[1]?.criteria).toMatchObject([{ width: 22, height: 17 }]);
    expect(await page.getByTestId("ai-sticky-checklist").getAttribute("data-status")).not.toBe("verified");
    await capture(page, f, "scope-retained"); release.resolve();
    expect((await done).result.execution.state).toBe("verified-local");
    const result = await inspect(page);
    expect(result.map).toEqual({ width: 22, height: 17 });
    expect(result.item.name).toBe(f.initial.item.name);
    expect(f.unexpected).toEqual([]); await capture(page, f, "complete");
  } finally { release.resolve(); }
});

test("B3 no-write-is-not-done", async ({ page }) => {
  const f = await boot(page), raw = 'Set title to "Actually applied"';
  const held = signal(), release = signal();
  await installProvider(page, raw, [valueEntry(raw, raw, "Actually applied")], f, async index => {
    if (index === 1) return { content: "done" };
    if (index === 2) return { calls: [title(f.initial.title)] };
    if (index === 3) { held.resolve(); await bounded(release.promise); return { calls: [title("Actually applied")] }; }
    throw new Error("Unexpected B3 writer");
  });
  const done = terminal(f, raw); await send(page, raw);
  try {
    await bounded(held.promise);
    expect((await inspect(page)).title).toBe(f.initial.title);
    expect(await page.getByTestId("ai-sticky-checklist").getAttribute("data-status")).not.toBe("verified");
    await capture(page, f, "not-done"); release.resolve();
    expect((await done).result.execution.state).toBe("verified-local");
    expect((await inspect(page)).title).toBe("Actually applied");
    expect(f.unexpected).toEqual([]); await capture(page, f, "complete");
  } finally { release.resolve(); }
});

for (const control of ["recover", "abort", "queued", "project-switch", "401"] as const) test(`B4 changed-recovery-and-user-controls ${control}`, async ({ page }) => {
  const f = await boot(page), mapId = f.initial.mapId, raw = "Resize current map to 22x17";
  const entries = [{ source: [anchor(raw)], criteria: [{ kind: "mapDimensions", target: { mapId }, width: 22, height: 17 }], bindings: ["width", "height"].map((role, i) => ({ source: anchor(raw, i === 0 ? "22" : "17"), role, criterionIndex: 0, fieldPath: [role] })) }];
  const held = signal(), release = signal();
  await installProvider(page, raw, entries, f, async index => {
    if (index === 6) { held.resolve(); await bounded(release.promise); }
    if (index > (control === "queued" ? 7 : 6)) throw new Error("Unexpected B4 writer");
    return index === 6 && control === "401" ? { status: 401 } : { calls: [{ name: "resize_map", args: { mapId, width: index <= 5 ? 0 : 22, height: 17, reason: `Attempt ${index}` } }] };
  });
  const done = terminal(f, raw); await send(page, raw);
  try {
    await bounded(held.promise);
    const heldState = await inspect(page);
    const failures = heldState.harness?.audit.filter(entry => entry.kind === "tool" && entry.name === "resize_map");
    expect(failures).toHaveLength(5);
    expect(failures?.filter(entry => entry.kind === "tool" && entry.deferred)).toHaveLength(1);
    expect(await page.getByTestId("ai-sticky-checklist").getAttribute("data-status")).not.toBe("verified");
    await capture(page, f, "recovery");
    const queuedDone = control === "queued" ? terminal(f, "continue") : undefined;
    if (control === "queued") {
      await page.getByTestId("ai-input").fill("continue");
      await page.getByTestId("ai-input").press("Enter");
    }
    if (control === "abort") await page.getByTestId("ai-abort").click();
    if (control === "project-switch") await page.evaluate(async () => {
      const storePath = "/src/project/store.ts", defaultsPath = "/src/project/defaults.ts";
      const [{ store }, { createBlankProject }] = await Promise.all([import(storePath), import(defaultsPath)]);
      store.replaceProject(createBlankProject()); // Existing fixture project-switch surface, no session mutation.
    });
    release.resolve();
    const record = await done, current = await inspect(page);
    if (control === "recover") {
      expect(record.result.execution.state).toBe("verified-local"); expect(current.map).toEqual({ width: 22, height: 17 });
    } else if (control === "queued") {
      expect(record.result.execution.state).toBe("queued");
      expect(record.result.appliedCalls).toBe(0);
      expect(current.map).not.toEqual({ width: 22, height: 17 });
      const acceptance = record.result.acceptance;
      if (acceptance === undefined || acceptance === null) throw new Error("Missing terminal acceptance");
      expect(acceptance.status).not.toBe("verified");
      if (queuedDone === undefined) throw new Error("Missing queued terminal subscription");
      const resumed = await queuedDone;
      expect(resumed.result.execution.state).toBe("verified-local");
      expect((await inspect(page)).map).toEqual({ width: 22, height: 17 });
    } else {
      expect(record.result.execution.state).toBe(control === "401" ? "external-blocker" : control === "abort" ? "aborted" : "project-switch");
      expect(current.map).not.toEqual({ width: 22, height: 17 });
    }
    expect(f.unexpected).toEqual([]); await capture(page, f, "terminal");
  } finally { release.resolve(); }
});
