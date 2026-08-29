import { beforeEach, describe, expect, it } from "vitest";
import {
  getMapEditHistoryState,
  recordProjectSnapshot,
  resetMapEditHistory,
  undoMapEdit,
} from "@/editor/mapEditHistory";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
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

beforeEach(() => {
  store.replace(projectNamed("이전 프로젝트 맵"));
  resetMapEditHistory();
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
});
