import { describe, expect, it, afterEach, vi } from "vitest";
import { createScarloxyDemoProject } from "@/project/defaults/defaultProject";
import type { GameMap, Project } from "@/project/types";
import { changedMapIdsBetween, mapSaveConflicts, mergeProjectMaps } from "@/project/persistence/core/mapMerge";
import { createStarterBlankProject } from "@/project/defaults";
import { projectWithoutEventDrafts } from "@/project/eventDrafts";
import { deserialize, serialize } from "@/project/io";
import { createElectronRepository, hasElectronBridge, type OprnBridge } from "@/project/persistence/electronRepository";
import { adoptElectronOpenProject, projectRepository, setProjectRepositoryForTest } from "@/project/persistence/repository";
import { setUploadedAssetResolver } from "@/project/persistence/assetAccessors";
import type { ProjectRepository } from "@/project/persistence/types";
import { prepareProjectMedia } from "@/project/persistence/prepareProjectMedia";
import { isolateTimers } from "../mergedTeardown";
import { mapPatchChangeSet, planMapPatch, readMapPatchSnapshot } from "@/project/persistence/core/mapPatch";

describe("mapMerge", () => {
  isolateTimers();
  describe("mapMerge", () => {
    isolateTimers();
    function mapIds(project: Project): [string, string] {
      const [first, second] = Object.keys(project.maps);
      if (!first || !second) throw new Error("fixture needs two maps");
      return [first, second];
    }
    function renamed(project: Project, mapId: string, name: string): GameMap {
      const map = project.maps[mapId];
      if (!map) throw new Error(`expected map ${mapId}`);
      return { ...map, name };
    }
    describe("mapMerge core", () => {
      it("키 순서만 다른 맵은 바뀐 것으로 보지 않는다 (jsonb 왕복)", () => {
        const base = createScarloxyDemoProject();
        const [mapId] = mapIds(base);
        const reordered = structuredClone(base);
        const map = reordered.maps[mapId];
        if (!map) throw new Error("expected map");
        reordered.maps[mapId] = Object.fromEntries(Object.entries(map).reverse()) as unknown as GameMap;
        expect(changedMapIdsBetween(base, reordered)).toEqual([]);
      });

      it("서로 다른 맵을 고친 두 편집은 충돌이 아니고, 병합 결과에 둘 다 남는다", () => {
        const base = createScarloxyDemoProject();
        const [mineId, theirsId] = mapIds(base);
        const mine = structuredClone(base);
        mine.maps[mineId] = renamed(mine, mineId, "내 맵");
        const latest = structuredClone(base);
        latest.maps[theirsId] = renamed(latest, theirsId, "남의 맵");
        const changed = changedMapIdsBetween(base, mine);
        expect(changed).toEqual([mineId]);
        expect(mapSaveConflicts(base, mine, latest, changed)).toEqual([]);
        const merged = mergeProjectMaps(latest, mine, changed, []);
        expect(merged.maps[mineId]?.name).toBe("내 맵");
        expect(merged.maps[theirsId]?.name).toBe("남의 맵");
      });

      it("같은 맵을 다르게 고치면 그 맵만 충돌로 돌려준다", () => {
        const base = createScarloxyDemoProject();
        const [mapId] = mapIds(base);
        const mine = structuredClone(base);
        mine.maps[mapId] = renamed(mine, mapId, "내 맵");
        const latest = structuredClone(base);
        latest.maps[mapId] = renamed(latest, mapId, "남의 맵");
        const changed = changedMapIdsBetween(base, mine);
        expect(mapSaveConflicts(base, mine, latest, changed)).toEqual([{ mapId, name: "내 맵" }]);
      });

      it("최신본과 같은 내용으로 고친 편집은 충돌이 아니다", () => {
        const base = createScarloxyDemoProject();
        const [mapId] = mapIds(base);
        const mine = structuredClone(base);
        mine.maps[mapId] = renamed(mine, mapId, "같은 이름");
        const latest = structuredClone(mine);
        expect(mapSaveConflicts(base, mine, latest, changedMapIdsBetween(base, mine))).toEqual([]);
      });
    });
  });
  describe("electronRepository", () => {
    isolateTimers();
    const PROJECT = projectWithoutEventDrafts(createScarloxyDemoProject());
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
      it("keeps authored edits out during a folder switch and accepts them again on cancellation", async () => {
        const { store } = await import("@/project/store");
        const first = store.holdProjectEdits();
        const second = store.holdProjectEdits();
        const edit = vi.fn();
        try {
          store.update(edit);
          first();
          first();
          store.update(edit);
          expect(edit).not.toHaveBeenCalled();

          second();
          store.update(edit);
          expect(edit).toHaveBeenCalledOnce();
        } finally {
          first();
          second();
        }
      });

      it("skips an empty document patch and keeps the last successful save time", async () => {
        const bridge = fakeBridge();
        const save = vi.spyOn(bridge.project, "save").mockResolvedValue({ kind: "saved", sha256: SHA, revision: 1 });
        const savePatch = vi.spyOn(bridge.project, "saveMapPatch");
        const now = vi.spyOn(Date, "now");
        const { store } = await import("@/project/store");
        vi.stubGlobal("window", { oprn: bridge });
        const repository = createElectronRepository();
        setProjectRepositoryForTest(repository);

        try {
          await repository.open(DIR);
          store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: true, disabledReason: null });
          store.replaceProject(createStarterBlankProject());
          store.update(() => {}); // Normalize the fixture before taking the first baseline.
          store._setPersistenceStateForTest({ loaded: true });

          now.mockReturnValue(10_000);
          await expect(store.flush()).resolves.toMatchObject({ kind: "saved", receipt: expect.anything() });
          expect(store.getAutoSaveState()).toEqual({ kind: "saved", at: 10_000 });

          now.mockReturnValue(20_000);
          store.update(() => {});
          expect(store.hasUnsavedChanges()).toBe(true);
          await expect(store.flush()).resolves.toEqual({ kind: "saved", written: false });
          expect(save).toHaveBeenCalledTimes(1);
          expect(savePatch).not.toHaveBeenCalled();
          expect(store.hasUnsavedChanges()).toBe(false);
          expect(store.getAutoSaveState()).toEqual({ kind: "saved", at: 10_000 });
          expect(store.isOwnSavedHostRevision(1)).toBe(true);

          store.update(project => { project.meta.title = "실제 편집"; });
          await expect(store.flush()).resolves.toMatchObject({ kind: "saved" });
          expect(savePatch).toHaveBeenCalledTimes(1);
          expect(store.getAutoSaveState()).toEqual({ kind: "saved", at: 20_000 });
        } finally {
          now.mockRestore();
          store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
          await store.flush();
          setProjectRepositoryForTest(null);
        }
      }, 60_000);

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

      it.each(["save", "saveMapPatch"] as const)("keeps the new folder's baseline after a late %s response", async (method) => {
        const bridge = fakeBridge();
        const nextDir = `${DIR}-next`;
        const nextSha = "b".repeat(64);
        bridge.project.open = async ({ projectDir }) => ({ projectDir, projectId: projectDir });
        bridge.project.load = async ({ projectDir }) => ({ serialized: SERIALIZED, sha256: projectDir === DIR ? SHA : nextSha, revision: 1 });
        let markStarted!: () => void;
        const started = new Promise<void>(resolve => { markStarted = resolve; });
        let release!: () => void;
        const wait = new Promise<void>(resolve => { release = resolve; });
        vi.spyOn(bridge.project, method).mockImplementationOnce(async () => {
          markStarted();
          await wait;
          return { kind: "saved", sha256: SHA };
        });
        vi.stubGlobal("window", { oprn: bridge });
        const repository = createElectronRepository();
        const target = await repository.open(DIR);
        await repository.loadSnapshot(target);
        const edited = { ...PROJECT, meta: { ...PROJECT.meta, title: "Edit in the first folder" } };
        const pending = method === "save"
          ? repository.save(edited, target)
          : repository.saveMapPatch!({ baseProject: PROJECT, project: edited }, target);
        await started;
        try {
          const next = await repository.open(nextDir);
          await repository.loadSnapshot(next);
          release();
          await expect(pending).resolves.toMatchObject({ kind: "saved" });

          const save = vi.spyOn(bridge.project, "save");
          await repository.save(PROJECT, next);
          expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ projectDir: nextDir, expectedSha: nextSha }));
        } finally {
          release();
        }
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
        // 로드는 기본값 생략·빠진 얼굴 채우기를 한다 — 기준은 같은 글을 한 번 읽은 내용이다.
        expect(serialize(second!.project)).toBe(serialize(deserialize(SERIALIZED)));
      });
    });
  });
  describe("prepareProjectMedia", () => {
    isolateTimers();
    const target = { kind: "local", projectDir: "/fixture", projectId: "one" } as const;
    const ref = { sha256: "a".repeat(64), extension: "png", mime: "image/png", bytes: 3 };
    function fixture() {
      const original = { id: "pixels", name: "소재", kind: "sprite" as const, dataUrl: "data:image/png;base64,AQID", meta: { frames: 1 } };
      const project = { assets: { uploaded: { pixels: original } } } as unknown as Project;
      const put = vi.fn(async () => ({ ref, dataUrl: null }));
      const repository = { supportsAssetRefs: true, currentTarget: () => target, assets: { put } } as unknown as ProjectRepository;
      return { project, original, repository, put };
    }
    describe("seed media before folder adoption", () => {
      it("실제 바이트를 파일 저장에 넘기고 원본 소재 레코드는 유지한다", async () => {
        const { project, original, repository, put } = fixture();
        await prepareProjectMedia(project, repository);
        expect(put).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]), { mime: "image/png", extension: "png", originalName: "소재", kind: "sprite" });
        expect(project.assets.uploaded.pixels).toMatchObject({ ref, meta: { frames: 1 } });
        expect(project.assets.uploaded.pixels?.dataUrl).toBeUndefined();
        expect(original.dataUrl).toBe("data:image/png;base64,AQID");
      });
      it("파일 저장 실패는 프로젝트 채택 전에 전파되고 소재를 지우지 않는다", async () => {
        const { project, repository, put } = fixture();
        put.mockRejectedValueOnce(new Error("disk full"));
        await expect(prepareProjectMedia(project, repository)).rejects.toThrow("disk full");
        expect(project.assets.uploaded.pixels?.dataUrl).toBeDefined();
        expect(project.assets.uploaded.pixels?.ref).toBeUndefined();
      });
      it("소재 준비 중 폴더가 바뀌면 중단한다", async () => {
        const { project, repository } = fixture();
        let active: typeof target | { kind: "local"; projectDir: string; projectId: string } = target;
        const put = vi.fn(async () => { active = { kind: "local", projectDir: "/other", projectId: "two" }; return { ref, dataUrl: null }; });
        const changed = { ...repository, currentTarget: () => active, assets: { ...repository.assets, put } };
        await expect(prepareProjectMedia(project, changed)).rejects.toThrow("폴더가 바뀌었습니다");
        expect(project.assets.uploaded.pixels?.ref).toBeUndefined();
      });
      it("같은 경로의 프로젝트 ID가 바뀌어도 중단한다", async () => {
        const { project, repository } = fixture();
        let active: { kind: "local"; projectDir: string; projectId: string } = target;
        const put = vi.fn(async () => { active = { ...target, projectId: "replacement" }; return { ref, dataUrl: null }; });
        const changed = { ...repository, currentTarget: () => active, assets: { ...repository.assets, put } };
        await expect(prepareProjectMedia(project, changed)).rejects.toThrow("폴더가 바뀌었습니다");
        expect(project.assets.uploaded.pixels?.ref).toBeUndefined();
      });
    });
  });
});

describe("mapPatch", () => {
  isolateTimers();
  function mapIds(project: Project): [string, string] {
    const [first, second] = Object.keys(project.maps);
    if (!first || !second) throw new Error("fixture needs two maps");
    return [first, second];
  }
  function renamed(project: Project, mapId: string, name: string): GameMap {
    const map = project.maps[mapId];
    if (!map) throw new Error(`expected map ${mapId}`);
    return { ...map, name };
  }
  /** 서버가 돌려주는 모양: 직렬화 → JSON 왕복(jsonb 처럼 키 순서가 바뀔 수 있다). */
  function asStoredJson(project: Project): unknown {
    return JSON.parse(serialize(projectWithoutEventDrafts(project)));
  }
  describe("planMapPatch", () => {
    // 호스티드 러너에서 단독으로도 15~17초 걸린다(ci-vitest-files 45671861464, ci-full 45620536375) — 기본 15초 대신 60초.
    it("비겹침 편집은 후보를 만들고 후보에 최신본의 다른 맵이 남는다", async () => {
      const base = createScarloxyDemoProject();
      const [mineId, theirsId] = mapIds(base);
      const mine = structuredClone(base);
      mine.maps[mineId] = renamed(mine, mineId, "내 맵");
      const latest = structuredClone(base);
      latest.maps[theirsId] = renamed(latest, theirsId, "남의 맵");

      const plan = await planMapPatch(mapPatchChangeSet(base, mine), readMapPatchSnapshot(asStoredJson(latest)));

      expect(plan.kind).toBe("candidate");
      if (plan.kind !== "candidate") return;
      expect(plan.mergedProject.maps[mineId]?.name).toBe("내 맵");
      expect(plan.mergedProject.maps[theirsId]?.name).toBe("남의 맵");
      expect(plan.wire.serialized).toBe(serialize(plan.mergedProject));
      expect(plan.wire.sha256).toMatch(/^[0-9a-f]{64}$/);
    }, 60_000);

    it("같은 맵의 다른 편집은 충돌이다", async () => {
      const base = createScarloxyDemoProject();
      const [mapId] = mapIds(base);
      const mine = structuredClone(base);
      mine.maps[mapId] = renamed(mine, mapId, "내 맵");
      const latest = structuredClone(base);
      latest.maps[mapId] = renamed(latest, mapId, "남의 맵");

      const plan = await planMapPatch(mapPatchChangeSet(base, mine), readMapPatchSnapshot(asStoredJson(latest)));

      expect(plan).toEqual({ kind: "conflict", conflicts: [{ mapId, name: "내 맵" }] });
    });

    it("최신본이 없으면(첫 저장) 기준본을 최신본으로 써서 후보를 만든다", async () => {
      const base = createScarloxyDemoProject();
      const [mapId] = mapIds(base);
      const mine = structuredClone(base);
      mine.maps[mapId] = renamed(mine, mapId, "내 맵");
      const changeSet = mapPatchChangeSet(base, mine);

      const plan = await planMapPatch(changeSet, changeSet.canonicalBase);

      expect(plan.kind).toBe("candidate");
    });

    it("호출자가 changedMapIds 를 주면 그 목록만 병합한다", async () => {
      const base = createScarloxyDemoProject();
      const [mineId, otherId] = mapIds(base);
      const mine = structuredClone(base);
      mine.maps[mineId] = renamed(mine, mineId, "내 맵");
      mine.maps[otherId] = renamed(mine, otherId, "안 보낼 편집");
      const changeSet = mapPatchChangeSet(base, mine, [mineId]);

      const plan = await planMapPatch(changeSet, changeSet.canonicalBase);

      expect(plan.kind).toBe("candidate");
      if (plan.kind !== "candidate") return;
      expect(plan.mergedProject.maps[otherId]?.name).toBe(base.maps[otherId]?.name);
    });
  });
});
