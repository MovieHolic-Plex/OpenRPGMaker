import { expect, type Page, type TestInfo } from "@playwright/test";
import { bootEditor, historySettled } from "./aiMapHistoryHarness";

// Run against a fixture-only Vite server (no .env.local/live credentials needed):
// VITE_SUPABASE_URL=https://history.invalid VITE_SUPABASE_ANON_KEY=fixture-only \
// VITE_SUPABASE_PROJECT_ID=history-startup-fixture VITE_SUPABASE_USE_PROXY=false \
// DEV_SERVER_PORT=<isolated-port> E2E_RETRIES=0 npx playwright test test/e2e/ai-map-history.spec.ts --grep 'startup catalog'
// Controls, panel ownership, archive queries and Chromium IndexedDB are production code.
// Only transport and delivery of one already-completed native read transaction are gated.

type CatalogGate = { entered: Promise<void>; release: () => void; restore: () => void };
declare global { interface Window { historyStartupFixture?: CatalogGate } }

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
async function bounded<T>(signal: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([signal, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("History fixture signal did not settle")), 5_000);
    })]);
  } finally { clearTimeout(timer); }
}

export async function startupRecoverRegression({ page }: { page: Page }, testInfo: TestInfo): Promise<void> {
  const forbidden: string[] = [], historyRequests: string[] = [];
  // No request from this test can reach a live provider or remote database.
  await page.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.origin === "http://127.0.0.1:17831" && ["/v1/browser/hello", "/v1/browser/next"].includes(url.pathname)) {
      return route.fulfill({ status: 503, json: { error: "offline fixture: no companion" } });
    }
    if (url.origin === new URL(testInfo.project.use.baseURL!).origin) {
      if (url.pathname === "/__oprn/edit-activity") return route.fulfill({ json: { ok: true } });
      if (!/^\/(api|__oprn)\//.test(url.pathname)) return route.continue();
    }
    forbidden.push(`${route.request().method()} ${url.origin}${url.pathname}`);
    return route.abort("blockedbyclient");
  });
  await bootEditor(page);
  const fixture = await page.evaluate(async () => {
    const panelPath: string = "/src/editor/panels/aiChatPanel.ts";
    const storePath: string = "/src/project/store.ts";
    const conversationPath: string = "/src/ai/conversationStore.ts";
    const configPath: string = "/src/project/supabaseProjectConfig.ts";
    const panel = await import(/* @vite-ignore */ panelPath) as typeof import("@/editor/panels/aiChatPanel");
    await panel.whenAiChatPanelSettled();
    const { store } = await import(/* @vite-ignore */ storePath) as typeof import("@/project/store");
    const { conversationScopeKey } = await import(/* @vite-ignore */ conversationPath) as typeof import("@/ai/conversationStore");
    const { supabaseProjectConfig } = await import(/* @vite-ignore */ configPath) as typeof import("@/project/supabaseProjectConfig");
    const config = supabaseProjectConfig();
    if (config?.url !== "https://history.invalid" || config.projectId !== "history-startup-fixture") {
      throw new Error("Use the documented offline fixture configuration, not a live project");
    }
    const project = store.getCurrent(), map = project.maps[project.startMapId]!;
    return { scope: conversationScopeKey(store.getProjectIdentity(), project), projectId: config.projectId,
      context: { mapId: map.id, mapName: map.name, mapWidth: map.width, mapHeight: map.height } };
  });
  const entries = [{ kind: "user", text: "STARTUP-RECOVER-REQUEST", context: fixture.context },
    { kind: "assistant", text: "STARTUP-RECOVER-ANSWER" }];
  const getEntered = deferred<void>(), releaseResponse = deferred<void>();
  await page.route("**/rest/v1/ai_conversations**", async route => {
    historyRequests.push(route.request().method());
    if (route.request().method() !== "GET") {
      forbidden.push("history import mirror");
      return route.fulfill({ status: 204 });
    }
    getEntered.resolve();
    await releaseResponse.promise;
    return route.fulfill({ json: [{ conversation_id: "startup-remote", project_id: fixture.projectId,
      project_context_key: fixture.scope, title: "STARTUP-RECOVER-REQUEST", model: "offline-fixture",
      saved_at: new Date(2_000).toISOString(), entries_json: entries }] });
  });
  const initialId = await page.getByTestId("ai-panel").getAttribute("data-ai-conversation-id");
  expect(initialId).toBeTruthy();
  const initialLog = await page.getByTestId("ai-chat-log").textContent();
  await page.evaluate(() => {
    const native = IDBDatabase.prototype.transaction;
    let resolveEntered!: () => void, release = () => {};
    const entered = new Promise<void>(resolve => { resolveEntered = resolve; });
    const restore = () => { IDBDatabase.prototype.transaction = native; };
    // Arm BEFORE clock click; do not hold a transaction open across networking.
    IDBDatabase.prototype.transaction = function (...args: Parameters<typeof native>) {
      const transaction = native.apply(this, args);
      if (this.name === "oprn-ai-records" && args[0] === "conversations" && args[1] === "readonly") {
        restore();
        transaction.addEventListener("complete", event => {
          event.stopImmediatePropagation();
          const completion = transaction.oncomplete;
          if (!completion) throw new Error("Native archive completion subscriber missing");
          release = () => { completion.call(transaction, event); };
          resolveEntered();
        }, { once: true, capture: true });
      }
      return transaction;
    };
    window.historyStartupFixture = { entered, release: () => release(), restore };
  });
  try {
    // Register exact catalog-completed signal before activating the real control.
    const held = page.evaluate(() => window.historyStartupFixture!.entered);
    // Bound signal delivery after Playwright has completed control actionability.
    // Both promises are owned immediately; UI actionability uses the suite's unchanged bound.
    await Promise.all([held, page.getByTestId("ai-map-history-open").click().then(() => bounded(held))]);
    await expect(page.getByTestId("ai-history-modal")).toBeVisible();
    expect(historyRequests).toEqual([]);
    await Promise.all([getEntered.promise, page.getByTestId("ai-history-recover").click().then(() => bounded(getEntered.promise))]);
    const status = page.getByTestId("ai-history-recover-status");
    expect(await status.getAttribute("data-state")).toBe("loading");
    await page.evaluate(async () => {
      const path: string = "/src/ai/aiRecordDb.ts";
      const { readAllAiRecords, AI_RECORD_STORES } = await import(/* @vite-ignore */ path) as typeof import("@/ai/aiRecordDb");
      window.historyStartupFixture!.release();
      // A new native transaction's completion is a task/microtask checkpoint:
      // the released catalog continuation runs before this signal. No delay/poll.
      await readAllAiRecords(AI_RECORD_STORES.conversations);
    });
    const stateAfterStartup = await status.getAttribute("data-state");
    releaseResponse.resolve();
    await historySettled(page);
    const retained = await page.evaluate(async ({ scope }) => {
      const path: string = "/src/ai/conversationStore.ts";
      const dbPath: string = "/src/ai/aiRecordDb.ts";
      const { loadConversationForScope } = await import(/* @vite-ignore */ path) as typeof import("@/ai/conversationStore");
      const { aiRecordBackendKind } = await import(/* @vite-ignore */ dbPath) as typeof import("@/ai/aiRecordDb");
      return { record: await loadConversationForScope("startup-remote", scope), backend: await aiRecordBackendKind() };
    }, fixture);
    await testInfo.attach("startup-recover-receipt", { body: JSON.stringify({ stateAfterStartup,
      state: await status.getAttribute("data-state"), retained, historyRequests, forbidden }, null, 2), contentType: "application/json" });
    expect(retained.record?.entries).toEqual(entries);
    expect(retained.backend).toBe("indexeddb");
    expect(stateAfterStartup).toBe("loading");
    expect(await status.getAttribute("data-state")).toBe("ok");
    await expect(status).toBeVisible();
    await expect(page.getByTestId("ai-history-row")).toHaveCount(1);
    await expect(page.getByTestId("ai-history-recover")).toBeEnabled();
    expect(await page.getByTestId("ai-panel").getAttribute("data-ai-conversation-id")).toBe(initialId);
    expect(await page.getByTestId("ai-chat-log").textContent()).toBe(initialLog);
    expect(historyRequests).toEqual(["GET"]); expect(forbidden).toEqual([]);
    await testInfo.attach("visible-recovery-success", { body: await page.screenshot(), contentType: "image/png" });
    // Recovery does not open. Only a subsequent shipped Open adopts the transcript.
    await page.getByTestId("ai-history-open").click();
    await historySettled(page);
    await expect(page.getByTestId("ai-history-modal")).toHaveCount(0);
    expect(await page.getByTestId("ai-panel").getAttribute("data-ai-conversation-id")).toBe("startup-remote");
    expect(await page.getByTestId("ai-chat-log").textContent()).toContain(entries[1]!.text);
    expect(historyRequests).toEqual(["GET"]); expect(forbidden).toEqual([]);
  } finally {
    releaseResponse.resolve();
    await page.evaluate(() => { window.historyStartupFixture?.release(); window.historyStartupFixture?.restore(); delete window.historyStartupFixture; });
  }
}
