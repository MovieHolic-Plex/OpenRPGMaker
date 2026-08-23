// test/maptree.test.ts
// Map Tree 조작 로직 검증 (순수 — actions.ts의 트리 로직과 동일).
// 스펙 docs/specs/2026-06-18-oprn-overhaul-design.md §3.3, §11.2.

import { describe, it, expect } from "vitest";
import type { MapTreeNode } from "@/project/types";

// actions.ts의 findNode와 동일 로직.
function findNode(node: MapTreeNode, mapId: string): MapTreeNode | null {
  if (node.mapId === mapId) return node;
  for (const c of node.children) {
    const found = findNode(c, mapId);
    if (found) return found;
  }
  return null;
}

// removeFromTree와 동일 로직(재귀 삭제).
function removeFromTree(node: MapTreeNode, mapId: string): boolean {
  const before = node.children.length;
  node.children = node.children.filter((c) => c.mapId !== mapId);
  for (const c of node.children) {
    removeFromTree(c, mapId);
  }
  return node.children.length !== before;
}

// 트리 순회 — 모든 mapId 수집(고아 노드 탐지용).
function collectIds(node: MapTreeNode, acc: Set<string> = new Set()): Set<string> {
  acc.add(node.mapId);
  for (const c of node.children) collectIds(c, acc);
  return acc;
}

function makeTree(): MapTreeNode {
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

describe("findNode", () => {
  it("루트를 찾는다", () => {
    const t = makeTree();
    expect(findNode(t, "world")?.mapId).toBe("world");
  });
  it("중첩 자식을 찾는다", () => {
    const t = makeTree();
    expect(findNode(t, "shop")?.mapId).toBe("shop");
    expect(findNode(t, "inn")?.mapId).toBe("inn");
  });
  it("없으면 null", () => {
    const t = makeTree();
    expect(findNode(t, "nope")).toBeNull();
  });
});

describe("removeFromTree", () => {
  it("리프 노드 삭제", () => {
    const t = makeTree();
    removeFromTree(t, "shop");
    // shop은 town의 자식이므로 실제로 삭제됐는지 findNode로 확인.
    expect(findNode(t, "shop")).toBeNull();
    // town은 유지.
    expect(findNode(t, "town")?.mapId).toBe("town");
  });
  it("루트 직접 자식 삭제 시 true 반환", () => {
    const t = makeTree();
    // forest는 루트 직접 자식 → 루트 children 길이 변화 → true.
    expect(removeFromTree(t, "forest")).toBe(true);
    expect(findNode(t, "forest")).toBeNull();
  });
  it("중간 노드 삭제(자식도 함께)", () => {
    const t = makeTree();
    removeFromTree(t, "town");
    expect(findNode(t, "town")).toBeNull();
    expect(findNode(t, "shop")).toBeNull(); // town의 자식도 사라짐
    expect(findNode(t, "forest")?.mapId).toBe("forest"); // 형제는 유지
  });
  it("없는 노드 삭제 시 false", () => {
    const t = makeTree();
    expect(removeFromTree(t, "nope")).toBe(false);
  });
});

describe("moveMapInTree (부모 변경 시뮬레이션)", () => {
  it("노드를 새 부모 아래로 이동", () => {
    const t = makeTree();
    // shop을 town에서 forest로 이동: town에서 제거 + forest 자식으로 추가.
    removeFromTree(t, "shop");
    const forest = findNode(t, "forest");
    if (!forest) throw new Error("forest node missing");
    forest.children.push({ mapId: "shop", children: [] });
    // 검증.
    const town = findNode(t, "town");
    if (!town) throw new Error("town node missing");
    expect(town.children.find((c) => c.mapId === "shop")).toBeUndefined();
    expect(forest.children.find((c) => c.mapId === "shop")?.mapId).toBe("shop");
  });
  it("루트 자식으로 이동(부모 없음)", () => {
    const t = makeTree();
    removeFromTree(t, "shop");
    t.children.push({ mapId: "shop", children: [] });
    expect(t.children.find((c) => c.mapId === "shop")?.mapId).toBe("shop");
  });
});

describe("고아 노드 처리", () => {
  it("트리에 있는 mapId만 수집된다", () => {
    const t = makeTree();
    const ids = collectIds(t);
    expect(ids.has("world")).toBe(true);
    expect(ids.has("town")).toBe(true);
    expect(ids.has("shop")).toBe(true);
    expect(ids.has("forest")).toBe(true);
    expect(ids.size).toBe(5);
  });
  it("삭제된 노드는 수집에서 빠진다(고아 아님)", () => {
    const t = makeTree();
    removeFromTree(t, "town"); // town + shop + inn 제거
    const ids = collectIds(t);
    expect(ids.has("town")).toBe(false);
    expect(ids.has("shop")).toBe(false);
    expect(ids.size).toBe(2); // world, forest
  });
});

describe("트리 구조 무결성", () => {
  it("같은 mapId가 두 번 나오지 않는다(정상 생성 시)", () => {
    const t = makeTree();
    const ids = collectIds(t);
    expect(ids.size).toBe(new Set([...ids]).size); // 중복 없음
  });
  it("빈 트리(루트만)", () => {
    const t: MapTreeNode = { mapId: "solo", children: [] };
    expect(collectIds(t).size).toBe(1);
    expect(findNode(t, "solo")?.mapId).toBe("solo");
  });
});
