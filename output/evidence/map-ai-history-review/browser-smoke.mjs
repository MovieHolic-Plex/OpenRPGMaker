import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { createServer } from "vite";
import { chromium } from "@playwright/test";

// Run from the worktree root. No editor project or remote records are modified.
const cacheDir = await mkdtemp(join(tmpdir(), "archive-review-vite-"));
const server = await createServer({
  configFile: false,
  cacheDir,
  resolve: { alias: { "@": resolve("src") } },
  server: { host: "127.0.0.1", port: 0 },
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(15_000);
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.route("**/__archive-review", route => route.fulfill({
    contentType: "text/html", body: "<!doctype html><html><body></body></html>",
  }));
  await page.goto(`${server.resolvedUrls.local[0]}__archive-review`);
  const result = await page.evaluate(async () => {
    const archive = await import("/src/ai/conversationStore.ts");
    const modal = await import("/src/editor/panels/aiConversationHistoryModal.ts");
    const db = await import("/src/ai/aiRecordDb.ts");
    const opened = [];
    const check = (condition, message) => { if (!condition) throw new Error(message); };
    const node = (root, id) => {
      const found = root.querySelector(`[data-testid="${id}"]`);
      check(found, `Missing ${id}`);
      return found;
    };
    const makeRecord = (id, savedAt, mapId) => ({
      id, title: id, model: "fixture", savedAt, projectContextKey: "archive-review",
      entries: [{ kind: "user", text: id, context: { mapId, mapName: mapId, mapWidth: 20, mapHeight: 15 } }],
    });
    const open = (scopeKey = "archive-review") => modal.openAiConversationHistoryModal({
      scopeKey, currentConversationId: "active-conversation", currentMapId: "map_a",
      knownMaps: [{ id: "map_a", name: "Map A" }], onOpen: record => opened.push(record.id),
    });
    const settled = modal.whenAiConversationHistoryModalSettled;
    for (let index = 0; index < 200; index += 1) {
      check((await archive.saveConversation(makeRecord(`new-a-${index}`, 1000 + index, "map_a"))).ok, "save failed");
    }
    check((await archive.saveConversation(makeRecord("older-deleted-map", 1, "map_gone"))).ok, "old save failed");
    check(await db.aiRecordBackendKind() === "indexeddb", "real IndexedDB is required");
    let root = open();
    await settled();
    check(node(root, "ai-history-filter-current").getAttribute("aria-pressed") === "true", "default changed");
    check(root.querySelectorAll('[data-testid="ai-history-row"]').length === 20, "page size changed");
    const gone = root.querySelector('[data-map-id="map_gone"]');
    check(gone, "201st record map not selectable");
    gone.click();
    await settled();
    check(root.querySelectorAll('[data-testid="ai-history-row"]').length === 1, "deleted-map filter failed");
    node(root, "ai-history-open").click();
    await settled();
    check(opened.join() === "older-deleted-map" && !root.isConnected, "whole-record open failed");

    root = open();
    await settled();
    const originalGet = IDBObjectStore.prototype.get;
    const failReads = () => {
      IDBObjectStore.prototype.get = function (...args) {
        if (this.name === "conversations") throw new DOMException("BROWSER_READ_FAILURE", "UnknownError");
        return originalGet.apply(this, args);
      };
    };
    failReads();
    try {
      node(root, "ai-history-open").click();
      await settled();
      const status = node(root, "ai-history-recover-status");
      check(status.dataset.state === "error" && !status.hidden, "read failure has no visible status");
      check(status.textContent.includes("BROWSER_READ_FAILURE"), "read error was lost");
      check(root.isConnected && opened.length === 1, "read failure adopted a conversation");
    } finally { IDBObjectStore.prototype.get = originalGet; }
    node(root, "ai-history-open").click();
    await settled();
    check(opened.join() === "older-deleted-map,new-a-199", "retry failed");

    root = open();
    await settled();
    const stale = root;
    failReads();
    try {
      node(stale, "ai-history-open").click();
      root = open("other-project");
      await settled();
      check(!stale.isConnected && root.isConnected, "replacement boundary failed");
      for (const element of [stale, root]) {
        const status = node(element, "ai-history-recover-status");
        check(status.dataset.state === "idle" && status.hidden, "stale error leaked");
      }
      check(opened.length === 2, "stale failure adopted a conversation");
    } finally { IDBObjectStore.prototype.get = originalGet; }
    modal.closeAiConversationHistoryModal();

    root = open();
    await settled();
    await archive.deleteConversationForScope("new-a-199", "archive-review");
    node(root, "ai-history-open").click();
    await settled();
    check(node(root, "ai-history-recover-status").dataset.state === "error", "missing record was silently lost");
    check(!node(root, "ai-history-recover-status").hidden && opened.length === 2, "missing record changed conversation");
    check(node(root, "ai-history-open").textContent.includes("new-a-198"), "missing record list was not refreshed");
    modal.closeAiConversationHistoryModal();
    await settled();
    return { backend: "indexeddb", seededRecords: 201, catalogAndWholeRecordOpen: true,
      readFailureAndRetry: true, staleFailureSuppression: true, missingRecordNotice: true, opened };
  });
  assert.deepEqual(pageErrors, []);
  console.log(JSON.stringify({ ...result, pageErrors }, null, 2));
} finally {
  await browser?.close();
  await server.close();
  await rm(cacheDir, { recursive: true, force: true });
}
