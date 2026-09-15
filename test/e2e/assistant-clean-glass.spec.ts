import { expect, test, type Page, type Route } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Agent, get } from "node:http";

const EVIDENCE = path.resolve("output/evidence/assistant-clean-glass/phase-1");

// Phase 2 uses the same real editor boot; no fake keyboard/range implementation.
test("background opacity: native keyboard, immediate application and reload", async ({ page }) => {
  test.setTimeout(180_000);
  await boot(page);
  const root = page.locator(".ai-chat-panel");
  const deck = page.locator(".ai-deck");
  await page.getByTestId("topbar-ai-settings").click();
  const slider = page.getByRole("slider", { name: "배경 농도", exact: true });
  await expect(slider).toHaveValue("82");
  await slider.focus();
  await slider.press("ArrowRight");
  await expect(slider).toHaveValue("83");
  await expect(page.getByTestId("ai-background-opacity-value")).toHaveText("83%");
  expect(await root.evaluate((node) => node.style.getPropertyValue("--ai-background-opacity"))).toBe("83%");
  expect(await deck.evaluate((node) => getComputedStyle(node).opacity)).toBe("1");
  for (const [key, value] of [["Home", "78"], ["End", "100"], ["ArrowLeft", "99"]]) {
    await slider.press(key!);
    await expect(slider).toHaveValue(value!);
    expect(await page.evaluate(() => localStorage.getItem("oprn:ai-background-opacity"))).toBe(value);
  }
  await page.getByTestId("ai-settings-close").click();
  await page.getByTestId("ai-collapse").click();
  const pill = page.getByTestId("ai-collapsed-restore");
  await expect(pill).toBeVisible();
  const before = await pill.evaluate((node) => ({ background: getComputedStyle(node).backgroundColor, opacity: getComputedStyle(node).opacity }));
  expect(before.opacity).toBe("1");
  await page.reload({ waitUntil: "commit" });
  await expect(pill).toBeVisible({ timeout: 60_000 });
  expect(await root.evaluate((node) => node.style.getPropertyValue("--ai-background-opacity"))).toBe("99%");
  expect(await pill.evaluate((node) => getComputedStyle(node).backgroundColor)).toBe(before.background);
  await page.getByTestId("topbar-ai-settings").click();
  await expect(slider).toHaveValue("99");
  await slider.press("Home");
  expect(await pill.evaluate((node) => getComputedStyle(node).backgroundColor)).not.toBe(before.background);
  const evidence = path.resolve("output/evidence/assistant-clean-glass/phase-2");
  mkdirSync(evidence, { recursive: true });
  await page.screenshot({ path: path.join(evidence, "keyboard-opacity-settings.png") });
});
const VIEWPORTS = [{ width: 1024, height: 768 }, { width: 1280, height: 800 }, { width: 1440, height: 900 }];
const PROMOTIONS = '.ai-quick-reply-chip, .ai-composer-chip, .ai-suggest-row, .ai-authoring-example-chip, .ai-start-visual-gallery, [data-testid="ai-studio-suggest"]';
const LIVE_PLAN = '[data-testid="ai-work-plan-checklist"], [data-testid="ai-plan-book"], [data-testid="ai-autonomous-feed"]';
const FINAL = "CLEAN-GLASS-FINAL";
const FOLLOWUP = "CLEAN-GLASS-FOLLOWUP";
const RETAINED = "CLEAN-GLASS-RETAINED";
type Ending = "success" | "no-write" | "error" | "abort";
type Message = { role: "assistant"; content: string; tool_calls?: unknown[] };

function signal<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

// A timeout is a failure bound, never a scheduling mechanism.
async function bounded<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Missing exact event: ${label}`)), 30_000);
    })]);
  } finally { clearTimeout(timer); }
}

async function reply(route: Route, message: Message): Promise<void> {
  const body = route.request().postDataJSON();
  // Respect the actual provider capability, including cpen's stream:false request.
  if (body.stream === true) {
    const delta = { ...message, tool_calls: message.tool_calls?.map((call, index) => ({ ...(call as object), index })) };
    await route.fulfill({ contentType: "text/event-stream", body: `data: ${JSON.stringify({ choices: [{ index: 0, delta, finish_reason: null }] })}\n\ndata: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: message.tool_calls ? "tool_calls" : "stop" }] })}\n\ndata: [DONE]\n\n` });
  } else {
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ choices: [{ message, finish_reason: message.tool_calls ? "tool_calls" : "stop" }] }) });
  }
}

function tool(name: string, args: object, content = "") : Message {
  return { role: "assistant", content, tool_calls: [{ id: `clean_${name}`, type: "function", function: { name, arguments: JSON.stringify(args) } }] };
}

async function installTransport(page: Page, ending: Ending, mapId: string, log: unknown[]) {
  const held = signal<Route>();
  let round = 0;
  let released = false;
  await page.route("**/v1/chat/completions", async (route) => {
    const request = route.request().postDataJSON();
    const hasTools = (request.tools?.length ?? 0) > 0;
    log.push({ action: "transport", hasTools, stream: request.stream, round });
    if (!hasTools) {
      const plan = ending === "success" && !released
        ? { action: "new_plan", goal: "CLEAN-GLASS-PLAN", layers: [{ title: "terrain", items: [{ title: "pond", instruction: "fill_region", successTools: ["fill_region"] }] }] }
        : { action: "direct", reason: "single operation" };
      await reply(route, { role: "assistant", content: JSON.stringify(plan) });
      return;
    }
    round += 1;
    if (round === 1) {
      await reply(route, tool("set_build_spec", { mapId, title: "CLEAN_GLASS_PLAN", density: "normal", assets: [{ id: "pond", kind: "terrain", x: 4, y: 4, w: 4, h: 4, layer: "lower", overExisting: "keep" }] }, RETAINED));
    } else if (round === 2 && ending === "success") {
      await reply(route, tool("fill_region", { mapId, rect: { x: 4, y: 4, w: 4, h: 4 }, material: "물", shape: "rect", layer: "lower" }));
    } else if (!released) {
      // Keep the real HTTP request pending until assertions have inspected live state.
      held.resolve(route);
    } else {
      await reply(route, { role: "assistant", content: FOLLOWUP });
    }
  });
  return {
    held: held.promise,
    release: async (route: Route) => {
      released = true;
      if (ending === "error") await route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: { message: "CLEAN_GLASS_TRANSPORT_ERROR", type: "invalid_request_error" } }) });
      else await reply(route, { role: "assistant", content: FINAL });
    },
  };
}

async function boot(page: Page): Promise<string> {
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "standard");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
    localStorage.setItem("oprn:ai-config", JSON.stringify({ agentMode: "chat" }));
  });
  // Chromium on this shared Linux host receives unrelated netlink changes. Relay only
  // this server's static GETs, unchanged, with a bounded pool (no retry or delay).
  // No idle socket reuse: Vite can close an idle connection between two turns.
  const origin = new URL(test.info().project.use.baseURL!).origin;
  const agent = new Agent({ keepAlive: false, maxSockets: 8 });
  page.once("close", () => agent.destroy());
  await page.route(`${origin}/**`, async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const staticAsset = pathname === "/" || /^\/(src|assets|@vite|@id|@fs|node_modules)\//.test(pathname);
    if (route.request().method() !== "GET" || !staticAsset) return route.fallback();
    const response = await new Promise<{ status: number; headers: Record<string, string>; body: Buffer }>((resolve, reject) => {
      const target = new URL(route.request().url());
      if (process.env.E2E_EDITOR_CONNECT_HOST) target.hostname = process.env.E2E_EDITOR_CONNECT_HOST;
      const request = get(target, { agent, headers: { host: new URL(origin).host } }, (incoming) => {
        const chunks: Buffer[] = [];
        incoming.on("data", (chunk: Buffer) => chunks.push(chunk));
        incoming.once("error", reject);
        incoming.once("end", () => resolve({
          status: incoming.statusCode!,
          headers: Object.fromEntries(Object.entries(incoming.headers).filter((entry): entry is [string, string] => typeof entry[1] === "string")),
          body: Buffer.concat(chunks),
        }));
      });
      request.once("error", (cause) => reject(new Error(`Owned static GET failed: ${pathname}`, { cause })));
      request.setTimeout(60_000, () => request.destroy(new Error("Owned editor GET timed out")));
    });
    await route.fulfill(response);
  });
  // No real model or remote authoring writes. Keep local persistence and editor lifecycle real.
  await page.route("**/__oprn/ai-activity", (route) => route.fulfill({ json: { ok: true } }));
  await page.route("**/rest/v1/**", (route) => route.fulfill({ json: [] }));
  const guest = page.getByTestId("login-guest");
  const bootReady = guest.or(page.getByTestId("ai-input")).first().waitFor({ state: "visible", timeout: 120_000 });
  await page.goto("/?blankProject=1", { waitUntil: "commit" });
  await bootReady;
  if (await guest.isVisible()) await guest.click();
  await expect(page.getByTestId("login-modal")).toBeHidden();
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("ai-input")).toBeVisible();
  return page.evaluate(async () => {
    const modulePath = "/src/project/store.ts";
    const { store } = await import(modulePath) as typeof import("../../src/project/store");
    return store.getCurrent().startMapId;
  });
}

async function snapshot(page: Page) {
  return page.evaluate(async () => {
    const bpPath = "/src/editor/agentBlueprint.ts";
    const ghostPath = "/src/editor/agentGhostPreview.ts";
    const pendingPath = "/src/editor/regionTask/pendingRegionApply.ts";
    const storePath = "/src/project/store.ts";
    const historyPath = "/src/editor/mapEditHistory.ts";
    const [bp, ghost, pending, { store }, history] = await Promise.all([
      import(bpPath) as Promise<typeof import("../../src/editor/agentBlueprint")>,
      import(ghostPath) as Promise<typeof import("../../src/editor/agentGhostPreview")>,
      import(pendingPath) as Promise<typeof import("../../src/editor/regionTask/pendingRegionApply")>,
      import(storePath) as Promise<typeof import("../../src/project/store")>,
      import(historyPath) as Promise<typeof import("../../src/editor/mapEditHistory")>,
    ]);
    const project = store.getCurrent();
    return {
      blueprint: bp.getAgentBlueprintState().entries,
      ghost: ghost.getAgentGhostPreviewState(),
      pending: pending.getPendingRegionApply() ? { settled: pending.getPendingRegionApply()!.settled, instruction: pending.getPendingRegionApply()!.instruction } : null,
      tiles: project.maps[project.startMapId]!.lowerTiles,
      canUndo: history.getMapEditHistoryState().canUndo,
      overflow: document.documentElement.scrollWidth > innerWidth,
    };
  });
}

function terminal(page: Page, instruction: string) {
  // Registered before submit/release/abort; this record is emitted after owner finally cleanup.
  return page.waitForRequest((request) => {
    if (!request.url().endsWith("/__oprn/ai-activity") || request.method() !== "POST") return false;
    const record = request.postDataJSON();
    return record.instruction === instruction && record.result?.pending !== true && record.result?.stoppedReason !== undefined;
  }, { timeout: 60_000 });
}

async function noPromotions(page: Page) {
  await expect(page.locator(PROMOTIONS)).toHaveCount(0);
  await expect(page.getByTestId("ai-suggest-popover")).toBeHidden();
}

async function clean(page: Page, region = false) {
  const state = await snapshot(page);
  expect(state.blueprint).toEqual([]);
  expect(state.ghost.runningToolName).toBe("");
  if (!region) expect(state.ghost.previews).toEqual([]);
  await expect(page.locator(LIVE_PLAN)).toHaveCount(0);
  await expect(page.getByTestId("ai-abort")).toBeHidden();
  await noPromotions(page);
  expect(state.overflow).toBe(false);
  return state;
}

async function shot(page: Page, name: string, log: unknown[]) {
  await page.screenshot({ path: path.join(EVIDENCE, `${name}.png`), animations: "disabled" });
  log.push({ action: "screenshot", name, viewport: page.viewportSize(), url: page.url(), state: await snapshot(page) });
}

test.describe("assistant clean glass - real editor lifecycle", () => {
  test.describe.configure({ timeout: 240_000, retries: 0 });
  test.beforeAll(() => mkdirSync(EVIDENCE, { recursive: true }));

  for (const viewport of VIEWPORTS) {
    test(`success, undo, follow-up, history and focus ${viewport.width}x${viewport.height}`, async ({ page }) => {
      const log: unknown[] = [];
      const id = `success-${viewport.width}x${viewport.height}`;
      try {
        await page.setViewportSize(viewport);
        const mapId = await boot(page);
        await page.getByTestId("ai-input").focus();
        await expect(page.getByTestId("ai-input")).toBeFocused();
        await noPromotions(page);
        await shot(page, `${id}-idle`, log);
        const before = await snapshot(page);
        const transport = await installTransport(page, "success", mapId, log);
        const instruction = "CLEAN_GLASS_SUCCESS";
        const done = terminal(page, instruction);
        await page.getByTestId("ai-input").fill(instruction);
        await page.getByTestId("ai-send").click();
        const held = await bounded(transport.held, "success transport held after write");
        const live = await snapshot(page);
        expect(live.blueprint.length).toBeGreaterThan(0);
        expect(live.ghost.previews.length).toBeGreaterThan(0);
        await expect(page.getByTestId("ai-work-plan-checklist")).toBeVisible();
        await shot(page, `${id}-live`, log);
        await transport.release(held);
        const receipt = (await done).postDataJSON();
        log.push({ action: "terminal", receipt });
        expect(receipt.result.stoppedReason).toBe("final");
        expect(receipt.result.appliedCalls).toBeGreaterThan(0);
        const after = await clean(page);
        expect(after.tiles).not.toEqual(before.tiles);
        expect(after.canUndo).toBe(true);
        await expect(page.getByTestId("ai-chat-log")).toContainText(FINAL);
        await expect(page.getByTestId("ai-composer-undo")).toBeVisible();
        await shot(page, `${id}-settled`, log);
        await page.getByTestId("ai-composer-undo").click();
        expect((await snapshot(page)).tiles).toEqual(before.tiles);
        log.push({ action: "undo", restoredOriginalTiles: true });
        const followupDone = terminal(page, "CLEAN_GLASS_NEXT");
        await page.getByTestId("ai-input").fill("CLEAN_GLASS_NEXT");
        await page.getByTestId("ai-send").click();
        await followupDone;
        await clean(page);
        await expect(page.getByTestId("ai-chat-log")).toContainText(FOLLOWUP);
        await page.getByTestId("ai-new-chat").click();
        await noPromotions(page);
        await page.getByTestId("ai-input").focus();
        await noPromotions(page);
        await expect(page.getByTestId("ai-chat-log")).not.toContainText(FINAL);
        await page.getByTestId("ai-open-conversations").click();
        await expect(page.getByTestId("ai-history-modal")).toBeVisible();
        const row = page.getByTestId("ai-history-open").filter({ hasText: instruction });
        await expect(row).toBeVisible();
        await shot(page, `${id}-history`, log);
        await row.click();
        await expect(page.getByTestId("ai-history-modal")).toBeHidden();
        await expect(page.getByTestId("ai-chat-log")).toContainText(FINAL);
        await expect(page.getByTestId("ai-chat-log")).toContainText(FOLLOWUP);
        await clean(page);
        await shot(page, `${id}-restored`, log);
      } finally { writeFileSync(path.join(EVIDENCE, `${id}-actions.json`), JSON.stringify(log, null, 2)); }
    });
  }

  for (const ending of ["no-write", "error", "abort"] as const) {
    test(`${ending} cleans its turn and preserves independent region approval`, async ({ page }) => {
      const log: unknown[] = [];
      try {
        await page.setViewportSize(VIEWPORTS[2]!);
        const mapId = await boot(page);
        const before = await snapshot(page);
        const pendingResult = await page.evaluate(async (id) => {
          const harness = (window as unknown as { __oprnRegionTaskHarness: { runMock: (mapId: string, region: object, writes: object[]) => Promise<{ ok: boolean; applied: boolean; changedCells: number }> } }).__oprnRegionTaskHarness;
          const result = await harness.runMock(id, { x: 1, y: 1, width: 2, height: 2 }, [{ x: 1, y: 1, layer: "lower", tile: 342 }]);
          return { ok: result.ok, applied: result.applied, changedCells: result.changedCells };
        }, mapId);
        log.push({ action: "independent-region-draft", pendingResult });
        const pending = await snapshot(page);
        expect(pending.pending?.settled).toBe(false);
        expect(pending.ghost.previews.length).toBeGreaterThan(0);
        await expect(page.getByTestId("ghost-inline-accept")).toBeVisible();
        const transport = await installTransport(page, ending, mapId, log);
        const instruction = `CLEAN_GLASS_${ending}`;
        const done = terminal(page, instruction);
        await page.getByTestId("ai-input").fill(instruction);
        await page.getByTestId("ai-send").click();
        const held = await bounded(transport.held, `${ending} transport held after blueprint`);
        expect((await snapshot(page)).blueprint.length).toBeGreaterThan(0);
        await shot(page, `${ending}-live`, log);
        if (ending === "abort") {
          const cancelled = page.waitForEvent("requestfailed", { predicate: (request) => request === held.request(), timeout: 30_000 });
          await page.getByTestId("ai-abort").click();
          await cancelled;
        } else await transport.release(held);
        const receipt = (await done).postDataJSON();
        log.push({ action: "terminal", receipt });
        expect(receipt.result.stoppedReason).toBe(ending === "no-write" ? "final" : ending === "abort" ? "aborted" : "error");
        expect(receipt.result.appliedCalls).toBe(0);
        const after = await clean(page, true);
        expect(after.tiles).toEqual(before.tiles);
        expect(after.pending).toEqual(pending.pending);
        expect(after.ghost.previews).toEqual(pending.ghost.previews);
        await expect(page.getByTestId("ai-chat-log")).toContainText(ending === "no-write" ? FINAL : RETAINED);
        await expect(page.getByTestId("ghost-inline-accept")).toBeVisible();
        await expect(page.getByTestId("ghost-inline-hold-origin")).toBeVisible();
        if (ending === "error") await expect(page.getByTestId("ai-error-open-settings")).toBeVisible();
        await shot(page, `${ending}-settled-region-preserved`, log);
        if (ending === "error") {
          await expect(page.getByTestId("ai-gate-modal")).toHaveAttribute("data-gate-kind", "turn-error");
          await page.getByTestId("ai-gate-modal-close").click();
          await expect(page.getByTestId("ai-gate-modal")).toHaveCount(0);
          log.push({ action: "acknowledge-error-dialog" });
        }
        await page.getByTestId("ghost-inline-accept").click();
        expect((await snapshot(page)).pending).toBeNull();
        expect((await snapshot(page)).tiles).not.toEqual(before.tiles);
        log.push({ action: "independent-region-approved", appliedOnlyAfterExplicitClick: true });
      } finally { writeFileSync(path.join(EVIDENCE, `${ending}-actions.json`), JSON.stringify(log, null, 2)); }
    });
  }
});
