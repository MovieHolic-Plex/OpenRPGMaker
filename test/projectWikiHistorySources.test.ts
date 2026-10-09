import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, expect, it, vi } from "vitest";
import { resetAiRecordDbForTest, writeAiRecords } from "@/ai/aiRecordDb";
import { projectWikiHistorySources } from "@/editor/projectWikiCoordinator";

vi.mock("@/project/store", () => ({ store: {
  getProjectIdentity: () => ({ kind: "remote", id: "P" }),
  getCurrent: () => ({ meta: { title: "P" }, startMapId: "A" }),
} }));
vi.mock("@/editor/mapEditHistory", () => ({ recordProjectSnapshot: vi.fn() }));
vi.mock("@/ai/projectWikiClient", () => ({ extractProjectWiki: vi.fn() }));

beforeEach(() => { globalThis.indexedDB = new IDBFactory(); resetAiRecordDbForTest(); });

it("Given more than 50 same-project conversations When wiki recovers Then every original source id survives without foreign sources", async () => {
  await writeAiRecords("conversations", Array.from({ length: 61 }, (_, index) => ({
    id: `wiki-${index}`, title: "wiki", model: "test", savedAt: index + 1, projectContextKey: index === 60 ? "remote:Q" : "remote:P",
    entries: [{ kind: "assistant", text: "answer" }, { kind: "user", text: `source-${index}` }],
  })));
  const sources = await projectWikiHistorySources();
  expect(sources.map(source => source.id)).toEqual(Array.from({ length: 60 }, (_, index) => `history:wiki-${index}:1`));
});
