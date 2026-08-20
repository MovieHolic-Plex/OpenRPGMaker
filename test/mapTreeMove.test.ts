import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addMap, addMapFolder, duplicateMap, moveMapInTree } from "@/editor/actions";
import { editorState } from "@/editor/editorState";
import {
  canReparentMap,
  extractTreeNode,
  findTreeNode,
  insertTreeNode,
  isMapTreeFolder,
  repairMapTreeOrphans,
  selectionRoots,
} from "@/project/mapTree";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { MapTreeNode } from "@/project/types";

function townTree(): MapTreeNode {
  return {
    mapId: "world",
    children: [
      {
        mapId: "town",
        children: [
          { mapId: "shop", children: [] },
          { mapId: "inn", children: [] },
        ],
      },
      { mapId: "forest", children: [] },
    ],
  };
}

describe("extractTreeNode / insertTreeNode", () => {
  it("extracts a parent with its subtree intact", () => {
    const root = townTree();
    const town = extractTreeNode(root, "town");
    expect(town?.mapId).toBe("town");
    expect(town?.children.map((child) => child.mapId)).toEqual(["shop", "inn"]);
    expect(findTreeNode(root, "town")).toBeNull();
    expect(findTreeNode(root, "shop")).toBeNull();
    expect(findTreeNode(root, "forest")?.mapId).toBe("forest");
  });

  it("inserts the extracted subtree under a new parent", () => {
    const root = townTree();
    const town = extractTreeNode(root, "town");
    expect(town).not.toBeNull();
    expect(insertTreeNode(root, town!, "forest")).toBe(true);
    expect(findTreeNode(root, "forest")?.children[0]?.mapId).toBe("town");
    expect(findTreeNode(root, "shop")?.mapId).toBe("shop");
    expect(findTreeNode(root, "inn")?.mapId).toBe("inn");
  });

  it("inserts as a root sibling at a given index", () => {
    const root = townTree();
    const forest = extractTreeNode(root, "forest");
    expect(forest).not.toBeNull();
    expect(insertTreeNode(root, forest!, "", 0)).toBe(true);
    expect(root.children.map((child) => child.mapId)).toEqual(["forest", "town"]);
  });

  it("rejects reparenting onto a descendant", () => {
    const root = townTree();
    expect(canReparentMap(root, "town", "shop")).toBe(false);
    expect(canReparentMap(root, "town", "forest")).toBe(true);
    expect(canReparentMap(root, "town", "")).toBe(true);
    expect(canReparentMap(root, "world", "forest")).toBe(false);
  });
});

describe("moveMapInTree store action", () => {
  beforeEach(() => {
    const project = createBlankProject();
    store.replace(project);
    editorState.set({ currentMapId: project.startMapId, selectedEventId: null, selectedEventPageId: null });
  });

  afterEach(() => {
    store.replace(createBlankProject());
  });

  it("moves a parent map without flattening its children", () => {
    const houseId = addMap("집");
    const interiorId = addMap("내부");
    const loftId = addMap("다락");
    moveMapInTree(interiorId, houseId);
    moveMapInTree(loftId, interiorId);
    const otherId = addMap("광장");

    moveMapInTree(houseId, otherId);

    const tree = store.getCurrent().mapTree;
    const other = findTreeNode(tree, otherId);
    const house = findTreeNode(tree, houseId);
    const interior = findTreeNode(tree, interiorId);
    expect(other?.children.some((child) => child.mapId === houseId)).toBe(true);
    expect(house?.children.map((child) => child.mapId)).toEqual([interiorId]);
    expect(interior?.children.map((child) => child.mapId)).toEqual([loftId]);
  });

  it("moves a map to the root list when parent is empty", () => {
    const houseId = addMap("집");
    const interiorId = addMap("내부");
    moveMapInTree(interiorId, houseId);

    moveMapInTree(interiorId, "");

    const tree = store.getCurrent().mapTree;
    expect(tree.children.some((child) => child.mapId === interiorId)).toBe(true);
    expect(findTreeNode(tree, houseId)?.children).toEqual([]);
  });

  it("does not nest a map under its own descendant", () => {
    const houseId = addMap("집");
    const interiorId = addMap("내부");
    moveMapInTree(interiorId, houseId);

    moveMapInTree(houseId, interiorId);

    const tree = store.getCurrent().mapTree;
    expect(findTreeNode(tree, houseId)?.children.map((child) => child.mapId)).toEqual([interiorId]);
    expect(findTreeNode(tree, interiorId)?.children).toEqual([]);
  });

  it("duplicates a map as the next sibling, not a child", () => {
    const houseId = addMap("집");
    const copyId = duplicateMap(houseId);
    const tree = store.getCurrent().mapTree;
    const houseIndex = tree.children.findIndex((child) => child.mapId === houseId);
    expect(tree.children[houseIndex + 1]?.mapId).toBe(copyId);
    expect(findTreeNode(tree, houseId)?.children).toEqual([]);
  });

  it("places a map before a sibling when index is given", () => {
    const firstId = addMap("첫째");
    const secondId = addMap("둘째");
    moveMapInTree(secondId, "", 0);
    const ids = store.getCurrent().mapTree.children.map((child) => child.mapId);
    expect(ids.indexOf(secondId)).toBeLessThan(ids.indexOf(firstId));
  });

  it("keeps folder nodes when repairing orphans", () => {
    const folderId = addMapFolder("", "던전");
    expect(isMapTreeFolder(findTreeNode(store.getCurrent().mapTree, folderId)!)).toBe(true);
    const next = store.getCurrent();
    expect(repairMapTreeOrphans(next)).toBe(false);
    expect(findTreeNode(next.mapTree, folderId)?.name).toBe("던전");
    expect(next.maps[folderId]).toBeUndefined();
    expect(selectionRoots(next.mapTree, [folderId, next.startMapId])).toEqual([folderId]);
  });
});
