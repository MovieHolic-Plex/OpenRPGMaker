import { expect, test, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

type BrowserStore = typeof import("@/project/store");
type BrowserDefaults = typeof import("@/project/defaults");
type BrowserConstants = typeof import("@/project/defaults/constants");
type BrowserIo = typeof import("@/project/io");
type BrowserSha256 = typeof import("@/util/sha256");
type BrowserJobClient = typeof import("@/editor/aiJobs/jobClient");
type BrowserJobResult = import("@/ai/jobs/contracts").AiJobResult;
type BrowserProject = import("@/project/types").Project;

const PROJECT_ID = "task8-disposable-qa";
const MAP_ID = "map_blank_start";
const PATH_TILE = 360;
const origin = process.env.TASK8_ORIGIN ?? "";
const runId = process.env.TASK8_RUN_ID ?? "";
const owned = process.env.TASK8_QA === "1" && origin.length > 0 && runId.length > 0;
if (process.env.TASK8_QA === "1" && !owned) {
  throw new Error("Task8 family spec requires TASK8_QA=1, TASK8_ORIGIN and TASK8_RUN_ID");
}
if (owned) {
  const url = new URL(origin);
  if (url.hostname !== "127.0.0.1" || ["9841", "19841"].includes(url.port)) {
    throw new Error("Task8 family spec forbids shared ports and requires the owned ephemeral origin");
  }
}

test.skip(!owned, "Task8 owned fixture only");
test.setTimeout(240_000);

const PNG_DATA_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAXgN1WQAAAABJRU5ErkJggg==";
const EVIDENCE = resolve(".omo/evidence/ai-job-queue/task-8");
const CHAT_REPLY = "Review the controlled map proposal.";

type Counts = {
  jobCount: number;
  operationCount: number;
  controlledCalls: number;
  reusedResponses?: number;
  violations: unknown[];
  jobs: Array<{
    id: string;
    family: string;
    generation: string;
    report: string;
    application?: string;
    save?: string;
    project: { backend: string; projectId: string };
    resultRef: { sha256: string } | null;
    reportRef: { sha256: string } | null;
  }>;
  operations: Array<{ id: string; jobId: string; kind: string; status: string }>;
  persistence?: { initialized?: boolean; projectId?: string };
  events?: Array<{ seq: number }>;
};

async function control(request: APIRequestContext, route: string, body: Record<string, unknown> = {}) {
  const response = await request.post(`${origin}/__task8/${route}`, {
    headers: { "X-Task8-Run-Id": runId, Origin: origin },
    data: body,
    timeout: 120_000,
  });
  expect(response.status(), await response.text()).toBe(200);
  return response.json();
}

async function armJobEvent(
  request: APIRequestContext,
  jobId: string,
  fields: Record<string, unknown>,
): Promise<{ readonly reached: Promise<unknown> }> {
  const prior = await control(request, "counts") as Counts;
  const after = prior.events?.at(-1)?.seq;
  const armedBody: Record<string, unknown> = { type: "waiter-registered", waitType: "job-event" };
  if (after !== undefined) armedBody.after = after;
  const armed = control(request, "wait", armedBody);
  const reached = control(request, "wait", { type: "job-event", jobId, ...fields });
  await armed;
  return { reached };
}

type BootProbe = {
  crashes: string[];
  pageerrors: string[];
  requestfailed: Array<{ url: string; error: string }>;
};

function attachBootProbe(page: Page): BootProbe {
  const probe: BootProbe = { crashes: [], pageerrors: [], requestfailed: [] };
  page.on("crash", () => { probe.crashes.push("page-crash"); });
  page.on("pageerror", error => {
    probe.pageerrors.push(error.message);
    console.error("pageerror", error.message, error.stack);
  });
  page.on("requestfailed", request => {
    const url = request.url();
    if (origin && !url.startsWith(origin)) return;
    probe.requestfailed.push({ url, error: request.failure()?.errorText ?? "unknown" });
  });
  return probe;
}

function isDeadPageError(error: unknown): boolean {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /Target crashed|has been closed|Target closed|page\.screenshot: Target crashed/i.test(text);
}

async function recordOpenEditorFailure(page: Page, probe: BootProbe, error: unknown): Promise<void> {
  const dir = process.env.TASK8_PLAYWRIGHT_OUTPUT || "/dev/shm";
  const payload = {
    original: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error),
    closed: page.isClosed(),
    probe,
  };
  await mkdir(dir, { recursive: true }).catch(() => undefined);
  await writeFile(resolve(dir, "open-editor-fail.json"), `${JSON.stringify(payload, null, 2)}\n`).catch(() => undefined);
  if (page.isClosed()) return;
  try {
    await page.screenshot({ path: resolve(dir, "open-editor-fail.png"), fullPage: true });
  } catch (shotError) {
    await writeFile(resolve(dir, "open-editor-fail-screenshot.txt"), String(shotError)).catch(() => undefined);
  }
}

async function installStaticGetWire(context: BrowserContext): Promise<void> {
  await context.route("**/*", async (route) => {
    try {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin !== origin) return route.abort();
      if (request.method() === "GET" && !/^\/(api|supabase|auth|v1)(\/|$)/.test(url.pathname)) {
        const response = await route.fetch({ maxRedirects: 0, maxRetries: 1, timeout: 120_000 });
        return route.fulfill({ response });
      }
      return route.continue();
    } catch {
      try { await route.abort("failed"); } catch { /* page/context already disposed */ }
    }
  });
}

async function releaseStaticGetWire(context: BrowserContext): Promise<void> {
  await context.unrouteAll({ behavior: "ignoreErrors" }).catch(() => undefined);
}

async function waitPaintedMapFrame(page: Page): Promise<void> {
  const canvas = page.getByTestId("edit-canvas").locator("canvas").first();
  await canvas.waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForFunction(() => {
    const source = document.querySelector("[data-testid='edit-canvas'] canvas") as HTMLCanvasElement | null;
    if (!source || source.width < 16 || source.height < 16) return false;
    const probe = document.createElement("canvas");
    probe.width = 48;
    probe.height = 48;
    const ctx = probe.getContext("2d");
    if (!ctx) return false;
    try { ctx.drawImage(source, 0, 0, 48, 48); } catch { return false; }
    const data = ctx.getImageData(0, 0, 48, 48).data;
    const r0 = data[0], g0 = data[1], b0 = data[2], a0 = data[3];
    for (let i = 16; i < data.length; i += 16) {
      if (data[i] !== r0 || data[i + 1] !== g0 || data[i + 2] !== b0 || data[i + 3] !== a0) return true;
    }
    return false;
  }, null, { timeout: 30_000 });
}

async function loadedIdentity(page: Page): Promise<{ backend: string; projectId: string }> {
  return page.evaluate(async () => {
    const storeHref = "/src/project/store.ts";
    const { store }: BrowserStore = await import(storeHref);
    return store.getLoadedProjectIdentity();
  });
}

async function assertFixtureIdentity(page: Page): Promise<void> {
  const identity = await loadedIdentity(page);
  expect(identity.projectId).toBe(PROJECT_ID);
  expect(identity.backend).toBe(`task8-local:${runId}`);
}

async function openEditor(page: Page): Promise<void> {
  const probe = attachBootProbe(page);
  await page.addInitScript(() => {
    window.localStorage.setItem("oprn:coachmarks-basic-v1", "1");
    window.localStorage.setItem("oprn:standard-welcome-seen", "1");
  });
  await page.goto(`/?project=${PROJECT_ID}`, { waitUntil: "load", timeout: 120_000 });
  const welcome = page.getByTestId("standard-welcome-start");
  const jobs = page.getByTestId("ai-jobs-open");
  try {
    await welcome.waitFor({ state: "visible", timeout: 20_000 });
    await welcome.click();
  } catch (error) {
    if (page.isClosed() || isDeadPageError(error) || probe.crashes.length) {
      await recordOpenEditorFailure(page, probe, error);
      throw error;
    }
  }
  try {
    await jobs.waitFor({ state: "visible", timeout: 120_000 });
  } catch (error) {
    await recordOpenEditorFailure(page, probe, error);
    throw error;
  }
  const skipCoach = page.getByTestId("coach-mark-skip");
  if (await skipCoach.isVisible().catch(() => false)) await skipCoach.click();
  const takeover = page.getByTestId("map-lock-banner-takeover");
  if (await takeover.isVisible().catch(() => false)) {
    await takeover.click();
    const confirm = page.getByTestId("app-modal-confirm");
    if (await confirm.isVisible().catch(() => false)) await confirm.click();
    await expect(takeover).toBeHidden({ timeout: 15_000 });
  }
  await assertFixtureIdentity(page);
}

function providerText(content: unknown) {
  return {
    choices: [{
      finish_reason: "stop",
      message: { role: "assistant", content: typeof content === "string" ? content : JSON.stringify(content) },
    }],
  };
}

function providerTool(name: string, args: Record<string, unknown>) {
  return {
    choices: [{
      finish_reason: "tool_calls",
      message: {
        role: "assistant",
        content: null,
        tool_calls: [{ id: `task8-${name}`, type: "function", function: { name, arguments: JSON.stringify(args) } }],
      },
    }],
  };
}

function intent(tools: string[], region = false) {
  return providerText({
    mode: "modify",
    space: region ? "outdoor" : "none",
    facility: null,
    targetMapId: null,
    useSelection: region,
    clarify: null,
    clarifyOptions: [],
    needsPlan: false,
    resetsContext: false,
    tools,
    summary: "Controlled disposable QA change",
    source: "llm",
  });
}

function sessionOps(prefix: string, responses: unknown[]) {
  return responses.map((response, index) => ({
    key: `${prefix}/provider/${index}`,
    kind: "text",
    provider: "google-antigravity",
    hold: index === 0,
    response,
  }));
}

function paintArgs() {
  return {
    mapId: MAP_ID,
    mode: "rect",
    layer: "lower",
    tile: PATH_TILE,
    from: { x: 1, y: 1 },
    to: { x: 4, y: 4 },
  };
}

/** Dirt-road autotile result of brush 360 over inclusive (1,1)..(4,4) on grass. NW stores 390, not 360. */
const EXPECTED_PATH_RECT = [
  [390, 391, 391, 392],
  [420, 421, 421, 422],
  [420, 421, 421, 422],
  [450, 451, 451, 452],
];

function buildSpecArgs() {
  return {
    mapId: MAP_ID,
    title: "Task8 path",
    assets: [{
      id: "terrain_path",
      kind: "terrain",
      x: 1,
      y: 1,
      w: 4,
      h: 4,
      layer: "lower",
      overExisting: "clear",
    }],
  };
}

function mapEditResponses() {
  return [
    intent(["set_build_spec", "paint_tiles"]),
    providerTool("set_build_spec", buildSpecArgs()),
    providerTool("paint_tiles", paintArgs()),
    providerText(CHAT_REPLY),
  ];
}

/** Disjoint from chat path (1,1)..(4,4). Blank map is 20x15 grass 240. */
const STALE_HUMAN_TILE = 303;
const STALE_GRASS = 240;
const STALE_CELL = { x: 12, y: 8 } as const;
const STALE_FROM = { x: 12, y: 8 } as const;
const STALE_TO = { x: 15, y: 11 } as const;

function stalePaintArgs() {
  return {
    mapId: MAP_ID,
    mode: "rect",
    layer: "lower",
    tile: PATH_TILE,
    from: { ...STALE_FROM },
    to: { ...STALE_TO },
  };
}

function staleBuildSpecArgs() {
  return {
    mapId: MAP_ID,
    title: "Task8 stale overlap",
    assets: [{
      id: "terrain_stale_path",
      kind: "terrain",
      x: STALE_FROM.x,
      y: STALE_FROM.y,
      w: STALE_TO.x - STALE_FROM.x + 1,
      h: STALE_TO.y - STALE_FROM.y + 1,
      layer: "lower",
      overExisting: "clear",
    }],
  };
}

function staleMapEditResponses() {
  return [
    intent(["set_build_spec", "paint_tiles"]),
    providerTool("set_build_spec", staleBuildSpecArgs()),
    providerTool("paint_tiles", stalePaintArgs()),
    providerText(CHAT_REPLY),
  ];
}

async function readLowerTile(page: Page, mapId: string, x: number, y: number): Promise<number | null> {
  return page.evaluate(async ({ mapId, x, y }) => {
    const storeHref = "/src/project/store.ts";
    const { store }: BrowserStore = await import(storeHref);
    const map = store.getCurrent().maps[mapId];
    if (!map) return null;
    return map.lowerTiles[y * map.width + x] ?? null;
  }, { mapId, x, y });
}

async function holdThenClose(
  request: APIRequestContext,
  page: Page,
  plan: Record<string, unknown>,
  act: () => Promise<void>,
): Promise<string> {
  await control(request, "plan", plan);
  const armed = control(request, "wait", { type: "waiter-registered", waitType: "operation-reached", planId: plan.id });
  const reached = control(request, "wait", { type: "operation-reached", planId: plan.id, index: 0 });
  await armed;
  await act();
  const atProvider = await reached as { jobId: string };
  const generated = control(request, "wait", { type: "job-event", jobId: atProvider.jobId, generation: "succeeded" });
  const reported = control(request, "wait", { type: "job-event", jobId: atProvider.jobId, report: "ready" });
  await page.keyboard.press("Escape").catch(() => undefined);
  await page.close();
  await control(request, "release", { planId: plan.id, index: 0 });
  await generated;
  await reported;
  return atProvider.jobId;
}

async function openDatabase(page: Page): Promise<void> {
  const toolbar = page.getByTestId("toolbar-database");
  if (await toolbar.isVisible().catch(() => false)) {
    await toolbar.click();
  } else {
    await page.getByTestId("menu-tools").click();
    await page.getByTestId("menu-tools-database").click();
  }
  await page.waitForSelector('[data-testid="database-modal"]', { timeout: 30_000 });
}

async function openReport(page: Page, jobId: string) {
  await page.getByTestId("ai-jobs-open").click();
  await expect(page.getByTestId("ai-jobs-list")).toBeVisible();
  await page.getByTestId("ai-jobs-search").fill(jobId);
  const row = page.locator(`[data-job-id="${jobId}"]`);
  try {
    await expect(row).toBeVisible({ timeout: 15_000 });
  } catch {
    await page.getByTestId("ai-jobs-reconnect").click();
    await expect(row).toBeVisible({ timeout: 30_000 });
  }
  await row.locator('[data-testid="ai-job-open-report"]').click();
  const report = page.locator(`[data-testid="ai-job-report"][data-job-id="${jobId}"]`);
  await expect(report).toBeVisible({ timeout: 30_000 });
  await expect(report).toHaveAttribute("data-busy", "false");
  return report;
}

async function jobOf(request: APIRequestContext, jobId: string) {
  const counts = await control(request, "counts") as Counts;
  expect(counts.violations).toEqual([]);
  const job = counts.jobs.find(item => item.id === jobId);
  expect(job, `missing job ${jobId}`).toBeTruthy();
  return { counts, job: job! };
}

async function dumpFailureMetadata(request: APIRequestContext, title: string): Promise<void> {
  const dir = process.env.TASK8_PLAYWRIGHT_OUTPUT || "/dev/shm";
  const slug = title.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 80);
  try {
    const counts = await control(request, "counts");
    let snapshot: unknown = null;
    try { snapshot = await control(request, "persistence/snapshot"); } catch { snapshot = { error: "snapshot-unavailable" }; }
    await mkdir(dir, { recursive: true });
    await writeFile(resolve(dir, `${slug}-failure-meta.json`), `${JSON.stringify({ title, counts, snapshot }, null, 2)}\n`);
  } catch (error) {
    await writeFile(resolve(dir, `${slug}-failure-meta-error.txt`), String(error)).catch(() => undefined);
  }
}

test.describe("AI job families on the owned Task8 fixture", () => {
  test.beforeEach(async ({ context }) => {
    await installStaticGetWire(context);
  });

  test.afterEach(async ({ context, request }, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) {
      await dumpFailureMetadata(request, testInfo.title);
    }
    await releaseStaticGetWire(context);
    await Promise.all(context.pages().map(page => page.close().catch(() => undefined)));
  });

  test.beforeAll(async ({ request, browser }) => {
    const existing = await control(request, "counts") as Counts;
    if (existing.persistence?.initialized) {
      expect(existing.persistence.projectId).toBe(PROJECT_ID);
      return;
    }
    const context = await browser.newContext({ serviceWorkers: "block" });
    await installStaticGetWire(context);
    const page = await context.newPage();
    await page.goto("/task8-bootstrap.html", { waitUntil: "domcontentloaded", timeout: 60_000 });
    const serialized = await page.evaluate(async () => {
      const defaultsHref = "/src/project/defaults.ts";
      const constantsHref = "/src/project/defaults/constants.ts";
      const ioHref = "/src/project/io.ts";
      const { createBlankProject }: BrowserDefaults = await import(defaultsHref);
      const { DEFAULT_TILESET_ID }: BrowserConstants = await import(constantsHref);
      const { serialize }: BrowserIo = await import(ioHref);
      const project = createBlankProject();
      const tileset = project.tilesets[DEFAULT_TILESET_ID];
      if (tileset) {
        tileset.tileGroups = [{
          defaultLayer: "lower",
          description: "Task8 fence",
          id: "task8-fence",
          name: "Task8 Fence",
          placementRules: "edge",
          role: "fence",
          tileIds: [1, 2, 3],
        }];
        tileset.structureKits = [{
          id: "kit_task8_well",
          kind: "section",
          name: "Task8 Well",
          width: 3,
          height: 3,
          rows: [{ tiles: [240, 240, 240] }, { tiles: [240, 116, 240] }, { tiles: [240, 240, 240] }],
          learnedFrom: "db-authored",
        }];
      }
      return serialize(project);
    });
    const sha256 = await page.evaluate(async (value) => {
      const shaHref = "/src/util/sha256.ts";
      const { sha256HexText }: BrowserSha256 = await import(shaHref);
      return sha256HexText(value);
    }, serialized);
    await control(request, "persistence/init", { projectId: PROJECT_ID, serialized, sha256 });
    await releaseStaticGetWire(context);
    await context.close();
  });

  test("chat send completes a ready image-rich report and auto-applies on reconnect", async ({ page, request, context }) => {
    await mkdir(EVIDENCE, { recursive: true });
    await openEditor(page);
    await waitPaintedMapFrame(page);
    await page.screenshot({ path: resolve(EVIDENCE, "boot-proof-editor.png"), fullPage: true });
    await page.waitForSelector('[data-testid="ai-input"]', { timeout: 30_000 });
    const plan = {
      id: "assistant",
      match: { family: "assistant", projectId: PROJECT_ID },
      operations: sessionOps("assistant", mapEditResponses()),
    };
    const jobId = await holdThenClose(request, page, plan, async () => {
      await page.locator('[data-testid="ai-input"]').fill("이 맵 입구에 물을 놓아 주세요");
      await page.locator('[data-testid="ai-send"]').click();
      await page.screenshot({ path: resolve(EVIDENCE, "boot-proof-held.png"), fullPage: true });
    });
    const { counts, job } = await jobOf(request, jobId);
    expect(counts.operations.filter(operation => operation.jobId === jobId)).toHaveLength(4);
    expect(job.family).toBe("assistant");
    expect(job.project.projectId).toBe(PROJECT_ID);
    expect(job.project.backend).toBe(`task8-local:${runId}`);
    expect(job.generation).toBe("succeeded");
    expect(job.report).toBe("ready");
    expect(job.resultRef?.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(job.reportRef?.sha256).toMatch(/^[0-9a-f]{64}$/);
    const applied = await armJobEvent(request, jobId, { application: "applied" });
    const next = await context.newPage();
    await openEditor(next);
    await applied.reached;
    await next.keyboard.press("Escape").catch(() => undefined);
    await waitPaintedMapFrame(next);
    await next.screenshot({ path: resolve(EVIDENCE, "family-chat-applied-canvas.png"), fullPage: true });
    const report = await openReport(next, jobId);
    await expect(next.getByTestId("ai-job-report-body")).toContainText(CHAT_REPLY);
    const generatedMap = report.locator('[data-phase="generated"] figure[data-media-role="map"]');
    await expect(generatedMap).toHaveAttribute("data-status", "ready");
    await expect(generatedMap.locator("img")).toBeVisible();
    const beforeMap = report.locator('[data-phase="before"] figure[data-media-role="map"]');
    await expect(beforeMap).toHaveAttribute("data-status", "ready");
    await expect(beforeMap.locator("img")).toBeVisible();
    await next.screenshot({ path: resolve(EVIDENCE, "boot-proof-report.png"), fullPage: true });
    const appliedJob = await jobOf(request, jobId);
    expect(appliedJob.job.application).toBe("applied");
    expect(appliedJob.counts.operations.filter(operation => operation.jobId === jobId && operation.status === "succeeded")).toHaveLength(4);
    const painted = await next.evaluate(async ({ mapId }) => {
      const storeHref = "/src/project/store.ts";
      const { store }: BrowserStore = await import(storeHref);
      const map = store.getCurrent().maps[mapId];
      if (!map) return null;
      const rect: number[][] = [];
      for (let y = 1; y <= 4; y += 1) {
        const row: number[] = [];
        for (let x = 1; x <= 4; x += 1) row.push(map.lowerTiles[y * map.width + x] ?? -2);
        rect.push(row);
      }
      return rect;
    }, { mapId: MAP_ID });
    expect(painted).toEqual(EXPECTED_PATH_RECT);
    await next.close();
  });

  test("database generate keeps the brief, hydrates facts, and exposes the report", async ({ page, request, context }) => {
    await openEditor(page);
    await openDatabase(page);
    await page.locator('[data-testid="db-tab-items"]').click();
    await page.locator('[data-testid="db-ai-generate-open"]').click();
    await page.waitForSelector('[data-testid="db-ai-generate-dialog-item"]', { timeout: 30_000 });
    const brief = page.locator('[data-testid="db-ai-generate-brief"]');
    await page.locator('[data-testid="db-ai-generate-artwork"]').uncheck();
    await brief.fill("Disposable controlled potion");
    const plan = {
      id: "database-text",
      match: { family: "database", projectId: PROJECT_ID, payload: { kind: "item", brief: "Disposable controlled potion" } },
      operations: [{
        key: "database/text",
        kind: "text",
        provider: "google-antigravity",
        hold: true,
        response: providerText({ name: "Task8 Fixture Potion", price: 37 }),
      }],
    };
    const jobId = await holdThenClose(request, page, plan, async () => {
      await page.locator('[data-testid="db-ai-generate-run"]').click();
    });
    const { job } = await jobOf(request, jobId);
    expect(job.family).toBe("database");
    expect(job.report).toBe("ready");
    const next = await context.newPage();
    await openEditor(next);
    await openReport(next, jobId);
    await expect(next.getByTestId("ai-job-apply")).toBeVisible();
    await control(request, "persistence/configure", { failWrites: 0, blockWrites: true });
    const applied = await armJobEvent(request, jobId, { application: "applied" });
    await next.getByTestId("ai-job-apply").click();
    await next.getByTestId("app-modal-confirm").click();
    await applied.reached;
    await next.screenshot({ path: resolve(EVIDENCE, "family-database-applied.png"), fullPage: true });
    const unknownSave = await armJobEvent(request, jobId, { save: "unknown" });
    await next.getByTestId("ai-job-save").click();
    await unknownSave.reached;
    const failed = await jobOf(request, jobId);
    expect(failed.job.save ?? "unknown").toBe("unknown");
    await control(request, "persistence/configure", { failWrites: 0, blockWrites: false });
    const savedWait = await armJobEvent(request, jobId, { save: "saved" });
    await next.getByTestId("ai-job-save").click();
    await savedWait.reached;
    const saved = await jobOf(request, jobId);
    expect(saved.job.application).toBe("applied");
    expect(saved.job.save).toBe("saved");
    expect(saved.counts.operations.filter(operation => operation.jobId === jobId && operation.status === "succeeded")).toHaveLength(1);
    const item = await next.evaluate(async () => {
      const storeHref = "/src/project/store.ts";
      const { store }: BrowserStore = await import(storeHref);
      for (const record of store.getCurrent().database.items) {
        if (record.name === "Task8 Fixture Potion") return { name: record.name, price: record.price };
      }
      return null;
    });
    expect(item?.price).toBe(37);
    await next.close();
  });

  test("canvas ask admits a region job from the existing workbench control", async ({ page, request, context }) => {
    await openEditor(page);
    await page.getByTestId("tool-select").click();
    const canvas = page.getByTestId("edit-canvas").locator("canvas").first();
    await expect(canvas).toBeVisible({ timeout: 30_000 });
    const box = await canvas.boundingBox();
    if (!box) throw new Error("map canvas has no box");
    const x0 = box.x + box.width * 0.35;
    const y0 = box.y + box.height * 0.35;
    const x1 = box.x + box.width * 0.55;
    const y1 = box.y + box.height * 0.55;
    await page.mouse.move(x0, y0);
    await page.mouse.down();
    await page.mouse.move(x1, y1, { steps: 8 });
    await page.mouse.up();
    await expect(page.getByTestId("selection-chip-ai")).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("selection-chip-ai").click();
    const plan = {
      id: "region",
      match: { family: "region", projectId: PROJECT_ID },
      operations: sessionOps("region", [
        intent(["set_build_spec", "paint_tiles"], true),
        providerTool("set_build_spec", buildSpecArgs()),
        providerTool("paint_tiles", paintArgs()),
        providerText(CHAT_REPLY),
      ]),
    };
    await page.waitForSelector('[data-testid="region-task-run"]', { timeout: 30_000 });
    await page.locator('[data-testid="region-task-input"]').fill("이 맵 입구에 물을 놓아 주세요");
    const jobId = await holdThenClose(request, page, plan, async () => {
      await page.locator('[data-testid="region-task-run"]').click();
    });
    const { job } = await jobOf(request, jobId);
    expect(job.family).toBe("region");
    expect(job.report).toBe("ready");
    const next = await context.newPage();
    await openEditor(next);
    const report = await openReport(next, jobId);
    await expect(report.locator('[data-phase="generated"] figure[data-media-role="map"]')).toHaveAttribute("data-status", "ready");
    await next.close();
  });

  test("actor face image field admits an image job with the actor destination", async ({ page, request, context }) => {
    await openEditor(page);
    await openDatabase(page);
    await page.locator('[data-testid="db-tab-actors"]').click();
    await page.locator('[data-testid="db-actor-tab-appearance"]').click();
    await page.waitForSelector('[data-testid="db-actor-face-ai-prompt"]', { timeout: 30_000 });
    await page.locator('[data-testid="db-actor-face-ai-prompt"]').fill("빨간 머리 소녀 검사");
    const plan = {
      id: "image",
      match: { family: "image", projectId: PROJECT_ID },
      operations: [{
        key: "image/provider/generate",
        kind: "image",
        provider: "google-antigravity",
        hold: true,
        response: { image: { dataUrl: PNG_DATA_URL, mimeType: "image/png", model: "gemini-3.8-flash", provider: "google-antigravity" } },
      }],
    };
    const jobId = await holdThenClose(request, page, plan, async () => {
      await page.locator('[data-testid="db-actor-face-ai-generate"]').click();
    });
    const { job } = await jobOf(request, jobId);
    expect(job.family).toBe("image");
    expect(job.report).toBe("ready");
    const next = await context.newPage();
    await openEditor(next);
    const report = await openReport(next, jobId);
    await expect(report.locator('figure[data-media-role="artwork"]')).toHaveAttribute("data-status", "ready");
    await next.close();
  });

  test("tileset workspace analyze admits a tileset job", async ({ page, request, context }) => {
    await openEditor(page);
    await openDatabase(page);
    await page.locator('[data-testid="db-tab-search"]').fill("타일셋");
    await page.locator('[data-testid="db-tab-tilesets"]').click();
    await page.waitForSelector('[data-testid="tileset-ai-workspace-open"]', { timeout: 30_000 });
    await page.locator('[data-testid="tileset-ai-workspace-open"]').click();
    await page.waitForSelector('[data-testid="tileset-ai-workspace-analyze"]', { timeout: 30_000 });
    const plan = {
      id: "tileset-knowledge",
      match: { family: "tileset", projectId: PROJECT_ID, operation: "knowledge-analysis" },
      operations: [{
        key: "tileset/knowledge-analysis/provider/0",
        kind: "text",
        provider: "google-antigravity",
        hold: true,
        response: providerText({
          summary: "Controlled captured atlas review",
          proposals: [{ template: "desk", tileIds: [0, 1], name: "Task8 Desk", confidence: 0.7 }],
        }),
      }],
    };
    const jobId = await holdThenClose(request, page, plan, async () => {
      await page.locator('[data-testid="tileset-ai-workspace-analyze"]').click();
    });
    const { job } = await jobOf(request, jobId);
    expect(job.family).toBe("tileset");
    expect(job.report).toBe("ready");
    const next = await context.newPage();
    await openEditor(next);
    await openReport(next, jobId);
    await expect(next.getByTestId("ai-job-review")).toBeVisible();
    await next.close();
  });

  test("event editor assist admits an event-commands job", async ({ page, request, context }) => {
    await openEditor(page);
    await page.locator('[data-testid="layer-event"]').click();
    const canvas = page.getByTestId("edit-canvas").locator("canvas").first();
    await expect(canvas).toBeVisible({ timeout: 30_000 });
    const box = await canvas.boundingBox();
    if (!box) throw new Error("map canvas has no box");
    await page.mouse.click(box.x + box.width * 0.45, box.y + box.height * 0.45);
    await page.locator('[data-testid="basic-create-selected-event"]').click();
    await page.waitForSelector('[data-testid="event-editor-modal"]', { timeout: 30_000 });
    await page.waitForSelector('[data-testid="ai-event-assist"]', { timeout: 30_000 });
    await page.locator('[data-testid="ai-event-assist"]').click();
    await page.locator('[data-testid="ai-event-input"]').fill("말풍선을 추가해 주세요");
    const plan = {
      id: "event-commands",
      match: { family: "event-commands", projectId: PROJECT_ID },
      operations: [{
        key: "event-commands/assist/0",
        kind: "text",
        provider: "google-antigravity",
        hold: true,
        response: providerText([{ kind: "text", body: "Task8 retained command" }]),
      }],
    };
    const jobId = await holdThenClose(request, page, plan, async () => {
      await page.locator('[data-testid="ai-event-generate"]').click();
    });
    const { job } = await jobOf(request, jobId);
    expect(job.family).toBe("event-commands");
    expect(job.report).toBe("ready");
    const next = await context.newPage();
    await openEditor(next);
    await openReport(next, jobId);
    await expect(next.getByTestId("ai-job-review")).toBeVisible();
    await expect(next.getByTestId("ai-event-staged")).toBeVisible();
    await next.close();
  });

  test("sheet range classify admits a cluster tileset job", async ({ page, request, context }) => {
    await openEditor(page);
    await page.getByTestId("tool-paint").click();
    const tiles = page.locator(".chipset-tile");
    await expect(tiles.first()).toBeVisible({ timeout: 60_000 });
    await page.keyboard.down("Shift");
    await tiles.nth(0).hover();
    await page.mouse.down();
    await tiles.nth(8).hover();
    await page.mouse.up();
    await page.keyboard.up("Shift");
    await page.waitForSelector('[data-testid="palette-range-classify"]', { timeout: 15_000 });
    const plan = {
      id: "tileset-range",
      match: { family: "tileset", projectId: PROJECT_ID, operation: "range-classify" },
      operations: sessionOps("tileset/range-classify", [
        intent(["upsert_tile_group"]),
        providerTool("upsert_tile_group", { tilesetId: "easyrpg_chipset_combined_town", name: "Task8 range", tileIds: [0, 1], role: "prop", defaultLayer: "lower" }),
        providerText("Review the controlled tile group."),
      ]),
    };
    const jobId = await holdThenClose(request, page, plan, async () => {
      await page.locator('[data-testid="palette-range-classify"]').click();
      await page.waitForSelector('[data-testid="cluster-ai-modal"]', { timeout: 15_000 });
    });
    const { job } = await jobOf(request, jobId);
    expect(job.family).toBe("tileset");
    expect(job.report).toBe("ready");
    const next = await context.newPage();
    await openEditor(next);
    await openReport(next, jobId);
    await next.close();
  });

  test("structure kit AI draft admits a tileset metadata job", async ({ page, request, context }) => {
    await openEditor(page);
    await openDatabase(page);
    await page.locator('[data-testid="db-tab-search"]').fill("부품");
    await page.locator('[data-testid="db-tab-structure-kits"]').click();
    await page.waitForSelector('[data-testid="structure-kit-db-kit_task8_well"]', { timeout: 30_000 });
    await page.locator('[data-testid="structure-kit-db-kit_task8_well"]').click();
    const editKit = page.getByTestId("structure-kit-edit-kit_task8_well");
    const duplicateKit = page.getByTestId("structure-kit-duplicate-kit_task8_well");
    if (await editKit.isVisible().catch(() => false)) await editKit.click();
    else await duplicateKit.click();
    await page.waitForSelector('[data-testid="structure-kit-editor-tab-ai"]', { timeout: 15_000 });
    await page.locator('[data-testid="structure-kit-editor-tab-ai"]').click();
    const plan = {
      id: "tileset-kit",
      match: { family: "tileset", projectId: PROJECT_ID, operation: "structure-kit-metadata" },
      operations: [{
        key: "tileset/structure-kit-metadata/provider/0",
        kind: "text",
        provider: "google-antigravity",
        hold: true,
        response: providerText({
          description: "Task8 captured structure",
          tags: ["fixture"],
          placement: [{ zone: "againstWall", facing: "north", strength: "hard" }],
        }),
      }],
    };
    const jobId = await holdThenClose(request, page, plan, async () => {
      await page.locator('[data-testid="structure-kit-editor-ai-draft"]').click();
    });
    const { job } = await jobOf(request, jobId);
    expect(job.family).toBe("tileset");
    expect(job.report).toBe("ready");
    const next = await context.newPage();
    await openEditor(next);
    await openReport(next, jobId);
    await next.close();
  });

  test("stale human map edit during a held chat job surfaces Apply conflict", async ({ page, request }) => {
    await openEditor(page);
    await page.waitForSelector('[data-testid="ai-input"]', { timeout: 30_000 });
    const instruction = "겹친 칸을 물로 칠해 주세요";
    const plan = {
      id: "assistant-stale",
      match: { family: "assistant", projectId: PROJECT_ID, payload: { instruction } },
      operations: sessionOps("assistant", staleMapEditResponses()),
    };
    await control(request, "plan", plan);
    const armed = control(request, "wait", { type: "waiter-registered", waitType: "operation-reached", planId: plan.id });
    const reached = control(request, "wait", { type: "operation-reached", planId: plan.id, index: 0 });
    await armed;
    await page.locator('[data-testid="ai-input"]').fill(instruction);
    await page.locator('[data-testid="ai-send"]').click();
    const atProvider = await reached as { jobId: string };
    const beforeHuman = await readLowerTile(page, MAP_ID, STALE_CELL.x, STALE_CELL.y);
    expect(beforeHuman).toBe(STALE_GRASS);
    await page.evaluate(async ({ mapId, x, y, tile }) => {
      const storeHref = "/src/project/store.ts";
      const { store }: BrowserStore = await import(storeHref);
      store.updateMap(mapId, map => {
        map.lowerTiles[y * map.width + x] = tile;
      }, { origin: "human" });
    }, { mapId: MAP_ID, x: STALE_CELL.x, y: STALE_CELL.y, tile: STALE_HUMAN_TILE });
    expect(await readLowerTile(page, MAP_ID, STALE_CELL.x, STALE_CELL.y)).toBe(STALE_HUMAN_TILE);
    await page.evaluate(async ({ jobId }) => {
      const jobClientHref = "/src/editor/aiJobs/jobClient.ts";
      const { getJobClient }: BrowserJobClient = await import(jobClientHref);
      const client = getJobClient();
      Reflect.set(globalThis, "__staleConflict", new Promise((resolve, reject) => {
        const check = (): void => {
          const outcome = client.outcomes.get(jobId);
          if (outcome?.application === "conflict") resolve(outcome);
          if (outcome?.application === "applied") reject(new Error(`stale job applied: ${outcome.reason ?? ""}`));
        };
        client.subscribe(check);
        check();
      }));
    }, { jobId: atProvider.jobId });
    const generated = control(request, "wait", { type: "job-event", jobId: atProvider.jobId, generation: "succeeded" });
    const reported = control(request, "wait", { type: "job-event", jobId: atProvider.jobId, report: "ready" });
    await control(request, "release", { planId: plan.id, index: 0 });
    await generated;
    await reported;
    const local = await page.evaluate(() => Reflect.get(globalThis, "__staleConflict")) as { application: string; reason?: string };
    expect(local.application).toBe("conflict");
    const proof = await page.evaluate(async ({ jobId, mapId, x, y }) => {
      const jobClientHref = "/src/editor/aiJobs/jobClient.ts";
      const storeHref = "/src/project/store.ts";
      const { getJobClient }: BrowserJobClient = await import(jobClientHref);
      const { store }: BrowserStore = await import(storeHref);
      const client = getJobClient();
      const job = client.jobs.get(jobId);
      if (!job?.resultRef) throw new Error("missing result");
      const result = await client.artifacts.json<BrowserJobResult>(jobId, job.resultRef);
      if (!result.generatedSnapshot) throw new Error("missing generated snapshot");
      const generatedProject = await client.artifacts.json<BrowserProject>(jobId, result.generatedSnapshot);
      const live = store.getCurrent().maps[mapId];
      const generatedMap = generatedProject.maps[mapId];
      return {
        liveTile: live ? live.lowerTiles[y * live.width + x] ?? null : null,
        generatedTile: generatedMap ? generatedMap.lowerTiles[y * generatedMap.width + x] ?? null : null,
        baseSha: result.baseSnapshot.sha256,
        generatedSha: result.generatedSnapshot.sha256,
        serverApplication: job.application,
        localApplication: client.outcomes.get(jobId)?.application ?? null,
        localReason: client.outcomes.get(jobId)?.reason ?? null,
      };
    }, { jobId: atProvider.jobId, mapId: MAP_ID, x: STALE_CELL.x, y: STALE_CELL.y });
    expect(proof.localApplication).toBe("conflict");
    expect(proof.serverApplication).not.toBe("applied");
    expect(proof.liveTile).toBe(STALE_HUMAN_TILE);
    expect(proof.baseSha).not.toBe(proof.generatedSha);
    expect(proof.generatedTile).not.toBe(STALE_HUMAN_TILE);
    expect(proof.generatedTile).not.toBe(STALE_GRASS);
    expect(proof.generatedTile).toBe(390);
    const { job } = await jobOf(request, atProvider.jobId);
    expect(job.application).not.toBe("applied");
    expect(job.generation).toBe("succeeded");
    expect(job.report).toBe("ready");
    await page.close();
  });

  test("cancelled database job reuses the late held response on retry", async ({ page, request }) => {
    await openEditor(page);
    await openDatabase(page);
    await page.locator('[data-testid="db-tab-items"]').click();
    await page.locator('[data-testid="db-ai-generate-open"]').click();
    await page.waitForSelector('[data-testid="db-ai-generate-dialog-item"]', { timeout: 30_000 });
    const brief = "Disposable cancelled potion";
    await page.locator('[data-testid="db-ai-generate-artwork"]').uncheck();
    await page.locator('[data-testid="db-ai-generate-brief"]').fill(brief);
    const plan = {
      id: "database-cancel",
      match: { family: "database", projectId: PROJECT_ID, payload: { kind: "item", brief } },
      operations: [{
        key: "database/text",
        kind: "text",
        provider: "google-antigravity",
        hold: true,
        cancel: "late-response",
        response: providerText({ name: "Task8 Cancelled Potion", price: 11 }),
      }],
    };
    await control(request, "plan", plan);
    const armed = control(request, "wait", { type: "waiter-registered", waitType: "operation-reached", planId: plan.id });
    const reached = control(request, "wait", { type: "operation-reached", planId: plan.id, index: 0 });
    await armed;
    await page.locator('[data-testid="db-ai-generate-run"]').click();
    const atProvider = await reached as { jobId: string };
    const cancelled = control(request, "wait", { type: "job-event", jobId: atProvider.jobId, generation: "cancelled" });
    const originOpen = page.getByTestId("ai-job-origin-open");
    if (await originOpen.isVisible().catch(() => false)) {
      await originOpen.click();
    } else {
      await page.getByTestId("ai-jobs-open").click();
      await page.getByTestId("ai-jobs-search").fill(atProvider.jobId);
      await page.locator(`[data-job-id="${atProvider.jobId}"] [data-testid="ai-job-open-report"]`).click();
    }
    await page.getByTestId("ai-job-report-cancel").click();
    await page.getByTestId("app-modal-confirm").click();
    await cancelled;
    const retried = control(request, "wait", { type: "operation-reused", jobId: atProvider.jobId });
    await page.getByTestId("ai-job-report-retry").click();
    await page.getByTestId("app-modal-confirm").click();
    await control(request, "release", { planId: plan.id, index: 0 });
    await retried;
    const succeeded = await armJobEvent(request, atProvider.jobId, { generation: "succeeded" });
    await succeeded.reached;
    const { counts, job } = await jobOf(request, atProvider.jobId);
    expect(job.generation).toBe("succeeded");
    expect((counts.reusedResponses ?? 0)).toBeGreaterThan(0);
  });
});
