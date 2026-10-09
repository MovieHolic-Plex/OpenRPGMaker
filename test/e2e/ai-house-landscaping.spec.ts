import { expect, test as base, type Page, type BrowserContext } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { GameMap, MapLayoutRegion, Rect } from "../../src/project/types";
import type { ToolResult } from "../../src/editor/tools/types";

// Engine-only fixture. The session, runner, proposals, store and Phaser canvas are real.
// Only the model transport is scripted; remote writes are denied, never faked as saved.
const EVIDENCE = path.resolve(process.env.E2E_HOUSE_LANDSCAPING_EVIDENCE_DIR ?? ".omo/evidence/house-protection/p2/e2e");
type Call = { id: string; name: string; args: Record<string, unknown> };
type Outcome = { id: string; name: string; result: ToolResult; map: GameMap; houseCells: ReturnType<typeof houseCells>; outsideChanged: number; protectedOverlap: number };

function bounded<T>(promise: Promise<T>, label: string, ms = 60_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timed out awaiting ${label}`)), ms);
    promise.then((value) => { clearTimeout(timeout); resolve(value); }, (error) => { clearTimeout(timeout); reject(error); });
  });
}

async function readMap(page: Page, source: "store" | "draft"): Promise<GameMap> {
  return page.evaluate(async (from) => {
    const moduleUrl = (suffix: string) => performance.getEntriesByType("resource")
      .map((entry) => entry.name).find((url) => new URL(url).pathname === suffix) ?? suffix;
    const { store } = await import(moduleUrl("/src/project/store.ts")) as typeof import("../../src/project/store");
    const project = store.getCurrent();
    if (from === "store") return structuredClone(project.maps[project.startMapId]);
    const { getAgentGhostDraftMap } = await import(moduleUrl("/src/editor/agentGhostPreview.ts")) as typeof import("../../src/editor/agentGhostPreview");
    const map = getAgentGhostDraftMap(project.startMapId);
    if (!map) throw new Error("Real panel session draft provider is unavailable");
    return structuredClone(map);
  }, source);
}

// Independent oracle, frozen at build time: no production protection helpers.
function ownedCoordinates(map: GameMap) {
  const cells = new Map<string, { x: number; y: number }>();
  const add = (x: number, y: number) => {
    if (x >= 0 && y >= 0 && x < map.width && y < map.height) cells.set(`${x},${y}`, { x, y });
  };
  for (const house of map.layoutPlan?.regions.filter((region) => region.role === "house") ?? []) {
    for (let y = house.y - 1; y < house.y + house.h; y += 1) {
      for (let x = house.x; x < house.x + house.w; x += 1) add(x, y);
    }
    if (house.doorAt && (house.shape === "rooftop-deck"
      || house.tags?.some((tag) => tag === "roof-deck" || tag === "shape:rooftop-deck"))) {
      const left = house.x + 2;
      const right = house.x + house.w - 3;
      const x = Math.abs(right - house.doorAt.x) >= Math.abs(left - house.doorAt.x) ? right : left;
      const y = house.y + house.h;
      if (map.upperTiles[y * map.width + x] === 322) add(x, y);
    }
  }
  return [...cells.values()].sort((a, b) => a.y - b.y || a.x - b.x);
}
function houseCells(map: GameMap, coordinates: readonly { x: number; y: number }[]) {
  return coordinates.map(({ x, y }) => {
    const i = y * map.width + x;
    return { x, y, lower: map.lowerTiles[i], upper: map.upperTiles[i],
      lowerStack: map.lowerTileStacks?.[i] ?? null, upperStack: map.upperTileStacks?.[i] ?? null };
  });
}
function outsideChanged(before: GameMap, after: GameMap, coordinates: readonly { x: number; y: number }[]) {
  const owned = new Set(coordinates.map(({ x, y }) => y * before.width + x));
  return before.lowerTiles.reduce((count, lower, i) => count + Number(!owned.has(i) && (
    lower !== after.lowerTiles[i] || before.upperTiles[i] !== after.upperTiles[i]
    || JSON.stringify(before.lowerTileStacks?.[i]) !== JSON.stringify(after.lowerTileStacks?.[i])
    || JSON.stringify(before.upperTileStacks?.[i]) !== JSON.stringify(after.upperTileStacks?.[i])
  )), 0);
}
function overlap(rect: Rect, coordinates: readonly { x: number; y: number }[]) {
  return coordinates.filter(({ x, y }) => x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h).length;
}

async function captureCanvas(page: Page, filename: string): Promise<void> {
  // Observe the actual Phaser render, not a guessed delay or a RAF-count heuristic.
  await bounded(page.evaluate(async () => {
    const modeUrl = performance.getEntriesByType("resource").map((entry) => entry.name)
      .find((url) => new URL(url).pathname === "/src/app/mode.ts") ?? "/src/app/mode.ts";
    const { getGame } = await import(modeUrl) as typeof import("../../src/app/mode");
    const game = getGame();
    if (!game) throw new Error("Editor Phaser game is missing");
    await new Promise<void>((resolve, reject) => {
      const rendered = () => { clearTimeout(timeout); resolve(); };
      const timeout = setTimeout(() => {
        game.events.off("postrender", rendered);
        reject(new Error("Editor postrender event deadline"));
      }, 10_000);
      game.events.once("postrender", rendered);
    });
  }), "editor render module and postrender");
  await page.screenshot({ path: path.join(EVIDENCE, filename), animations: "disabled" });
}

async function prepareEditor(page: Page, context: BrowserContext) {
  const deniedWrites: { method: string; pathname: string }[] = [];
  const remoteWriteResponses: { pathname: string; status: number }[] = [];
  context.on("response", (response) => {
    const request = response.request();
    const url = new URL(request.url());
    // The only fulfilled remote mutation is our explicitly scripted model HTTP.
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method()) && url.pathname !== "/v1/chat/completions"
      && (url.hostname !== "127.0.0.1" || /\/rest\/v1\/|\/storage\/v1\//.test(url.pathname))) {
      remoteWriteResponses.push({ pathname: url.pathname, status: response.status() });
    }
  });
  await test.step("Install remote-write guard and isolated static transport", async () => {
    mkdirSync(EVIDENCE, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    // Context-owned guard survives page.unrouteAll during teardown.
    await context.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (!["GET", "HEAD", "OPTIONS"].includes(request.method())
        && (url.hostname !== "127.0.0.1" || /\/rest\/v1\/|\/storage\/v1\//.test(url.pathname))) {
        deniedWrites.push({ method: request.method(), pathname: url.pathname });
        return route.abort("blockedbyclient");
      }
      return route.fallback();
    });
    // Existing browser utility's Node transport workaround, without its retry policy.
    await page.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.hostname === "127.0.0.1" && request.method() === "GET"
        && (request.isNavigationRequest() || /^\/(src|node_modules|@|vendor)\//.test(url.pathname))) {
        // Vite closes idle HTTP sockets; never reuse a stale socket during a large
        // module graph load. This is transport isolation, not an ECONNRESET retry.
        return route.fulfill({ response: await route.fetch({
          headers: { ...request.headers(), connection: "close" }, maxRetries: 0, timeout: 60_000,
        }) });
      }
      return route.fallback();
    });
    await page.addInitScript(() => {
      localStorage.setItem("oprn:editor-ui-mode", "standard");
      localStorage.setItem("oprn:editor-welcome-dismissed", "1");
      localStorage.setItem("oprn:standard-welcome-seen", "1");
      localStorage.setItem("oprn:coachmarks-basic-v1", "1");
      localStorage.setItem("oprn:ai-config", JSON.stringify({ configVersion: 2, agentMode: "chat", maxToolCalls: 20 }));
    });
  });
  await test.step("Navigate and dismiss editor boot overlays", async () => {
    await page.goto("/?blankProject=1&aiBridge=0", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 60_000 });
    const guest = page.getByTestId("login-guest");
    if (await guest.isVisible()) await guest.click();
    await expect(page.getByTestId("login-modal")).toHaveCount(0);
    const welcome = page.getByTestId("standard-welcome-start");
    if (await welcome.isVisible()) await welcome.click();
    await expect(page.getByTestId("standard-welcome-card")).toHaveCount(0);
    const coach = page.getByTestId("coach-mark-skip");
    if (await coach.isVisible()) await coach.click();
    await expect(page.locator("[data-testid^='coach-mark-']")).toHaveCount(0);
  });
  return test.step("Load initial modules and establish the real editor precondition", async () => {
    const fixture = await page.evaluate(async () => {
      const moduleUrl = (suffix: string) => performance.getEntriesByType("resource")
        .map((entry) => entry.name).find((url) => new URL(url).pathname === suffix) ?? suffix;
      const { store } = await import(moduleUrl("/src/project/store.ts")) as typeof import("../../src/project/store");
      const { editorState } = await import(moduleUrl("/src/editor/editorState.ts")) as typeof import("../../src/editor/editorState");
      const { runTool } = await import(moduleUrl("/src/editor/tools/toolRunner.ts")) as typeof import("../../src/editor/tools/toolRunner");
      const { getAiAssistantStatus } = await import(moduleUrl("/src/editor/aiAssistantBridge.ts")) as typeof import("../../src/editor/aiAssistantBridge");
      await import(moduleUrl("/src/project/io.ts"));
      const id = store.getCurrent().startMapId;
      const ctx = { project: store.getCurrent() };
      const resized = runTool(ctx, "resize_map", { mapId: id, width: 50, height: 50 });
      if (!resized.ok) throw new Error(JSON.stringify(resized));
      ctx.project.startPos = { x: 0, y: 0 };
      store.replace(ctx.project, { change: { origin: "human", label: "Landscaping engine fixture: blank 50x50" } });
      editorState.set({ zoom: 1, selection: { mapId: id, x: 0, y: 0, width: 50, height: 50 } });
      return { mapId: id, remotePersistenceEnabled: store.isRemotePersistenceEnabled(), selection: editorState.get().selection,
        bridgeReady: getAiAssistantStatus().ready, resized };
    });
    expect(fixture.remotePersistenceEnabled).toBe(false);
    expect(fixture.bridgeReady).toBe(true);
    const before = await readMap(page, "store");
    expect([before.width, before.height]).toEqual([50, 50]);
    expect(before.layoutPlan?.regions.filter((region) => region.role === "house") ?? []).toEqual([]);
    expect(new Set(before.lowerTiles).size).toBe(1);
    expect(new Set(before.upperTiles)).toEqual(new Set([-1]));
    await captureCanvas(page, "01-blank-before.png");

    return { fixture, before, deniedWrites, remoteWriteResponses };
  });
}

const test = base.extend<{ drainRoutes: void }>({
  drainRoutes: [async ({ page }, use) => {
    await use();
    // Fixture teardown has its own deadline: a completed behavioral test must not
    // dispose responses while its remaining static-file handlers are draining.
    await page.unrouteAll({ behavior: "wait" });
  }, { auto: true, timeout: 30_000 }],
});

const scenario = test.extend<{ editor: Awaited<ReturnType<typeof prepareEditor>> }>({
  // Boot/module work has its own budget, separate from the real AI turn.
  editor: [async ({ page, context }, use) => {
    await use(await prepareEditor(page, context));
  }, { timeout: 180_000 }],
});

scenario("same AI turn landscapes around four completed village houses without changing them", async ({ page, editor }, testInfo) => {
  // New heavier village case only: existing Phase 1 deadlines remain unchanged.
  test.setTimeout(180_000);
  const { fixture, before, deniedWrites, remoteWriteResponses } = editor;
  const mapId = fixture.mapId;
  const calls: Call[] = [];
  const outcomes: Outcome[] = [];
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  let built: GameMap | undefined;
  let coordinates: ReturnType<typeof ownedCoordinates> = [];
  let house: MapLayoutRegion | undefined;
  let strip: Rect | undefined;
  let forest: Rect | undefined;
  let round = 0;
  const receipt = (extra: Record<string, unknown> = {}) => {
    writeFileSync(path.join(EVIDENCE, "landscaping.json"), JSON.stringify({ fixture, before, built, house, strip, forest,
      builtHouseCells: built ? houseCells(built, coordinates) : null, calls, outcomes, browserErrors, deniedWrites, ...extra }, null, 2) + "\n");
  };
  await page.route("**/v1/chat/completions", async (route) => {
    const body = route.request().postDataJSON() as {
      tools?: unknown[]; messages: { role: string; tool_call_id?: string; content?: string }[];
    };
    if (!body.tools?.length) return route.fulfill({ json: { choices: [{ finish_reason: "stop", message: {
      role: "assistant", content: JSON.stringify({ mode: "create", space: "outdoor", targetMapId: mapId,
        needsPlan: false, action: "direct", tools: ["author_village", "fill_region", "place_props", "tile_erase"],
        reason: "Engine landscaping regression", summary: "Engine landscaping regression" }),
    } }] } });
    // One call per request. Its tool message is the exact session completion
    // signal; capture the actual draft before allowing the next operation.
    for (const message of body.messages) {
      const call = calls.find((entry) => entry.id === message.tool_call_id);
      if (message.role !== "tool" || !call || outcomes.some((entry) => entry.id === call.id)) continue;
      const result = JSON.parse(message.content!) as ToolResult;
      const map = await readMap(page, "draft");
      const previous = outcomes.at(-1)?.map ?? before;
      if (call.id === "build" && result.ok) {
        built = map;
        coordinates = ownedCoordinates(map);
        house = map.layoutPlan?.regions.filter((region) => region.role === "house")
          .sort((a, b) => a.y - b.y || a.x - b.x)[0];
        if (!house) throw new Error("Successful village has no house metadata");
        // Straddle north ridge/roof and outside land, not a front door.
        const x = Math.max(0, house.x - 3);
        strip = { x, y: house.y - 1, w: Math.min(map.width, house.x + house.w + 3) - x, h: 3 };
        // Forest starts below water. Exterior-only keeps the fixture minimal;
        // linked-door passage coverage belongs to the focused core tests.
        const y = house.y + 2;
        forest = { x: 0, y, w: map.width, h: map.height - y };
        await captureCanvas(page, "02-built-before-landscaping.png");
      }
      const area = (call.args.rect ?? call.args.area) as Rect | undefined;
      outcomes.push({ id: call.id, name: call.name, result, map, houseCells: houseCells(map, coordinates),
        outsideChanged: outsideChanged(previous, map, coordinates), protectedOverlap: area ? overlap(area, coordinates) : 0 });
      receipt();
    }
    const script: Call[] = [
      { id: "build", name: "author_village", args: { target: { kind: "existing", mapId, bounds: { x: 0, y: 0, w: 50, h: 50 } },
        houseCount: 4, countPolicy: "exact", seed: 7, interior: false, npcCount: 0, forestDensity: "sparse" } },
      ...(house && strip && forest ? [
        { id: "sand", name: "fill_region", args: { mapId, rect: strip, material: "모래", clearUpper: true } },
        { id: "water", name: "fill_region", args: { mapId, rect: strip, material: "물", clearUpper: true } },
        { id: "forest", name: "place_props", args: { mapId, area: forest, material: "침엽수", density: "dense", seed: 7 } },
        { id: "protected-noop", name: "fill_region", args: { mapId,
          rect: { x: house.x + Math.floor(house.w / 2), y: house.y, w: 1, h: 1 }, material: "물", clearUpper: true } },
        { id: "protected-erase", name: "tile_erase", args: { mapId, rect: { x: house.x, y: house.y - 1, w: house.w, h: house.h + 1 } } },
      ] : []),
    ];
    const call = script[round++];
    if (call) calls.push(call);
    await route.fulfill({ json: { choices: [{ finish_reason: call ? "tool_calls" : "stop", message: call ? {
      role: "assistant", content: null, tool_calls: [{ id: call.id, type: "function", function: {
        name: call.name, arguments: JSON.stringify(call.args),
      } }],
    } : { role: "assistant", content: "HOUSE_LANDSCAPING_COMPLETE" } }] } });
  });

  const turn = await test.step("Build seed 7 village, fill sand/water and plant dense forest in one real panel turn", () => bounded(page.evaluate(async () => {
    const moduleUrl = (suffix: string) => performance.getEntriesByType("resource")
      .map((entry) => entry.name).find((url) => new URL(url).pathname === suffix) ?? suffix;
    const { store } = await import(moduleUrl("/src/project/store.ts")) as typeof import("../../src/project/store");
    const { sendAiAssistantMessage } = await import(moduleUrl("/src/editor/aiAssistantBridge.ts")) as typeof import("../../src/editor/aiAssistantBridge");
    let unsubscribe = () => {};
    const applied = new Promise<{ origin?: string; label?: string }>((resolve) => {
      unsubscribe = store.subscribe((project, change) => {
        if (change.origin === "ai" && project.maps[project.startMapId].layoutPlan?.regions.some((region) => region.role === "house")) {
          resolve({ origin: change.origin, label: change.label });
        }
      });
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Village AI send/store completion timeout")), 155_000); });
      const [result, storeEvent] = await Promise.race([Promise.all([
        sendAiAssistantMessage("author_village seed 7: Build four exterior-only houses, then fill_region sand and water around a house and place_props dense forest outside the houses. Preserve every completed house. Test a protected no-op fill and rejected erase."), applied,
      ]), timeout]);
      return { result, storeEvent };
    } finally {
      clearTimeout(timer);
      unsubscribe();
    }
  }), "real village session and applied store event", 160_000));

  const after = await readMap(page, "store");
  await captureCanvas(page, "03-applied-after-landscaping.png");
  receipt({ after, afterHouseCells: houseCells(after, coordinates), actualOutsideChanged: built ? outsideChanged(built, after, coordinates) : null, turn });
  await testInfo.attach("landscaping-raw", { path: path.join(EVIDENCE, "landscaping.json"), contentType: "application/json" });
  await test.step("Assert outside work, skipped protection and exact houses after every operation and final apply", async () => {
    expect(turn.result.ok, turn.result.error).toBe(true);
    expect(turn.result.status.turnBusy).toBe(false);
    expect(turn.result.lastAssistantText).toBe("HOUSE_LANDSCAPING_COMPLETE");
    expect(turn.result.audit.filter((entry) => entry.kind === "user")).toHaveLength(1);
    expect(outcomes.map((entry) => entry.id)).toEqual(calls.map((entry) => entry.id));
    expect(outcomes.map((entry) => entry.id)).toEqual(["build", "sand", "water", "forest", "protected-noop", "protected-erase"]);
    expect(outcomes[0].result.ok, JSON.stringify(outcomes[0].result)).toBe(true);
    expect(built).toBeDefined();
    expect(built!.layoutPlan?.regions.filter((region) => region.role === "house")).toHaveLength(4);
    expect(built!.lowerTiles).not.toEqual(before.lowerTiles);
    expect(coordinates.length).toBeGreaterThan(0);
    const expected = houseCells(built!, coordinates);
    for (const outcome of outcomes.slice(1)) {
      expect(outcome.houseCells, outcome.id).toEqual(expected);
      expect(outcome.map.layoutPlan, outcome.id).toEqual(built!.layoutPlan);
    }
    for (const id of ["sand", "water", "forest"]) {
      const outcome = outcomes.find((entry) => entry.id === id)!;
      expect(outcome.result.ok, JSON.stringify(outcome.result)).toBe(true);
      expect(outcome.outsideChanged, id).toBeGreaterThan(0);
      expect(outcome.protectedOverlap, id).toBeGreaterThan(0);
      if (id !== "forest") {
        expect(outcome.result.data).toMatchObject({ mutatedCells: outcome.outsideChanged });
        expect((outcome.result.data as { skipped: { structure: number } }).skipped.structure).toBeGreaterThanOrEqual(outcome.protectedOverlap);
      } else {
        const data = outcome.result.data as { placed: number; density: string; materials: string[] };
        expect(data.placed).toBeGreaterThan(0);
        expect(data.density).toBe("dense");
        expect(data.materials).toEqual(expect.arrayContaining(["침엽수", "활엽수", "덤불"]));
      }
    }
    const noop = outcomes.find((entry) => entry.id === "protected-noop")!;
    expect(noop.result.ok, JSON.stringify(noop.result)).toBe(true);
    expect(noop.result.data).toMatchObject({ filled: 0, mutatedCells: 0, reshaped: 0, upperCleared: 0 });
    expect(noop.map).toEqual(outcomes.find((entry) => entry.id === "forest")!.map);
    const erase = outcomes.find((entry) => entry.id === "protected-erase")!;
    expect(erase.result.ok).toBe(false);
    expect(erase.result.issues?.map((issue) => issue.code)).toContain("protected-house-write");
    expect(erase.map).toEqual(noop.map);
    expect(after).toEqual(erase.map);
    expect(houseCells(after, coordinates)).toEqual(expected);
    expect(outsideChanged(built!, after, coordinates)).toBeGreaterThan(0);
  });

  await test.step("Round-trip applied project through real IO, then run guarded fill and erase", async () => {
    // Subsequent direct-tool persistence check, not a substitute AI turn.
    const reloaded = await page.evaluate(async ({ mapId, rect, eraseRect }) => {
      const moduleUrl = (suffix: string) => performance.getEntriesByType("resource")
        .map((entry) => entry.name).find((url) => new URL(url).pathname === suffix) ?? suffix;
      const { store } = await import(moduleUrl("/src/project/store.ts")) as typeof import("../../src/project/store");
      const { serialize, deserialize } = await import(moduleUrl("/src/project/io.ts")) as typeof import("../../src/project/io");
      const { runTool } = await import(moduleUrl("/src/editor/tools/toolRunner.ts")) as typeof import("../../src/editor/tools/toolRunner");
      const serialized = serialize(store.getCurrent());
      const ctx = { project: deserialize(serialized) };
      const loaded = structuredClone(ctx.project.maps[mapId]);
      const filled = runTool(ctx, "fill_region", { mapId, rect, material: "모래", clearUpper: true });
      const afterFill = structuredClone(ctx.project.maps[mapId]);
      const erased = runTool(ctx, "tile_erase", { mapId, rect: eraseRect });
      const afterErase = structuredClone(ctx.project.maps[mapId]);
      store.replace(ctx.project, { change: { origin: "human", label: "Load round-trip landscaping engine fixture" } });
      return { serialized, loaded, filled, afterFill, erased, afterErase, applied: structuredClone(store.getCurrent().maps[mapId]),
        remotePersistenceEnabled: store.isRemotePersistenceEnabled() };
    }, { mapId, rect: strip!, eraseRect: { x: house!.x, y: house!.y, w: house!.w, h: house!.h } });
    const changed = outsideChanged(reloaded.loaded, reloaded.afterFill, coordinates);
    writeFileSync(path.join(EVIDENCE, "reload.json"), JSON.stringify({ ...reloaded, actualOutsideChanged: changed,
      houseCells: houseCells(reloaded.applied, coordinates) }, null, 2) + "\n");
    expect(reloaded.loaded).toEqual(after);
    expect(reloaded.filled.ok, JSON.stringify(reloaded.filled)).toBe(true);
    expect(changed).toBeGreaterThan(0);
    expect(reloaded.filled.data).toMatchObject({ mutatedCells: changed });
    expect(reloaded.erased.ok).toBe(false);
    expect(reloaded.erased.issues?.map((issue) => issue.code)).toContain("protected-house-write");
    expect(reloaded.afterErase).toEqual(reloaded.afterFill);
    expect(reloaded.applied).toEqual(reloaded.afterFill);
    expect(houseCells(reloaded.applied, coordinates)).toEqual(houseCells(built!, coordinates));
    expect(reloaded.remotePersistenceEnabled).toBe(false);
    await captureCanvas(page, "04-reloaded-guarded-fill.png");
  });
  // Remote-off project persistence does not disable activity/conversation logs.
  // Preserve the blocked attempts as evidence; none may receive a response.
  writeFileSync(path.join(EVIDENCE, "network-safety.json"), JSON.stringify({ deniedWrites, remoteWriteResponses, browserErrors }, null, 2) + "\n");
  expect(remoteWriteResponses).toEqual([]);
  expect(browserErrors).toEqual([]);
});
