import { expect, test as base, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { GameMap } from "../../src/project/types";
import type { ToolResult } from "../../src/editor/tools/types";

// Engine-only fixture. The session, runner, proposals, store and Phaser canvas are real.
// Only the model transport is scripted; remote writes are denied, never faked as saved.
const EVIDENCE = path.resolve(".omo/evidence/house-protection/p1");
const HOUSE = { x: 2, y: 2, w: 6, h: 6 };
const OUTSIDE = { x: 14, y: 10 };
const PERMITS = ["selection", "confirmDestroy", "overExisting-clear", "overExisting-keep"] as const;
type Call = { id: string; name: string; args: Record<string, unknown> };
type Outcome = { id: string; name: string; result: ToolResult; map: GameMap };

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

// Independent oracle: do not ask production protection code which cells it protects.
function protectedCells(map: GameMap) {
  return Array.from({ length: HOUSE.w * (HOUSE.h + 1) }, (_, index) => {
    const x = HOUSE.x + index % HOUSE.w;
    const y = HOUSE.y - 1 + Math.floor(index / HOUSE.w);
    const offset = y * map.width + x;
    return { x, y, lower: map.lowerTiles[offset], upper: map.upperTiles[offset],
      lowerStack: map.lowerTileStacks?.[offset] ?? null, upperStack: map.upperTileStacks?.[offset] ?? null };
  });
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

const test = base.extend<{ drainRoutes: void }>({
  drainRoutes: [async ({ page }, use) => {
    await use();
    // Fixture teardown has its own deadline: a completed 120s test must not
    // dispose responses while its remaining static-file handlers are draining.
    await page.unrouteAll({ behavior: "wait" });
  }, { auto: true, timeout: 30_000 }],
});

for (const permit of PERMITS) {
  test(`completed house survives same-turn destruction with ${permit}`, async ({ page, context }) => {
    test.setTimeout(120_000);
    mkdirSync(EVIDENCE, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    const deniedWrites: { method: string; pathname: string }[] = [];
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
          headers: { ...request.headers(), connection: "close" }, maxRetries: 0, timeout: 15_000,
        }) });
      }
      return route.fallback();
    });
    await page.addInitScript(() => {
      localStorage.setItem("rpg-zzu:editor-ui-mode", "standard");
      localStorage.setItem("oprn:editor-welcome-dismissed", "1");
      localStorage.setItem("oprn:standard-welcome-seen", "1");
      localStorage.setItem("oprn:coachmarks-basic-v1", "1");
      localStorage.setItem("oprn:ai-config", JSON.stringify({ configVersion: 2, agentMode: "chat", maxToolCalls: 20 }));
    });
    const outcomes: Outcome[] = [];
    const calls: Call[] = [];
    let round = 0;
    let built: GameMap | undefined;
    let emptyUpper: { x: number; y: number } | undefined;
    let mapId = "";
    await page.route("**/v1/chat/completions", async (route) => {
      const body = route.request().postDataJSON() as {
        tools?: unknown[];
        messages: { role: string; tool_call_id?: string; content?: string }[];
      };
      if (!body.tools?.length) {
        return route.fulfill({ json: { choices: [{ finish_reason: "stop", message: {
          role: "assistant", content: JSON.stringify({ mode: "create", space: "outdoor", targetMapId: mapId,
            needsPlan: false, action: "direct", tools: ["set_build_spec", "author_house", "tile_erase", "paint_tiles", "clear_region"],
            reason: "Engine regression fixture", summary: "Engine regression fixture" }),
        } }] } });
      }
      // A tool response in the next model request is the exact session completion signal.
      for (const message of body.messages) {
        const call = calls.find((entry) => entry.id === message.tool_call_id);
        if (message.role !== "tool" || !call || outcomes.some((entry) => entry.id === call.id)) continue;
        const result = JSON.parse(message.content!) as ToolResult;
        const map = await readMap(page, "draft");
        outcomes.push({ id: call.id, name: call.name, result, map });
        if (call.id === "build") {
          built = map;
          emptyUpper = protectedCells(map).find((cell) => cell.y >= HOUSE.y && cell.upper === -1);
          await captureCanvas(page, `${permit}-built-before-attempts.png`);
        }
      }
      const script: Call[] = [
        { id: "plan", name: "set_build_spec", args: { mapId, assets: [{ id: "house", kind: "house", x: 1, y: 1, w: 8, h: 8 }] } },
        { id: "build", name: "author_house", args: { kind: "single", mapId, kitId: "blue-stone", wings: [HOUSE], interior: "exterior-only", yard: [] } },
        ...(permit === "selection" ? [] : [{ id: "permit", name: "set_build_spec", args: { mapId, assets: [{
          id: "overwrite", x: 1, y: 1, w: 8, h: 8,
          ...(permit === "confirmDestroy" ? { kind: "clear", confirmDestroy: true }
            : { kind: "terrain", overExisting: permit === "overExisting-clear" ? "clear" : "keep" }),
        }] } }]),
        { id: "erase-house", name: "tile_erase", args: { mapId, rect: HOUSE } },
        { id: "fill-empty-upper", name: "paint_tiles", args: { mapId, mode: "cells", layer: "upper", tile: 322, cells: emptyUpper ? [{ x: emptyUpper.x, y: emptyUpper.y }] : [] } },
        { id: "erase-ridge", name: "clear_region", args: { mapId, x: HOUSE.x, y: HOUSE.y - 1, w: HOUSE.w, h: 1, fill: "empty" } },
        { id: "edit-selected-outside", name: "tile_erase", args: { mapId, layer: "upper", rect: { ...OUTSIDE, w: 1, h: 1 } } },
      ];
      const call = script[round++];
      if (call) calls.push(call);
      await route.fulfill({ json: { choices: [{ finish_reason: call ? "tool_calls" : "stop", message: call ? {
        role: "assistant", content: null, tool_calls: [{ id: call.id, type: "function", function: {
          name: call.name, arguments: JSON.stringify({ ...call.args, reason: "Exercise the completed-house transaction contract" }),
        } }],
      } : { role: "assistant", content: "HOUSE_PROTECTION_REGRESSION_COMPLETE" } }] } });
    });

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

    const fixture = await page.evaluate(async ({ permission, outside }) => {
      const moduleUrl = (suffix: string) => performance.getEntriesByType("resource")
        .map((entry) => entry.name).find((url) => new URL(url).pathname === suffix) ?? suffix;
      const { store } = await import(moduleUrl("/src/project/store.ts")) as typeof import("../../src/project/store");
      const { editorState } = await import(moduleUrl("/src/editor/editorState.ts")) as typeof import("../../src/editor/editorState");
      const { getAiAssistantStatus } = await import(moduleUrl("/src/editor/aiAssistantBridge.ts")) as typeof import("../../src/editor/aiAssistantBridge");
      const id = store.getCurrent().startMapId;
      // Minimal human-authored QA precondition, not a replacement runner/session.
      store.update((project) => {
        project.startPos = { x: 0, y: 0 };
        project.maps[id].upperTiles[outside.y * project.maps[id].width + outside.x] = 322;
      }, { scope: "project", origin: "human", label: "House protection QA precondition" });
      editorState.set({ selection: permission === "selection"
        ? { mapId: id, x: 0, y: 0, width: 20, height: 15 }
        : { mapId: id, x: 13, y: 10, width: 3, height: 2 } });
      return { mapId: id, remotePersistenceEnabled: store.isRemotePersistenceEnabled(), selection: editorState.get().selection,
        bridgeReady: getAiAssistantStatus().ready };
    }, { permission: permit, outside: OUTSIDE });
    mapId = fixture.mapId;
    expect(fixture.remotePersistenceEnabled).toBe(false);
    expect(fixture.bridgeReady).toBe(true);
    const before = await readMap(page, "store");
    expect(before.layoutPlan?.regions.filter((region) => region.role === "house") ?? []).toEqual([]);
    expect(before.upperTiles[OUTSIDE.y * before.width + OUTSIDE.x]).toBe(322);
    await captureCanvas(page, `${permit}-before.png`);

    // Subscribe before send. Both the real bridge promise and the AI store mutation must finish.
    const turn = await bounded(page.evaluate(async () => {
      const storeUrl = performance.getEntriesByType("resource").map((entry) => entry.name)
        .find((url) => new URL(url).pathname === "/src/project/store.ts") ?? "/src/project/store.ts";
      const { store } = await import(storeUrl) as typeof import("../../src/project/store");
      const bridgeUrl = performance.getEntriesByType("resource").map((entry) => entry.name)
        .find((url) => new URL(url).pathname === "/src/editor/aiAssistantBridge.ts") ?? "/src/editor/aiAssistantBridge.ts";
      const { sendAiAssistantMessage } = await import(bridgeUrl) as typeof import("../../src/editor/aiAssistantBridge");
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
        const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("AI send/store completion timeout")), 60_000); });
        const completed = Promise.all([
          sendAiAssistantMessage("author_house set_build_spec tile_erase paint_tiles clear_region: 집을 짓고 선택 영역을 정리해줘"), applied,
        ]);
        const [result, storeEvent] = await Promise.race([completed, timeout]);
        return { result, storeEvent };
      } finally {
        clearTimeout(timer);
        unsubscribe();
      }
    }), "real AI send and applied store event", 65_000);
    const after = await readMap(page, "store");
    await captureCanvas(page, `${permit}-after.png`);
    writeFileSync(path.join(EVIDENCE, `${permit}.json`), JSON.stringify({ permit, fixture, before, built,
      protectedBefore: built ? protectedCells(built) : null, protectedAfter: protectedCells(after),
      emptyUpper, calls, outcomes, after, turn: { status: turn.result.status, audit: turn.result.audit, storeEvent: turn.storeEvent },
      deniedWrites }, null, 2) + "\n");

    expect(turn.result.ok, turn.result.error).toBe(true);
    expect(turn.result.status.turnBusy).toBe(false);
    expect(turn.result.lastAssistantText).toBe("HOUSE_PROTECTION_REGRESSION_COMPLETE");
    expect(outcomes.map((entry) => entry.id)).toEqual(calls.map((entry) => entry.id));
    expect(outcomes.find((entry) => entry.id === "build")?.result.ok, JSON.stringify(outcomes)).toBe(true);
    expect(built).toBeDefined();
    expect(built!.layoutPlan?.regions.filter((region) => region.role === "house")).toHaveLength(1);
    expect(built!.lowerTiles).not.toEqual(before.lowerTiles);
    expect(emptyUpper).toBeDefined();
    expect(built!.lowerTiles[(HOUSE.y - 1) * built!.width + HOUSE.x]).not.toBe(-1);
    for (const id of ["erase-house", "fill-empty-upper", "erase-ridge"]) {
      const outcome = outcomes.find((entry) => entry.id === id)!;
      expect(outcome.result.ok, JSON.stringify(outcome.result)).toBe(false);
      expect(outcome.result.issues?.map((issue) => issue.code), id).toContain("protected-house-write");
      expect(outcome.map, `${id}: entire map rollback, not just sampled roof tiles`).toEqual(built);
    }
    if (permit !== "selection") expect(outcomes.find((entry) => entry.id === "permit")?.result.ok).toBe(true);
    expect(outcomes.find((entry) => entry.id === "edit-selected-outside")?.result.ok).toBe(true);
    expect(protectedCells(after)).toEqual(protectedCells(built!));
    expect(after.lowerTiles).toEqual(built!.lowerTiles);
    const expectedUpper = [...built!.upperTiles];
    expectedUpper[OUTSIDE.y * after.width + OUTSIDE.x] = -1;
    expect(after.upperTiles).toEqual(expectedUpper);
    expect(after.layoutPlan).toEqual(built!.layoutPlan);
    expect(after.events).toEqual(built!.events);
  });
}
