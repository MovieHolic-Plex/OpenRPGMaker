import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initLocalProjectStore, type LocalProjectStore } from "../../electron/local-store/store";

let directory: string | undefined;
let store: LocalProjectStore | undefined;
afterEach(async () => { store?.close(); store = undefined; if (directory) await rm(directory, { recursive: true, force: true }); });
async function open() {
  directory = await mkdtemp(join(tmpdir(), "oprn-import-history-"));
  store = await initLocalProjectStore({ projectDir: directory }); return store;
}

describe("offline history import", () => {
  it("preserves structured JSON and imports every history family", async () => {
    const db = await open();
    db.importHistory({
      commits: [{ commit_id: "commit", created_at: "2026-09-21T00:00:00Z", diff_json: { maps: ["map"] } }],
      changes: [{ commit_id: "commit", entity_kind: "map", entity_id: "map", patch_json: { name: "saved" } }],
      aiActivityLogs: [{ log_id: "activity", channel: "chat", instruction: "hello", payload_json: { ok: true } }],
      aiConversations: [{ conversation_id: "conversation", title: "History", entries_json: [{ kind: "user", text: "hello" }] }],
      aiAnalysisRuns: [{ run_id: "analysis", selected_tile_ids_json: [1, 2], result_json: { ok: true } }],
    });
    expect(db.loadConversation("conversation")?.entries_json).toEqual([{ kind: "user", text: "hello" }]);
    expect(db.listActivity(10)).toHaveLength(1);
    expect(db.listCommits(10)).toHaveLength(1);
  });
  it("rolls back the complete batch when a later row conflicts", async () => {
    const db = await open();
    db.importHistory({ aiConversations: [{ conversation_id: "existing", entries_json: [] }] });
    expect(() => db.importHistory({
      aiActivityLogs: [{ log_id: "must-rollback", channel: "chat", payload_json: {} }],
      aiConversations: [{ conversation_id: "existing", entries_json: [] }],
    })).toThrow();
    expect(db.listActivity(10)).toEqual([]);
    expect(db.listConversations({ limit: 10 })).toHaveLength(1);
  });
});
