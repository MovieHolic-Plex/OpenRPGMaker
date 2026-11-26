/** @vitest-environment happy-dom */
// OPRN-OUT-027 — 새 맵 대화창의 「(루트)」는 없는 계층을 약속했다.
//
// 이 저장소의 맵 트리는 최상위가 **언제나 실제 맵 하나**다(`Project.mapTree`는 mapId 를 가진
// 단일 노드). 상위를 비워 만든 맵은 프로젝트 루트가 아니라 그 최상위 맵의 자식으로 저장된다.
// 「(루트)」는 형제 최상위 맵이 생긴다고 읽혔지만 실제로는 초기 맵의 하위였다.
//
// 결정된 방향은 "문구만 진실로"다 — 저장 구조는 손대지 않는다. 그래서 이 파일은 두 가지를
// 한꺼번에 못 박는다: (1) 보이는 글자가 실제 부모를 이름으로 말한다, (2) 그 항목으로 만든
// 트리 모양은 예전과 한 바이트도 다르지 않다. 문구 스윕은 대화창 하나로 끝나지 않으므로
// 맵 목록 헤더·끌기 손잡이·행 메뉴·조수 도구까지 같은 낱말을 쓰는지 함께 본다.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addChildMap } from "@/editor/actions";
import { editorState } from "@/editor/editorState";
import { openMapCreateDialog } from "@/editor/panels/mapCreateDialog";
import { closeMapContextMenu } from "@/editor/panels/mapContextMenu";
import { resetMapListUiStateForTests } from "@/editor/panels/mapList";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { resetMapPanelSectionForTests } from "@/editor/workspace/mapPanelSection";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { MapId, MapTreeNode } from "@/project/types";

function node<T extends HTMLElement = HTMLElement>(testId: string): T {
  const found = document.querySelector<T>(`[data-testid="${testId}"]`);
  if (!found) throw new Error(`Missing test control: ${testId}`);
  return found;
}

/** 노드 id 를 자리표로 바꿔 두 경로가 만든 트리 모양을 이름 없이 비교한다. */
function shapeWithout(node: MapTreeNode, replaced: MapId): unknown {
  return {
    mapId: node.mapId === replaced ? "<created>" : node.mapId,
    children: node.children.map((child) => shapeWithout(child, replaced)),
  };
}

function createdMapId(before: ReadonlySet<MapId>): MapId {
  const id = Object.keys(store.getCurrent().maps).find((mapId) => !before.has(mapId));
  if (!id) throw new Error("새 맵이 만들어지지 않았습니다");
  return id;
}

/** 대화창을 실제 컨트롤로 채워 만들고, 새 맵 id 를 돌려준다. */
function createThroughDialog(parentId: MapId | "", name: string): MapId {
  const before = new Set(Object.keys(store.getCurrent().maps));
  openMapCreateDialog();
  const parent = node<HTMLSelectElement>("map-create-parent");
  parent.value = parentId;
  parent.dispatchEvent(new Event("change", { bubbles: true }));
  const nameInput = node<HTMLInputElement>("map-create-name");
  nameInput.value = name;
  nameInput.dispatchEvent(new Event("input", { bubbles: true }));
  node("map-create-confirm").click();
  return createdMapId(before);
}

beforeEach(() => {
  document.body.replaceChildren();
  resetMapListUiStateForTests();
  resetMapPanelSectionForTests();
  const project = createBlankProject();
  store.replace(project);
  editorState.set({ currentMapId: project.startMapId, selectedEventId: null, selectedEventPageId: null });
});

afterEach(() => {
  closeMapContextMenu();
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  document.body.replaceChildren();
});

describe("새 맵 대화창의 상위 선택", () => {

  it("그 항목으로 만든 맵은 최상위 맵의 자식으로 저장된다(트리 모양 그대로)", () => {
    const before = structuredClone(store.getCurrent().mapTree);
    const created = createThroughDialog("", "새 하위");

    const after = store.getCurrent().mapTree;
    expect(after).toEqual({ ...before, children: [...before.children, { mapId: created, children: [] }] });
    expect(after.mapId).toBe(before.mapId);
  });

  it("빈 상위와 최상위 맵을 직접 고른 것은 같은 트리를 만든다 — 라벨이 거짓이 아니다", () => {
    const implicitRoot = store.getCurrent().mapTree.mapId;
    const implicitId = createThroughDialog("", "암묵");
    const implicitShape = shapeWithout(structuredClone(store.getCurrent().mapTree), implicitId);

    const project = createBlankProject();
    store.replace(project);
    editorState.set({ currentMapId: project.startMapId, selectedEventId: null, selectedEventPageId: null });
    const explicitId = createThroughDialog(store.getCurrent().mapTree.mapId, "명시");
    const explicitShape = shapeWithout(structuredClone(store.getCurrent().mapTree), explicitId);

    expect(implicitShape).toEqual(explicitShape);
    expect(store.getCurrent().mapTree.mapId).toBe(implicitRoot);
  });

  it("이미 계층이 있는 프로젝트에서 다른 가지는 건드리지 않는다", () => {
    const root = store.getCurrent().mapTree.mapId;
    const child = addChildMap(root, "집", { width: 12, height: 10 });
    const grandchild = addChildMap(child, "지하", { width: 10, height: 8 });
    const before = structuredClone(store.getCurrent().mapTree);

    const created = createThroughDialog("", "광장");

    const after = store.getCurrent().mapTree;
    expect(after.children.slice(0, before.children.length)).toEqual(before.children);
    expect(after.children.at(-1)).toEqual({ mapId: created, children: [] });
    const childNode = after.children.find((entry) => entry.mapId === child);
    expect(childNode?.children).toEqual([{ mapId: grandchild, children: [] }]);
  });
});

describe("조수 맵 트리 도구", () => {
  function ctx(): ToolContext {
    return { project: createBlankProject() };
  }

  it("빈 parentId 이동 요약도 최상위 맵 하위라고 보고한다(이동 결과는 그대로)", () => {
    const context = ctx();
    const root = context.project.mapTree.mapId;
    expect(runTool(context, "create_map", { name: "가게", width: 12, height: 10, id: "map_shop" }).ok).toBe(true);
    expect(runTool(context, "manage_map_tree", { operation: "create_folder", folderId: "folder_town", name: "마을", parentId: "" }).ok).toBe(true);
    expect(runTool(context, "manage_map_tree", { operation: "move", mapId: "map_shop", parentId: "folder_town" }).ok).toBe(true);

    const back = runTool(context, "manage_map_tree", { operation: "move", mapId: "map_shop", parentId: "" });
    expect(back.ok, back.summary).toBe(true);
    expect(back.summary).not.toContain("루트");
    expect(back.summary).toContain("최상위");
    // 문구만 바뀐다 — 빈 parentId 는 여전히 최상위 맵의 자식으로 넣는다.
    expect(context.project.mapTree.mapId).toBe(root);
    expect(context.project.mapTree.children.some((child) => child.mapId === "map_shop")).toBe(true);
  });
});
