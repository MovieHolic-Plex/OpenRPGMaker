// 맵 묶음 분할·병합. 다중 에이전트가 각자 맵 하나씩 맡아 병렬로 일한 뒤 결과를 한 프로젝트로 합친다.
//
// 「맵 묶음」= 맵 + mapTree 에서 그 맵 아래 달린 부분 트리(실내 맵 등 파생 맵 포함).
// 집 시공이 실내 맵을 새로 만들면 부모 맵의 자식으로 단다(houseKitDomain). 그래서 `maps.<id>`
// 한 키만 복사하면 실내 맵과 mapTree 항목이 떨어진다 — 2026-09-09 스파이크에서 실측한 구멍.
//
// 병합은 base 를 기준으로 각 결과의 묶음만 옮긴다. 묶음 밖 변경은 버리고 `spills` 로 보고한다.
// 최종 무결성은 호출자가 commitChangeset 게이트로 확인한다(이 모듈은 게이트를 대신하지 않는다).

import type { MapTreeNode, Project } from "@/project/types";

export interface MapBundleResult {
  readonly mapIds: readonly string[];
  readonly project: Project;
}

export interface MapBundleSpill {
  readonly mapIds: readonly string[];
  /** 묶음 밖에서 바뀐 키. `maps.<id>` 또는 최상위 키. */
  readonly keys: readonly string[];
}

export interface MergeMapBundlesResult {
  readonly project: Project;
  readonly spills: readonly MapBundleSpill[];
  /** 둘 이상의 결과가 같은 맵을 묶음에 넣었다. 뒤의 결과가 이겼으니 호출자가 알려야 한다. */
  readonly conflicts: readonly string[];
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function findMapTreeNode(root: MapTreeNode | undefined, mapId: string): MapTreeNode | null {
  if (!root) return null;
  if (root.mapId === mapId) return root;
  for (const child of root.children ?? []) {
    const found = findMapTreeNode(child, mapId);
    if (found) return found;
  }
  return null;
}

function findMapTreeParent(root: MapTreeNode | undefined, mapId: string): MapTreeNode | null {
  if (!root) return null;
  for (const child of root.children ?? []) {
    if (child.mapId === mapId) return root;
    const found = findMapTreeParent(child, mapId);
    if (found) return found;
  }
  return null;
}

function collectTreeIds(node: MapTreeNode, out: string[]): void {
  out.push(node.mapId);
  for (const child of node.children ?? []) collectTreeIds(child, out);
}

/** 맵 + mapTree 부분 트리의 맵 id 들. 트리에 없는 맵은 자기 자신만. */
export function mapBundleIds(project: Project, mapId: string): string[] {
  const node = findMapTreeNode(project.mapTree, mapId);
  if (!node) return [mapId];
  const ids: string[] = [];
  collectTreeIds(node, ids);
  return ids;
}

function pruneSubtrees(node: MapTreeNode, roots: ReadonlySet<string>): MapTreeNode {
  return {
    ...node,
    children: (node.children ?? []).filter((child) => !roots.has(child.mapId)).map((child) => pruneSubtrees(child, roots)),
  };
}

/** 묶음 밖에서 달라진 키. 범위를 벗어난 에이전트를 잡아내는 감사용. */
export function mapBundleSpill(base: Project, result: Project, mapIds: readonly string[]): string[] {
  const roots = new Set(mapIds);
  const bundle = new Set<string>();
  for (const id of mapIds) {
    for (const bid of mapBundleIds(result, id)) bundle.add(bid);
    for (const bid of mapBundleIds(base, id)) bundle.add(bid);
  }
  const spill: string[] = [];
  const keys = new Set([...Object.keys(base), ...Object.keys(result)]);
  for (const key of keys) {
    if (key === "maps") {
      const ids = new Set([...Object.keys(base.maps ?? {}), ...Object.keys(result.maps ?? {})]);
      for (const id of ids) {
        if (bundle.has(id)) continue;
        if (JSON.stringify(base.maps?.[id]) !== JSON.stringify(result.maps?.[id])) spill.push(`maps.${id}`);
      }
      continue;
    }
    if (key === "mapTree") {
      const a = base.mapTree ? pruneSubtrees(base.mapTree, roots) : undefined;
      const b = result.mapTree ? pruneSubtrees(result.mapTree, roots) : undefined;
      if (JSON.stringify(a) !== JSON.stringify(b)) spill.push("mapTree");
      continue;
    }
    const a = (base as unknown as Record<string, unknown>)[key];
    const b = (result as unknown as Record<string, unknown>)[key];
    if (JSON.stringify(a) !== JSON.stringify(b)) spill.push(key);
  }
  return spill.sort();
}

function replaceOrAttachSubtree(mergedRoot: MapTreeNode, resultRoot: MapTreeNode | undefined, mapId: string): void {
  const resultNode = findMapTreeNode(resultRoot, mapId);
  const mergedParent = findMapTreeParent(mergedRoot, mapId);
  if (!resultNode) {
    // 에이전트가 트리에서 맵을 뺐다 — 묶음 소유자니 그대로 따른다.
    if (mergedParent) mergedParent.children = mergedParent.children.filter((child) => child.mapId !== mapId);
    return;
  }
  const replacement = clone(resultNode);
  if (mergedParent) {
    mergedParent.children = mergedParent.children.map((child) => (child.mapId === mapId ? replacement : child));
    return;
  }
  if (mergedRoot.mapId === mapId) {
    mergedRoot.children = replacement.children;
    return;
  }
  // base 트리에 없던 맵: 결과 트리의 부모가 병합 트리에 있으면 그 밑에, 아니면 루트에 단다.
  const resultParent = findMapTreeParent(resultRoot, mapId);
  const target = (resultParent && findMapTreeNode(mergedRoot, resultParent.mapId)) ?? mergedRoot;
  target.children = [...(target.children ?? []), replacement];
}

/** base 에 각 결과의 맵 묶음만 얹는다. 같은 맵을 두 결과가 주장하면 뒤의 것이 이긴다. */
export function mergeMapBundles(base: Project, results: readonly MapBundleResult[]): MergeMapBundlesResult {
  const merged = clone(base);
  const spills: MapBundleSpill[] = [];
  const claimed = new Set<string>();
  const conflicts = new Set<string>();
  for (const result of results) {
    const keys = mapBundleSpill(base, result.project, result.mapIds);
    if (keys.length > 0) spills.push({ mapIds: result.mapIds, keys });
    const bundle = new Set<string>();
    for (const id of result.mapIds) {
      for (const bid of mapBundleIds(result.project, id)) bundle.add(bid);
      for (const bid of mapBundleIds(base, id)) bundle.add(bid);
    }
    for (const id of bundle) {
      if (claimed.has(id)) conflicts.add(id);
      claimed.add(id);
      const row = result.project.maps?.[id];
      if (row) merged.maps[id] = clone(row);
      else delete merged.maps[id];
    }
    if (merged.mapTree) {
      for (const id of result.mapIds) replaceOrAttachSubtree(merged.mapTree, result.project.mapTree, id);
    }
  }
  return { project: merged, spills, conflicts: [...conflicts].sort() };
}
