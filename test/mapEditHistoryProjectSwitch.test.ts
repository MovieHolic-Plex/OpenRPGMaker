/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getMapEditHistoryEntries,
  getMapEditHistoryState,
  recordMapEditIfChanged,
  recordProjectSnapshot,
  resetMapEditHistory,
  undoMapEdit,
} from "@/editor/mapEditHistory";
import { createBlankProject } from "@/project/defaults";
import { serialize } from "@/project/io";
import { store } from "@/project/store";
import { setTeamRole } from "@/project/teamAccess";
import type { Project } from "@/project/types";

function firstMapId(project: Project): string {
  const id = Object.keys(project.maps)[0];
  if (!id) throw new Error("fixture project has no maps");
  return id;
}

function currentMapName(): string {
  const project = store.getCurrent();
  return project.maps[firstMapId(project)]!.name;
}

function projectNamed(mapName: string): Project {
  const project = createBlankProject();
  project.maps[firstMapId(project)]!.name = mapName;
  return project;
}

function stubRemoteProject(project: Project): void {
  vi.stubEnv("VITE_LEGACY_DB_ANON_KEY", "test-anon-key");
  vi.stubEnv("VITE_LEGACY_DB_PROJECT_ID", "previous-project");
  vi.stubEnv("VITE_LEGACY_DB_URL", "http://dbserver:8100");
  const currentJson = JSON.parse(serialize(project));
  vi.stubGlobal("fetch", vi.fn<typeof fetch>(async (input) => {
    if (String(input).includes("/rest/v1/projects?")) {
      return new Response(JSON.stringify([{ current_json: currentJson, current_sha256: "test-sha" }]), { status: 200 });
    }
    return new Response("[]", { status: 200 });
  }));
}

beforeEach(() => {
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(projectNamed("이전 프로젝트 맵"));
  resetMapEditHistory();
});

afterEach(() => {
  setTeamRole(null);
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("project switch invalidates map edit history", () => {
  it("drops the undo stack when the project is replaced", () => {
    recordProjectSnapshot("맵 이름 변경");
    store.update((draft) => {
      draft.maps[firstMapId(draft)]!.name = "수정된 이전 맵";
    });
    expect(getMapEditHistoryState().canUndo).toBe(true);

    store.replaceProject(projectNamed("새 프로젝트 맵"));

    expect(getMapEditHistoryState().canUndo).toBe(false);
  });

  it("does not bring back the previous project's map data through undo", () => {
    recordProjectSnapshot("맵 이름 변경");
    store.update((draft) => {
      draft.maps[firstMapId(draft)]!.name = "수정된 이전 맵";
    });

    store.replaceProject(projectNamed("새 프로젝트 맵"));
    expect(currentMapName()).toBe("새 프로젝트 맵");

    expect(undoMapEdit()).toBe(false);
    expect(currentMapName()).toBe("새 프로젝트 맵");
  });

  it("still undoes a normal edit within the same project", () => {
    recordProjectSnapshot("맵 이름 변경");
    store.update((draft) => {
      draft.maps[firstMapId(draft)]!.name = "수정된 이전 맵";
    });
    expect(currentMapName()).toBe("수정된 이전 맵");

    expect(undoMapEdit()).toBe(true);
    expect(currentMapName()).toBe("이전 프로젝트 맵");
  });

  it("drops the undo stack after a transactional new remote project switch", async () => {
    stubRemoteProject(projectNamed("원격 기준 맵"));
    await expect(store.reconnectRemotePersistence()).resolves.toEqual({ kind: "connected", source: "remote" });
    resetMapEditHistory();
    recordProjectSnapshot("이전 프로젝트 편집");
    expect(getMapEditHistoryState().canUndo).toBe(true);
    const candidate = projectNamed("새 원격 프로젝트 맵");

    await store.loadNewRemoteProjectTransactionally(candidate, { projectId: "next-project" }, {
      createProjectId: () => "unused-project-id",
      saveTarget: async (project) => ({ kind: "saved", project }),
      reloadTarget: async () => structuredClone(candidate),
    });

    expect(getMapEditHistoryState().canUndo).toBe(false);
  });

  it("drops the undo stack after reconnecting to the selected remote project", async () => {
    stubRemoteProject(projectNamed("선택한 원격 프로젝트 맵"));
    recordProjectSnapshot("이전 프로젝트 편집");
    expect(getMapEditHistoryState().canUndo).toBe(true);

    await expect(store.reconnectRemotePersistence()).resolves.toEqual({ kind: "connected", source: "remote" });

    expect(getMapEditHistoryState().canUndo).toBe(false);
  });
});

describe("tile undo history bounds", () => {
  it("sheds two steps when the first large-map edit arrives, not the whole stack down to 25", () => {
    const mapId = firstMapId(store.getCurrent());
    for (let step = 0; step < 30; step += 1) {
      const recorded = recordMapEditIfChanged(mapId, () => {
        store.update((draft) => {
          const map = draft.maps[mapId];
          if (map) map.name = `history-${step}`;
        });
      });
      expect(recorded).toBe(true);
    }
    expect(getMapEditHistoryEntries()).toHaveLength(30);

    store.update((draft) => {
      const map = draft.maps[mapId];
      if (!map) return;
      map.width = 100;
      map.height = 100;
      map.lowerTiles = new Array<number>(10_000).fill(0);
      map.upperTiles = new Array<number>(10_000).fill(-1);
    });
    const recorded = recordMapEditIfChanged(mapId, () => {
      store.update((draft) => {
        const tiles = draft.maps[mapId]?.lowerTiles;
        if (tiles) tiles[0] = 3;
      });
    });

    expect(recorded).toBe(true);
    expect(getMapEditHistoryEntries()).toHaveLength(29);
  });

  it("keeps the undo step when the team role cannot write", () => {
    recordProjectSnapshot("뷰어 이전");
    store.update((draft) => {
      draft.meta.title = "남길 제목";
    });
    const previousBridge = window.oprn;
    window.oprn = { team: { projectId: "team-project" } } as typeof window.oprn;
    setTeamRole("viewer");

    expect(undoMapEdit()).toBe(false);
    expect(store.getCurrent().meta.title).toBe("남길 제목");
    expect(getMapEditHistoryState().canUndo).toBe(true);

    window.oprn = previousBridge;
    setTeamRole(null);
  });
});
