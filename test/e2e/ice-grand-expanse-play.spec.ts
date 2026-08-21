import fs from "node:fs";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import {
  createLocalIceGrandExpanseProject,
  iceGrandExpanseOrderInputs,
  proveIceGrandExpanseGateClosed,
  type IceExpanseOrder,
} from "../../scripts/verify-ice-grand-expanse.mts";
import { hashIceGrandExpanseMap } from "@/project/defaults/iceGrandExpanse";
import { ICE_GRAND_EXPANSE_MAP_ID, ICE_GRAND_EXPANSE_START } from "@/project/defaults/iceGrandExpansePlan";
import { ICE_GRAND_EXPANSE_SEAL_SWITCHES } from "@/project/defaults/iceGrandExpanseSeals";
import type { Dir, GameMap } from "@/project/types";
import type { SceneStep } from "@/testing/sceneTestRunner";
import { performBattleSkill } from "./battleReferenceProject";

type RuntimeState = {
  readonly mapId: string;
  readonly player: { readonly x: number; readonly y: number };
  readonly switches: Record<string, boolean>;
  readonly inputEnabled: boolean;
  readonly m2Runtime?: { readonly ui?: readonly { readonly message: string; readonly surface: string }[] };
};

type BrowserFailures = {
  readonly consoleErrors: string[];
  readonly pageErrors: string[];
  readonly requestFailures: string[];
};

type PlayerSpriteState = {
  readonly frame: string | number;
  readonly moving: boolean;
};

const EXPECTED_DERIVED_MAP_SHA256 = "89aea00de01b5b7367595ad4a6b78d57376d27ed0fc252a9f98bf104fb5226bd";
const EVIDENCE_DIR = path.resolve("output", "evidence", "ice-grand-expanse", "ice-expanse-source-bound-20260722T080324Z-final", "task-7", "browser");

function collectBrowserFailures(page: Page): BrowserFailures {
  const failures: BrowserFailures = { consoleErrors: [], pageErrors: [], requestFailures: [] };
  page.on("console", (message) => {
    if (message.type() === "error") failures.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => failures.pageErrors.push(error.message));
  page.on("requestfailed", (request) => failures.requestFailures.push(`${request.method()} ${request.url()}`));
  return failures;
}

function runtimeState(value: unknown): RuntimeState {
  if (!isRecord(value) || typeof value.mapId !== "string" || typeof value.inputEnabled !== "boolean" || !isRecord(value.player)
    || typeof value.player.x !== "number" || typeof value.player.y !== "number" || !isBooleanRecord(value.switches)) {
    throw new TypeError("runtime-state-json has an unexpected shape");
  }
  const m2Runtime = isRecord(value.m2Runtime) && Array.isArray(value.m2Runtime.ui)
    ? { ui: value.m2Runtime.ui.flatMap((entry) => isUiEntry(entry) ? [entry] : []) }
    : undefined;
  return { mapId: value.mapId, player: { x: value.player.x, y: value.player.y }, switches: value.switches, inputEnabled: value.inputEnabled, ...(m2Runtime === undefined ? {} : { m2Runtime }) };
}

async function readRuntimeState(page: Page): Promise<RuntimeState> {
  const raw = await page.getByTestId("runtime-state-json").textContent();
  if (raw === null) throw new TypeError("runtime-state-json is missing");
  return runtimeState(JSON.parse(raw));
}

async function startAtExpanseEntry(page: Page): Promise<string> {
  const bootStartedAt = Date.now();
  const local = await createLocalIceGrandExpanseProject();
  await page.route("**/__oprn/ai-activity", (route) => route.fulfill({ status: 204 }));
  await page.route("**/rest/v1/ai_analysis_runs?*", (route) => route.fulfill({ status: 204 }));
  await page.addInitScript(({ project }) => {
    window.__RPG_ZZU_E2E_PROJECT__ = project;
    window.localStorage.clear();
    window.localStorage.setItem("oprn:editor-ui-mode", "expert");
  }, { project: local.project });
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto(`/?focusX=${ICE_GRAND_EXPANSE_START.x}&focusY=${ICE_GRAND_EXPANSE_START.y}`);
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 25_000 });
  console.log(`expanse-boot:container:${Date.now() - bootStartedAt}ms`);
  await page.getByTestId(`map-tree-node-${ICE_GRAND_EXPANSE_MAP_ID}`).click();
  const selectedAt = Date.now();
  await page.getByTestId("layer-event").click();
  await page.getByTestId("tool-event").click();

  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  const box = await canvas.boundingBox();
  console.log(`expanse-boot:inner-canvas:${Date.now() - selectedAt}ms:total:${Date.now() - bootStartedAt}ms`);
  if (box === null) throw new TypeError("editor canvas is not measurable");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByTestId("cursor-position")).toHaveText(`${ICE_GRAND_EXPANSE_START.x},${ICE_GRAND_EXPANSE_START.y}`);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: "right" });
  await expect(page.getByTestId(`map-context-menu-${ICE_GRAND_EXPANSE_MAP_ID}`)).toBeVisible();
  await page.getByTestId("event-layer-test-here").click();
  await expect(page.getByTestId("runtime-state-json")).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("play-canvas").click();
  expect(await readRuntimeState(page)).toMatchObject({ mapId: ICE_GRAND_EXPANSE_MAP_ID, player: ICE_GRAND_EXPANSE_START, inputEnabled: true });
  const browserMap = readBrowserMap(await page.getByTestId("project-export-json").textContent());
  expect(await hashIceGrandExpanseMap(browserMap)).toBe(local.derivedMapSha256);
  return local.derivedMapSha256;
}

const KEY_BY_DIR = { down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight", up: "ArrowUp" } as const satisfies Record<Dir, string>;

async function readPlayerSprite(page: Page): Promise<PlayerSpriteState> {
  const value = await page.evaluate(() => window.__oprnPlayerSprite?.() ?? null);
  if (!isRecord(value) || typeof value.moving !== "boolean" || (typeof value.frame !== "string" && typeof value.frame !== "number")) {
    throw new TypeError("player sprite debug hook is unavailable");
  }
  return { frame: value.frame, moving: value.moving };
}

async function pulseDirection(page: Page, key: string): Promise<"battle" | "moving"> {
  await expect.poll(async () => (await readPlayerSprite(page)).moving, { timeout: 2_000 }).toBe(false);
  const before = await readRuntimeState(page);
  await page.keyboard.press(key);
  await expect.poll(async () => {
    const state = await readRuntimeState(page);
    return state.player.x !== before.player.x || state.player.y !== before.player.y || await page.getByTestId("battle-scene").isVisible();
  }, { timeout: 2_000 }).toBe(true);
  return await page.getByTestId("battle-scene").isVisible() ? "battle" : "moving";
}

async function pressAction(page: Page): Promise<void> {
  await page.keyboard.press("Space");
}

async function winBattle(page: Page): Promise<void> {
  await expect(page.getByTestId("battle-scene")).toBeVisible({ timeout: 15_000 });
  for (let turn = 0; turn < 12 && await page.getByTestId("battle-scene").isVisible(); turn += 1) await performBattleSkill(page);
  await expect(page.getByTestId("battle-scene")).toBeHidden({ timeout: 20_000 });
  await expect.poll(async () => (await readRuntimeState(page)).inputEnabled, { timeout: 10_000 }).toBe(true);
}

async function driveStep(page: Page, step: SceneStep, interaction: number, routeIndex: number, order: IceExpanseOrder): Promise<boolean> {
  if (step.kind === "wait") { await page.waitForTimeout(step.ticks * 16); return false; }
  if (step.kind === "set" || step.kind === "gift" || step.kind === "choose" || step.kind === "retryCheckpoint") throw new TypeError(`forbidden browser step ${step.kind}`);
  if (step.kind === "face") {
    const before = await readRuntimeState(page);
    await page.keyboard.press(KEY_BY_DIR[step.dir]);
    await expect.poll(async () => (await readRuntimeState(page)).player, { timeout: 2_000 }).toEqual(before.player);
    return false;
  }
  if (step.kind === "interact") {
    await pressAction(page);
    if ([6, 7, 8, 9, 12].includes(interaction)) {
      await expect(page.getByTestId("battle-scene")).toBeVisible({ timeout: 15_000 });
      if (interaction === 12) await captureBattle(page, `${order}-boss`);
      await winBattle(page);
    }
    else await expect.poll(async () => (await readRuntimeState(page)).inputEnabled, { timeout: 5_000 }).toBe(true);
    console.log(`expanse-milestone:${order}:${interactionLabel(interaction)}:route-${routeIndex}`);
    return false;
  }
  if (step.to !== undefined) throw new TypeError("coordinate movement is forbidden in browser acceptance");
  const before = await readRuntimeState(page);
  const delta = directionDelta(step.dir);
  const plannedTo = { x: before.player.x + delta.x, y: before.player.y + delta.y };
  const stepStartedAt = performance.now();
  const pulse = await pulseDirection(page, KEY_BY_DIR[step.dir]);
  if (pulse === "battle") {
    await captureBattle(page, `${order}-field`);
    console.log(`expanse-milestone:${order}:field-battle:route-${routeIndex}`);
    await winBattle(page); return true;
  }
  await expect.poll(async () => {
    const state = await readRuntimeState(page); const sprite = await readPlayerSprite(page);
    return { moving: sprite.moving, player: state.player };
  }, { message: `route ${routeIndex}: ${JSON.stringify({ dir: step.dir, plannedFrom: before.player, plannedTo })}`, timeout: 5_000 }).toEqual({ moving: false, player: plannedTo });
  console.log(`expanse-step-settle:${routeIndex}:${(performance.now() - stepStartedAt).toFixed(1)}ms:${before.player.x},${before.player.y}->${plannedTo.x},${plannedTo.y}`);
  return false;
}

async function driveOrder(page: Page, order: IceExpanseOrder): Promise<{ readonly battles: number; readonly interactions: number; readonly state: RuntimeState }> {
  const input = await iceGrandExpanseOrderInputs(order);
  let battles = 0; let interactions = 0;
  for (const [routeIndex, step] of input.steps.entries()) {
    if (step.kind === "interact") interactions += 1;
    if (await driveStep(page, step, interactions, routeIndex, order)) battles += 1;
    if (step.kind === "interact" && [6, 7, 8, 9, 12].includes(interactions)) battles += 1;
  }
  return { battles, interactions, state: await readRuntimeState(page) };
}

async function captureBattle(page: Page, slug: string): Promise<void> {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  await page.getByTestId("battle-scene").screenshot({ path: path.join(EVIDENCE_DIR, `${slug}.png`) });
}

function interactionLabel(interaction: number): string {
  const labels = ["entry-checkpoint", "first-seal", "second-seal-gate-open", "lake-shortcut", "lake-checkpoint",
    "guard-1", "guard-2", "guard-3", "guard-4", "summit-checkpoint", "crown-shortcut", "dragon-boss"];
  return labels[interaction - 1] ?? `interaction-${interaction}`;
}

function directionDelta(direction: Dir): { readonly x: number; readonly y: number } {
  if (direction === "left") return { x: -1, y: 0 };
  if (direction === "right") return { x: 1, y: 0 };
  if (direction === "up") return { x: 0, y: -1 };
  return { x: 0, y: 1 };
}

function readBrowserMap(raw: string | null): GameMap {
  const exported: unknown = JSON.parse(raw ?? "null");
  if (!isRecord(exported) || !isRecord(exported.project) || !isRecord(exported.project.maps)) throw new TypeError("project export is unavailable");
  const map = exported.project.maps[ICE_GRAND_EXPANSE_MAP_ID];
  if (!isRecord(map) || typeof map.id !== "string" || typeof map.width !== "number" || typeof map.height !== "number"
    || typeof map.tilesetId !== "string" || !Array.isArray(map.lowerTiles) || !Array.isArray(map.upperTiles) || !Array.isArray(map.events)) {
    throw new TypeError("browser expanse map is unavailable");
  }
  return map as GameMap;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isBooleanRecord(value: unknown): value is Record<string, boolean> {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === "boolean");
}

function isUiEntry(value: unknown): value is { readonly message: string; readonly surface: string } {
  return isRecord(value) && typeof value.message === "string" && typeof value.surface === "string";
}

for (const order of ["west-east", "east-west"] as const satisfies readonly IceExpanseOrder[]) {
  test(`ice grand expanse ${order} route starts through the editor and proves the complete authored order`, async ({ page }) => {
    test.setTimeout(180_000);
    const failures = collectBrowserFailures(page);

    // Given: the freshly installed local project is selected at the authored entry in the real editor.
    expect(await startAtExpanseEntry(page)).toBe(EXPECTED_DERIVED_MAP_SHA256);

    // When: every authored move/action/contact is replayed through the live player input surface.
    const proof = await driveOrder(page, order);

    // Then: the authored field battle, four guards, dragon, and both-seal gate contract are complete.
    expect(proof).toMatchObject({ battles: 6, interactions: 12 });
    expect(proof.state.switches[ICE_GRAND_EXPANSE_SEAL_SWITCHES.gate]).toBe(true);
    expect(proof.state.player.y).toBeLessThan(20);
    expect(proof.state.m2Runtime?.ui?.filter(({ surface }) => surface === "checkpoint")).toHaveLength(3);
    const bridgeFailures = failures.requestFailures.filter((url) => url.includes("127.0.0.1:17831/v1/browser/hello"));
    expect(bridgeFailures.length).toBeLessThanOrEqual(2);
    expect(failures.pageErrors).toEqual([]);
    expect(failures.requestFailures.filter((url) => !url.includes("127.0.0.1:17831/v1/browser/hello"))).toEqual([]);
    expect(failures.consoleErrors.filter((message) => !message.includes("ERR_CONNECTION_REFUSED"))).toEqual([]);
  });
}

test("ice grand expanse real keyboard pulses advance one tile through the first turn", async ({ page }) => {
  test.setTimeout(90_000);
  expect(await startAtExpanseEntry(page)).toBe(EXPECTED_DERIVED_MAP_SHA256);
  const input = await iceGrandExpanseOrderInputs("west-east");
  let interactions = 0;
  for (const [routeIndex, step] of input.steps.slice(0, 30).entries()) {
    if (step.kind === "interact") interactions += 1;
    await driveStep(page, step, interactions, routeIndex, "west-east");
  }
  const state = await readRuntimeState(page);
  expect(state.player).toEqual({ x: 60, y: 96 });
  expect(state.m2Runtime?.ui?.filter(({ surface }) => surface === "checkpoint")).toHaveLength(1);
});

test("one exact tile pulse", async ({ page }) => {
  test.setTimeout(60_000);
  console.log("one-tile:boot:start");
  expect(await startAtExpanseEntry(page)).toBe(EXPECTED_DERIVED_MAP_SHA256);
  console.log("one-tile:boot:ready");
  const before = await readRuntimeState(page);
  await page.evaluate(() => {
    const trace: unknown[] = [];
    const events: unknown[] = [];
    Reflect.set(window, "__icePulseTrace", trace);
    Reflect.set(window, "__icePulseEvents", events);
    const recordEvent = (event: KeyboardEvent): void => { if (event.key === "ArrowUp") events.push({ at: performance.now(), type: event.type }); };
    document.addEventListener("keydown", recordEvent, { once: true });
    document.addEventListener("keyup", recordEvent, { once: true });
    const startedAt = performance.now();
    const sample = (): void => {
      const sprite = window.__oprnPlayerSprite?.();
      trace.push({ at: performance.now(), moving: sprite?.moving ?? null, x: sprite?.x ?? null, y: sprite?.y ?? null });
      if (performance.now() - startedAt < 2_000) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  const pressStartedAt = performance.now();
  console.log(`pulse:start:${JSON.stringify({ before: before.player, pressStartedAt })}`);
  await page.keyboard.press("ArrowUp");
  const pressResolvedAt = performance.now();
  await page.waitForTimeout(2_000);
  const after = await readRuntimeState(page);
  const browserPulse = await page.evaluate(() => ({ events: Reflect.get(window, "__icePulseEvents"), trace: Reflect.get(window, "__icePulseTrace") }));
  console.log(`pulse:result:${JSON.stringify({ after: after.player, before: before.player, browserPulse, pressResolvedAt, pressStartedAt })}`);
  expect(after.player).toEqual({ x: before.player.x, y: before.player.y - 1 });
});

test("ice grand expanse one-seal route fails closed with the typed gate code", async () => {
  // Given: the west-first authored route has activated only one seal.
  // When: summit access is evaluated through the verification boundary.
  const proof = await proveIceGrandExpanseGateClosed("west-east");
  // Then: access fails closed with the stable typed code.
  expect(proof).toMatchObject({ code: "GATE_CLOSED", order: "west-east" });
  expect(proof.stepsRun).toBeGreaterThan(0);
});
