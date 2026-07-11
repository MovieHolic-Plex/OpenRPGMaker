import type { MapId, MapTreeNode, Project } from "@/project/types";

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

/** 맵 트리에 등장하는 mapId 집합 (루트 포함). */
export function collectMapIdsInTree(node: MapTreeNode): Set<MapId> {
  const ids = new Set<MapId>();
  walkMapTree(node, (mapId) => {
    if (mapId) ids.add(mapId);
  });
  return ids;
}

/**
 * `project.maps`에는 있는데 `mapTree`에 없는 고아 맵을 루트 자식으로 붙인다.
 * 트리 루트가 비었거나 삭제된 맵이면 startMapId / 첫 맵으로 복구한다.
 *
 * UI 맵 목록은 mapTree만 순회하므로, 스크립트가 maps에만 넣으면 트리에 1개만 보인다.
 */
export function repairMapTreeOrphans(project: Pick<Project, "maps" | "mapTree" | "startMapId">): boolean {
  const mapIds = Object.keys(project.maps);
  if (mapIds.length === 0) return false;

  let changed = false;
  const maps = project.maps;

  // 죽은 자식 노드 제거 (재귀)
  const prune = (node: MapTreeNode): void => {
    const before = node.children.length;
    node.children = node.children.filter((child) => maps[child.mapId]);
    if (node.children.length !== before) changed = true;
    for (const child of node.children) prune(child);
  };
  prune(project.mapTree);

  // 루트가 유효하지 않으면 복구
  if (!project.mapTree.mapId || !maps[project.mapTree.mapId]) {
    const preferred =
      (project.startMapId && maps[project.startMapId] ? project.startMapId : null)
      ?? mapIds[0]!;
    const keptChildren = project.mapTree.children.filter((child) => child.mapId !== preferred);
    project.mapTree = { mapId: preferred, children: keptChildren };
    changed = true;
  }

  const inTree = collectMapIdsInTree(project.mapTree);
  for (const id of mapIds) {
    if (inTree.has(id)) continue;
    project.mapTree.children.push({ mapId: id, children: [] });
    inTree.add(id);
    changed = true;
  }
  return changed;
}

function walkMapTree(node: MapTreeNode, visit: (mapId: MapId) => void): void {
  visit(node.mapId);
  for (const child of node.children) walkMapTree(child, visit);
}

function findNode(node: MapTreeNode, mapId: MapId): MapTreeNode | null {
  if (node.mapId === mapId) return node;
  for (const c of node.children) {
    const found = findNode(c, mapId);
    if (found) return found;
  }
  return null;
}
