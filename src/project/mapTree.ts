import type { MapId, MapTreeNode, Project } from "@/project/types";

export function appendToTree(root: MapTreeNode, mapId: MapId, parentId?: MapId): void {
  const node: MapTreeNode = { mapId, children: [] };
  if (insertTreeNode(root, node, parentId ?? "", undefined)) return;
  insertTreeNode(root, node, "", undefined);
}

export function removeFromTree(node: MapTreeNode, mapId: MapId): boolean {
  return extractTreeNode(node, mapId) !== null;
}

export function findTreeNode(node: MapTreeNode, mapId: MapId): MapTreeNode | null {
  if (node.mapId === mapId) return node;
  for (const child of node.children) {
    const found = findTreeNode(child, mapId);
    if (found) return found;
  }
  return null;
}

/** 루트 자식이면 루트 id, 루트 자신이면 null. */
export function findParentMapId(root: MapTreeNode, mapId: MapId): MapId | null {
  if (root.mapId === mapId) return null;
  for (const child of root.children) {
    if (child.mapId === mapId) return root.mapId;
    const found = findParentMapId(child, mapId);
    if (found !== null) return found;
  }
  return null;
}

export function extractTreeNode(root: MapTreeNode, mapId: MapId): MapTreeNode | null {
  if (root.mapId === mapId) return null;
  const index = root.children.findIndex((child) => child.mapId === mapId);
  if (index >= 0) {
    const [removed] = root.children.splice(index, 1);
    return removed ?? null;
  }
  for (const child of root.children) {
    const found = extractTreeNode(child, mapId);
    if (found) return found;
  }
  return null;
}

export function insertTreeNode(
  root: MapTreeNode,
  node: MapTreeNode,
  parentId: MapId | "",
  index?: number,
): boolean {
  const parent =
    parentId === "" || parentId === root.mapId ? root : findTreeNode(root, parentId);
  if (!parent) return false;
  if (containsMap(node, parent.mapId) && node.mapId !== parent.mapId) return false;
  const at = Math.max(0, Math.min(index ?? parent.children.length, parent.children.length));
  parent.children.splice(at, 0, node);
  return true;
}

export function canReparentMap(root: MapTreeNode, sourceId: MapId, parentId: MapId | ""): boolean {
  if (sourceId === root.mapId) return false;
  if (parentId === sourceId) return false;
  const source = findTreeNode(root, sourceId);
  if (!source) return false;
  if (parentId === "" || parentId === root.mapId) return true;
  const parent = findTreeNode(root, parentId);
  if (!parent) return false;
  return !containsMap(source, parentId);
}

export function containsMap(node: MapTreeNode, mapId: MapId): boolean {
  if (node.mapId === mapId) return true;
  return node.children.some((child) => containsMap(child, mapId));
}

export function siblingIndex(root: MapTreeNode, mapId: MapId): number {
  const parentId = findParentMapId(root, mapId);
  const parent = parentId === null ? null : parentId === root.mapId ? root : findTreeNode(root, parentId);
  if (!parent) return -1;
  return parent.children.findIndex((child) => child.mapId === mapId);
}

/** 삭제 후 선택할 이웃. 없으면 부모, 그것도 없으면 fallback. */
export function nextMapAfterRemoval(root: MapTreeNode, mapId: MapId, fallback: MapId): MapId {
  const parentId = findParentMapId(root, mapId);
  const parent = parentId === null ? root : parentId === root.mapId ? root : findTreeNode(root, parentId);
  if (!parent) return fallback;
  const index = parent.children.findIndex((child) => child.mapId === mapId);
  const after = parent.children[index + 1]?.mapId;
  if (after) return after;
  const before = parent.children[index - 1]?.mapId;
  if (before) return before;
  if (parent.mapId !== mapId) return parent.mapId;
  return fallback;
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
    node.children = node.children.filter((child) => maps[child.mapId] || isMapTreeFolder(child));
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

export function isMapTreeFolder(node: Pick<MapTreeNode, "kind" | "mapId">): boolean {
  return node.kind === "folder" || node.mapId.startsWith("folder_");
}

export function mapTreeNodeLabel(node: MapTreeNode, maps: Project["maps"]): string {
  if (isMapTreeFolder(node)) return node.name?.trim() || "분류";
  return maps[node.mapId]?.name?.trim() || node.mapId;
}

/** 선택 묶음에서 조상이 같이 선택된 후손은 제외한다. */
export function selectionRoots(root: MapTreeNode, ids: readonly MapId[]): MapId[] {
  const set = new Set(ids);
  return ids.filter((id) => {
    if (id === root.mapId) return false;
    const node = findTreeNode(root, id);
    if (!node) return false;
    for (const other of set) {
      if (other === id || other === root.mapId) continue;
      const otherNode = findTreeNode(root, other);
      if (otherNode && containsMap(otherNode, id)) return false;
    }
    return true;
  });
}

export function dissolveFolderKeepChildren(root: MapTreeNode, folderId: MapId): boolean {
  const folder = findTreeNode(root, folderId);
  if (!folder || !isMapTreeFolder(folder)) return false;
  const parentId = findParentMapId(root, folderId);
  const index = siblingIndex(root, folderId);
  const extracted = extractTreeNode(root, folderId);
  if (!extracted) return false;
  const insertParent = parentId === null || parentId === root.mapId ? "" : parentId;
  extracted.children.forEach((child, offset) => {
    insertTreeNode(root, child, insertParent, index + offset);
  });
  return true;
}

function walkMapTree(node: MapTreeNode, visit: (mapId: MapId) => void): void {
  visit(node.mapId);
  for (const child of node.children) walkMapTree(child, visit);
}
