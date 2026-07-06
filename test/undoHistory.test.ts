import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addDatabaseRecord,
  deleteDatabaseRecord,
  updateDatabaseRecord,
} from "@/editor/databaseActions";
import { newCommand } from "@/editor/eventActions";
import { handleHistoryHotkey } from "@/editor/hotkeys";
import {
  getMapEditHistoryEntries,
  getMapEditHistoryDebugEntries,
  getMapEditHistoryState,
  peekPreviousProject,
  recordProjectSnapshot,
  revertToHistoryIndex,
  redoMapEdit,
  resetMapEditHistory,
  undoMapEdit,
} from "@/editor/mapEditHistory";
import { createDatabaseCommandListActions } from "@/editor/panels/databaseCommandListAdapter";
import { createBlankMap, createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command } from "@/project/types";

beforeEach(() => {
  vi.unstubAllGlobals();
  store.replace(createBlankProject());
  resetMapEditHistory();
});

function itemName(id: string): string | undefined {
  return store.getCurrent().database.items.find((entry) => entry.id === id)?.name;
}

function itemCount(): number {
  return store.getCurrent().database.items.length;
}

describe("database record undo/redo", () => {
  it("restores and reapplies a record field edit through undo/redo", () => {
    const id = addDatabaseRecord("items");
    updateDatabaseRecord("items", id, { name: "검" });
    expect(itemName(id)).toBe("검");

    expect(undoMapEdit()).toBe(true);
    expect(itemName(id)).toBe("새 아이템");

    expect(redoMapEdit()).toBe(true);
    expect(itemName(id)).toBe("검");
  });

  it("undoes a record addition and deletion", () => {
    const baseline = itemCount();
    const id = addDatabaseRecord("items");
    expect(itemCount()).toBe(baseline + 1);

    // 삭제 → undo 로 복원.
    expect(deleteDatabaseRecord("items", id)).toEqual({ ok: true });
    expect(itemCount()).toBe(baseline);
    expect(undoMapEdit()).toBe(true);
    expect(itemCount()).toBe(baseline + 1);

    // 추가 자체도 undo 로 제거.
    expect(undoMapEdit()).toBe(true);
    expect(itemCount()).toBe(baseline);
  });

  it("coalesces consecutive edits to the same field into a single snapshot", () => {
    const id = addDatabaseRecord("items");
    // 같은 필드를 keystroke 처럼 여러 번 편집 → 스냅샷 1개만.
    updateDatabaseRecord("items", id, { name: "검" });
    updateDatabaseRecord("items", id, { name: "검 " });
    updateDatabaseRecord("items", id, { name: "검신" });
    expect(itemName(id)).toBe("검신");

    // 한 번의 undo 로 편집 시작 이전(기본 이름)으로 되돌아간다.
    expect(undoMapEdit()).toBe(true);
    expect(itemName(id)).toBe("새 아이템");

    // 그 다음 undo 는 레코드 추가 이전 상태.
    expect(undoMapEdit()).toBe(true);
    expect(store.getCurrent().database.items.find((entry) => entry.id === id)).toBeUndefined();
  });

  it("keeps separate snapshots for edits to different fields", () => {
    const id = addDatabaseRecord("items");
    updateDatabaseRecord("items", id, { name: "검" });
    updateDatabaseRecord("items", id, { price: 100 });
    expect(itemName(id)).toBe("검");
    expect(store.getCurrent().database.items.find((entry) => entry.id === id)?.price).toBe(100);

    expect(undoMapEdit()).toBe(true);
    expect(store.getCurrent().database.items.find((entry) => entry.id === id)?.price).toBe(0);
    expect(itemName(id)).toBe("검");

    expect(undoMapEdit()).toBe(true);
    expect(itemName(id)).toBe("새 아이템");
  });
});

describe("snapshot dedup", () => {
  it("does not push duplicate consecutive snapshots for identical state", () => {
    recordProjectSnapshot();
    recordProjectSnapshot();
    recordProjectSnapshot();
    expect(getMapEditHistoryState().canUndo).toBe(true);
    expect(undoMapEdit()).toBe(true);
    // 동일 상태 3회 기록이 1개로 dedup 되어 두 번째 undo 는 없다.
    expect(undoMapEdit()).toBe(false);
  });

  it("stores optional labels and keeps no-argument calls backward compatible", () => {
    const mapId = store.getCurrent().startMapId;
    recordProjectSnapshot("AI: 집 건설", mapId);
    store.update((project) => {
      project.maps[mapId].lowerTiles[0] = 101;
    });
    recordProjectSnapshot();

    const entries = getMapEditHistoryEntries();
    expect(entries[0]).toMatchObject({ label: "편집", mapId: null, current: true });
    expect(entries[1]).toMatchObject({ label: "AI: 집 건설", mapId, current: false });
    expect(entries[0]?.at).toBeGreaterThan(entries[1]?.at ?? -1);
  });

  it("peeks previous snapshots as clones and reverts to a history index", () => {
    const mapId = store.getCurrent().startMapId;
    recordProjectSnapshot("첫 변경", mapId);
    store.update((project) => {
      project.maps[mapId].lowerTiles[0] = 111;
    });
    const afterFirst = structuredClone(store.getCurrent());
    recordProjectSnapshot("둘째 변경", mapId);
    store.update((project) => {
      project.maps[mapId].lowerTiles[0] = 222;
    });

    const entries = getMapEditHistoryEntries();
    expect(entries.map((entry) => entry.label)).toEqual(["둘째 변경", "첫 변경"]);
    expect(entries[0]?.current).toBe(true);

    const peeked = peekPreviousProject();
    expect(peeked).toEqual(afterFirst);
    if (!peeked) throw new Error("expected peeked project");
    peeked.maps[mapId].lowerTiles[0] = 999;
    expect(peekPreviousProject()).toEqual(afterFirst);

    expect(revertToHistoryIndex(entries[0]?.index ?? -1)).toBe(true);
    expect(store.getCurrent()).toEqual(afterFirst);

    expect(redoMapEdit()).toBe(true);
    expect(store.getCurrent().maps[mapId].lowerTiles[0]).toBe(222);
  });

  it("stores map-kind snapshots as per-map history and keeps redo symmetric", () => {
    const project = store.getCurrent();
    const mapId = project.startMapId;
    const otherMap = createBlankMap("다른 맵", 12, 12);
    store.update((draft) => {
      draft.maps[otherMap.id] = otherMap;
      draft.mapTree.children.push({ mapId: otherMap.id, children: [] });
    });

    recordProjectSnapshot("현재 맵 칠하기", mapId, { kind: "map" });
    store.update((draft) => {
      draft.maps[mapId].lowerTiles[0] = 111;
      draft.maps[otherMap.id].lowerTiles[0] = 777;
    });

    expect(undoMapEdit()).toBe(true);
    expect(store.getCurrent().maps[mapId].lowerTiles[0]).not.toBe(111);
    expect(store.getCurrent().maps[otherMap.id].lowerTiles[0]).toBe(777);

    expect(redoMapEdit()).toBe(true);
    expect(store.getCurrent().maps[mapId].lowerTiles[0]).toBe(111);
    expect(store.getCurrent().maps[otherMap.id].lowerTiles[0]).toBe(777);
  });

  it("keeps single-map paint history well below full-project snapshot volume", () => {
    const base = createBlankProject();
    for (let index = 1; index < 10; index += 1) {
      const map = createBlankMap(`메모리 맵 ${index}`, 24, 24);
      base.maps[map.id] = map;
      base.mapTree.children.push({ mapId: map.id, children: [] });
    }
    store.replace(base);
    resetMapEditHistory();

    const mapId = store.getCurrent().startMapId;
    for (let index = 0; index < 50; index += 1) {
      recordProjectSnapshot(`페인트 ${index}`, mapId, { kind: "map" });
      store.update((project) => {
        project.maps[mapId].lowerTiles[index] = index + 100;
      });
    }

    const entries = getMapEditHistoryDebugEntries();
    const mapSnapshotBytes = entries.reduce((sum, entry) => sum + entry.serializedLength, 0);
    const projectBytes = JSON.stringify(store.getCurrent()).length;

    expect(entries).toHaveLength(50);
    expect(entries.every((entry) => entry.kind === "map" && entry.mapId === mapId)).toBe(true);
    // 전체 프로젝트 50벌은 projectBytes * 50에 가깝다. 10맵 프로젝트에서 단일 맵 50벌은
    // 대략 1/10 수준이므로, 직렬화 오버헤드를 감안해도 projectBytes * 5 미만이어야 한다.
    expect(mapSnapshotBytes).toBeLessThan(projectBytes * 5);
  });
});

describe("database-hosted command list undo (common events)", () => {
  function seedCommonEvent(): string {
    const id = "ce_test";
    store.update((project) => {
      project.commonEvents.push({ id, name: "테스트 공용", trigger: "none", commands: [] });
    });
    return id;
  }

  function commonEventCommands(id: string): Command[] {
    return store.getCurrent().commonEvents.find((entry) => entry.id === id)?.commands ?? [];
  }

  it("undoes a command added to a common event", () => {
    const id = seedCommonEvent();
    const actions = createDatabaseCommandListActions({
      get commands() {
        return commonEventCommands(id);
      },
      replaceCommands: (next) => {
        store.update((project) => {
          const target = project.commonEvents.find((entry) => entry.id === id);
          if (target) target.commands = structuredClone(next);
        });
      },
    });

    actions.addCommand([], newCommand("wait"));
    expect(commonEventCommands(id)).toHaveLength(1);

    expect(undoMapEdit()).toBe(true);
    expect(commonEventCommands(id)).toHaveLength(0);

    expect(redoMapEdit()).toBe(true);
    expect(commonEventCommands(id)).toHaveLength(1);
  });
});

describe("handleHistoryHotkey", () => {
  function keyEvent(
    key: string,
    opts: { ctrl?: boolean; shift?: boolean; target?: unknown } = {}
  ): KeyboardEvent {
    return {
      key,
      ctrlKey: opts.ctrl ?? true,
      metaKey: false,
      altKey: false,
      shiftKey: Boolean(opts.shift),
      target: opts.target,
      preventDefault: () => {},
    } as unknown as KeyboardEvent;
  }

  it("undoes on Ctrl+Z and redoes on Ctrl+Y / Ctrl+Shift+Z", () => {
    const id = addDatabaseRecord("items");
    updateDatabaseRecord("items", id, { name: "검" });

    expect(handleHistoryHotkey(keyEvent("z"))).toBe(true);
    expect(itemName(id)).toBe("새 아이템");

    expect(handleHistoryHotkey(keyEvent("y"))).toBe(true);
    expect(itemName(id)).toBe("검");

    expect(handleHistoryHotkey(keyEvent("z", { shift: true }))).toBe(false);
    // 편집 시작 전 상태(추가만 남음)로 undo 후 redo(shift+z) 로 되돌린다.
    expect(handleHistoryHotkey(keyEvent("z"))).toBe(true);
    expect(itemName(id)).toBe("새 아이템");
    expect(handleHistoryHotkey(keyEvent("z", { shift: true }))).toBe(true);
    expect(itemName(id)).toBe("검");
  });

  it("ignores the shortcut while a text input is focused", () => {
    class FakeInput {
      tagName = "INPUT";
      isContentEditable = false;
    }
    vi.stubGlobal("HTMLElement", FakeInput);
    const id = addDatabaseRecord("items");
    updateDatabaseRecord("items", id, { name: "검" });

    expect(handleHistoryHotkey(keyEvent("z", { target: new FakeInput() }))).toBe(false);
    expect(itemName(id)).toBe("검");
  });

  it("does not handle plain keys without a modifier", () => {
    expect(handleHistoryHotkey(keyEvent("z", { ctrl: false }))).toBe(false);
  });
});
