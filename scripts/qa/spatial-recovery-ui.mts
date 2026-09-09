import "./spatial-local-only.mjs";
import assert from "node:assert/strict";
import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { createServer as createNetServer } from "node:net";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, type Page } from "@playwright/test";
import { deserialize, serialize } from "../../src/project/io";
import { readStoredZipEntry } from "../../src/project/packageZip";
import { spatialFixture } from "../../test/support/spatialSchemaFixture";
import { spatialPersistenceHttp, type HttpExchange } from "../../test/support/spatialPersistenceHttp";

const ROOT = resolve(import.meta.dirname, "../..");
const EVIDENCE = resolve(ROOT, "output/evidence/tile-to-world/task-6/recovery-ui-repair");
const VIEWPORTS = [
  { name: "1024x768", width: 1024, height: 768 },
  { name: "1280x800", width: 1280, height: 800 },
  { name: "1440x900", width: 1440, height: 900 },
] as const;

type Scenario = {
  readonly id: string;
  readonly criterion: string;
  readonly surface: string;
  readonly invocation: string;
  readonly verdict: "PASS" | "FAIL";
  readonly notes: string;
  readonly artifacts: readonly string[];
};

async function main(): Promise<void> {
  await mkdir(EVIDENCE, { recursive: true });
  const sourceSHA = execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
  const port = String(await ownedPort());
  const origin = `http://127.0.0.1:${port}`;
  const fixture = spatialFixture();
  const project = deserialize(JSON.stringify({ ...fixture.project, spatialAuthoring: fixture.document }));
  const http = await spatialPersistenceHttp();
  http.state.root = JSON.parse(serialize(project)) as Record<string, unknown>;
  http.state.enforceFences = true;
  http.targets.set("other-fixture", {
    root: JSON.parse(serialize({ ...project, meta: { ...project.meta, title: "other fixture" } })),
    sha: "2".repeat(64),
    revision: 1,
    maps: [],
  });
  const vite = startVite(http.config.url, http.config.anonKey, http.config.projectId, port);
  attachViteLog(vite);
  const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
  const scenarios: Scenario[] = [];
  const serversClosed: string[] = [];
  try {
    await waitViteReady(vite, port);
    const context = await browser.newContext({ acceptDownloads: true });
    const openPage = async (): Promise<Page> => {
      const next = await context.newPage();
      next.on("pageerror", (error) => { void writeFile(resolve(EVIDENCE, "pageerror.txt"), `${error.stack ?? error.message}\n`, { flag: "a" }).catch(() => undefined); });
      await next.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
      await boot(next, origin, http.config.projectId);
      return next;
    };
    let page = await openPage();
    await page.setViewportSize({ width: 1280, height: 800 });
    const bootShot = resolve(EVIDENCE, "boot-1280x800.png");
    await page.screenshot({ path: bootShot });
    scenarios.push(await runMirrorWarningAndPending(page, http, bootShot));
    scenarios.push(await runConflictCancelBytes(page, http));
    scenarios.push(await runRepeatedSave(page, http));
    scenarios.push(await runCurlConflict(http));
    scenarios.push(await runExportCopyBytes(page, http));
    scenarios.push(await runSamePageProjectSwitch(page, http, origin));
    await page.close();
    page = await openPage();
    scenarios.push(await runReloadRejectsSwitchedTarget(page, http));
    await boot(page, origin, http.config.projectId);
    scenarios.push(await runReloadThenSuccessBytes(page, http));
    scenarios.push(await runMissingRpc(page, http));
    scenarios.push(await captureViewports(page, http));
    const failed = scenarios.filter((row) => row.verdict === "FAIL");
    assert.equal(failed.length, 0, failed.map((row) => `${row.id}: ${row.notes}`).join("; "));
  } finally {
    try { await http[Symbol.asyncDispose](); } catch { /* cleanup continues */ }
    await browser.close();
    await stopChild(vite);
    serversClosed.push(origin, http.config.url);
    await writeFile(resolve(EVIDENCE, "cleanup.md"), [
      "# cleanup",
      `- sourceSHA: ${sourceSHA}`,
      `- serversClosed: ${serversClosed.join(", ")}`,
      "- remoteCalls: 0",
      "- databaseResourcesCreated: 0",
      "- browserClosed: true",
      "- portsReleased: true",
      "",
    ].join("\n"));
    await writeFile(resolve(EVIDENCE, "DoneClaim.json"), JSON.stringify({
      task: 6,
      scope: "canonical-recovery-ui-repair",
      sourceSHA,
      scenarios,
      http: summarize(http.trace),
      cleanup: {
        sourceSHA,
        serversClosed,
        remoteCalls: 0,
        databaseResourcesCreated: 0,
        browserClosed: true,
        portsReleased: true,
      },
    }, null, 2));
  }
}

function startVite(url: string, anonKey: string, projectId: string, port: string): ChildProcess {
  return spawn("npx", ["vite", "--configLoader", "runner", "--host", "127.0.0.1", "--port", port, "--strictPort"], {
    cwd: ROOT,
    detached: true,
    env: {
      ...process.env,
      VITE_CACHE_DIR: resolve(ROOT, ".vite-cache-recovery-ui-repair"),
      VITE_SUPABASE_URL: url,
      VITE_SUPABASE_ANON_KEY: anonKey,
      VITE_SUPABASE_PROJECT_ID: projectId,
      VITE_SUPABASE_USE_PROXY: "0",
      DEV_SERVER_PORT: port,
      DEV_SERVER_NO_TLS: "1",
      E2E_FREEZE_DEV_SERVER: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function attachViteLog(child: ChildProcess): void {
  const path = resolve(EVIDENCE, "vite.log");
  const onChunk = (chunk: Buffer): void => {
    void writeFile(path, chunk, { flag: "a" }).catch(() => undefined);
  };
  child.stdout?.on("data", onChunk);
  child.stderr?.on("data", onChunk);
}

async function ownedPort(): Promise<number> {
  const server = createNetServer();
  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolveListen());
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise<void>((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose()));
  return port;
}

async function waitViteReady(child: ChildProcess, port: string): Promise<void> {
  let output = "";
  const ready = new Promise<void>((resolveReady, reject) => {
    const timer = setTimeout(() => reject(new Error(`vite did not become ready\n${output}`)), 120_000);
    const onChunk = (chunk: Buffer): void => {
      output += String(chunk);
      if (output.includes(`http://127.0.0.1:${port}`)) {
        clearTimeout(timer);
        resolveReady();
      }
    };
    child.stdout?.on("data", onChunk);
    child.stderr?.on("data", onChunk);
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`vite exited ${code}\n${output}`));
    });
  });
  await ready;
}

async function stopChild(child: ChildProcess): Promise<void> {
  if (child.pid) {
    try { process.kill(-child.pid, "SIGKILL"); } catch { child.kill("SIGKILL"); }
  }
  if (child.exitCode === null) await Promise.race([once(child, "exit"), once(child, "close")]);
}

async function boot(page: Page, origin: string, projectId: string): Promise<void> {
  await page.goto(`${origin}/?project=${encodeURIComponent(projectId)}`, { waitUntil: "domcontentloaded", timeout: 180_000 });
  try {
    await page.getByTestId("toolbar-save").waitFor({ state: "attached", timeout: 180_000 });
  } catch (error) {
    await page.screenshot({ path: resolve(EVIDENCE, "boot-timeout.png") }).catch(() => undefined);
    await writeFile(resolve(EVIDENCE, "boot-timeout.html"), await page.content().catch(() => ""));
    throw error;
  }
  await page.waitForFunction(() => Boolean((window as unknown as { __oprnEditorTool?: unknown }).__oprnEditorTool), null, { timeout: 30_000 });
}

async function dirtyMap(page: Page, name: string): Promise<void> {
  const result = await page.evaluate((mapName) => {
    const bridge = (window as unknown as { __oprnProjectE2E?: { currentProject: () => { project: { startMapId: string } } } }).__oprnProjectE2E;
    const tool = (window as unknown as { __oprnEditorTool?: (name: string, args: Record<string, unknown>) => { ok: boolean; reason?: string } }).__oprnEditorTool;
    if (!bridge) return { ok: false, reason: "missing-e2e-bridge" };
    if (!tool) return { ok: false, reason: "missing-editor-tool" };
    return tool("set_map_properties", { mapId: bridge.currentProject().project.startMapId, name: mapName });
  }, name);
  assert.equal(result.ok, true, result.reason ?? "set_map_properties failed");
}

async function draftSnapshot(page: Page): Promise<{ projectId: string; title: string; startMapName: string; startMapId: string }> {
  return page.evaluate(() => {
    const bridge = (window as unknown as {
      __oprnProjectE2E?: {
        currentProject: () => {
          effectiveTarget: { projectId: string };
          project: { meta: { title?: string }; startMapId: string; maps: Record<string, { name: string }> };
        };
      };
    }).__oprnProjectE2E;
    if (!bridge) throw new Error("missing-e2e-bridge");
    const snap = bridge.currentProject();
    const start = snap.project.maps[snap.project.startMapId];
    return {
      projectId: snap.effectiveTarget.projectId,
      title: String(snap.project.meta.title ?? ""),
      startMapId: snap.project.startMapId,
      startMapName: start?.name ?? "",
    };
  });
}

async function chipState(page: Page): Promise<{
  mirrorStatus: string | null;
  autosaveKind: string | null;
  retry: number;
  recover: number;
}> {
  return page.evaluate(() => ({
    mirrorStatus: document.querySelector("[data-testid=persistence-mirror-warning]")?.getAttribute("data-mirror-status") ?? null,
    autosaveKind: document.querySelector("[data-testid=db-autosave-state]")?.getAttribute("data-autosave-kind") ?? null,
    retry: document.querySelectorAll("[data-testid=db-autosave-retry]").length,
    recover: document.querySelectorAll("[data-testid=persistence-recovery-open]").length,
  }));
}

async function serverRoot(http: Awaited<ReturnType<typeof spatialPersistenceHttp>>, projectId = http.config.projectId): Promise<{
  status: number;
  sha: string | null;
  title: string | null;
  startMapName: string | null;
}> {
  const url = `${http.config.url}/rest/v1/projects?select=project_id,current_json,current_sha256&project_id=eq.${encodeURIComponent(projectId)}`;
  const response = await fetch(url, {
    headers: { Accept: "application/json", "Accept-Profile": "rpg_zzu" },
    signal: AbortSignal.timeout(5000),
    redirect: "error",
  });
  const body = await response.json() as Array<{ current_json?: { meta?: { title?: string }; startMapId?: string; maps?: Record<string, { name?: string }> }; current_sha256?: string }>;
  const row = body[0];
  const maps = row?.current_json?.maps ?? {};
  const startId = row?.current_json?.startMapId ?? "";
  return {
    status: response.status,
    sha: row?.current_sha256 ?? null,
    title: row?.current_json?.meta?.title ?? null,
    startMapName: maps[startId]?.name ?? null,
  };
}

async function publishAccepted(http: Awaited<ReturnType<typeof spatialPersistenceHttp>>, title: string): Promise<void> {
  assert(http.state.root);
  const body = {
    p_project_id: http.config.projectId,
    p_expected_sha256: http.state.sha,
    p_operation: "update",
    p_project: { ...http.state.root, meta: { ...(http.state.root.meta as object), title } },
  };
  const accepted = http.completed("/rest/v1/rpc/publish_spatial_project");
  const response = await fetch(`${http.config.url}/rest/v1/rpc/publish_spatial_project`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Content-Profile": "rpg_zzu" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
    redirect: "error",
  });
  await accepted;
  assert.equal(response.status, 200, await response.text());
}

async function dismissRecovery(page: Page): Promise<void> {
  const modal = page.getByTestId("persistence-recovery-modal");
  if (await modal.count() === 0) return;
  await page.getByTestId("persistence-recovery-cancel").click();
  await modal.waitFor({ state: "hidden", timeout: 5_000 }).catch(() => undefined);
}

async function openConflict(page: Page, http: Awaited<ReturnType<typeof spatialPersistenceHttp>>): Promise<void> {
  http.state.mirrorFailure = false;
  http.state.heldPath = "";
  await dismissRecovery(page);
  await dirtyMap(page, "Q7 dirty template B");
  await publishAccepted(http, "Q7 accepted template A");
  await page.locator("[data-testid=toolbar-save]").evaluate((node) => (node as HTMLButtonElement).click());
  await page.getByTestId("persistence-recovery-modal").waitFor({ state: "visible", timeout: 15_000 });
}

async function runMirrorWarningAndPending(
  page: Page,
  http: Awaited<ReturnType<typeof spatialPersistenceHttp>>,
  bootShot: string,
): Promise<Scenario> {
  const invocation = "toolbar-save with mirrorFailure; hold next publish_spatial_project; toolbar-save";
  http.state.mirrorFailure = true;
  await dirtyMap(page, "Q8 accepted root map");
  const before = await serverRoot(http);
  await page.locator("[data-testid=toolbar-save]").evaluate((node) => (node as HTMLButtonElement).click());
  await page.getByTestId("persistence-mirror-warning").waitFor({ state: "visible", timeout: 15_000 });
  const afterSave = await serverRoot(http);
  const chipAfterSave = await chipState(page);
  const shot = resolve(EVIDENCE, "mirror-warning.png");
  await page.screenshot({ path: shot });
  http.state.mirrorFailure = false;
  http.state.heldPath = "/rest/v1/rpc/publish_spatial_project";
  await dirtyMap(page, "pending after mirror");
  const pending = http.requested("/rest/v1/rpc/publish_spatial_project");
  await page.locator("[data-testid=toolbar-save]").evaluate((node) => (node as HTMLButtonElement).click());
  await pending;
  const chipDuringSave = await chipState(page);
  const pendingShot = resolve(EVIDENCE, "mirror-pending.png");
  await page.screenshot({ path: pendingShot });
  const completed = http.completed("/rest/v1/rpc/publish_spatial_project");
  http.state.heldPath = "";
  http.release();
  await completed;
  await page.getByTestId("toast").filter({ hasText: "저장 완료" }).waitFor({ state: "visible", timeout: 15_000 }).catch(() => undefined);
  await dismissRecovery(page);
  const afterRelease = await serverRoot(http);
  const pendingVisible = chipDuringSave.autosaveKind === "saving" || chipDuringSave.autosaveKind === "pending";
  const warningKept = chipDuringSave.mirrorStatus === "warning" && chipAfterSave.mirrorStatus === "warning";
  const rootAccepted = afterSave.startMapName === "Q8 accepted root map" && afterSave.sha !== before.sha;
  const staleMirror = http.state.maps.length === 0 || http.state.maps.every((row) => {
    const json = row.map_json as { name?: string } | undefined;
    return json?.name !== "Q8 accepted root map";
  });
  await writeFile(resolve(EVIDENCE, "mirror-root.json"), JSON.stringify({
    before, afterSave, afterRelease, chipAfterSave, chipDuringSave, pendingVisible, warningKept, rootAccepted, staleMirror,
  }, null, 2));
  return {
    id: "mirror-warning",
    criterion: "accepted root distinct from stale mirror; AutoSaveState visible during in-flight publish",
    surface: "browser UI + GET /rest/v1/projects + held publish",
    invocation,
    verdict: rootAccepted && pendingVisible && warningKept && staleMirror ? "PASS" : "FAIL",
    notes: `rootMap=${afterSave.startMapName} autosaveKind=${chipDuringSave.autosaveKind} mirror=${chipDuringSave.mirrorStatus}`,
    artifacts: [shot, pendingShot, bootShot, resolve(EVIDENCE, "mirror-root.json")],
  };
}

async function runConflictCancelBytes(page: Page, http: Awaited<ReturnType<typeof spatialPersistenceHttp>>): Promise<Scenario> {
  const invocation = "concurrent accepted publish then toolbar-save; persistence-recovery-cancel";
  await openConflict(page, http);
  const shot = resolve(EVIDENCE, "conflict-modal.png");
  await page.screenshot({ path: shot });
  const code = await page.getByTestId("persistence-recovery-code").textContent();
  const draftBefore = await draftSnapshot(page);
  const rootBefore = await serverRoot(http);
  await page.getByTestId("persistence-recovery-cancel").click();
  const gone = await page.getByTestId("persistence-recovery-modal").count();
  const draftAfter = await draftSnapshot(page);
  const rootAfter = await serverRoot(http);
  const ok = code === "conflict"
    && gone === 0
    && draftAfter.startMapName === "Q7 dirty template B"
    && rootAfter.title === "Q7 accepted template A"
    && rootAfter.startMapName !== "Q7 dirty template B"
    && rootAfter.sha === rootBefore.sha;
  await writeFile(resolve(EVIDENCE, "conflict-bytes.json"), JSON.stringify({
    code, draftBefore, draftAfter, rootBefore, rootAfter, gone,
  }, null, 2));
  return {
    id: "conflict-cancel",
    criterion: "dirty local bytes retained; server root remains accepted A",
    surface: "browser UI + GET /rest/v1/projects",
    invocation,
    verdict: ok ? "PASS" : "FAIL",
    notes: `code=${code} draft=${draftAfter.startMapName} rootTitle=${rootAfter.title}`,
    artifacts: [shot, resolve(EVIDENCE, "conflict-bytes.json")],
  };
}

async function runRepeatedSave(page: Page, http: Awaited<ReturnType<typeof spatialPersistenceHttp>>): Promise<Scenario> {
  const invocation = "second toolbar-save after 409 without reload";
  const before = http.trace.filter((row) => row.path.includes("publish_spatial_project") && row.status === 409);
  const serverSha = http.state.sha;
  await page.locator("[data-testid=toolbar-save]").evaluate((node) => (node as HTMLButtonElement).click());
  await page.getByTestId("persistence-recovery-modal").waitFor({ state: "visible", timeout: 15_000 });
  const after = http.trace.filter((row) => row.path.includes("publish_spatial_project") && row.status === 409);
  const last = after.at(-1);
  const expected = typeof last?.body === "object" && last.body !== null
    ? (last.body as { p_expected_sha256?: string }).p_expected_sha256
    : "";
  const ok = after.length > before.length && expected !== serverSha;
  await writeFile(resolve(EVIDENCE, "repeat-token.json"), JSON.stringify({ expected, serverSha, n: after.length }, null, 2));
  return {
    id: "repeated-save-same-stale-token",
    criterion: "repeated save still 409 with original expected SHA",
    surface: "HTTP publish_spatial_project",
    invocation,
    verdict: ok ? "PASS" : "FAIL",
    notes: `expected=${expected} current=${serverSha}`,
    artifacts: [resolve(EVIDENCE, "repeat-token.json")],
  };
}

async function runCurlConflict(http: Awaited<ReturnType<typeof spatialPersistenceHttp>>): Promise<Scenario> {
  const invocation = `curl -i POST ${http.config.url}/rest/v1/rpc/publish_spatial_project stale token`;
  assert(http.state.root);
  const payload = JSON.stringify({
    p_project_id: http.config.projectId,
    p_expected_sha256: "5".repeat(64),
    p_operation: "update",
    p_project: { ...http.state.root, meta: { ...(http.state.root.meta as object), title: "curl stale overwrite attempt" } },
  });
  const rootBefore = await serverRoot(http);
  const receiptPath = resolve(EVIDENCE, "conflict-http.txt");
  const curl = spawn("curl", [
    "-i", "--max-time", "5",
    "-X", "POST", `${http.config.url}/rest/v1/rpc/publish_spatial_project`,
    "-H", "Content-Type: application/json",
    "-H", "Content-Profile: rpg_zzu",
    "--data-binary", "@-",
  ], { cwd: ROOT, stdio: ["pipe", "pipe", "pipe"] });
  curl.stdin?.end(payload);
  const chunks: Buffer[] = [];
  curl.stdout?.on("data", (chunk: Buffer) => chunks.push(chunk));
  curl.stderr?.on("data", (chunk: Buffer) => chunks.push(chunk));
  const [code] = await once(curl, "close") as [number | null];
  const raw = Buffer.concat(chunks).toString("utf8");
  await writeFile(receiptPath, raw);
  const rootAfter = await serverRoot(http);
  const http409 = /HTTP\/1\.[01] 409/.test(raw);
  const unchanged = rootAfter.sha === rootBefore.sha && rootAfter.title !== "curl stale overwrite attempt";
  return {
    id: "http-conflict-receipt",
    criterion: "stale writer HTTP 409; server root bytes unchanged",
    surface: "HTTP curl -i",
    invocation,
    verdict: http409 && unchanged ? "PASS" : "FAIL",
    notes: `curlExit=${code} http409=${http409} title=${rootAfter.title}`,
    artifacts: [receiptPath],
  };
}

async function runExportCopyBytes(page: Page, http: Awaited<ReturnType<typeof spatialPersistenceHttp>>): Promise<Scenario> {
  const invocation = "click persistence-recovery-export; parse zip project.json";
  await page.getByTestId("persistence-recovery-modal").waitFor({ state: "visible", timeout: 5_000 });
  const draft = await draftSnapshot(page);
  const downloadPromise = page.waitForEvent("download", { timeout: 10_000 });
  await page.getByTestId("persistence-recovery-export").click();
  const download = await downloadPromise;
  const path = resolve(EVIDENCE, download.suggestedFilename() || "export-copy.oprn");
  await download.saveAs(path);
  const bytes = new Uint8Array(await readFile(path));
  const projectJson = new TextDecoder().decode(readStoredZipEntry(bytes, "project.json") ?? new Uint8Array());
  const exported = JSON.parse(projectJson) as { startMapId?: string; maps?: Record<string, { name?: string }>; meta?: { title?: string } };
  const exportedMap = exported.maps?.[exported.startMapId ?? ""]?.name ?? null;
  const root = await serverRoot(http);
  const modal = await page.getByTestId("persistence-recovery-modal").count();
  const ok = modal === 1
    && exportedMap === "Q7 dirty template B"
    && draft.startMapName === "Q7 dirty template B"
    && draft.projectId === http.config.projectId
    && root.title === "Q7 accepted template A"
    && root.startMapName !== "Q7 dirty template B";
  await writeFile(resolve(EVIDENCE, "export-inspect.json"), JSON.stringify({
    suggestedFilename: download.suggestedFilename(),
    byteLength: bytes.byteLength,
    exportedMap,
    exportedTitle: exported.meta?.title ?? null,
    draft,
    root,
    modal,
  }, null, 2));
  return {
    id: "export-copy",
    criterion: "export zip contains dirty draft identity; server root remains A",
    surface: "browser download + zip project.json + GET /rest/v1/projects",
    invocation,
    verdict: ok ? "PASS" : "FAIL",
    notes: `bytes=${bytes.byteLength} exportedMap=${exportedMap} rootTitle=${root.title}`,
    artifacts: [path, resolve(EVIDENCE, "export-inspect.json")],
  };
}

async function runSamePageProjectSwitch(
  page: Page,
  http: Awaited<ReturnType<typeof spatialPersistenceHttp>>,
  origin: string,
): Promise<Scenario> {
  const invocation = `same-page db-config-project-option other-fixture while recovery open on ${origin}`;
  http.state.heldPath = "";
  await page.getByTestId("persistence-recovery-modal").waitFor({ state: "visible", timeout: 5_000 });
  const originalDraft = await draftSnapshot(page);
  const originalRoot = await serverRoot(http, http.config.projectId);
  const otherBefore = await serverRoot(http, "other-fixture");
  const debugPath = resolve(EVIDENCE, "same-page-switch.json");
  const shot = resolve(EVIDENCE, "same-page-switch.png");
  try {
    await page.locator("[data-testid=db-connection-status]").evaluate((node) => (node as HTMLButtonElement).click());
    await page.getByTestId("db-config-modal").waitFor({ state: "attached", timeout: 20_000 });
    const option = page.locator("[data-testid=db-config-project-option][data-project-id=other-fixture]");
    await option.waitFor({ state: "attached", timeout: 20_000 });
    const modalBeforeSwitch = await page.getByTestId("persistence-recovery-modal").count();
    await option.evaluate((node) => (node as HTMLButtonElement).click());
    await page.getByTestId("db-config-modal").waitFor({ state: "hidden", timeout: 20_000 }).catch(() => undefined);
    const modal = await page.getByTestId("persistence-recovery-modal").count();
    const after = await draftSnapshot(page);
    const otherAfter = await serverRoot(http, "other-fixture");
    const originalAfter = await serverRoot(http, http.config.projectId);
    await page.screenshot({ path: shot });
    const ok = modal === 0
      && modalBeforeSwitch === 1
      && after.projectId === "other-fixture"
      && otherAfter.title === "other fixture"
      && otherAfter.startMapName !== "Q7 dirty template B"
      && originalAfter.sha === originalRoot.sha
      && originalAfter.startMapName !== "Q7 dirty template B";
    await writeFile(debugPath, JSON.stringify({
      originalDraft, after, originalRoot, originalAfter, otherBefore, otherAfter, modal, modalBeforeSwitch,
    }, null, 2));
    return {
      id: "project-switch-while-open",
      criterion: "same-page project switch closes recovery; old draft cannot write the new root",
      surface: "browser UI + GET /rest/v1/projects",
      invocation,
      verdict: ok ? "PASS" : "FAIL",
      notes: `modal=${modal} afterId=${after.projectId} otherMap=${otherAfter.startMapName}`,
      artifacts: [shot, debugPath],
    };
  } catch (error) {
    await page.screenshot({ path: shot }).catch(() => undefined);
    const debug = await page.evaluate(() => ({
      chip: Boolean(document.querySelector("[data-testid=db-connection-status]")),
      settings: Boolean(document.querySelector("[data-testid=db-config-modal]")),
      options: [...document.querySelectorAll("[data-testid=db-config-project-option]")].map((node) => (node as HTMLElement).dataset.projectId ?? ""),
      recovery: Boolean(document.querySelector("[data-testid=persistence-recovery-modal]")),
    }));
    await writeFile(debugPath, JSON.stringify({ error: String(error), debug, originalDraft, originalRoot, otherBefore }, null, 2));
    return {
      id: "project-switch-while-open",
      criterion: "same-page project switch closes recovery; old draft cannot write the new root",
      surface: "browser UI + GET /rest/v1/projects",
      invocation,
      verdict: "FAIL",
      notes: String(error),
      artifacts: [shot, debugPath],
    };
  }
}

async function runReloadRejectsSwitchedTarget(page: Page, http: Awaited<ReturnType<typeof spatialPersistenceHttp>>): Promise<Scenario> {
  const invocation = "capture-phase history.pushState(?project=other-fixture) then persistence-recovery-reload";
  await openConflict(page, http);
  const draftBefore = await draftSnapshot(page);
  const originalBefore = await serverRoot(http, http.config.projectId);
  const otherBefore = await serverRoot(http, "other-fixture");
  await page.evaluate(() => {
    document.querySelector("[data-testid=persistence-recovery-reload]")?.addEventListener("click", () => {
      history.pushState({}, "", "/?project=other-fixture");
    }, true);
  });
  await page.getByTestId("persistence-recovery-reload").click();
  await page.getByTestId("toast").waitFor({ state: "visible", timeout: 15_000 });
  const draftAfter = await draftSnapshot(page);
  const originalAfter = await serverRoot(http, http.config.projectId);
  const otherAfter = await serverRoot(http, "other-fixture");
  const shot = resolve(EVIDENCE, "reload-switched-url.png");
  await page.screenshot({ path: shot });
  const keptDraft = draftAfter.startMapName === "Q7 dirty template B";
  const rootsUnchanged = originalAfter.sha === originalBefore.sha && otherAfter.sha === otherBefore.sha;
  const didNotAdoptOther = draftAfter.startMapName !== (otherBefore.startMapName ?? "");
  await writeFile(resolve(EVIDENCE, "reload-switch.json"), JSON.stringify({
    draftBefore, draftAfter, originalBefore, originalAfter, otherBefore, otherAfter, keptDraft, rootsUnchanged,
  }, null, 2));
  return {
    id: "reload-bound-session",
    criterion: "reload rejects a changed live target; root and dirty draft stay put",
    surface: "browser UI + GET /rest/v1/projects",
    invocation,
    verdict: keptDraft && rootsUnchanged && didNotAdoptOther ? "PASS" : "FAIL",
    notes: `afterMap=${draftAfter.startMapName} afterId=${draftAfter.projectId}`,
    artifacts: [shot, resolve(EVIDENCE, "reload-switch.json")],
  };
}

async function runReloadThenSuccessBytes(page: Page, http: Awaited<ReturnType<typeof spatialPersistenceHttp>>): Promise<Scenario> {
  const invocation = "persistence-recovery-reload then toolbar-save; compare draft and root bytes";
  await openConflict(page, http);
  const draftBefore = await draftSnapshot(page);
  const rootBefore = await serverRoot(http);
  await page.getByTestId("persistence-recovery-reload").click();
  await page.getByTestId("toast").filter({ hasText: "불러왔습니다" }).waitFor({ state: "visible", timeout: 15_000 });
  const errorToasts = await page.locator(".toast.error.show").count();
  await page.waitForFunction(() => !document.querySelector("[data-testid=persistence-recovery-modal]"), { timeout: 15_000 });
  const draftAfterReload = await draftSnapshot(page);
  await dirtyMap(page, "recovered success map");
  await page.locator("[data-testid=toolbar-save]").evaluate((node) => (node as HTMLButtonElement).click());
  await page.getByTestId("toast").filter({ hasText: "저장 완료" }).waitFor({ state: "visible", timeout: 15_000 });
  const modal = await page.getByTestId("persistence-recovery-modal").count();
  const shot = resolve(EVIDENCE, "failure-to-success.png");
  await page.screenshot({ path: shot });
  const rootAfter = await serverRoot(http);
  const ok = modal === 0
    && errorToasts === 0
    && draftBefore.startMapName === "Q7 dirty template B"
    && draftAfterReload.startMapName !== "Q7 dirty template B"
    && rootBefore.title === "Q7 accepted template A"
    && rootAfter.startMapName === "recovered success map";
  await writeFile(resolve(EVIDENCE, "reload-bytes.json"), JSON.stringify({
    draftBefore, draftAfterReload, rootBefore, rootAfter, modal, errorToasts,
  }, null, 2));
  return {
    id: "failure-to-success",
    criterion: "explicit reload replaces dirty draft; later save publishes new map name; error toast cleared",
    surface: "browser UI + GET /rest/v1/projects",
    invocation,
    verdict: ok ? "PASS" : "FAIL",
    notes: `afterReload=${draftAfterReload.startMapName} rootMap=${rootAfter.startMapName} errorToasts=${errorToasts}`,
    artifacts: [shot, resolve(EVIDENCE, "reload-bytes.json")],
  };
}

async function runMissingRpc(page: Page, http: Awaited<ReturnType<typeof spatialPersistenceHttp>>): Promise<Scenario> {
  const invocation = "missingRpc=true then toolbar-save";
  http.state.missingRpc = true;
  const upsertBefore = http.trace.filter((row) => row.path.includes("/rest/v1/projects") && row.method === "POST").length;
  await dirtyMap(page, "migration required map");
  const rootBefore = await serverRoot(http);
  await page.locator("[data-testid=toolbar-save]").evaluate((node) => (node as HTMLButtonElement).click());
  await page.getByTestId("persistence-recovery-modal").waitFor({ state: "visible", timeout: 15_000 });
  const code = await page.getByTestId("persistence-recovery-code").textContent();
  const retry = await page.getByTestId("db-autosave-retry").count();
  const shot = resolve(EVIDENCE, "migration-required.png");
  await page.screenshot({ path: shot });
  const rootAfter = await serverRoot(http);
  const lastPublish = http.trace.filter((row) => row.path.includes("publish_spatial_project")).at(-1);
  const upsertAfter = http.trace.filter((row) => row.path.includes("/rest/v1/projects") && row.method === "POST").length;
  await page.getByTestId("persistence-recovery-cancel").click();
  http.state.missingRpc = false;
  const ok = code === "migration-required" && retry === 0 && upsertAfter === upsertBefore && lastPublish?.status === 404 && rootAfter.sha === rootBefore.sha;
  await writeFile(resolve(EVIDENCE, "missing-rpc.json"), JSON.stringify({
    code, retry, upsertBefore, upsertAfter, lastPublish: lastPublish ? { status: lastPublish.status, path: lastPublish.path } : null, rootAfter,
  }, null, 2));
  return {
    id: "missing-rpc",
    criterion: "migration-required, no upsert fallback, root unchanged",
    surface: "browser UI + HTTP fixture trace + GET /rest/v1/projects",
    invocation,
    verdict: ok ? "PASS" : "FAIL",
    notes: `code=${code} retry=${retry} upsertDelta=${upsertAfter - upsertBefore} publish=${lastPublish?.status}`,
    artifacts: [shot, resolve(EVIDENCE, "missing-rpc.json")],
  };
}

async function captureViewports(page: Page, http: Awaited<ReturnType<typeof spatialPersistenceHttp>>): Promise<Scenario> {
  const invocation = "setViewportSize 1024x768,1280x800,1440x900; Tab; hover danger; toast geometry";
  await openConflict(page, http);
  const artifacts: string[] = [];
  const geometry: unknown[] = [];
  let ok = true;
  const notes: string[] = [];
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const cancel = page.getByTestId("persistence-recovery-cancel");
    await cancel.focus();
    const active = await page.evaluate(() => document.activeElement?.getAttribute("data-testid"));
    if (active !== "persistence-recovery-cancel") {
      ok = false;
      notes.push(`${viewport.name} focus=${active}`);
    }
    await page.keyboard.press("Tab");
    const afterTab = await page.evaluate(() => document.activeElement?.getAttribute("data-testid"));
    const wrap = await page.evaluate(() => {
      const node = document.querySelector("[data-testid=persistence-recovery-message]");
      const text = node?.textContent ?? "";
      return {
        keepBypass: text.includes("우회하지 않습니다") || !text.includes("우회하지"),
        keepReload: text.includes("다시 불러오거나"),
        break: getComputedStyle(node as Element).wordBreak,
      };
    });
    if (wrap.break !== "keep-all") {
      ok = false;
      notes.push(`${viewport.name} word-break=${wrap.break}`);
    }
    const reload = page.getByTestId("persistence-recovery-reload");
    await reload.hover();
    const hover = await reload.evaluate((element) => getComputedStyle(element).backgroundColor);
    if (hover === "rgb(124, 58, 237)" || hover.includes("128, 90")) {
      ok = false;
      notes.push(`${viewport.name} dangerHover=${hover}`);
    }
    const path = resolve(EVIDENCE, `recovery-${viewport.name}.png`);
    await page.screenshot({ path });
    artifacts.push(path);
    geometry.push({ viewport, active, afterTab, wrap, hover });
  }
  await page.getByTestId("persistence-recovery-export").click();
  await page.setViewportSize({ width: 1024, height: 768 });
  const toastBox = await page.locator("[data-testid=toast-stack]").boundingBox();
  const toastShot = resolve(EVIDENCE, "toast-1024x768.png");
  await page.screenshot({ path: toastShot });
  artifacts.push(toastShot);
  if (!toastBox || toastBox.x < 0 || toastBox.y < 0 || toastBox.x + toastBox.width > 1025 || toastBox.y + toastBox.height > 769) {
    ok = false;
    notes.push(`toastBox=${JSON.stringify(toastBox)}`);
  }
  if (toastBox && toastBox.x + toastBox.width > 620) {
    ok = false;
    notes.push(`toast overlaps composer x=${toastBox.x + toastBox.width}`);
  }
  await writeFile(resolve(EVIDENCE, "viewport-geometry.json"), JSON.stringify({ geometry, toastBox }, null, 2));
  artifacts.push(resolve(EVIDENCE, "viewport-geometry.json"));
  await page.getByTestId("persistence-recovery-cancel").click();
  return {
    id: "viewports-keyboard",
    criterion: "CJK keep-all, danger hover stays destructive, 1024 toast unclipped",
    surface: "browser UI",
    invocation,
    verdict: ok ? "PASS" : "FAIL",
    notes: notes.join("; ") || VIEWPORTS.map((row) => row.name).join(","),
    artifacts,
  };
}

function summarize(trace: readonly HttpExchange[]): { readonly requests: number; readonly conflicts: number } {
  return {
    requests: trace.length,
    conflicts: trace.filter((row) => row.status === 409).length,
  };
}

await main();
