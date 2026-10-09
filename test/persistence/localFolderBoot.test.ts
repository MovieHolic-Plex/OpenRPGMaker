// 빈 로컬 폴더 부팅 회귀 테스트 — 패키징 앱 실측(2026-09-17):
// 호스트(앱·로컬 서버)가 폴더를 열어둔 채 렌더러를 띄우면 저장소에 문서가 없을 수 있다
// (방금 만든 새 프로젝트). 그때 store.load() 가 "작업을 찾지 못함" 오류로 떨어지면
// 온라인 선택지가 없는 앱이 DB 연결 화면에 갇힌다 — 빈 문서를 채택하고 첫 flush 가
// 폴더에 심는 게 맞는 계약이다.
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OprnBridge } from "@/project/persistence/electronRepository";

const DIR = "/projects/fresh";
const PROJECT_ID = "uuid-fresh";
const SHA = "a".repeat(64);

function fakeEmptyFolderBridge(saved: string[]): OprnBridge {
  return {
    closeIsHostDriven: true,
    companionOrigin: null,
    companionToken: null,
    assetBaseUrl: (projectId: string) => `oprn-asset://${projectId}/`,
    project: {
      status: async () => ({ kind: "ready", projectId: PROJECT_ID, projectDir: DIR }),
      probe: async () => true,
      open: async () => ({ projectId: PROJECT_ID, projectDir: DIR }),
      load: async () => null,
      save: async (payload) => {
        saved.push(payload.serialized);
        return { kind: "saved", sha256: SHA };
      },
      saveMapPatch: async () => ({ kind: "saved", sha256: SHA }),
      dataVersion: async () => 0,
      separateMedia: async () => ({ changed: false, migratedAssetIds: [], revision: 0 }),
      backup: async () => `${DIR}/backups/x.sqlite`,
      listBackups: async () => [],
      restoreBackup: async () => ({ projectDir: `${DIR}-recovered`, projectId: "restored", sha256: SHA, title: "복구 사본" }),
    },
    commits: {
      record: async () => ({ kind: "saved", commitId: "c1" }),
      list: async () => [],
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
      put: async (payload) => ({
        ref: { sha256: "b".repeat(64), mime: payload.mime, bytes: payload.bytes.byteLength, extension: payload.extension },
        dataUrl: null,
      }),
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
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("store.load — 비어 있는 로컬 폴더(새 프로젝트)", () => {
  it("빈 문서를 채택하고 첫 flush 가 폴더에 프로젝트를 심는다", async () => {
    const saved: string[] = [];
    vi.stubGlobal("window", {
      oprn: fakeEmptyFolderBridge(saved),
      addEventListener: () => {},
      location: {
        hostname: "127.0.0.1",
        href: "app://oprn/index.html",
        pathname: "/index.html",
        search: "",
        hash: "",
      },
      localStorage: {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined,
      },
      history: { replaceState: () => undefined, state: null },
    });
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("no remote in packaged app");
    }));
    vi.resetModules();

    const { adoptElectronOpenProject } = await import("@/project/persistence/repository");
    const { store } = await import("@/project/store");

    // 시작 화면 → 편집기 인계: 메인이 열어둔 폴더를 렌더러가 채택한다.
    expect(await adoptElectronOpenProject()).toBe(true);
    expect(store.hasAdoptedLocalProject()).toBe(true);
    expect(store.usesLocalProjectFolder()).toBe(true);

    await store.load();

    // DB 연결 화면이 아니라 편집기로 간다 — 저장 대상은 준비 상태, 문서는 미저장(dirty).
    expect(store.isLoaded()).toBe(true);
    expect(store.getDbPersistenceStatus().kind).toBe("ready");
    expect(store.hasUnsavedChanges()).toBe(true);

    const flushed = await store.flush();
    expect(flushed.kind).toBe("saved");
    expect(saved.length).toBe(1);

    // 심어진 문서가 실제 프로젝트로 역직렬화된다.
    const { deserialize } = await import("@/project/io");
    const doc = deserialize(saved[0]);
    expect(Object.keys(doc.maps).length).toBeGreaterThan(0);
    // 실제 store 를 부팅하고 빈 프로젝트 전체를 폴더에 심는다. 단독 실측(2026-09-26) 모듈 적재 9s · load 3.5s ·
    // flush 6.5s 로 기본 15s 를 넘긴다. 멈춤이 아니라 케이스 비용이라 이 케이스만 예산을 늘린다.
  }, 60_000);
});
