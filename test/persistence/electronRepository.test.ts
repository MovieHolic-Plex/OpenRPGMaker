import { afterEach, describe, expect, it, vi } from "vitest";
import { createHouseTemplateGalleryProject } from "@/project/defaults/defaultProject";
import { projectWithoutEventDrafts } from "@/project/eventDrafts";
import { serialize } from "@/project/io";
import { createElectronRepository, hasElectronBridge, type OprnBridge } from "@/project/persistence/electronRepository";
import { projectRepository } from "@/project/persistence/repository";
import { setUploadedAssetResolver } from "@/project/persistence/assetAccessors";

const PROJECT = projectWithoutEventDrafts(createHouseTemplateGalleryProject());
const SERIALIZED = serialize(PROJECT);
const SHA = "a".repeat(64);
const DIR = "/projects/demo";
const PROJECT_ID = "uuid-demo";

function fakeBridge(): OprnBridge {
  return {
    project: {
      status: async () => ({ kind: "ready", projectId: PROJECT_ID, projectDir: DIR }),
      probe: async () => true,
      open: async () => ({ projectId: PROJECT_ID, projectDir: DIR }),
      load: async () => ({ serialized: SERIALIZED, sha256: SHA, revision: 1 }),
      save: async () => ({ kind: "saved", sha256: SHA }),
      saveMapPatch: async () => ({ kind: "saved", sha256: SHA }),
      dataVersion: async () => 1,
      separateMedia: async () => ({ changed: false, migratedAssetIds: [], revision: 1 }),
      backup: async () => `${DIR}/backups/x.sqlite`,
    },
    commits: {
      record: async () => ({ kind: "saved", commitId: "c1" }),
      list: async () => [{ commitId: "c1", message: "요약", reviewStatus: "direct", authorId: null, authorKind: null, authorLabel: null, agentName: null, createdAt: null, summary: "요약" }],
      listSync: () => [],
    },
    ai: {
      recordActivity: async () => ({ kind: "saved" }),
      listActivity: async () => [],
      recordConversation: async () => ({ kind: "saved" }),
      listConversations: async () => [],
      loadConversation: async () => null,
      recordAnalysisRun: async () => ({ kind: "saved" }),
    },
    assets: {
      put: async (payload) => ({ ref: { sha256: "b".repeat(64), mime: payload.mime, bytes: payload.bytes.byteLength, extension: payload.extension }, dataUrl: null }),
      list: async () => [],
      read: async () => new Uint8Array([1, 2, 3]),
      pruneUnused: async () => [],
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  setUploadedAssetResolver(null);
});

describe("electron repository", () => {
  it("브리지가 있으면 Electron 어댑터를 고른다", () => {
    vi.stubGlobal("window", { oprn: fakeBridge() });

    expect(hasElectronBridge()).toBe(true);
    expect(projectRepository().kind).toBe("local");
    expect(projectRepository().supportsAssetRefs).toBe(true);
  });

  it("폴더를 열면 그 대상이 currentTarget 이 되고 저장·읽기가 브리지를 탄다", async () => {
    vi.stubGlobal("window", { oprn: fakeBridge() });
    const repository = createElectronRepository();
    const electron = repository as typeof repository & { open: (projectDir: string) => Promise<unknown> };

    await electron.open(DIR);

    expect(repository.currentTarget()).toEqual({ kind: "local", projectDir: DIR, projectId: PROJECT_ID });
    const status = repository.status(null);
    expect(status).toMatchObject({ kind: "ready", projectId: PROJECT_ID });

    const loaded = await repository.loadSnapshot({ kind: "local", projectDir: DIR, projectId: PROJECT_ID });
    expect(loaded?.sha256).toBe(SHA);
    expect(loaded?.project.meta.title).toBe(PROJECT.meta.title);

    const saved = await repository.save(PROJECT, { kind: "local", projectDir: DIR, projectId: PROJECT_ID });
    expect(saved).toMatchObject({ kind: "saved", sha256: SHA });

    expect(repository.assets.url("b".repeat(64))).toBe("oprn-asset://" + PROJECT_ID + "/" + "b".repeat(64));
  });

  it("열기 전에는 not-configured 다", () => {
    vi.stubGlobal("window", { oprn: fakeBridge() });
    const repository = createElectronRepository();

    expect(repository.currentTarget()).toBeNull();
    expect(repository.status(null).kind).toBe("not-configured");
  });
});
