/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// 사람 팀 협업은 꺼져 있다(2026-10-21). 이 파일은 잠든 팀 코드의 계약을 지키므로 스위치를 켠 채로 검사한다.
vi.mock("../electron/shared/teamCollab", () => ({ TEAM_COLLAB_ENABLED: true, TEAM_COLLAB_DEPRECATION_NOTE: "" }));
import {
  getMapEditHistoryEntries,
  getMapEditHistoryState,
  recordMapEditIfChanged,
  recordProjectSnapshot,
  resetMapEditHistory,
  undoMapEdit,
} from "@/editor/mapEditHistory";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { setTeamRole } from "@/project/teamAccess";
import type { Project } from "@/project/types";
import { installMemoryProjectSession, type MemoryProjectSession } from "./support/projectSession";

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

let session: MemoryProjectSession | null = null;

/**
 * The store no longer picks a LegacyDb repository from VITE_LEGACY_DB_* env (storage retirement; the canonical store is
 * the host SQLite behind ProjectRepository). Install a memory repository holding the selected project instead.
 */
async function stubRemoteProject(project: Project): Promise<void> {
  session = installMemoryProjectSession();
  await session.seed(project);
}

beforeEach(() => {
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(projectNamed("이전 프로젝트 맵"));
  resetMapEditHistory();
});

afterEach(() => {
  session?.dispose();
  session = null;
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

  // 「transactional new remote project switch」 는 뺐다 — store.loadNewRemoteProjectTransactionally 가 저장소 정리(LegacyDb 은퇴)로 없어졌다.

  it("drops the undo stack after reconnecting to the selected remote project", async () => {
    await stubRemoteProject(projectNamed("선택한 원격 프로젝트 맵"));
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
