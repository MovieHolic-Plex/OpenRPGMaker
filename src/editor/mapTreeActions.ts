import type { MapId, MapTreeNode } from "@/project/types";

export function appendToTree(root: MapTreeNode, mapId: MapId, parentId?: MapId): void {
  if (parentId === undefined) {
    root.children.push({ mapId, children: [] });
    return;
  }
  const parent = findNode(root, parentId);
  if (parent) {
    parent.children.push({ mapId, children: [] });
  } else {
    root.children.push({ mapId, children: [] });
  }
}

export function removeFromTree(node: MapTreeNode, mapId: MapId): boolean {
  const before = node.children.length;
  node.children = node.children.filter((c) => c.mapId !== mapId);
  for (const c of node.children) {
    removeFromTree(c, mapId);
  }
  return node.children.length !== before;
}

function findNode(node: MapTreeNode, mapId: MapId): MapTreeNode | null {
  if (node.mapId === mapId) return node;
  for (const c of node.children) {
    const found = findNode(c, mapId);
    if (found) return found;
  }
  return null;
}
