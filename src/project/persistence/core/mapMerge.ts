import type { GameMap, MapTreeNode, Project } from "../../types";
import { canonicalJsonString } from "./canonicalJson";

export type MapSaveConflict = {
  readonly mapId: string;
  readonly name: string;
};

export function changedMapIdsBetween(baseProject: Pick<Project, "maps" | "mapTree">, project: Pick<Project, "maps" | "mapTree">): readonly string[] {
  const mapIds = [...new Set([...Object.keys(baseProject.maps), ...Object.keys(project.maps)])]
    .filter((mapId) => mapSnapshot(baseProject.maps[mapId]) !== mapSnapshot(project.maps[mapId]));
  return [...new Set([...mapIds, ...changedMapTreeIdsBetween(baseProject.mapTree, project.mapTree)])];
}

export function mapSaveConflicts(
  baseProject: Pick<Project, "maps">,
  project: Pick<Project, "maps">,
  latestProject: Pick<Project, "maps">,
  changedMapIds: readonly string[],
): readonly MapSaveConflict[] {
  return changedMapIds
    .filter((mapId) => {
      const baseSnapshot = mapSnapshot(baseProject.maps[mapId]);
      const latestSnapshot = mapSnapshot(latestProject.maps[mapId]);
      const localSnapshot = mapSnapshot(project.maps[mapId]);
      return latestSnapshot !== baseSnapshot && latestSnapshot !== localSnapshot;
    })
    .map((mapId) => ({ mapId, name: mapConflictName(mapId, project, latestProject, baseProject) }));
}

export function mergeProjectMaps(
  latestProject: Pick<Project, "maps" | "mapTree">,
  project: Project,
  changedMapIds: readonly string[],
  changedMapTreeIds: readonly string[],
): Project {
  const mergedMaps = { ...latestProject.maps };
  for (const mapId of changedMapIds) {
    const map = project.maps[mapId];
    if (map) {
      mergedMaps[mapId] = map;
    } else {
      delete mergedMaps[mapId];
    }
  }
  return {
    ...project,
    maps: mergedMaps,
    mapTree: mergeMapTree(latestProject.mapTree, project.mapTree, changedMapTreeIds),
  };
}

export function changedMapTreeIdsBetween(baseTree: MapTreeNode, tree: MapTreeNode): readonly string[] {
  const baseLocations = mapTreeLocations(baseTree);
  const locations = mapTreeLocations(tree);
  return [...new Set([...baseLocations.keys(), ...locations.keys()])]
    .filter((mapId) => baseLocations.get(mapId) !== locations.get(mapId));
}

export function mapSnapshot(map: GameMap | undefined): string {
  return map ? canonicalJsonString(map) : "";
}

function mapTreeLocations(tree: MapTreeNode): Map<string, string> {
  const locations = new Map<string, string>();
  visitMapTreeLocations(tree, null, 0, locations);
  return locations;
}

function visitMapTreeLocations(
  node: MapTreeNode,
  parentId: string | null,
  index: number,
  locations: Map<string, string>,
): void {
  locations.set(node.mapId, `${parentId ?? ""}/${index}`);
  node.children.forEach((child, childIndex) => visitMapTreeLocations(child, node.mapId, childIndex, locations));
}

function mergeMapTree(latestTree: MapTreeNode, tree: MapTreeNode, changedMapIds: readonly string[]): MapTreeNode {
  return changedMapIds.reduce(
    (mergedTree, mapId) => mergeMapTreeNode(mergedTree, latestTree, tree, mapId),
    structuredClone(latestTree),
  );
}

function mergeMapTreeNode(
  mergedTree: MapTreeNode,
  latestTree: MapTreeNode,
  tree: MapTreeNode,
  mapId: string,
): MapTreeNode {
  const localPlacement = findMapTreePlacement(tree, mapId);
  const latestPlacement = findMapTreePlacement(latestTree, mapId);
  const treeWithoutNode = removeMapTreeNode(mergedTree, mapId);
  if (!localPlacement) return treeWithoutNode;
  const node = latestPlacement
    ? { ...structuredClone(latestPlacement.node), mapId }
    : structuredClone(localPlacement.node);
  return insertMapTreeNode(treeWithoutNode, localPlacement.parentId, localPlacement.index, node);
}

type MapTreePlacement = {
  readonly index: number;
  readonly node: MapTreeNode;
  readonly parentId: string | null;
};

function findMapTreePlacement(
  node: MapTreeNode,
  mapId: string,
  parentId: string | null = null,
  index = 0,
): MapTreePlacement | null {
  if (node.mapId === mapId) return { index, node, parentId };
  for (let childIndex = 0; childIndex < node.children.length; childIndex += 1) {
    const child = node.children[childIndex];
    if (!child) continue;
    const found = findMapTreePlacement(child, mapId, node.mapId, childIndex);
    if (found) return found;
  }
  return null;
}

function removeMapTreeNode(node: MapTreeNode, mapId: string): MapTreeNode {
  if (node.mapId === mapId) {
    return { ...node, children: node.children.filter((child) => child.mapId !== mapId).map((child) => removeMapTreeNode(child, mapId)) };
  }
  return {
    ...node,
    children: node.children
      .filter((child) => child.mapId !== mapId)
      .map((child) => removeMapTreeNode(child, mapId)),
  };
}

function insertMapTreeNode(node: MapTreeNode, parentId: string | null, index: number, childNode: MapTreeNode): MapTreeNode {
  if (parentId === null) return childNode;
  if (node.mapId === parentId) {
    const children = [...node.children];
    children.splice(Math.min(index, children.length), 0, childNode);
    return { ...node, children };
  }
  return { ...node, children: node.children.map((child) => insertMapTreeNode(child, parentId, index, childNode)) };
}

function mapConflictName(mapId: string, project: Pick<Project, "maps">, latestProject: Pick<Project, "maps">, baseProject: Pick<Project, "maps">): string {
  return project.maps[mapId]?.name ?? latestProject.maps[mapId]?.name ?? baseProject.maps[mapId]?.name ?? mapId;
}
