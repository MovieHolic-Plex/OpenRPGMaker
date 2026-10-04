import { afterEach, describe, expect, it, vi } from "vitest";
import { createHouseTemplateGalleryProject } from "@/project/defaults/defaultProject";
import { projectWithoutEventDrafts } from "@/project/eventDrafts";
import { serialize } from "@/project/io";
import { createElectronRepository, hasElectronBridge, type OprnBridge } from "@/project/persistence/electronRepository";
import { adoptElectronOpenProject, projectRepository } from "@/project/persistence/repository";
import { setUploadedAssetResolver } from "@/project/persistence/assetAccessors";

const PROJECT = projectWithoutEventDrafts(createHouseTemplateGalleryProject());
const SERIALIZED = serialize(PROJECT);
const SHA = "a".repeat(64);
const DIR = "/projects/demo";
const PROJECT_ID = "uuid-demo";

function fakeBridge(): OprnBridge {
  return {
    closeIsHostDriven: true,
    companionOrigin: "http://127.0.0.1:1234",
    companionToken: "test-companion-token",
    assetBaseUrl: (projectId: string) => `oprn-asset://${projectId}/`,
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
      listBackups: async () => [],
      restoreBackup: async () => ({ projectDir: `${DIR}-recovered`, projectId: "restored", sha256: SHA, title: "복구 사본" }),
    },
    commits: {
      record: async () => ({ kind: "saved", commitId: "c1" }),
      list: async () => [{ commitId: "c1", message: "요약", reviewStatus: "direct", authorId: null, authorKind: null, authorLabel: null, agentName: null, createdAt: null, summary: "요약" }],
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
    lifecycle: {
      onFlushBeforeClose: () => {},
      flushDone: async () => true,
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  setUploadedAssetResolver(null);
});

describe("electron repository", () => {
  it("분리된 사본 저장은 전송 중 원본의 다음 변경과 섞이지 않는다", async () => {
    const live = { ...PROJECT, meta: { ...PROJECT.meta, title: "제출 당시" } };
    const bridge = fakeBridge();
    let accept!: () => void;
    let sent = "";
    bridge.project.save = async (payload) => {
      sent = payload.serialized;
      await new Promise<void>(resolve => { accept = resolve; });
      return { kind: "saved", sha256: SHA };
    };
    vi.stubGlobal("window", { oprn: bridge });
    const repository = createElectronRepository();
    await repository.open(DIR);
    const pending = repository.save(live, { kind: "local", projectDir: DIR, projectId: PROJECT_ID });
    live.meta.title = "전송 중 편집";
    accept();
    const result = await pending;
    expect(JSON.parse(sent).meta.title).toBe("제출 당시");
    expect(result).toMatchObject({ kind: "saved", project: { meta: { title: "제출 당시" } } });
    expect(live.meta.title).toBe("전송 중 편집");
  });

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

  it("백업은 브리지로 폴더 사본을 만든다", async () => {
    vi.stubGlobal("window", { oprn: fakeBridge() });
    const repository = createElectronRepository();
    await repository.open(DIR);

    await expect(repository.backup?.()).resolves.toContain("backups");
  });

  it("열기 전에는 not-configured 다", () => {
    vi.stubGlobal("window", { oprn: fakeBridge() });
    const repository = createElectronRepository();

    expect(repository.currentTarget()).toBeNull();
    expect(repository.status(null).kind).toBe("not-configured");
  });

  it("브리지가 알려준 열린 폴더를 채택한다 — 시작 화면에서 넘어온 편집기 부팅 경로", async () => {
    vi.stubGlobal("window", { oprn: fakeBridge() });
    const repository = createElectronRepository();

    expect(repository.currentTarget()).toBeNull();
    expect(await repository.adoptOpenProject()).toBe(true);
    expect(repository.currentTarget()).toEqual({ kind: "local", projectDir: DIR, projectId: PROJECT_ID });
    expect(repository.status(null)).toMatchObject({ kind: "ready", projectId: PROJECT_ID });
    await expect(repository.loadSnapshot({ kind: "local", projectDir: DIR, projectId: PROJECT_ID })).resolves.toMatchObject({ sha256: SHA });
  });

  it("메인에 열린 세션이 없으면 채택하지 않는다", async () => {
    const bridge = fakeBridge();
    vi.stubGlobal("window", { oprn: { ...bridge, project: { ...bridge.project, status: async () => ({ kind: "not-configured" }) } } });
    const repository = createElectronRepository();

    expect(await repository.adoptOpenProject()).toBe(false);
    expect(repository.currentTarget()).toBeNull();
    expect(repository.status(null).kind).toBe("not-configured");
  });

  it("부팅 채택은 브리지가 없으면 no-op 이다", async () => {
    vi.stubGlobal("window", {});

    expect(await adoptElectronOpenProject()).toBe(false);
  });
});

describe("folded host loads", () => {
  // 호스트 접힌 행: 타일셋 칸은 {"$blob":sha} 표식, 본문은 tilesetBlobs 로 준다(electron/local-store/tilesetFold.ts).
  function foldedBridge(project: typeof PROJECT) {
    const bodies = new Map<string, string>();
    const tilesets: Record<string, { $blob: string }> = {};
    Object.keys(project.tilesets).forEach((id, index) => {
      const sha = index.toString(16).padStart(64, "0");
      bodies.set(sha, JSON.stringify(project.tilesets[id]));
      tilesets[id] = { $blob: sha };
    });
    const folded = JSON.stringify({ ...JSON.parse(serialize(project)), tilesets });
    const requested: string[][] = [];
    const bridge = fakeBridge();
    bridge.project.loadFolded = async () => ({ folded, sha256: SHA, revision: 1 });
    bridge.project.tilesetBlobs = async ({ sha256s }) => { requested.push([...sha256s]); return Object.fromEntries(sha256s.map(sha => [sha, bodies.get(sha)!])); };
    return { bridge, requested };
  }

  it("팀 변경 반영은 바뀌지 않은 타일셋을 다시 받거나 파싱하지 않고, 제자리에서 고친 타일셋은 다시 푼다", async () => {
    const { bridge, requested } = foldedBridge(PROJECT);
    vi.stubGlobal("window", { oprn: bridge });
    const repository = createElectronRepository();
    await (repository as typeof repository & { open: (dir: string) => Promise<unknown> }).open(DIR);
    const target = { kind: "local" as const, projectDir: DIR, projectId: PROJECT_ID };
    const first = await repository.loadSnapshot(target);
    const ids = Object.keys(PROJECT.tilesets);
    expect(ids.length).toBeGreaterThan(1);
    expect(requested.flat().length).toBeGreaterThan(0);
    requested.length = 0;

    // 편집기가 한 타일셋을 제자리에서 고쳤다(계약 위반이어도 틀린 문서를 재사용하면 안 된다).
    const edited = ids[0]!;
    first!.project.tilesets[edited]!.name = "제자리 수정";
    const second = await repository.loadSnapshot(target);
    for (const id of ids.slice(1)) expect(second!.project.tilesets[id]).toBe(first!.project.tilesets[id]);
    expect(second!.project.tilesets[edited]).not.toBe(first!.project.tilesets[edited]);
    expect(second!.project.tilesets[edited]!.name).toBe(PROJECT.tilesets[edited]!.name);
    // IndexedDB 가 없는 시험 환경이라 다시 푸는 타일셋만 호스트에 다시 묻는다.
    expect(requested.flat()).toEqual(["0".padStart(64, "0")]);
    expect(serialize(second!.project)).toBe(serialize(PROJECT));
  });
});
