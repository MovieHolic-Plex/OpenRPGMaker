import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import { createStoreHandlers } from "../../electron/main/dispatch";
import { createProjectSessionRegistry } from "../../electron/main/sessions";
import { OPRN_CHANNELS as C } from "../../electron/shared/channels";
import { createStarterBlankProject } from "@/project/defaults";
import { ensureBundledTilesets } from "@/project/defaults/defaultAssets";
import { serialize } from "@/project/io";
import { createElectronRepository } from "@/project/persistence/electronRepository";
import { setProjectRepositoryForTest } from "@/project/persistence/repository";
import { store } from "@/project/store";

const note = { id: "author-note", name: "내 메모", markdown: "이 프로젝트의 계단 배치" };

it.each(["empty folder", "legacy full tilesets"] as const)(
  "boot normalizes a starter from %s and saves and reopens the renderer's patch",
  async source => {
    const dir = await mkdtemp(join(tmpdir(), "oprn-starter-patch-"));
    const sessions = createProjectSessionRegistry();
    const windowId = 1;
    try {
      const session = await sessions.open(windowId, dir);
      const handlers = createStoreHandlers(sessions);
      const ipc = (channel: string) => vi.fn((input?: unknown) => handlers[channel]!(windowId, input));
      const project = {
        status: ipc(C.projectStatus), loadFolded: ipc(C.projectLoadFolded), tilesetBlobs: ipc(C.projectTilesetBlobs),
        save: ipc(C.projectSave), saveMapPatch: ipc(C.projectSaveMapPatch),
      };
      vi.stubGlobal("window", { location: new URL("app://oprn/index.html"), oprn: { project, commits: { list: ipc(C.commitsList), record: ipc(C.commitsRecord) } } });
      const repository = createElectronRepository();
      setProjectRepositoryForTest(repository);
      if (source === "legacy full tilesets") {
        // The QA row predates the beodeul-objects category. Its full inline list already ends in stair-entrance.
        const starter = createStarterBlankProject();
        ensureBundledTilesets(starter);
        const city = starter.tilesets.beodeul_city!;
        city.referenceDocuments = city.referenceDocuments!.filter(category => category.id !== "beodeul-objects");
        city.referenceDocuments = city.referenceDocuments.map(category => category.id === "stair-entrance"
          ? { ...category, documents: [...category.documents, note] } : category);
        await session.store.saveSerialized(serialize(starter, { inlineBundledTilesets: true }));
      }
      expect(await repository.adoptOpenProject()).toBe(true);
      await store.load({ deferBootNormalization: true });
      await store.whenBootNormalized();
      if (source === "empty folder") {
        expect((await store.flush()).kind).toBe("saved");
        expect(project.save).toHaveBeenCalledOnce();
        // An editor can move a category and add a page. The next save goes through saveMapPatch.
        store.update(p => {
          const city = p.tilesets.beodeul_city!;
          const docs = city.referenceDocuments!;
          const moved = docs.find(category => category.id === "beodeul-objects")!;
          city.referenceDocuments = [...docs.filter(category => category !== moved), { ...moved, documents: [...moved.documents, note] }];
        });
      }
      const expected = store.getCurrent().tilesets.beodeul_city!.referenceDocuments!;
      expect(expected.at(-1)?.id).toBe("beodeul-objects");
      expect((await store.flush()).kind).toBe("saved");
      expect(project.saveMapPatch).toHaveBeenCalledTimes(1);
      expect(project.saveMapPatch.mock.calls[0]![0]).not.toHaveProperty("baseSerialized");
      expect(store._getPersistedBaselineForTest()!.tilesets.beodeul_city!.referenceDocuments?.at(-1)?.id).toBe("beodeul-objects");
      store.update(p => { p.meta.title = "다시 저장"; });
      expect((await store.flush()).kind).toBe("saved");
      const reopened = session.store.loadSnapshot()!.project;
      expect(reopened.meta.title).toBe("다시 저장");
      const docs = reopened.tilesets.beodeul_city!.referenceDocuments!;
      expect(docs.map(category => category.id)).toEqual(expected.map(category => category.id));
      expect(docs.flatMap(category => category.documents).filter(doc => doc.id === note.id)).toEqual([note]);

      store.update(p => { p.meta.title = "버릴 변경"; });
      const revision = session.store.info().revision;
      store.leaveProjectSession();
      expect(store.hasUnsavedChanges()).toBe(false);
      expect((await store.flush()).kind).toBe("not-loaded");
      expect(session.store.info().revision).toBe(revision);
    } finally {
      store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false });
      await store.flush();
      setProjectRepositoryForTest(null);
      vi.unstubAllGlobals();
      sessions.close(windowId);
      await rm(dir, { recursive: true, force: true });
    }
  }, 120_000,
);

it("refuses late saves from the previous folder after the window switches", async () => {
  const dir = await mkdtemp(join(tmpdir(), "oprn-folder-switch-"));
  const sessions = createProjectSessionRegistry();
  const windowId = 1;
  try {
    const previous = await sessions.open(windowId, join(dir, "old"));
    const handlers = createStoreHandlers(sessions);
    const next = await sessions.open(windowId, join(dir, "new"));
    const payload = { projectDir: previous.projectDir, expectedSha: null, serialized: "{}", patch: {} };
    for (const channel of [C.projectSave, C.projectSaveMapPatch]) {
      await expect(handlers[channel]!(windowId, payload)).rejects.toThrow("저장 대상 프로젝트 폴더가 바뀌었습니다");
    }
    expect(next.store.loadSnapshot()).toBeNull();
  } finally {
    sessions.close(windowId);
    await rm(dir, { recursive: true, force: true });
  }
});
