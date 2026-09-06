import assert from "node:assert/strict";
import { expect, type Page, type Route, type Locator } from "@playwright/test";
import { serialize, deserialize } from "../../src/project/io";
import type { Project } from "../../src/project/types";
import type { RuntimeQaEventCommandOp, RuntimeQaEventObservation } from "../../scripts/lib/runtimeQa.d.mts";
import { armEventCommandObservation } from "../../scripts/lib/runtimeQaEventCommands.mjs";

const EXPORT = '[data-testid="project-export-json"]';
const DIALOG = '[data-testid="event-command-edit-dialog"]';

/** Observe real editor actions; callbacks must use the visible product controls. */
export async function observeEditorAction(page: Page, op: Omit<RuntimeQaEventCommandOp, "kind" | "trigger">, action: () => Promise<unknown>) {
  const observation: RuntimeQaEventCommandOp = { ...op, kind: "eventCommand", trigger: { kind: "none" } };
  await page.evaluate(armEventCommandObservation, observation);
  try {
    await page.evaluate(() => {
      if (!window.__eventCommandQa) throw new Error("Observation not armed");
      window.__eventCommandQa.start();
    });
    await action();
    const trace = await page.evaluate(async () => {
      if (!window.__eventCommandQa) throw new Error("Observation not armed");
      window.__eventCommandQa.check();
      return await window.__eventCommandQa.result;
    });
    assert.equal(trace.status, "success", JSON.stringify(trace));
    return trace;
  } finally {
    await page.evaluate(() => { window.__eventCommandQa?.abort(); delete window.__eventCommandQa; });
  }
}

/** Fresh, disposable context only. No remote seed API, retry loop or project writes. */
export async function enterLocalEditor(page: Page, project: Project, url: string) {
  assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname));
  const writes: string[] = [];
  // Do not intercept thousands of local module/asset GETs. Guard only network
  // destinations that can persist data; the local Vite module graph stays native.
  const persistenceRoute = (target: URL) =>
    /(?:supabase|dbserver|\/rest\/v1|\/projects?(?:\/|$))/i.test(target.href);
  const guard = async (route: Route) => {
    const request = route.request();
    const target = new URL(request.url());
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) {
      writes.push(`${request.method()} ${target.origin}${target.pathname}`);
      await route.abort("blockedbyclient");
    } else await route.continue();
  };
  await page.route(persistenceRoute, guard);
  await page.addInitScript((seed) => {
    localStorage.clear();
    localStorage.setItem("oprn:editor-ui-mode", "expert");
    window.__RPG_ZZU_E2E_PROJECT__ = seed;
  }, project);
  const ready: RuntimeQaEventCommandOp = { kind: "eventCommand", trigger: { kind: "none" }, timeoutMs: 120_000,
    observe: [
      { source: "dom", selector: '[data-testid="edit-canvas"] canvas', read: "present", equals: true },
      { source: "state", selector: EXPORT, path: ["project", "startMapId"], equals: project.startMapId },
    ] };
  // One init script guarantees subscribe/start ordering before editor boot.
  await page.addInitScript(`(${armEventCommandObservation.toString()})(${JSON.stringify(ready)}); window.__eventCommandQa.start();`);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 });
  const trace = await page.evaluate(async () => {
    if (!window.__eventCommandQa) throw new Error("Editor boot observation not armed");
    window.__eventCommandQa.check();
    const result = await window.__eventCommandQa.result;
    window.__eventCommandQa.abort(); delete window.__eventCommandQa;
    return result;
  });
  assert.equal(trace.status, "success", JSON.stringify(trace));
  // Keep the browser-native import out of the Node/SSR transform.
  const remote = await page.evaluate<boolean>(`(async () => {
    const { store } = await import("/src/project/store.ts");
    return store.isRemotePersistenceEnabled();
  })()`);
  assert.equal(remote, false);
  return {
    assertNoRemoteWrites: () => assert.deepEqual(writes, []),
    dispose: async () => { await page.unroute(persistenceRoute, guard); assert.deepEqual(writes, []); },
  };
}

export async function openMapCommand(page: Page, eventId = "host", path: readonly number[] = [0]) {
  await page.getByTestId("layer-event").click();
  await page.getByTestId("tool-event").click();
  await page.getByTestId(`event-list-row-${eventId}`).click();
  await page.getByTestId("event-editor-open").click();
  const toggle = page.getByTestId("event-view-toggle-list");
  if (await toggle.isVisible()) await toggle.click();
  await openCommandRow(page, page.getByTestId("event-editor-modal"), path);
}

export async function openCommandRow(page: Page, scope: Locator, path: readonly number[] = [0]) {
  // cmd-step is a span; select its real focusable cmd-head, then invoke the product shortcut.
  const head = scope.getByTestId(`event-command-step-${path.join("-")}`).locator("..");
  await head.click();
  await head.press("Space");
  await expect(page.getByTestId("event-command-edit-dialog")).toBeVisible();
}

export async function openDatabaseCommand(page: Page, context: "common" | "troop", id: string, path: readonly number[] = [0]) {
  // enterLocalEditor uses expert mode; the database lives on its toolbar, not the beginner tools menu.
  await page.getByTestId("toolbar-database").click();
  await page.getByTestId(context === "common" ? "db-tab-common-events" : "db-tab-troops").click();
  await page.getByTestId(context === "common" ? `db-common-event-row-${id}` : `db-record-row-${id}`).click();
  if (context === "troop") {
    const details = page.getByTestId("db-troop-event-details");
    if (await details.getAttribute("open") === null) await details.locator("summary").click();
    await page.getByTestId("db-troop-event-page-tab-1").click();
  }
  await openCommandRow(page, page.getByTestId(context === "common" ? "db-common-event-command-list" : "db-troop-event-command-list"), path);
}

export async function pickCommand(page: Page, entry: { readonly search: string; readonly commandId: string }, add: Locator) {
  await add.click();
  await page.getByTestId("event-command-picker-search").fill(entry.search);
  await page.getByTestId("event-command-picker-search-results").locator(`button[data-command-entry=${JSON.stringify(entry.commandId)}]`).click();
  await expect(page.getByTestId("event-command-edit-dialog")).toBeVisible();
}

export function projectObservation(path: readonly (string | number)[], equals: unknown): RuntimeQaEventObservation {
  return { source: "state", selector: EXPORT, path: ["project", ...path], equals };
}

export async function readEditorProject(page: Page): Promise<Project> {
  const text = await page.getByTestId("project-export-json").textContent();
  assert.ok(text);
  return deserialize(serialize(JSON.parse(text).project));
}

export async function confirmCommand(page: Page, context: "map" | "common" | "troop", observe: readonly RuntimeQaEventObservation[]) {
  const closed: RuntimeQaEventObservation = { source: "dom", selector: DIALOG, read: "present", equals: false };
  const trace = await observeEditorAction(page, { observe: context === "map" ? [closed] : [closed, ...observe], timeoutMs: 10_000 },
    () => page.getByTestId("event-command-edit-ok").click());
  if (context !== "map") return trace;
  // The export mirror deliberately excludes drafts: map Confirm is NOT a save.
  return await observeEditorAction(page, { observe, mutation: EXPORT, timeoutMs: 10_000 },
    () => page.getByTestId("event-editor-apply").click());
}

export async function cancelCommand(page: Page, saved: Project) {
  await observeEditorAction(page, { observe: [{ source: "dom", selector: DIALOG, read: "present", equals: false }], timeoutMs: 10_000 },
    () => page.getByTestId("event-command-edit-cancel").click());
  assert.deepEqual(await readEditorProject(page), saved);
}

export async function reimportProject(page: Page, saved: Project) {
  const json = serialize(saved);
  assert.deepEqual(deserialize(json), saved);
  await page.getByTestId("menu-project").click();
  const chooser = page.waitForEvent("filechooser", { timeout: 10_000 });
  await page.getByTestId("menu-project-import").click();
  const input = await chooser;
  await observeEditorAction(page, { observe: [projectObservation([], JSON.parse(json))], mutation: EXPORT, timeoutMs: 10_000 },
    () => input.setFiles({ name: "h0-temporary.json", mimeType: "application/json", buffer: Buffer.from(json) }));
  assert.deepEqual(await readEditorProject(page), saved);
  return json;
}
